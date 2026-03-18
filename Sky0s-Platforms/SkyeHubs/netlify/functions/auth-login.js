const { query } = require('./_lib/db');
const { ensureSchema } = require('./_lib/schema');
const {
  createSession,
  json,
  normalizeEmail,
  setSessionCookie,
  verifyPassword,
} = require('./_lib/auth');

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
    await ensureSchema();

    const body = JSON.parse(event.body || '{}');
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');

    if (!email || !password) return json(400, { ok: false, error: 'missing_fields' });

    const result = await query(
      `
        SELECT id, email, role, name, status, password_hash
        FROM hub_users
        WHERE email = $1
        LIMIT 1
      `,
      [email]
    );
    const user = result.rows[0];
    if (!user) return json(401, { ok: false, error: 'invalid_credentials' });
    if (user.status !== 'active') return json(403, { ok: false, error: 'user_inactive' });

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return json(401, { ok: false, error: 'invalid_credentials' });

    const session = await createSession(user.id);
    return json(
      200,
      { ok: true, user: { id: user.id, email: user.email, role: user.role, name: user.name, status: user.status } },
      { 'Set-Cookie': setSessionCookie(session.token, session.expires, event) }
    );
  } catch (error) {
    console.error(error);
    return json(500, { ok: false, error: error.message || String(error) });
  }
};