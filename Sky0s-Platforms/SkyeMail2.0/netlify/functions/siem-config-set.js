const { query } = require("./_db");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
const { requireOrgRole } = require("./_rbac");
const { kmsEncryptToB64, configKmsKeyId } = require("./_kms");

exports.handler = async (event) => {
  try{
    requireMethod(event, "POST");
    if((event.httpMethod||"GET").toUpperCase() !== "POST") return json(405, { error:"Method not allowed" });

    const auth = await verifyAuthSession(event);
    requireCsrf(event);
    const userId = auth.sub;
    const { org } = await requireOrgRole(userId, ["owner","admin"]);

    const body = parseJson(event);
    const enabled = !!body.enabled;
    const provider = String(body.provider || "splunk").toLowerCase();
    const endpoint = String(body.endpoint || "").trim();
    const token = String(body.token || "").trim();

    if(!["splunk","datadog"].includes(provider)) return json(400, { error:"provider must be splunk or datadog" });
    if(!endpoint) return json(400, { error:"endpoint required" });
    if(!token) return json(400, { error:"token required" });

    const token_enc = await kmsEncryptToB64(token, configKmsKeyId());

    await query(
      `insert into siem_configs(org_id, enabled, provider, endpoint, token_enc, updated_at)
       values($1,$2,$3,$4,$5,now())
       on conflict(org_id) do update set enabled=$2, provider=$3, endpoint=$4, token_enc=$5, updated_at=now()`,
      [org.id, enabled, provider, endpoint, token_enc]
    );

    return json(200, { ok:true });

  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
