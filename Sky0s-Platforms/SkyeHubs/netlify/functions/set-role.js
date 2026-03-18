const { ensureSchema } = require('./_lib/schema');
const { query } = require('./_lib/db');
const { json, normalizeEmail, requireRole } = require('./_lib/auth');

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
    await ensureSchema();
    const auth = await requireRole(event, ['admin']);
    if (!auth.ok) return auth.response;

    const body = JSON.parse(event.body || '{}');
    const role = String(body.role || '').trim().toLowerCase();
    const userId = String(body.userId || '').trim();
    const email = normalizeEmail(body.email);
    if (!['admin', 'host', 'cohost'].includes(role)) return json(400, { ok: false, error: 'invalid_role' });

    const result = userId
      ? await query('UPDATE hub_users SET role = $2, updated_at = NOW() WHERE id = $1 RETURNING id, email, role', [userId, role])
      : await query('UPDATE hub_users SET role = $2, updated_at = NOW() WHERE email = $1 RETURNING id, email, role', [email, role]);

    if (!result.rowCount) return json(404, { ok: false, error: 'user_not_found' });
    return json(200, { ok: true, user: result.rows[0] });
  } catch (error) {
    console.error(error);
    return json(500, { ok: false, error: error.message || String(error) });
  }
};