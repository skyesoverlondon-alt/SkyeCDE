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
    const host = await resolveUser(String(body.hostUid || '').trim(), body.hostEmail, null);
    const cohost = await resolveUser(String(body.cohostUid || '').trim(), body.cohostEmail, 'cohost');

    if (!host || !cohost) return json(400, { ok: false, error: 'host_or_cohost_not_found' });
    if (!body.guestName || !body.startDate || !body.endDate) return json(400, { ok: false, error: 'missing_required_fields' });

    const stay = await query(
      `
        INSERT INTO stays (
          id, host_uid, host_name, host_email, cohost_uid, cohost_name, listing_name,
          start_date, end_date, turnover_date, service_type, notes, status, created_at, updated_at
        ) VALUES (
          gen_random_uuid()::text, $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, 'active', NOW(), NOW()
        )
        RETURNING id
      `,
      [
        host.id,
        String(body.hostName || host.name || '').trim() || null,
        host.email,
        cohost.id,
        String(body.cohostName || cohost.name || '').trim() || null,
        String(body.listingName || body.guestName || 'SkyeHubs Stay').trim(),
        String(body.startDate || '').trim(),
        String(body.endDate || '').trim(),
        String(body.turnoverDate || body.startDate || '').trim(),
        String(body.serviceType || 'turnover').trim(),
        String(body.notes || '').trim() || null,
      ]
    );

    return json(200, { ok: true, stayId: stay.rows[0].id });
  } catch (error) {
    console.error(error);
    return json(500, { ok: false, error: error.message || String(error) });
  }
};