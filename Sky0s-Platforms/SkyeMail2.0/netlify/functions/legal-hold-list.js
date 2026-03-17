const { query } = require("./_db");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
const { requireOrgRole } = require("./_rbac");

exports.handler = async (event) => {try{
    requireMethod(event, "GET");
    const auth = await verifyAuthSession(event);
    const { org } = await requireOrgRole(auth.sub, ["owner","admin"]);

    const r = await query(
      `select id, scope, scope_id, reason, created_by, created_at, released_at
       from legal_holds
       where org_id=$1
       order by created_at desc
       limit 200`,
      [org.id]
    );

    return json(200, { items: r.rows });
  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
