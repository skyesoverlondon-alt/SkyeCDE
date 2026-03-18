const { ensureSchema } = require('./_lib/schema');
const { query } = require('./_lib/db');
const { json, requireUser } = require('./_lib/auth');

exports.handler = async (event) => {
  try {
    await ensureSchema();
    const user = await requireUser(event);
    if (!user) return json(401, { ok: false, error: 'unauthorized' });

    let result;
    if (user.role === 'admin') {
      result = await query('SELECT * FROM stays ORDER BY turnover_date DESC NULLS LAST, created_at DESC');
    } else if (user.role === 'cohost') {
      result = await query('SELECT * FROM stays WHERE cohost_uid = $1 ORDER BY turnover_date DESC NULLS LAST, created_at DESC', [user.id]);
    } else {
      result = await query('SELECT * FROM stays WHERE host_uid = $1 ORDER BY turnover_date DESC NULLS LAST, created_at DESC', [user.id]);
    }

    return json(200, { ok: true, user, stays: result.rows });
  } catch (error) {
    console.error(error);
    return json(500, { ok: false, error: error.message || String(error) });
  }
};