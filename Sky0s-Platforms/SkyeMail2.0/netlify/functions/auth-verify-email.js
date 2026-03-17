const crypto = require("crypto");
const { query } = require("./_db");
const { recordAudit } = require("./_audit");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
function sha256Hex(s){
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

exports.handler = async (event) => {
  try{
    requireMethod(event, "POST");
    const body = parseJson(event);
    const token = String(body.token || "").trim();
    if(!token) return json(400, { error: "token required" });

    const hash = sha256Hex(token);

    const res = await query(
      `select id, email_verified, email_verify_expires_at
       from users
       where email_verify_token_hash=$1
       limit 1`,
      [hash]
    );
    if(!res.rows.length) return json(400, { error: "Invalid or expired token." });

    const u = res.rows[0];
    const exp = u.email_verify_expires_at ? new Date(u.email_verify_expires_at) : null;
    if(exp && exp.getTime() < Date.now()){
      return json(400, { error: "Invalid or expired token." });
    }

    await query(
      `update users
       set email_verified=true, email_verified_at=now(),
           email_verify_token_hash=null, email_verify_expires_at=null
       where id=$1`,
      [u.id]
    );

    await recordAudit(event, u.id, 'EMAIL_VERIFIED', 'user', u.id, null);

    return json(200, { ok:true });

  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
