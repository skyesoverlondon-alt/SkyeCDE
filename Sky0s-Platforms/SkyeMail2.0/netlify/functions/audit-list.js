const { query } = require("./_db");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
exports.handler = async (event) => {try{
    requireMethod(event, "GET");
    const auth = await verifyAuthSession(event);
    const userId = auth.sub;

    const u = await query(`select org_id from users where id=$1 limit 1`, [userId]);
    const orgId = u.rows.length ? u.rows[0].org_id : null;
    if(!orgId) return json(200, { items: [] });

    const m = await query(`select role from org_members where org_id=$1 and user_id=$2 limit 1`, [orgId, userId]);
    if(!m.rows.length) return json(403, { error: "Forbidden" });

    const qs = event.queryStringParameters || {};
    const limit = Math.max(1, Math.min(500, Number(qs.limit || 200)));
    const before = qs.before ? String(qs.before) : "";

    let res;
    if(before){
      res = await query(
        `select a.id, a.created_at, a.action, a.target_type, a.target_id, a.ip_hash, a.user_agent, a.meta_json,
                u.handle as actor_handle, u.email as actor_email
         from audit_events a
         left join users u on u.id=a.actor_user_id
         where a.org_id=$1 and a.created_at < $2::timestamptz
         order by a.created_at desc
         limit ${limit}`,
        [orgId, before]
      );
    }else{
      res = await query(
        `select a.id, a.created_at, a.action, a.target_type, a.target_id, a.ip_hash, a.user_agent, a.meta_json,
                u.handle as actor_handle, u.email as actor_email
         from audit_events a
         left join users u on u.id=a.actor_user_id
         where a.org_id=$1
         order by a.created_at desc
         limit ${limit}`,
        [orgId]
      );
    }

    const items = res.rows;
    const next = items.length ? items[items.length-1].created_at : null;

    return json(200, { items, next_before: next });

  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
