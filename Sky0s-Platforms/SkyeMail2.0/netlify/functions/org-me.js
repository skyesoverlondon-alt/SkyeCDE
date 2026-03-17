const { query } = require("./_db");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
exports.handler = async (event) => {try{
    requireMethod(event, "GET");
    const auth = await verifyAuthSession(event);
    const userId = auth.sub;

    const u = await query(`select org_id from users where id=$1 limit 1`, [userId]);
    const orgId = u.rows.length ? u.rows[0].org_id : null;
    if(!orgId) return json(200, { org: null, members: [] });

    const o = await query(`select id, name, created_at from organizations where id=$1 limit 1`, [orgId]);
    const org = o.rows.length ? o.rows[0] : null;

    const m = await query(
      `select om.role, om.created_at, u.id as user_id, u.handle, u.email
       from org_members om
       join users u on u.id=om.user_id
       where om.org_id=$1
       order by (case om.role when 'owner' then 0 when 'admin' then 1 else 2 end), u.created_at asc`,
      [orgId]
    );

    return json(200, { org, members: m.rows });
  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
