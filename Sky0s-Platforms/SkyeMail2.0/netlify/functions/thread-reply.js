const { query } = require("./_db");
const { recordAudit } = require("./_audit");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf } = require("./_utils");
function escapeHtml(s){
  return String(s || "").replace(/[<>&"]/g, c => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", '"':"&quot;" }[c]));
}

function siteBase(){
  return process.env.PUBLIC_BASE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL || "";
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

exports.handler = async (event) => {
  try{
    if(event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

    const body = parseJson(event);

    const token = (body.token || "").trim();
    const from_name = (body.from_name || "").trim();
    const from_email = (body.from_email || "").trim();
    const encrypted_key_b64 = body.encrypted_key_b64;
    const iv_b64 = body.iv_b64;
    const ciphertext_b64 = body.ciphertext_b64;
    const key_version = Number(body.key_version || 0);

    const hp = (body.website || "").trim();
    if(hp) return json(200, { ok:true });

    if(!token) return json(400, { error: "token required" });
    if(!from_email || !from_email.includes("@")) return json(400, { error: "Valid sender email required." });
    if(!encrypted_key_b64 || !iv_b64 || !ciphertext_b64) return json(400, { error: "Encrypted payload required." });
    if(!Number.isFinite(key_version) || key_version < 1) return json(400, { error: "key_version required." });

    const ip = getClientIp(event);
    await verifyTurnstile(body.turnstile_token, ip);

    // Resolve thread + user (recipient)
    const tres = await query(
      `select t.id as thread_id, t.user_id, t.token, u.email as user_email, u.handle as user_handle, u.org_id as org_id
       from threads t
       join users u on u.id=t.user_id
       where t.token=$1
       limit 1`,
      [token]
    );
    if(!tres.rows.length) return json(404, { error: "Thread not found." });

    const threadId = tres.rows[0].thread_id;
    const userId = tres.rows[0].user_id;
    const userEmail = tres.rows[0].user_email;
    const userHandle = tres.rows[0].user_handle;

    // Ensure key_version exists for recipient
    const kcheck = await query(
      `select 1 from user_keys where user_id=$1 and version=$2 limit 1`,
      [userId, key_version]
    );
    if(!kcheck.rows.length) return json(409, { error: "Recipient key rotated. Refresh the thread page and try again." });

    const ipH = hashIp(ip);
    const bucketIp = `ip:${ipH}:thread_reply`;
    await enforceRateLimit({
      ipLimit: 12,
      handleLimit: 999999,
      ipWindowLabel: "10 minutes",
      handleWindowLabel: "n/a",
      countIpWindow: async () => {
        const r = await query(
          `select count(*)::int as c from rate_events
           where bucket=$1 and created_at > now() - interval '10 minutes'`,
          [bucketIp]
        );
        return r.rows[0].c;
      },
      countHandleWindow: async () => 0
    });
    await query(`insert into rate_events(bucket) values($1)`, [bucketIp]);

    const mres = await query(
      `insert into messages(user_id, thread_id, from_name, from_email, key_version, encrypted_key_b64, iv_b64, ciphertext_b64)
       values($1,$2,$3,$4,$5,$6,$7,$8)
       returning id, created_at`,
      [userId, threadId, from_name || null, from_email, key_version, encrypted_key_b64, iv_b64, ciphertext_b64]
    );

    const messageId = mres.rows[0].id;
    await recordAudit(event, null, 'THREAD_REPLY', 'thread', String(threadId), { from_email }, tres.rows[0].org_id);
    await query(`update threads set last_activity_at=now() where id=$1`, [threadId]);

    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    if(attachments.length){
      if(attachments.length > 6) return json(400, { error: "Max 6 attachments." });
      for(const a of attachments){
        const filename = String(a.filename || "").trim();
        const mime_type = String(a.mime_type || "application/octet-stream").trim();
        const size_bytes = Number(a.size_bytes || 0);
        const a_enc_key = a.encrypted_key_b64;
        const a_iv = a.iv_b64;
        const a_ct_b64 = a.ciphertext_b64;

        if(!filename) return json(400, { error: "Attachment filename required." });
        if(!a_enc_key || !a_iv || !a_ct_b64) return json(400, { error: "Attachment encrypted payload required." });
        if(!Number.isFinite(size_bytes) || size_bytes <= 0) return json(400, { error: "Attachment size_bytes invalid." });
        if(size_bytes > 2_000_000) return json(400, { error: "Attachment too large (max 2MB each)." });

        const ctBuf = Buffer.from(a_ct_b64, "base64");
        await query(
          `insert into attachments(message_id, filename, mime_type, size_bytes, encrypted_key_b64, iv_b64, ciphertext)
           values($1,$2,$3,$4,$5,$6,$7)`,
          [messageId, filename, mime_type, size_bytes, a_enc_key, a_iv, ctBuf]
        );
      }
    }

    // Notify recipient (push)
    const base = siteBase();
    if(base && userEmail){
      const inboxLink = `${base}/message.html?id=${encodeURIComponent(messageId)}`;
      const htmlToRecipient = `
        <div style="font-family:Arial,sans-serif;line-height:1.5">
          <h2>New encrypted reply received</h2>
          <p>A new reply arrived for <b>${escapeHtml(userHandle)}</b>.</p>
          <p>Sender: <b>${escapeHtml(from_name || "")}</b> &lt;${escapeHtml(from_email)}&gt;</p>
          <p><a href="${inboxLink}" target="_blank" rel="noopener">Open in Skye Mail Vault</a></p>
          <p style="color:#666;font-size:12px">Message content is not included in this email to preserve end-to-end confidentiality.</p>
        </div>
      `;
      try{
        await resendSend({ to: userEmail, subject: `New encrypted reply for ${userHandle}`, html: htmlToRecipient });
      }catch(e){}
    }

    return json(200, { ok:true, id: messageId });

  }catch(err){
    const status = err.statusCode || 500;
    return json(status, { error: err.message || "Server error" });
  }
};
