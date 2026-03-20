// Required env vars (set in Netlify → SkyDexia 2.6 site → Environment Variables):
//   RESEND_API_KEY       — API key from resend.com (must have send access)
//   SKYDEXIA_MAIL_FROM   — Preferred from address, e.g. "SkyDexia 2.6 <notify@yourdomain.com>"
//   SKYDEX_MAIL_FROM     — Legacy fallback from address
//   RESEND_FROM_EMAIL    — Fallback from address if neither app-specific env var is set
const { handleCors, json, methodNotAllowed, requireSession, requireAuth } = require('./_lib/runtime');

exports.handler = async (event) => {
  const cors = handleCors(event, ['POST', 'OPTIONS']);
  if (cors) return cors;
  if (event.httpMethod !== 'POST') return methodNotAllowed(['POST', 'OPTIONS']);
  const session = await requireAuth(event);
  if (!session) return json(401, { error: 'Founder session or signed bearer token required.' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON body.' }); }
  const to = String(body?.to || '').trim();
  const subject = String(body?.subject || '').trim();
  const text = String(body?.text || '').trim();
  if (!to || !subject || !text) return json(400, { error: 'to, subject, and text are required.' });

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.SKYDEXIA_MAIL_FROM || process.env.SKYDEX_MAIL_FROM || process.env.RESEND_FROM_EMAIL;
  if (!resendKey || !from) {
    return json(500, { error: 'RESEND_API_KEY and SKYDEXIA_MAIL_FROM (or SKYDEX_MAIL_FROM / RESEND_FROM_EMAIL) must be configured for live email.' });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, text })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return json(response.status || 500, { error: payload?.message || 'Resend request failed.', provider_payload: payload });
    return json(200, { ok: true, provider: 'resend', mail_record_id: payload?.id || null, actor: session.sub });
  } catch (error) {
    return json(500, { error: error?.message || 'Unexpected skymail-send failure.' });
  }
};
