const crypto = require('crypto');
const { query } = require('./_lib/db');
const { ensureSchema } = require('./_lib/schema');
const { json } = require('./_lib/auth');

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
    await ensureSchema();
    const body = JSON.parse(event.body || '{}');
    const clientUid = String(body.clientUid || '').trim();
    const clientEmail = String(body.clientEmail || '').trim() || null;
    const requestType = String(body.requestType || 'one_time').trim() || 'one_time';
    const payload = body.payload && typeof body.payload === 'object' ? body.payload : {};
    const quote = body.quote && typeof body.quote === 'object' ? body.quote : {};
    if (!clientUid) return json(400, { ok: false, error: 'missing_client_uid' });
    const requestId = crypto.randomBytes(12).toString('hex');
    await query(
      `
        INSERT INTO service_requests (id, client_uid, client_email, request_type, payload, quote, status, source)
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, 'created_unpaid', 'sol_mobile_detailing_request_web')
      `,
      [requestId, clientUid, clientEmail, requestType, JSON.stringify(payload), JSON.stringify(quote)]
    );
    return json(200, { ok: true, requestId });
  } catch (error) {
    console.error(error);
    return json(500, { ok: false, error: error.message || String(error) });
  }
};