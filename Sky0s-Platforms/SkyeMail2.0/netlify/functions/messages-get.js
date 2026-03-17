const { query } = require("./_db");
const { recordAudit } = require("./_audit");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
exports.handler = async (event) => {try{
    requireMethod(event, "GET");
    const auth = await verifyAuthSession(event);
    const userId = auth.sub;

    const id = (event.queryStringParameters && event.queryStringParameters.id) ? String(event.queryStringParameters.id).trim() : "";
    if(!id) return json(400, { error: "id required" });

    const res = await query(
      `select id, thread_id, from_name, from_email, key_version, encrypted_key_b64, iv_b64, ciphertext_b64, created_at, read_at, legal_hold
       from messages
       where id=$1 and user_id=$2 and deleted_at is null
       limit 1`,
      [id, userId]
    );
    if(!res.rows.length) return json(404, { error: "Not found" });

    // Mark as read (idempotent)
    try{
      if(!res.rows[0].read_at){
        await query(`update messages set read_at=now() where id=$1 and user_id=$2 and read_at is null`, [id, userId]);
        res.rows[0].read_at = new Date().toISOString();
        await recordAudit(event, userId, 'message.read', 'message', String(id), null);
      }
    }catch(e){}

    const ares = await query(
      `select id, filename, mime_type, size_bytes, encrypted_key_b64, iv_b64
       from attachments where message_id=$1 order by created_at asc`,
      [id]
    );

    return json(200, { ...res.rows[0], attachments: ares.rows });

  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
