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
    const caregiver = await resolveUser(String(body.caregiverUid || '').trim(), body.caregiverEmail, 'caregiver');
    if (!client || !caregiver) return json(400, { ok: false, error: 'client_or_caregiver_not_found' });
    if (!body.petName || !body.startDate || !body.endDate) return json(400, { ok: false, error: 'missing_required_fields' });
    const booking = await query(
      `
        INSERT INTO bookings (
          id, client_uid, client_name, client_email, caregiver_uid, caregiver_name,
          pet_name, pet_type, start_date, end_date, notes, status, created_at, updated_at
        ) VALUES (
          gen_random_uuid()::text, $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10, 'active', NOW(), NOW()
        )
        RETURNING id
      `,
      [
        client.id,
        String(body.clientName || client.name || '').trim() || null,
        client.email,
        caregiver.id,
        String(body.caregiverName || caregiver.name || '').trim() || null,
        String(body.petName || '').trim(),
        String(body.petType || '').trim() || null,
        String(body.startDate || '').trim(),
        String(body.endDate || '').trim(),
        String(body.notes || '').trim() || null,
      ]
    );
    return json(200, { ok: true, bookingId: booking.rows[0].id });
  } catch (error) {
    console.error(error);
    return json(500, { ok: false, error: error.message || String(error) });
  }
};