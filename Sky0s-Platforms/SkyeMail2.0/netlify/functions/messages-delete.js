const { query } = require("./_db");
const { recordAudit } = require("./_audit");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
exports.handler = async (event) => {
  try{
    requireMethod(event, "POST");
    if((event.httpMethod||"GET").toUpperCase() !== "POST") return json(405,{error:"Method not allowed"});
    const auth = await verifyAuthSession(event);
    requireCsrf(event);
    const userId = auth.sub;

    const body = parseJson(event);
    const id = (body.id || "").trim();
    if(!id) return json(400, { error: "id required" });

    const m = await query(`select legal_hold from messages where id=$1 and user_id=$2 limit 1`, [id, userId]);
    if(!m.rows.length) return json(404, { error: "Not found" });
    if(m.rows[0].legal_hold) return json(423, { error: "Message is under legal hold and cannot be deleted." });

    await query(`update messages set deleted_at=now() where id=$1 and user_id=$2`, [id, userId]);
    await recordAudit(event, userId, "message.delete", "message", id, null);

    return json(200, { ok:true });

  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
