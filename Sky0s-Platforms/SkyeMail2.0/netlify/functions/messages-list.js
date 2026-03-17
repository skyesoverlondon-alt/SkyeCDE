const { query } = require("./_db");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
exports.handler = async (event) => {try{
    requireMethod(event, "GET");
    const auth = await verifyAuthSession(event);
    const userId = auth.sub;

    const res = await query(
      `select id, thread_id, from_name, from_email, key_version, created_at, read_at, legal_hold
       from messages
       where user_id=$1 and deleted_at is null
       order by created_at desc
       limit 200`,
      [userId]
    );

    return json(200, { items: res.rows });

  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
