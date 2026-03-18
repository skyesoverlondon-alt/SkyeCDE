const { query } = require('./_lib/db');
const { ensureSchema } = require('./_lib/schema');
const { createSession, hashPassword, isAdminEmail, json, normalizeEmail, setSessionCookie } = require('./_lib/auth');

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
    await ensureSchema();
    const body = JSON.parse(event.body || '{}');
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');
    const name = String(body.name || '').trim() || null;
    const requestedRole = String(body.requestedRole || 'client').trim().toLowerCase();
    if (!email || !email.includes('@')) return json(400, { ok: false, error: 'invalid_email' });
    if (password.length < 8) return json(400, { ok: false, error: 'password_too_short' });

    let role = 'client';
    if (requestedRole === 'admin' && isAdminEmail(email)) role = 'admin';
    const passwordHash = await hashPassword(password);
    const inserted = await query(
      `
        INSERT INTO hub_users (id, email, password_hash, role, name, status, created_at, updated_at)
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 'active', NOW(), NOW())
        RETURNING id, email, role, name, status
      `,
      [email, passwordHash, role, name]
    ).catch((error) => {
      if (String(error?.message || '').toLowerCase().includes('unique')) return null;
      throw error;
    });

    if (!inserted) return json(409, { ok: false, error: 'email_exists' });
    const user = inserted.rows[0];
    const session = await createSession(user.id);
    return json(200, { ok: true, user }, { 'Set-Cookie': setSessionCookie(session.token, session.expires, event) });
  } catch (error) {
    console.error(error);
    return json(500, { ok: false, error: error.message || String(error) });
  }
};