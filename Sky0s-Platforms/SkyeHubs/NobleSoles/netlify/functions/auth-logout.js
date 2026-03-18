const { clearSessionCookie, json } = require('./_lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
  return json(200, { ok: true }, { 'Set-Cookie': clearSessionCookie(event) });
};