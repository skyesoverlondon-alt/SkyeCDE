const { ensureSchema } = require('./_lib/schema');
const { query } = require('./_lib/db');
const { json, requireUser } = require('./_lib/auth');

async function loadStay(stayId) {
  const result = await query('SELECT * FROM stays WHERE id = $1 LIMIT 1', [stayId]);
  return result.rows[0] || null;
}

function canAccessStay(user, stay) {
  return user.role === 'admin' || stay.host_uid === user.id || stay.cohost_uid === user.id;
}

exports.handler = async (event) => {
  try {
    await ensureSchema();
    const user = await requireUser(event);
    if (!user) return json(401, { ok: false, error: 'unauthorized' });

    if (event.httpMethod === 'GET') {
      const stayId = String(event.queryStringParameters?.stayId || '').trim();
      if (!stayId) return json(400, { ok: false, error: 'missing_stay_id' });
      const stay = await loadStay(stayId);
      if (!stay) return json(404, { ok: false, error: 'stay_not_found' });
      if (!canAccessStay(user, stay)) return json(403, { ok: false, error: 'forbidden' });

      const messages = await query(
        'SELECT id, text, from_user_id, from_role, created_at FROM stay_messages WHERE stay_id = $1 ORDER BY created_at ASC',
        [stayId]
      );
      return json(200, { ok: true, messages: messages.rows });
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const stayId = String(body.stayId || '').trim();
      const text = String(body.text || '').trim();
      if (!stayId || !text) return json(400, { ok: false, error: 'missing_fields' });

      const stay = await loadStay(stayId);
      if (!stay) return json(404, { ok: false, error: 'stay_not_found' });
      if (!canAccessStay(user, stay)) return json(403, { ok: false, error: 'forbidden' });

      await query(
        `
          INSERT INTO stay_messages (id, stay_id, text, from_user_id, from_role, created_at)
          VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW())
        `,
        [stayId, text, user.id, user.role]
      );

      return json(200, { ok: true });
    }

    return json(405, { ok: false, error: 'method_not_allowed' });
  } catch (error) {
    console.error(error);
    return json(500, { ok: false, error: error.message || String(error) });
  }
};