// Required env vars (set in Netlify → SkyDex site → Environment Variables):
//   RESEND_API_KEY       — API key from resend.com (must have send access)
//   SKYDEX_MAIL_FROM     — From address, e.g. "SkyDex <notify@yourdomain.com>"
//   RESEND_FROM_EMAIL    — Fallback from address if SKYDEX_MAIL_FROM is not set
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body.' }) }; }
  const to = String(body?.to || '').trim();
  const subject = String(body?.subject || '').trim();
  const text = String(body?.text || '').trim();
  if (!to || !subject || !text) return { statusCode: 400, headers, body: JSON.stringify({ error: 'to, subject, and text are required.' }) };

  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.SKYDEX_MAIL_FROM || process.env.RESEND_FROM_EMAIL;
  if (!resendKey || !from) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'RESEND_API_KEY and SKYDEX_MAIL_FROM (or RESEND_FROM_EMAIL) must be configured for live email.' }) };
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
    if (!response.ok) return { statusCode: response.status || 500, headers, body: JSON.stringify({ error: payload?.message || 'Resend request failed.', provider_payload: payload }) };
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, provider: 'resend', mail_record_id: payload?.id || null }) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error?.message || 'Unexpected skymail-send failure.' }) };
  }
};
