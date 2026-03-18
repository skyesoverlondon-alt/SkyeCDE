const { ensureSchema } = require('./_lib/schema');
const { query } = require('./_lib/db');
const { json, requireUser } = require('./_lib/auth');

async function loadBooking(bookingId) {
  const result = await query('SELECT * FROM bookings WHERE id = $1 LIMIT 1', [bookingId]);
  return result.rows[0] || null;
}

function canAccessBooking(user, booking) {
  return user.role === 'admin' || booking.client_uid === user.id || booking.caregiver_uid === user.id;
}

exports.handler = async (event) => {
  try {
    await ensureSchema();
    const user = await requireUser(event);
    if (!user) return json(401, { ok: false, error: 'unauthorized' });
    if (event.httpMethod === 'GET') {
      const bookingId = String(event.queryStringParameters?.bookingId || '').trim();
      if (!bookingId) return json(400, { ok: false, error: 'missing_booking_id' });
      const booking = await loadBooking(bookingId);
      if (!booking) return json(404, { ok: false, error: 'booking_not_found' });
      if (!canAccessBooking(user, booking)) return json(403, { ok: false, error: 'forbidden' });
      const messages = await query('SELECT id, text, from_user_id, from_role, created_at FROM booking_messages WHERE booking_id = $1 ORDER BY created_at ASC', [bookingId]);
      return json(200, { ok: true, messages: messages.rows });
    }
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const bookingId = String(body.bookingId || '').trim();
      const text = String(body.text || '').trim();
      if (!bookingId || !text) return json(400, { ok: false, error: 'missing_fields' });
      const booking = await loadBooking(bookingId);
      if (!booking) return json(404, { ok: false, error: 'booking_not_found' });
      if (!canAccessBooking(user, booking)) return json(403, { ok: false, error: 'forbidden' });
      await query(
        `INSERT INTO booking_messages (id, booking_id, text, from_user_id, from_role, created_at) VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW())`,
        [bookingId, text, user.id, user.role]
      );
      return json(200, { ok: true });
    }
    return json(405, { ok: false, error: 'method_not_allowed' });
  } catch (error) {
    console.error(error);
    return json(500, { ok: false, error: error.message || String(error) });
  }
};