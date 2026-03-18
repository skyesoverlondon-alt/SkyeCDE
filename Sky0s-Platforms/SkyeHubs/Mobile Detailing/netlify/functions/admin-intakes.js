const { ensureSchema } = require('./_lib/schema');
const { query } = require('./_lib/db');
const { json, requireRole } = require('./_lib/auth');

exports.handler = async (event) => {
  try {
    await ensureSchema();
    const auth = await requireRole(event, ['admin']);
    if (!auth.ok) return auth.response;
    const result = await query(
      `
        SELECT id, email, first_name, last_name, city, payload, uploads, status, source,
               created_at, updated_at, approved_at, approved_user_id
        FROM detailer_intake
        ORDER BY created_at DESC
      `
    );
    return json(200, { ok: true, submissions: result.rows });
  } catch (error) {
    console.error(error);
    return json(500, { ok: false, error: error.message || String(error) });
  }
};