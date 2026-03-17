const { query } = require("./_db");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
exports.handler = async (event) => {try{
    requireMethod(event, "GET");
    const auth = await verifyAuthSession(event);
    const userId = auth.sub;

    const qs = event.queryStringParameters || {};
    const limit = Math.max(1, Math.min(100, Number(qs.limit || 50)));
    const before = qs.before ? String(qs.before) : "";

    let res;
    if(before){
      res = await query(
        `select id, thread_id, from_name, from_email, key_version, encrypted_key_b64, iv_b64, ciphertext_b64, created_at, read_at, legal_hold
         from messages
         where user_id=$1 and deleted_at is null and created_at < $2::timestamptz
         order by created_at desc
         limit ${limit}`,
        [userId, before]
      );
    }else{
      res = await query(
        `select id, thread_id, from_name, from_email, key_version, encrypted_key_b64, iv_b64, ciphertext_b64, created_at, read_at, legal_hold
         from messages
         where user_id=$1 and deleted_at is null
         order by created_at desc
         limit ${limit}`,
        [userId]
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
