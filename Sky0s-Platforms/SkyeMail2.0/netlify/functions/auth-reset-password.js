const bcrypt = require("bcryptjs");
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
    const new_password = String(body.new_password || "");

    if(!token) return json(400, { error: "token required" });
    if(!new_password || new_password.length < 10) return json(400, { error: "Password must be at least 10 characters." });

    const hash = sha256Hex(token);

    const res = await query(
      `select id, password_reset_expires_at
       from users
       where password_reset_token_hash=$1
       limit 1`,
      [hash]
    );
    if(!res.rows.length) return json(400, { error: "Invalid or expired token." });

    const u = res.rows[0];
    const exp = u.password_reset_expires_at ? new Date(u.password_reset_expires_at) : null;
    if(exp && exp.getTime() < Date.now()){
      return json(400, { error: "Invalid or expired token." });
    }

    const password_hash = await bcrypt.hash(new_password, 12);
    await query(
      `update users
       set password_hash=$1,
           password_reset_token_hash=null, password_reset_expires_at=null
       where id=$2`,
      [password_hash, u.id]
    );

    await recordAudit(event, u.id, 'PASSWORD_RESET_COMPLETED', 'user', u.id, null);

    return json(200, { ok:true });

  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
