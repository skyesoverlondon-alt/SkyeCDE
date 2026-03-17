const { query } = require("./_db");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
function cleanUrl(u){
  u = String(u||"").trim();
  if(!u) return "";
  if(!/^https?:\/\//i.test(u)) throw new Error("idp_sso_url must be https://");
  return u;
}

function normalizeCert(pem){
  pem = String(pem||"").trim();
  if(!pem) return "";
  if(pem.includes("BEGIN CERTIFICATE")) return pem;
  // allow raw base64
  const b64 = pem.replace(/[\r\n\s]/g, "");
  return `-----BEGIN CERTIFICATE-----\n${b64.match(/.{1,64}/g).join("\n")}\n-----END CERTIFICATE-----`;
}

exports.handler = async (event) => {
  try{
    requireMethod(event, "POST");
    if((event.httpMethod||"GET").toUpperCase() !== "POST"){
      return json(405, { error: "Method not allowed" });
    }

    const auth = await verifyAuthSession(event);
    requireCsrf(event);
    const userId = auth.sub;

    const u = await query(`select org_id from users where id=$1 limit 1`, [userId]);
    const orgId = u.rows.length ? u.rows[0].org_id : null;
    if(!orgId) return json(400, { error: "No organization found" });

    const m = await query(`select role from org_members where org_id=$1 and user_id=$2 limit 1`, [orgId, userId]);
    if(!m.rows.length || m.rows[0].role !== "owner"){
      return json(403, { error: "Owner role required" });
    }

    const body = parseJson(event);
    const enabled = !!body.enabled;
    const idp_entity_id = String(body.idp_entity_id||"").trim();
    const idp_sso_url = cleanUrl(body.idp_sso_url);
    const sp_entity_id = String(body.sp_entity_id||"").trim();
    const slug = String(body.slug||"").trim().toLowerCase();
    const idp_x509_cert_pem = normalizeCert(body.idp_x509_cert_pem || "");
    const want_assertions_signed = body.want_assertions_signed !== false;
    const want_response_signed = !!body.want_response_signed;

    if(enabled){
      if(!(want_assertions_signed || want_response_signed)) return json(400, { error: "At least one signature requirement must be enabled (assertion or response)." });
      if(!idp_entity_id) return json(400, { error: "idp_entity_id required" });
      if(!idp_sso_url) return json(400, { error: "idp_sso_url required" });
      if(!sp_entity_id) return json(400, { error: "sp_entity_id required" });
      if(!idp_x509_cert_pem) return json(400, { error: "idp_x509_cert_pem required for signature validation" });
      if(!slug || !/^[a-z0-9][a-z0-9-]{2,50}$/.test(slug)) return json(400, { error: "Valid org slug required (3-50 chars, a-z0-9-)" });
    }

    if(slug){
      await query(`update organizations set slug=$1 where id=$2`, [slug, orgId]);
    }

    await query(
      `insert into saml_configs(org_id, enabled, idp_entity_id, idp_sso_url, sp_entity_id, idp_x509_cert_pem, want_assertions_signed, want_response_signed, updated_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,now())
       on conflict(org_id) do update set enabled=$2, idp_entity_id=$3, idp_sso_url=$4, sp_entity_id=$5, idp_x509_cert_pem=$6, want_assertions_signed=$7, want_response_signed=$8, updated_at=now()`,
      [orgId, enabled, idp_entity_id, idp_sso_url, sp_entity_id, idp_x509_cert_pem, want_assertions_signed, want_response_signed]
    );

    return json(200, { ok:true });
  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
