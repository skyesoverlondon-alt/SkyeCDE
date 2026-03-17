const { query } = require("./_db");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
const { requireOrgRole } = require("./_rbac");

exports.handler = async (event) => {try{
    requireMethod(event, "GET");
    const auth = await verifyAuthSession(event);
    const { org } = await requireOrgRole(auth.sub, ["owner","admin"]);

    const r = await query(`select action, patterns_json, updated_at from dlp_policies where org_id=$1 limit 1`, [org.id]);
    if(!r.rows.length) return json(200, { action:"off", patterns:[], updated_at:null });

    return json(200, { action:r.rows[0].action, patterns: JSON.parse(r.rows[0].patterns_json||"[]"), updated_at: r.rows[0].updated_at });
  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
