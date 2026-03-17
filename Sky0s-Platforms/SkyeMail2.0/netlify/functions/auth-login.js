const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("./_db");
const { recordAudit } = require("./_audit");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
exports.handler = async (event) => {
  try{
    requireMethod(event, "POST");
    const body = parseJson(event);
    const ident = (body.ident || "").trim().toLowerCase();
    const password = body.password || "";

    if(!ident) return json(400, { error: "Email or handle required." });
    if(!password) return json(400, { error: "Password required." });

    const res = await query(
      `select u.id, u.handle, u.email, u.password_hash, u.email_verified, u.is_active, u.org_id,
              coalesce(o.require_sso,false) as require_sso,
              coalesce(o.session_max_days,14) as session_max_days
       from users u
       left join organizations o on o.id=u.org_id
       where lower(u.email)=$1 or lower(u.handle)=$1
       limit 1`,
      [ident]
    );
if(!res.rows.length){
      await recordAudit(event, null, 'LOGIN_FAIL', null, null, { ident });
      return json(401, { error: "Invalid credentials." });
    }
    const u = res.rows[0];

    const ok = await bcrypt.compare(password, u.password_hash);
    if(!ok){
      await recordAudit(event, null, 'LOGIN_FAIL', null, null, { ident });
      return json(401, { error: "Invalid credentials." });
    }

    if(u.is_active === false){
      await recordAudit(event, u.id, 'LOGIN_BLOCKED_DEACTIVATED', 'user', u.id, { email: u.email, handle: u.handle });
      return json(403, { error: "Account is deactivated." });
    }

    if(u.require_sso){
      await recordAudit(event, u.id, 'LOGIN_BLOCKED_SSO_REQUIRED', 'user', u.id, { email: u.email, handle: u.handle });
      return json(403, { error: "SSO required for this organization. Use SSO login." });
    }

    if(!u.email_verified){
      await recordAudit(event, u.id, 'LOGIN_BLOCKED_UNVERIFIED', 'user', u.id, { email: u.email, handle: u.handle });
      return json(403, { error: "Email not verified. Please verify your inbox link, or resend verification.", needs_verification: true, handle: u.handle, email: u.email });
    }

    const secret = requireEnv("JWT_SECRET");
    const maxDays = Number(u.session_max_days || 14);
    const jti = randomToken(24);
    const token = jwt.sign({ sub: u.id, handle: u.handle, email: u.email }, secret, { expiresIn: `${maxDays}d`, jwtid: jti });
    const csrf = randomToken(18);

    const ua = (event.headers && (event.headers["user-agent"] || event.headers["User-Agent"])) ? String(event.headers["user-agent"] || event.headers["User-Agent"]) : "";
    const ip = getClientIp(event);
    const ip_hash = (() => { try { return hashIp(ip); } catch(e){ return null; } })();
    const expiresAt = new Date(Date.now() + maxDays*24*60*60*1000);

    await query(`update users set last_login_at=now() where id=$1`, [u.id]);
    await query(
      `insert into sessions(user_id, jti, expires_at, ip_hash, user_agent)
       values($1,$2,$3,$4,$5)`,
      [u.id, jti, expiresAt.toISOString(), ip_hash, ua]
    );

    const cookies = issueAuthCookies({ token, csrf });
    await recordAudit(event, u.id, "LOGIN_SUCCESS", "user", u.id, { email: u.email, handle: u.handle, jti });
    return jsonCookies(200, { ok:true, handle: u.handle, email: u.email, email_verified: true }, cookies);
}catch(err){
    return json(500, { error: err.message || "Server error" });
  }
};
