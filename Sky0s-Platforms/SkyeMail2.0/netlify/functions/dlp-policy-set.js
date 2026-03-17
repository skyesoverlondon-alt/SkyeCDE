const { query } = require("./_db");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
const { requireOrgRole } = require("./_rbac");

exports.handler = async (event) => {
  try{
    requireMethod(event, "POST");
    if((event.httpMethod||"GET").toUpperCase() !== "POST") return json(405, { error:"Method not allowed" });

    const auth = await verifyAuthSession(event);
    requireCsrf(event);
    const { org } = await requireOrgRole(auth.sub, ["owner","admin"]);

    const body = parseJson(event);
    const action = String(body.action || "off");
    const patterns = body.patterns;

    if(!["off","warn","block"].includes(action)) return json(400, { error:"action must be off|warn|block" });
    if(!Array.isArray(patterns)) return json(400, { error:"patterns must be an array" });

    const patterns_json = JSON.stringify(patterns).slice(0, 20000);

    await query(
      `insert into dlp_policies(org_id, action, patterns_json, updated_at)
       values($1,$2,$3,now())
       on conflict(org_id) do update set action=$2, patterns_json=$3, updated_at=now()`,
      [org.id, action, patterns_json]
    );

    return json(200, { ok:true });
  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
