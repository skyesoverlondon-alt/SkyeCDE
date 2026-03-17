const crypto = require("crypto");
const { query } = require("./_db");
const { recordAudit } = require("./_audit");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
async function resendSend({ to, subject, html }){
  const key = requireEnv("RESEND_API_KEY");
  const from = requireEnv("NOTIFY_FROM_EMAIL");

  const res = await fetch("https://api.resend.com/emails", {
    method:"POST",
    headers:{
      "Authorization": `Bearer ${key}`,
      "Content-Type":"application/json"
    },
    body: JSON.stringify({ from, to, subject, html })
  });

  if(!res.ok){
    const t = await res.text();
    throw new Error("Email send failed: " + t);
  }
  return res.json();
}

function sha256Hex(s){
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

exports.handler = async (event) => {
  try{
    requireMethod(event, "POST");
    const body = parseJson(event);
    const ident = (body.ident || "").trim().toLowerCase();

    // Always return ok to avoid account enumeration.
    if(!ident) return json(200, { ok:true });

    const ip = getClientIp(event);
    const ipH = hashIp(ip);
    const bucket = `ip:${ipH}:resend_verify`;

    await enforceRateLimit({
      ipLimit: 6,
      handleLimit: 999999,
      ipWindowLabel: "1 hour",
      handleWindowLabel: "",
      countIpWindow: async () => {
        const r = await query(
          `select count(*)::int as c from rate_events where bucket=$1 and created_at > now() - interval '1 hour'`,
          [bucket]
        );
        return r.rows[0].c;
      },
      countHandleWindow: async () => 0
    });

    const ures = await query(
      `select id, handle, email, email_verified
       from users
       where lower(email)=$1 or lower(handle)=$1
       limit 1`,
      [ident]
    );
    if(!ures.rows.length) {
      await query(`insert into rate_events(bucket) values($1)`, [bucket]);
      return json(200, { ok:true });
    }

    const u = ures.rows[0];
    if(u.email_verified){
      await query(`insert into rate_events(bucket) values($1)`, [bucket]);
      return json(200, { ok:true });
    }

    const token = randomToken(32);
    const hash = sha256Hex(token);
    const expiresAt = new Date(Date.now() + 24*60*60*1000);

    await query(
      `update users
       set email_verify_token_hash=$1, email_verify_expires_at=$2
       where id=$3`,
      [hash, expiresAt.toISOString(), u.id]
    );

    await recordAudit(event, u.id, 'EMAIL_VERIFICATION_RESENT', 'user', u.id, null);

    await query(`insert into rate_events(bucket) values($1)`, [bucket]);

    const base = getSiteUrl();
    const link = `${base}/verify.html?token=${encodeURIComponent(token)}`;

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Verify your Skye Mail Vault email</h2>
        <p>Handle: <b>${escapeHtml(u.handle)}</b></p>
        <p><a href="${link}" target="_blank" rel="noopener">Verify Email</a></p>
        <p style="color:#666;font-size:12px">This link expires in 24 hours.</p>
      </div>
    `;

    try{
      await resendSend({ to: u.email, subject: "Verify your Skye Mail Vault email", html });
    }catch(e){}

    return json(200, { ok:true });

  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};

function escapeHtml(s){
  return String(s || "").replace(/[<>&"]/g, c => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", '"':"&quot;" }[c]));
}
