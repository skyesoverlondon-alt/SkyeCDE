const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { SAML } = require("@node-saml/node-saml");
const { query } = require("./_db");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod, getSiteUrl} = require("./_utils");
function b64decodeUtf8(s){
  return Buffer.from(String(s||""), "base64").toString("utf8");
}

function parseFormUrlEncoded(body){
  const out = {};
  try{
    const p = new URLSearchParams(String(body||""));
    for(const [k,v] of p.entries()){ out[k]=v; }
  }catch(e){}
  return out;
}


function pick(rex, xml){
  const m = xml.match(rex);
  return m ? String(m[1]||"").trim() : "";
}

function dbCacheProvider(){
  return {
    save: async (key, value, cb) => { try{ cb(null, value); }catch(e){} },
    get: async (key, cb) => {
      try{
        const r = await query(
          `select request_id, expires_at, used_at
           from saml_requests
           where request_id=$1
           limit 1`,
          [key]
        );
        if(!r.rows.length) return cb(null, null);
        const row = r.rows[0];
        if(row.used_at) return cb(null, null);
        const exp = row.expires_at ? Date.parse(row.expires_at) : 0;
        if(exp && exp < Date.now()) return cb(null, null);
        return cb(null, row.request_id);
      }catch(e){
        return cb(null, null);
      }
    },
    remove: async (key, cb) => { try{ cb(null, true); }catch(e){} }
  };
}

exports.handler = async (event) => {
  try{
    if((event.httpMethod||"GET").toUpperCase() !== "POST"){
      return json(405, { error: "Method not allowed" });
    }

    const base = getSiteUrl();
    if(!base) return json(500, { error: "PUBLIC_BASE_URL (or Netlify URL) missing" });

    const form = parseFormUrlEncoded(event.body || "");
    const samlResponseB64 = form.SAMLResponse || "";
    const relayState = form.RelayState || "";

    if(!samlResponseB64) return json(400, { error: "Missing SAMLResponse" });

    // Extract InResponseTo quickly to enforce SP-initiated and locate org config.
    const xml = b64decodeUtf8(samlResponseB64);
    const inResponseTo = pick(/InResponseTo="([^"]+)"/i, xml);
    if(!inResponseTo) return json(400, { error: "Missing InResponseTo (SP-initiated required)" });

    const req = await query(
      `select sr.org_id, sr.expires_at, sr.used_at, sc.enabled, sc.idp_entity_id, sc.idp_sso_url, sc.sp_entity_id, sc.idp_x509_cert_pem, sc.want_assertions_signed, sc.want_response_signed
       from saml_requests sr
       join saml_configs sc on sc.org_id=sr.org_id
       where sr.request_id=$1
       limit 1`,
      [inResponseTo]
    );
    if(!req.rows.length) return json(400, { error: "Unsolicited response rejected (IdP-initiated not allowed)" });

    const r = req.rows[0];
    if(!r.enabled) return json(400, { error: "SAML not enabled" });
    if(r.used_at) return json(400, { error: "SAML response already used" });

    const expAt = r.expires_at ? Date.parse(r.expires_at) : 0;
    if(expAt && expAt < Date.now()){
      return json(400, { error: "SAML request expired" });
    }

    if(!r.idp_x509_cert_pem) return json(400, { error: "IdP certificate not configured (signature validation required)" });

    if(!( (r.want_assertions_signed !== false) || !!r.want_response_signed )){
      // safety default
      r.want_assertions_signed = true;
      r.want_response_signed = false;
    }

    const acsUrl = `${base}/sso/saml/acs`;

    const saml = new SAML({
      issuer: r.sp_entity_id,
      callbackUrl: acsUrl,
      entryPoint: r.idp_sso_url,
      idpIssuer: r.idp_entity_id,
      cert: r.idp_x509_cert_pem,
      validateInResponseTo: true,
      requestIdExpirationPeriodMs: 5 * 60 * 1000,
      cacheProvider: dbCacheProvider(),
      wantAssertionsSigned: (r.want_assertions_signed !== false),
      wantAuthnResponseSigned: !!r.want_response_signed,
      acceptedClockSkewMs: 2 * 60 * 1000
    });

    const { profile } = await saml.validatePostResponse({ SAMLResponse: samlResponseB64 });

    const nameId = String(profile && profile.nameID ? profile.nameID : "").trim().toLowerCase();
    if(!nameId || !nameId.includes("@")) return json(400, { error: "Missing/invalid NameID email" });

    // Mark request used
    await query(`update saml_requests set used_at=now() where request_id=$1`, [inResponseTo]);

    // User must exist (SCIM/SSO provisioning is separate)
    const u = await query(
      `select id, handle, email, org_id, email_verified, is_active
       from users where lower(email)=lower($1) limit 1`,
      [nameId]
    );

    if(!u.rows.length){
      return {
        statusCode: 302,
        headers: { "Location": "/login.html?err=not_provisioned", "Cache-Control":"no-store" },
        body: ""
      };
    }

    const user = u.rows[0];
    if(user.is_active === false){
      return { statusCode: 302, headers: { "Location": "/login.html?err=deactivated", "Cache-Control":"no-store" }, body: "" };
    }

    if(String(user.org_id) !== String(r.org_id)){
      return json(403, { error: "User not in this organization" });
    }

    if(!user.email_verified){
      await query(`update users set email_verified=true, email_verified_at=now() where id=$1`, [user.id]);
    }

    const secret = requireEnv("JWT_SECRET");
    const token = jwt.sign({ sub: user.id, handle: user.handle, email: user.email }, secret, { expiresIn: "14d" });
    const csrf = crypto.randomBytes(18).toString("base64url");
    const cookies = issueAuthCookies({ token, csrf });

    return {
      statusCode: 302,
      headers: { "Location": "/dashboard.html", "Cache-Control":"no-store" },
      multiValueHeaders: { "Set-Cookie": cookies },
      body: ""
    };

  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
