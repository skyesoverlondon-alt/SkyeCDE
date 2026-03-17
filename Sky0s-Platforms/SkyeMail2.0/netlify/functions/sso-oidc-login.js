const crypto = require("crypto");
const { query } = require("./_db");
const { requireMethod, json, cookie } = require("./_utils");

function b64url(buf){
  return Buffer.from(buf).toString("base64").replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function sha256Hex(s){
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}
function sha256B64url(s){
  const h = crypto.createHash("sha256").update(String(s)).digest();
  return b64url(h);
}
function siteBase(){
  return process.env.PUBLIC_BASE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL || "";
}


function issuerForDiscovery(issuer){
  let x = String(issuer||"").trim();
  x = x.replace(/\{tenantid\}/ig, "common").replace(/\{tenant\}/ig, "common");
  return x.replace(/\/+$/,'');
}
async function fetchWellKnown(issuer){
  const url = issuer.replace(/\/+$/,'') + "/.well-known/openid-configuration";
  const res = await fetch(url, { headers:{ "Accept":"application/json" } });
  if(!res.ok) throw new Error("OIDC discovery failed: " + res.status);
  return res.json();
}

exports.handler = async (event) => {
  try{
    requireMethod(event, "GET");
    const qs = event.queryStringParameters || {};
    const slug = String(qs.org || "").trim().toLowerCase();
    if(!slug) return json(400, { error:"org required" });

    const cfg = await query(
      `select o.id as org_id, o.slug, o.key_management_mode,
              c.enabled, c.issuer, c.client_id, c.scopes, c.allowed_domains_csv
       from organizations o
       join oidc_configs c on c.org_id=o.id
       where lower(o.slug)=lower($1)
       limit 1`,
      [slug]
    );
    if(!cfg.rows.length || !cfg.rows[0].enabled) return json(404, { error:"OIDC not configured." });
    if(cfg.rows[0].key_management_mode !== "kms") return json(409, { error:"Org requires KMS mode for OIDC." });

    const issuer = String(cfg.rows[0].issuer);
    const issuer_disc = issuerForDiscovery(issuer);
    const wk = await fetchWellKnown(issuer_disc);

    const state = b64url(crypto.randomBytes(18));
    const nonce = b64url(crypto.randomBytes(18));
    const code_verifier = b64url(crypto.randomBytes(32));
    const code_challenge = sha256B64url(code_verifier);

    const redirect_uri = siteBase().replace(/\/+$/,'') + "/sso/oidc/callback";
    const expiresAt = new Date(Date.now() + 10*60*1000);

    await query(
      `insert into oidc_states(org_id, state_hash, code_verifier, nonce, redirect_uri, expires_at)
       values($1,$2,$3,$4,$5,$6)`,
      [cfg.rows[0].org_id, sha256Hex(state), code_verifier, nonce, redirect_uri, expiresAt.toISOString()]
    );

    const authUrl = new URL(wk.authorization_endpoint);
    authUrl.searchParams.set("response_type","code");
    authUrl.searchParams.set("client_id", cfg.rows[0].client_id);
    authUrl.searchParams.set("redirect_uri", redirect_uri);
    authUrl.searchParams.set("scope", cfg.rows[0].scopes || "openid email profile");
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("nonce", nonce);
    authUrl.searchParams.set("code_challenge", code_challenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    const cookies = [
      cookie("SMV_OIDC_STATE", state, { httpOnly:true, maxAge: 600, sameSite:"Lax", path:"/sso/oidc/callback" })
    ];

    return {
      statusCode: 302,
      headers: { Location: authUrl.toString() },
      multiValueHeaders: { "Set-Cookie": cookies }
    };
  }catch(err){
    return json(500, { error: err.message || "Server error" });
  }
};
