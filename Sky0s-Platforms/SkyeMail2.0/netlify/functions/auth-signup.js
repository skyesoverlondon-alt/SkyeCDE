const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { query } = require("./_db");
const { recordAudit } = require("./_audit");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
function validHandle(h){
  return /^[a-z0-9][a-z0-9-]{2,31}$/i.test(h || "");
}

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
    const {
      handle, email, password,
      rsa_public_key_pem,
      vault_wrap_json,
      recovery_enabled,
      recovery_blob_json
    } = body;

    if(!validHandle(handle)) return json(400, { error: "Invalid handle format." });
    if(!email || !email.includes("@")) return json(400, { error: "Valid email required." });
    if(!password || password.length < 10) return json(400, { error: "Password must be at least 10 characters." });
    if(!rsa_public_key_pem || !rsa_public_key_pem.includes("BEGIN PUBLIC KEY")) return json(400, { error: "rsa_public_key_pem required (PEM)." });
    if(!vault_wrap_json) return json(400, { error: "vault_wrap_json required." });

    // IP-based signup throttling
    const ip = getClientIp(event);
    const ipH = hashIp(ip);
    const bucket = `ip:${ipH}:signup`;
    await enforceRateLimit({
      ipLimit: 5,
      handleLimit: 30,
      ipWindowLabel: "1 hour",
      handleWindowLabel: "1 day",
      countIpWindow: async () => {
        const r = await query(
          `select count(*)::int as c from rate_events where bucket=$1 and created_at > now() - interval '1 hour'`,
          [bucket]
        );
        return r.rows[0].c;
      },
      countHandleWindow: async () => {
        const r = await query(
          `select count(*)::int as c from users where created_at > now() - interval '1 day'`,
          []
        );
        return r.rows[0].c;
      }
    });

    // Create org (default: one org per Vault) + owner membership
    const orgRes = await query(
      `insert into organizations(name, slug) values($1, $2) returning id`,
      [handle, handle.toLowerCase()]
    );
    const orgId = orgRes.rows[0].id;

    const password_hash = await bcrypt.hash(password, 12);
    const recoveryEnabled = !!recovery_enabled;
    const recoveryBlob = recoveryEnabled ? (recovery_blob_json || null) : null;

    // Create verification token (store hash)
    const verifyToken = randomToken(32);
    const verifyHash = sha256Hex(verifyToken);
    const expiresAt = new Date(Date.now() + 24*60*60*1000);

    const ures = await query(
      `insert into users(handle, email, password_hash, org_id, email_verified, email_verify_token_hash, email_verify_expires_at, recovery_enabled, recovery_blob_json)
       values($1,$2,$3,$4,false,$5,$6,$7,$8)
       returning id`,
      [handle, email.toLowerCase(), password_hash, orgId, verifyHash, expiresAt.toISOString(), recoveryEnabled, recoveryBlob]
    );
    const userId = ures.rows[0].id;

    await query(`insert into org_members(org_id, user_id, role) values($1,$2,'owner')`, [orgId, userId]);

    await query(
      `insert into user_keys(user_id, version, is_active, rsa_public_key_pem, vault_wrap_json)
       values($1, 1, true, $2, $3)`,
      [userId, rsa_public_key_pem, vault_wrap_json]
    );

    // Record the rate event
    await query(`insert into rate_events(bucket) values($1)`, [bucket]);

    // Send verification email
    const base = getSiteUrl();
    const link = `${base}/verify.html?token=${encodeURIComponent(verifyToken)}`;

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Verify your Skye Mail Vault email</h2>
        <p>Handle: <b>${escapeHtml(handle)}</b></p>
        <p>Click to verify your email address:</p>
        <p><a href="${link}" target="_blank" rel="noopener">Verify Email</a></p>
        <p style="color:#666;font-size:12px">This link expires in 24 hours.</p>
      </div>
    `;

    try{
      await resendSend({ to: email.toLowerCase(), subject: "Verify your Skye Mail Vault email", html });
    }catch(e){
      // Don't fail signup if email provider hiccups; user can resend later.
    }

    return json(200, { ok: true, verification_sent: true });

  }catch(err){
    const msg = (err && err.message) ? err.message : "Server error";
    if(/duplicate key value violates unique constraint/i.test(msg)){
      return json(409, { error: "Handle or email already exists." });
    }
    const status = err.statusCode || 500;
    return json(status, { error: msg });
  }
};

function escapeHtml(s){
  return String(s || "").replace(/[<>&"]/g, c => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", '"':"&quot;" }[c]));
}
