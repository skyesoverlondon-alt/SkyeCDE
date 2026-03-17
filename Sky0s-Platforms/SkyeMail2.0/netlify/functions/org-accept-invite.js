const crypto = require("crypto");
const { query } = require("./_db");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
const { recordAudit } = require("./_audit");

function sha256Hex(s){
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

exports.handler = async (event) => {
  try{
    requireMethod(event, "POST");
    if(event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

    const auth = await verifyAuthSession(event);
    requireCsrf(event);
    const userId = auth.sub;

    const body = parseJson(event);
    const token = String(body.token || "").trim();
    if(!token) return json(400, { error: "token required" });

    const token_hash = sha256Hex(token);

    const u = await query(`select id, email, org_id from users where id=$1 limit 1`, [userId]);
    if(!u.rows.length) return json(401, { error: "Unauthorized" });
    const me = u.rows[0];

    const inv = await query(
      `select id, org_id, email, role, expires_at, accepted_at
       from org_invites
       where token_hash=$1
       limit 1`,
      [token_hash]
    );
    if(!inv.rows.length) return json(400, { error: "Invalid or expired invite." });

    const i = inv.rows[0];
    if(i.accepted_at) return json(400, { error: "Invite already accepted." });
    if(new Date(i.expires_at).getTime() < Date.now()) return json(400, { error: "Invite expired." });
    if(String(i.email).toLowerCase() !== String(me.email).toLowerCase()) return json(403, { error: "Invite email does not match your login email." });

    if(me.org_id && String(me.org_id) !== String(i.org_id)){
      return json(409, { error: "This account already belongs to a different organization." });
    }

    // Attach user to org
    await query(`update users set org_id=$1 where id=$2`, [i.org_id, userId]);
    await query(
      `insert into org_members(org_id, user_id, role)
       values($1,$2,$3)
       on conflict (org_id, user_id) do update set role=excluded.role`,
      [i.org_id, userId, i.role]
    );
    await query(`update org_invites set accepted_at=now() where id=$1`, [i.id]);

    await recordAudit(event, userId, "ORG_INVITE_ACCEPTED", "org", String(i.org_id), { role: i.role });

    return json(200, { ok:true });
  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
