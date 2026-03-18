const crypto = require('crypto');

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('Missing STRIPE_SECRET_KEY env var');
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
}

const { query } = require('./_lib/db');
const { ensureSchema } = require('./_lib/schema');

function pickDetailer(detailers, requestPayload) {
  const zip = String(requestPayload.zip || '').trim();
  const address = String(requestPayload.address || '').toLowerCase();
  const vehicleCount = parseInt(requestPayload.vehicleCount || '1', 10) || 1;

  const pool = detailers.filter((detailer) => {
    if (detailer.status && detailer.status !== 'active') return false;
    const maxVehicles = parseInt(detailer.max_vehicles || '0', 10) || 0;
    if (maxVehicles && vehicleCount > maxVehicles) return false;
    if (zip && detailer.zip && String(detailer.zip).trim() === zip) return true;
    if (detailer.city && address.includes(String(detailer.city).toLowerCase())) return true;
    return !zip && !detailer.zip;
  });

  return pool[0] || null;
}

exports.handler = async (event) => {
  try {
    await ensureSchema();
    const sessionId = String(event.queryStringParameters?.session_id || '').trim();
    if (!sessionId) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'missing_session_id' }) };
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return { statusCode: 200, body: JSON.stringify({ ok: false, error: 'not_paid' }) };
    }

    const requestId = session.metadata?.requestId;
    if (!requestId) {
      return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'missing_requestId' }) };
    }

    const reqRes = await query('SELECT * FROM service_requests WHERE id = $1 LIMIT 1', [requestId]);
    if (!reqRes.rowCount) {
      return { statusCode: 404, body: JSON.stringify({ ok: false, error: 'request_not_found' }) };
    }

    const request = reqRes.rows[0];
    const payload = request.payload || {};
    if (request.status === 'paid_confirmed' || request.status === 'job_created') {
      return { statusCode: 200, body: JSON.stringify({ ok: true, already: true, jobId: request.job_id || null }) };
    }

    await query(
      `
        UPDATE service_requests
        SET status = 'paid_confirmed', paid_at = NOW(), updated_at = NOW(), stripe_session_id = $2, stripe_amount_total = $3, stripe_currency = $4
        WHERE id = $1
      `,
      [requestId, session.id, session.amount_total || null, session.currency || null]
    );

    const detailersRes = await query('SELECT uid, email, name, city, zip, max_vehicles, status FROM detailers WHERE status = $1', ['active']).catch(() => ({ rows: [] }));
    const chosen = pickDetailer(detailersRes.rows || [], payload);

    const job = await query(
      `
        INSERT INTO jobs (
          id, client_uid, client_name, client_email, detailer_uid, detailer_name,
          address, zip, preferred_date, time_window, vehicle_count, vehicle_type,
          service_level, interior, heavy_soil, addons, request_type, plan, notes, quote,
          status, source_request_id, created_at, updated_at
        ) VALUES (
          gen_random_uuid()::text, $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10, $11,
          $12, $13, $14, $15::jsonb, $16, $17, $18, $19::jsonb,
          $20, $21, NOW(), NOW()
        )
        RETURNING id
      `,
      [
        request.client_uid,
        String(payload.clientName || '').trim() || null,
        request.client_email,
        chosen ? chosen.uid : null,
        chosen ? (chosen.name || '') : null,
        String(payload.address || '').trim() || null,
        String(payload.zip || '').trim() || null,
        String(payload.preferredDate || '').trim() || null,
        String(payload.timeWindow || '').trim() || null,
        parseInt(payload.vehicleCount || '1', 10) || 1,
        String(payload.vehicleType || '').trim() || null,
        String(payload.serviceLevel || '').trim() || null,
        String(payload.interior || 'yes').trim(),
        String(payload.heavySoil || 'no').trim(),
        JSON.stringify({
          engine: payload.engine || 'no',
          headlights: payload.headlights || 'no',
          odor: payload.odor || 'no',
        }),
        String(request.request_type || 'one_time').trim(),
        String(payload.plan || 'none').trim(),
        String(payload.notes || '').trim() || null,
        JSON.stringify(request.quote || {}),
        chosen ? 'scheduled' : 'pending_assignment',
        requestId,
      ]
    );

    let subscriptionId = null;
    if (String(payload.requestType || '').trim() === 'subscription' && String(payload.plan || 'none').trim() !== 'none') {
      subscriptionId = crypto.randomBytes(12).toString('hex');
      await query(
        `
          INSERT INTO subscriptions (id, client_uid, client_email, plan, status, latest_job_id, started_at, updated_at)
          VALUES ($1, $2, $3, $4, 'active', $5, NOW(), NOW())
        `,
        [subscriptionId, request.client_uid, request.client_email, String(payload.plan || '').trim(), job.rows[0].id]
      );
      await query('UPDATE jobs SET subscription_id = $2, updated_at = NOW() WHERE id = $1', [job.rows[0].id, subscriptionId]);
    }

    await query(
      `
        UPDATE service_requests
        SET status = 'job_created', updated_at = NOW(), job_id = $2, detailer_uid = $3, detailer_name = $4, subscription_id = $5
        WHERE id = $1
      `,
      [requestId, job.rows[0].id, chosen ? chosen.uid : null, chosen ? (chosen.name || '') : null, subscriptionId]
    );

    return { statusCode: 200, body: JSON.stringify({ ok: true, jobId: job.rows[0].id, detailerAssigned: !!chosen, subscriptionId }) };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: error.message || String(error) }) };
  }
};
