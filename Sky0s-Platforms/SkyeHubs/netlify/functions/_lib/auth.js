const crypto = require('crypto');
const { query } = require('./db');

const COOKIE_NAME = 'skyehubs_session';

function json(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

function base64url(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function parseCookies(cookieHeader) {
  const out = {};
  String(cookieHeader || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const index = part.indexOf('=');
      if (index === -1) return;
      const key = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      out[key] = decodeURIComponent(value);
    });
  return out;
}

function secureCookie(event) {
  const proto = String(event?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  if (proto === 'http') return false;
  if (proto === 'https') return true;
  const host = String(event?.headers?.host || '').split(':')[0].trim().toLowerCase();
  return !(host === 'localhost' || host === '127.0.0.1' || host === '::1');
}

async function pbkdf2Hash(password, saltBase64) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, Buffer.from(saltBase64, 'base64'), 150000, 32, 'sha256', (error, result) => {
      if (error) return reject(error);
      resolve(base64url(result));
    });
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64');
  const hash = await pbkdf2Hash(password, salt);
  return `pbkdf2$sha256$150000$${salt}$${hash}`;
}

async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length < 5) return false;
  const salt = parts[3];
  const expected = parts[4];
  const actual = await pbkdf2Hash(password, salt);
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function createSession(userId) {
  const token = base64url(crypto.randomBytes(32));
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
  await query(
    'INSERT INTO hub_sessions (token, user_id, expires_at) VALUES ($1, $2, $3)',
    [token, userId, expires.toISOString()]
  );
  return { token, expires };
}

function setSessionCookie(token, expires, event) {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax;${secureCookie(event) ? ' Secure;' : ''} Expires=${expires.toUTCString()}`;
}

function clearSessionCookie(event) {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax;${secureCookie(event) ? ' Secure;' : ''} Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

async function requireUser(event) {
  const token = parseCookies(event?.headers?.cookie)[COOKIE_NAME];
  if (!token) return null;
  const result = await query(
    `
      SELECT u.id, u.email, u.role, u.name, u.status
      FROM hub_sessions s
      JOIN hub_users u ON u.id = s.user_id
      WHERE s.token = $1
        AND s.expires_at > NOW()
      LIMIT 1
    `,
    [token]
  );
  return result.rows[0] || null;
}

async function requireRole(event, roles) {
  const user = await requireUser(event);
  if (!user) return { ok: false, response: json(401, { ok: false, error: 'unauthorized' }) };
  if (!roles.includes(user.role)) {
    return { ok: false, response: json(403, { ok: false, error: 'forbidden' }) };
  }
  return { ok: true, user };
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function parseAdminEmails() {
  return String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((value) => normalizeEmail(value))
    .filter(Boolean);
}

function isAdminEmail(email) {
  return parseAdminEmails().includes(normalizeEmail(email));
}

module.exports = {
  clearSessionCookie,
  createSession,
  hashPassword,
  isAdminEmail,
  json,
  normalizeEmail,
  parseCookies,
  requireRole,
  requireUser,
  setSessionCookie,
  verifyPassword,
};