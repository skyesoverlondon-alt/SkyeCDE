const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createRemoteJWKSet, jwtVerify, decodeJwt } = require("jose");
const { query } = require("./_db");
const { recordAudit } = require("./_audit");
const { requireMethod, json, parseCookies, cookie, issueAuthCookies, requireEnv, randomToken, getClientIp, hashIp } = require("./_utils");
const { kmsDecryptFromB64, kmsEncryptToB64 } = require("./_kms");

function b64url(buf){
  return Buffer.from(buf).toString("base64").replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function sha256Hex(s){
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}
function siteBase(){
  return process.env.PUBLIC_BASE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL || "";
}
async function fetchWellKnown(issuer){
  const url = issuer.replace(/\/+$/,'') + "/.well-known/openid-configuration";
  const res = await fetch(url, { headers:{ "Accept":"application/json" } });
  if(!res.ok) throw new Error("OIDC discovery failed: " + res.status);
  return res.json();
}
function parseAllowedDomains(csv){
  if(!csv) return [];
  return String(csv).split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
}

function parseAllowedTenants(csv){
  if(!csv) return [];
  return String(csv).split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
}
function isEntraIssuer(issuer){
  return /login\.microsoftonline\.com/i.test(issuer || "");
}
function issuerForDiscovery(issuer){
  // Allow templates like https://login.microsoftonline.com/{tenant}/v2.0
  let x = String(issuer||"");
  x = x.replace(/\{tenantid\}/ig, "common").replace(/\{tenant\}/ig, "common");
  return x.replace(/\/+$/, "");
}
function entraEffectiveIssuerAndJwks(configIssuer, tid, wk){
  // For multi-tenant Entra apps, id_token iss is tenant-specific: https://login.microsoftonline.com/<tid>/v2.0
  const base = String(configIssuer||"").replace(/\/+$/, "");
  const m = base.match(/login\.microsoftonline\.com\/([^\/]+)\/v2\.0$/i);
  if(!m) return { issuer: base, jwks_uri: wk.jwks_uri };
  const part = String(m[1]||"").toLowerCase();
  const multi = (part === "common" || part === "organizations" || part === "consumers" || /\{tenant/.test(base));
  if(!multi) return { issuer: base, jwks_uri: wk.jwks_uri };
  if(!tid) throw new Error("Missing tid claim in id_token (Entra multi-tenant).");
  const issuer = `https://login.microsoftonline.com/${tid}/v2.0`;
  const jwks_uri = `https://login.microsoftonline.com/${tid}/discovery/v2.0/keys`;
  return { issuer, jwks_uri };
}
function makeHandle(email){
  const base = String(email||"user").split("@")[0].replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').toLowerCase();
  return (base || "user").slice(0,24);
}
const cryptoNode = require("crypto");
function genKeypair(){
  const { publicKey, privateKey } = cryptoNode.generateKeyPairSync("rsa", {
    modulusLength: 3072,
    publicKeyEncoding: { type:"spki", format:"pem" },
    privateKeyEncoding: { type:"pkcs8", format:"pem" }
  });
  return { publicKeyPem: publicKey, privateKeyPem: privateKey };
}

exports.handler = async (event) => {
  try{
    requireMethod(event, "GET");
    const qs = event.queryStringParameters || {};
    const code = String(qs.code || "");
    const state = String(qs.state || "");
    if(!code || !state) return json(400, { error:"Missing code/state" });

    const cookies = parseCookies(event);
    const cookieState = String(cookies.SMV_OIDC_STATE || "");
    if(!cookieState || cookieState !== state) return json(400, { error:"State validation failed" });

    const state_hash = sha256Hex(state);
    const st = await query(
      `select os.org_id, os.code_verifier, os.nonce, os.redirect_uri, os.expires_at,
              c.enabled, c.issuer, c.client_id, c.client_secret_enc, c.scopes, c.allowed_domains_csv,
              c.allowed_tenants_csv,
              o.kms_key_id, o.session_max_days, coalesce(o.require_sso,false) as require_sso
       from oidc_states os
       join oidc_configs c on c.org_id=os.org_id
       join organizations o on o.id=os.org_id
       where os.state_hash=$1
       limit 1`,
      [state_hash]
    );
    if(!st.rows.length) return json(400, { error:"Invalid/expired state" });

    const row = st.rows[0];
    const exp = row.expires_at ? new Date(row.expires_at).getTime() : 0;
    if(exp && exp < Date.now()) return json(400, { error:"Invalid/expired state" });

    // One-time use
    await query(`delete from oidc_states where state_hash=$1`, [state_hash]);

    if(!row.enabled) return json(400, { error:"OIDC not enabled" });
    if(!row.kms_key_id) return json(500, { error:"Organization KMS key not configured" });

    const issuer_cfg = String(row.issuer);
    const issuer_discovery = issuerForDiscovery(issuer_cfg);
    const wk = await fetchWellKnown(issuer_discovery);

    const client_secret = await kmsDecryptFromB64(row.client_secret_enc);

    const form = new URLSearchParams();
    form.set("grant_type","authorization_code");
    form.set("code", code);
    form.set("redirect_uri", row.redirect_uri);
    form.set("client_id", row.client_id);
    form.set("client_secret", client_secret);
    form.set("code_verifier", row.code_verifier);

    const tokRes = await fetch(wk.token_endpoint, {
      method:"POST",
      headers:{ "Content-Type":"application/x-www-form-urlencoded" },
      body: form.toString()
    });
    const tok = await tokRes.json().catch(()=> ({}));
    if(!tokRes.ok) throw new Error("Token exchange failed: " + tokRes.status);

    const id_token = tok.id_token;
    if(!id_token) throw new Error("Missing id_token");

    // Entra multi-tenant issuer pattern support (tenant-specific iss)
    const unverified = decodeJwt(id_token);
    const tid = String(unverified.tid || "").trim();
    const allowTenants = parseAllowedTenants(row.allowed_tenants_csv);
    if(allowTenants.length && tid){
      if(!allowTenants.includes(tid.toLowerCase())) throw new Error("Tenant not allowed");
    }else if(allowTenants.length && !tid){
      throw new Error("Missing tid claim (required by allowed_tenants_csv).");
    }

    const eff = (isEntraIssuer(issuer_cfg) ? entraEffectiveIssuerAndJwks(issuer_cfg, tid, wk) : { issuer: issuer_cfg, jwks_uri: wk.jwks_uri });

    const JWKS = createRemoteJWKSet(new URL(eff.jwks_uri));
    const { payload } = await jwtVerify(id_token, JWKS, {
      issuer: eff.issuer,
      audience: row.client_id
    });

    if(String(payload.nonce || "") !== String(row.nonce || "")){
      throw new Error("Nonce validation failed");
    }

    const email = String(payload.email || payload.preferred_username || payload.upn || "").trim().toLowerCase();
    if(!email || !email.includes("@")) throw new Error("No email claim in id_token");

    const allow = parseAllowedDomains(row.allowed_domains_csv);
    if(allow.length){
      const dom = email.split("@")[1].toLowerCase();
      if(!allow.includes(dom)) throw new Error("Email domain not allowed");
    }

    // Upsert user
    let user = await query(`select id, handle, email, is_active, org_id from users where lower(email)=lower($1) limit 1`, [email]);
    let userId;
    let handle;

    if(user.rows.length){
      const u = user.rows[0];
      if(u.org_id && String(u.org_id) !== String(row.org_id)){
        throw new Error("User belongs to another organization");
      }
      if(u.is_active === false){
        await recordAudit(event, u.id, "OIDC_LOGIN_BLOCKED_DEACTIVATED", "user", u.id, { email });
        throw new Error("Account is deactivated");
      }
      userId = u.id;
      handle = u.handle;
      if(!u.org_id){
        await query(`update users set org_id=$2 where id=$1`, [userId, row.org_id]);
        await query(`insert into org_members(org_id, user_id, role) values($1,$2,'viewer') on conflict do nothing`, [row.org_id, userId]);
      }
    }else{
      const rand = crypto.randomBytes(24).toString("base64url");
      const password_hash = await bcrypt.hash(rand, 12);
      handle = makeHandle(email);
      for(let i=0;i<20;i++){
        const h = i===0 ? handle : (handle + "-" + crypto.randomBytes(2).toString("hex"));
        const c = await query(`select 1 from users where org_id=$1 and lower(handle)=lower($2) limit 1`, [row.org_id, h]);
        if(!c.rows.length){ handle=h; break; }
      }

      const ins = await query(
        `insert into users(handle, email, password_hash, org_id, is_active, email_verified, email_verified_at)
         values($1,$2,$3,$4,true,true,now()) returning id`,
        [handle, email, password_hash, row.org_id]
      );
      userId = ins.rows[0].id;
      await query(`insert into org_members(org_id, user_id, role) values($1,$2,'viewer') on conflict do nothing`, [row.org_id, userId]);

      // Provision KMS keyring
      const kp = genKeypair();
      const wrapped = await kmsEncryptToB64(kp.privateKeyPem, row.kms_key_id);
      await query(
        `insert into user_keys(user_id, version, is_active, rsa_public_key_pem, vault_wrap_json, kms_wrapped_private_key_b64)
         values($1,1,true,$2,$3,$4)`,
        [userId, kp.publicKeyPem, JSON.stringify({mode:"KMS"}), wrapped]
      );
    }

    const secret = requireEnv("JWT_SECRET");
    const maxDays = Number(row.session_max_days || 14);
    const jti = randomToken(24);
    const token = jwt.sign({ sub: userId, handle, email }, secret, { expiresIn: `${maxDays}d`, jwtid: jti });
    const csrf = randomToken(18);

    const ua = (event.headers && (event.headers["user-agent"] || event.headers["User-Agent"])) ? String(event.headers["user-agent"] || event.headers["User-Agent"]) : "";
    const ip = getClientIp(event);
    const ip_hash = (() => { try { return hashIp(ip); } catch(e){ return null; } })();
    const expiresAt = new Date(Date.now() + maxDays*24*60*60*1000);

    await query(
      `insert into sessions(user_id, jti, expires_at, ip_hash, user_agent)
       values($1,$2,$3,$4,$5)`,
      [userId, jti, expiresAt.toISOString(), ip_hash, ua]
    );

    const cookiesOut = issueAuthCookies({ token, csrf });
    // clear oidc state cookie
    cookiesOut.push(cookie("SMV_OIDC_STATE","", { httpOnly:true, expires: new Date(0), sameSite:"Lax", path:"/sso/oidc/callback" }));

    await recordAudit(event, userId, "OIDC_LOGIN_SUCCESS", "user", userId, { email, jti, org_id: row.org_id });

    const dest = siteBase().replace(/\/+$/,'') + "/dashboard.html";
    return {
      statusCode: 302,
      headers: { Location: dest },
      multiValueHeaders: { "Set-Cookie": cookiesOut }
    };

  }catch(err){
    return json(500, { error: err.message || "Server error" });
  }
};
