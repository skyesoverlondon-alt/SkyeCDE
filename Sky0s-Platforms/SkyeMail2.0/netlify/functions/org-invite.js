const crypto = require("crypto");
const { query } = require("./_db");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
const { recordAudit } = require("./_audit");

function sha256Hex(s){
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

async function resendSend({ to, subject, html }){
  const key = requireEnv("RESEND_API_KEY");
  const from = requireEnv("NOTIFY_FROM_EMAIL");
  const res = await fetch("https://api.resend.com/emails", {
    method:"POST",
    headers:{ "Authorization": `Bearer ${key}`, "Content-Type":"application/json" },
    body: JSON.stringify({ from, to, subject, html })
  });
  if(!res.ok){
    const t = await res.text();
    throw new Error("Email send failed: " + t);
  }
  return res.json();
}

exports.handler = async (event) => {
  try{
    requireMethod(event, "POST");
    if(event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

    const auth = await verifyAuthSession(event);
    requireCsrf(event);
    const userId = auth.sub;

    const body = parseJson(event);
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "viewer").trim().toLowerCase();
    if(!email || !email.includes("@")) return json(400, { error: "Valid email required." });
    if(!["admin","viewer"].includes(role)) return json(400, { error: "Role must be admin or viewer." });

    const u = await query(`select org_id from users where id=$1 limit 1`, [userId]);
    const orgId = u.rows.length ? u.rows[0].org_id : null;
    if(!orgId) return json(400, { error: "No organization found for this account." });

    const m = await query(`select role from org_members where org_id=$1 and user_id=$2 limit 1`, [orgId, userId]);
    const myRole = m.rows.length ? m.rows[0].role : null;
    if(!myRole || (myRole !== "owner" && myRole !== "admin")) return json(403, { error: "Forbidden" });

    const token = randomToken(32);
    const token_hash = sha256Hex(token);
    const expires_at = new Date(Date.now() + 7*24*60*60*1000).toISOString();

    await query(
      `insert into org_invites(org_id, email, role, token_hash, expires_at)
       values($1,$2,$3,$4,$5)`,
      [orgId, email, role, token_hash, expires_at]
    );

    await recordAudit(event, userId, "ORG_INVITE_SENT", "org", String(orgId), { email, role });

    const base = getSiteUrl();
    const link = `${base}/accept-invite.html?token=${encodeURIComponent(token)}`;

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Skye Mail Vault — Organization Invite</h2>
        <p>You were invited to join an organization as <b>${role}</b>.</p>
        <p><a href="${link}" target="_blank" rel="noopener">Accept invite</a></p>
        <p style="color:#666;font-size:12px">This link expires in 7 days. You must log in with this email to accept.</p>
      </div>
    `;

    try{ await resendSend({ to: email, subject: "Skye Mail Vault — Invitation", html }); }catch(e){}

    return json(200, { ok:true });
  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
