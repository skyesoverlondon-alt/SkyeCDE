const { query } = require("./_db");
const { evaluateDlp } = require("./_dlp");
const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
const { hybridEncryptWithPublicKeyPem } = require("./_hybrid");

function escapeHtml(s){
  return String(s || "").replace(/[<>&"]/g, c => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", '"':"&quot;" }[c]));
}

async function resendSend({ to, subject, html }){
  const key = requireEnv("RESEND_API_KEY");
  const from = requireEnv("NOTIFY_FROM_EMAIL");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if(!res.ok){
    const t = await res.text();
    throw new Error("Email send failed: " + t);
  }
  return res.json();
}

function getHeaderValue(headers, name){
  const n = String(name || "").toLowerCase();
  if(!Array.isArray(headers)) return "";
  const h = headers.find(x => x && String(x.Name || "").toLowerCase() === n);
  return h ? String(h.Value || "") : "";
}

function stripHtml(html){
  return String(html || "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/?p\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function handleFromEmailAddress(addr){
  const s = String(addr || "").trim();
  const at = s.indexOf("@");
  const local = at >= 0 ? s.slice(0, at) : s;
  const base = local.split("+")[0];
  const handle = base.trim();
  if(!/^[a-z0-9][a-z0-9-]{2,31}$/i.test(handle)) return "";
  return handle;
}

function safeText(s, max){
  const out = String(s || "");
  if(out.length <= max) return out;
  return out.slice(0, max) + "\n\n[Truncated to protect system limits]";
}

exports.handler = async (event) => {
  try{
    requireMethod(event, "POST");
    if(event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

    // Recommended: set INBOUND_BASIC_USER + INBOUND_BASIC_PASS to lock this endpoint down.
    requireBasicAuth(event);

    const payload = parseJson(event);

    // Optional spam score filter (best-effort; depends on headers present)
    const spamScoreMax = Number.isFinite(Number(process.env.INBOUND_SPAM_SCORE_MAX)) ? Number(process.env.INBOUND_SPAM_SCORE_MAX) : 7.0;
    const spamScoreStr = getHeaderValue(payload.Headers, "X-Spam-Score");
    const spamScore = spamScoreStr ? Number.parseFloat(spamScoreStr) : NaN;
    if(Number.isFinite(spamScore) && spamScore > spamScoreMax){
      return json(200, { ok:true, ignored:true, reason:"spam_score", spamScore, spamScoreMax });
    }

    const toFull = Array.isArray(payload.ToFull) ? payload.ToFull : [];
    let toEmails = toFull.map(x => x && x.Email).filter(Boolean);

    // Fallbacks: some inbound payloads provide OriginalRecipient only
    if(!toEmails.length && payload.OriginalRecipient){
      toEmails = [ String(payload.OriginalRecipient).trim() ];
    }

    if(!toEmails.length) return json(200, { ok:true, ignored:true, reason:"no_recipients" });

    const handles = Array.from(new Set(toEmails.map(handleFromEmailAddress).filter(Boolean)));
    if(!handles.length) return json(200, { ok:true, ignored:true, reason:"no_valid_handles" });

    const fromEmail = String(payload.From || "").trim();
    const fromName = String(payload.FromName || "").trim();
    if(!fromEmail || !fromEmail.includes("@")) return json(200, { ok:true, ignored:true, reason:"missing_from" });

    const subj = String(payload.Subject || "(no subject)");
    const bodyText = payload.StrippedTextReply || payload.TextBody || stripHtml(payload.HtmlBody || "");

    const maxChars = Number.isFinite(Number(process.env.INBOUND_MAX_TEXT_CHARS)) ? Number(process.env.INBOUND_MAX_TEXT_CHARS) : 200000;
    const maxAttach = 6;

    const attachments = Array.isArray(payload.Attachments) ? payload.Attachments : [];
    const attachMeta = attachments.map(a => ({
      name: String(a.Name || ""),
      content_type: String(a.ContentType || ""),
      content_length: Number(a.ContentLength || 0) || 0,
    })).filter(a => a.name || a.content_type || a.content_length);

    const base = getSiteUrl() || requireEnv("PUBLIC_BASE_URL");

    const inserted = [];

    for(const handle of handles){
      // User lookup
      const ures = await query(
        `select id, email, handle, org_id from users where lower(handle)=lower($1) limit 1`,
        [handle]
      );
      if(!ures.rows.length) continue;
      const user = ures.rows[0];

      // Active key lookup
      const kres = await query(
        `select version, rsa_public_key_pem from user_keys where user_id=$1 and is_active=true limit 1`,
        [user.id]
      );
      if(!kres.rows.length) continue;
      const key = kres.rows[0];

      // DLP (server-side; plaintext inbound)
      const dlpRes = await evaluateDlp({ orgId: user.org_id, actorUserId: null, source: "inbound-postmark", text: (subj + "\n" + bodyText) });
      if(dlpRes.decision === "block"){
        try{
          await resendSend({ to: user.email, subject: `Inbound message blocked by DLP — ${user.handle}`, html: `<div style="font-family:Arial,sans-serif;line-height:1.5"><h2>Inbound message blocked by DLP</h2><p>A message to <b>${escapeHtml(user.handle)}</b> was blocked by your organization\'s DLP policy.</p><p style="color:#666;font-size:12px">No message content is included.</p></div>` });
        }catch(e){}
        continue;
      }

      // Thread upsert (sender-specific)
      let threadId = null;
      let threadToken = null;

      const existing = await query(
        `select id, token from threads where user_id=$1 and lower(from_email)=lower($2) order by last_activity_at desc limit 1`,
        [user.id, fromEmail]
      );

      if(existing.rows.length){
        threadId = existing.rows[0].id;
        threadToken = existing.rows[0].token;
        await query(`update threads set last_activity_at=now() where id=$1`, [threadId]);
      }else{
        threadToken = randomToken(24);
        const tIns = await query(
          `insert into threads(user_id, token, from_name, from_email) values($1,$2,$3,$4) returning id`,
          [user.id, threadToken, fromName || null, fromEmail]
        );
        threadId = tIns.rows[0].id;
      }

      const msgPayload = {
        subject: subj,
        message: safeText(bodyText, maxChars),
        source: "email",
        source_provider: "postmark",
        inbound: {
          original_recipient: String(payload.OriginalRecipient || ""),
          mailbox_hash: String(payload.MailboxHash || ""),
          message_id: String(payload.MessageID || ""),
          date: String(payload.Date || ""),
          reply_to: String(payload.ReplyTo || ""),
          to: toEmails,
          has_attachments: attachMeta.length > 0,
          attachments: attachMeta,
          spam: {
            x_spam_status: getHeaderValue(payload.Headers, "X-Spam-Status"),
            x_spam_score: spamScoreStr,
            x_spam_tests: getHeaderValue(payload.Headers, "X-Spam-Tests"),
          }
        }
      };

      // NOTE: This inbound pathway performs server-side encryption using the recipient public key.
      // The plaintext is processed transiently to create ciphertext at rest.
      const enc = hybridEncryptWithPublicKeyPem(key.rsa_public_key_pem, JSON.stringify(msgPayload));

      const mres = await query(
        `insert into messages(user_id, thread_id, from_name, from_email, key_version, encrypted_key_b64, iv_b64, ciphertext_b64)
         values($1,$2,$3,$4,$5,$6,$7,$8)
         returning id, created_at`,
        [user.id, threadId, fromName || null, fromEmail || null, Number(key.version), enc.encrypted_key_b64, enc.iv_b64, enc.ciphertext_b64]
      );

      const messageId = mres.rows[0].id;
      inserted.push({ handle: user.handle, id: messageId });

      // Attachments (optional): encrypt each file server-side, store ciphertext only.
      if(attachments.length){
        const slice = attachments.slice(0, maxAttach);
        for(const a of slice){
          const filename = String(a.Name || "").trim();
          const mime_type = String(a.ContentType || "application/octet-stream").trim();
          const content_b64 = String(a.Content || "").trim();
          const size_bytes = Number(a.ContentLength || 0) || 0;

          if(!filename || !content_b64) continue;
          if(size_bytes <= 0 || size_bytes > 2_000_000) continue; // enforce 2MB cap

          const bytes = Buffer.from(content_b64, "base64");
          if(!bytes.length) continue;

          const aEnc = hybridEncryptBytesNode(key.rsa_public_key_pem, bytes);
          await query(
            `insert into attachments(message_id, filename, mime_type, size_bytes, encrypted_key_b64, iv_b64, ciphertext)
             values($1,$2,$3,$4,$5,$6,$7)`,
            [messageId, filename, mime_type, bytes.length, aEnc.encrypted_key_b64, aEnc.iv_b64, aEnc.ciphertext]
          );
        }
      }

      // Notify recipient (no content)
      const inboxLink = `${base}/message.html?id=${encodeURIComponent(messageId)}`;
      const htmlToRecipient = `
        <div style="font-family:Arial,sans-serif;line-height:1.5">
          <h2>New imported email</h2>
          <p>A new email was received for <b>${escapeHtml(user.handle)}</b> and imported into Skye Mail Vault.</p>
          <p>From: <b>${escapeHtml(fromName || "")}</b> &lt;${escapeHtml(fromEmail)}&gt;</p>
          <p><a href="${inboxLink}" target="_blank" rel="noopener">Open in Skye Mail Vault</a></p>
          <p style="color:#666;font-size:12px">This notification includes no message content. The message is stored encrypted at rest in your Vault.</p>
        </div>
      `;
      await resendSend({ to: user.email, subject: `New email imported for ${user.handle}`, html: htmlToRecipient });

      // Send sender a secure thread link (best-effort)
      const threadLink = `${base}/thread.html?token=${encodeURIComponent(threadToken)}`;
      const htmlToSender = `
        <div style="font-family:Arial,sans-serif;line-height:1.5">
          <h2>Secure reply link</h2>
          <p>Your secure thread link for <b>${escapeHtml(user.handle)}</b>:</p>
          <p><a href="${threadLink}" target="_blank" rel="noopener">${threadLink}</a></p>
          <p style="color:#666;font-size:12px">No message content is included here. This is only a secure portal link.</p>
        </div>
      `;
      try{
        await resendSend({ to: fromEmail, subject: `Secure reply link — ${user.handle}`, html: htmlToSender });
      }catch(e){}
    }

    if(!inserted.length) return json(200, { ok:true, ignored:true, reason:"no_matching_users" });
    return json(200, { ok:true, inserted });

  }catch(err){
    const status = err.statusCode || 500;
    if(status === 401) return json(401, { error: "Unauthorized" });
    return json(status, { error: err.message || "Server error" });
  }
};
