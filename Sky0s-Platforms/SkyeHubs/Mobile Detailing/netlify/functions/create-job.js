const { ensureSchema } = require('./_lib/schema');
const { query } = require('./_lib/db');
const { json, normalizeEmail, requireRole } = require('./_lib/auth');

async function resolveUser(userId, email, role) {
  if (userId) {
    const byId = await query('SELECT id, email, role, name FROM hub_users WHERE id = $1 LIMIT 1', [userId]);
    return byId.rows[0] || null;
  }
  if (email) {
    const byEmail = await query('SELECT id, email, role, name FROM hub_users WHERE email = $1 LIMIT 1', [normalizeEmail(email)]);
    const row = byEmail.rows[0] || null;
    if (row && (!role || row.role === role)) return row;
  }
  return null;
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
    await ensureSchema();
    const auth = await requireRole(event, ['admin']);
    if (!auth.ok) return auth.response;

    const body = JSON.parse(event.body || '{}');
    const client = await resolveUser(String(body.clientUid || '').trim(), body.clientEmail, null);
    const detailer = await resolveUser(String(body.detailerUid || '').trim(), body.detailerEmail, 'detailer');
    if (!client || !detailer) return json(400, { ok: false, error: 'client_or_detailer_not_found' });
    if (!body.vehicleType || !body.preferredDate) return json(400, { ok: false, error: 'missing_required_fields' });

    const result = await query(
      `
        INSERT INTO jobs (
          id, client_uid, client_name, client_email, detailer_uid, detailer_name,
          address, zip, preferred_date, time_window, vehicle_count, vehicle_type,
          service_level, interior, heavy_soil, addons, request_type, plan, notes, quote,
          status, created_at, updated_at
        ) VALUES (
          gen_random_uuid()::text, $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10, $11,
          $12, $13, $14, $15::jsonb, $16, $17, $18, $19::jsonb,
          'scheduled', NOW(), NOW()
        )
        RETURNING id
      `,
      [
        client.id,
        String(body.clientName || client.name || '').trim() || null,
        client.email,
        detailer.id,
        String(body.detailerName || detailer.name || '').trim() || null,
        String(body.address || '').trim() || null,
        String(body.zip || '').trim() || null,
        String(body.preferredDate || '').trim(),
        String(body.timeWindow || '').trim() || null,
        parseInt(body.vehicleCount || '1', 10) || 1,
        String(body.vehicleType || '').trim(),
        String(body.serviceLevel || '').trim() || null,
        String(body.interior || 'yes').trim(),
        String(body.heavySoil || 'no').trim(),
        JSON.stringify(body.addons || {}),
        String(body.requestType || 'one_time').trim(),
        String(body.plan || 'none').trim(),
        String(body.notes || '').trim() || null,
        JSON.stringify(body.quote || {}),
      ]
    );

    return json(200, { ok: true, jobId: result.rows[0].id });
  } catch (error) {
    console.error(error);
    return json(500, { ok: false, error: error.message || String(error) });
  }
};
