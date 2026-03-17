const { query } = require("./_db");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
const { requireOrgRole } = require("./_rbac");

exports.handler = async (event) => {try{
    requireMethod(event, "GET");
    const auth = await verifyAuthSession(event);
    const userId = auth.sub;
    const { org } = await requireOrgRole(userId, ["owner","admin"]);

    const r = await query(`select enabled, provider, endpoint, updated_at from siem_configs where org_id=$1 limit 1`, [org.id]);
    if(!r.rows.length) return json(200, { enabled:false, provider:"splunk", endpoint:"", updated_at:null, token_set:false });

    const cfg = r.rows[0];
    const t = await query(`select token_enc from siem_configs where org_id=$1 limit 1`, [org.id]);
    const token_set = !!(t.rows.length && t.rows[0].token_enc);

    return json(200, { ...cfg, token_set });

  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
