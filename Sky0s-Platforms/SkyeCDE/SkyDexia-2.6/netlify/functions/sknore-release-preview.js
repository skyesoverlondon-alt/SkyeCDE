const { evaluateSknore, handleCors, json, methodNotAllowed, nowIso, readJsonBody, requireSession, requireAuth, sanitizeFiles } = require('./_lib/runtime');

exports.handler = async (event) => {
  const cors = handleCors(event, ['POST', 'OPTIONS']);
  if (cors) return cors;
  if (event.httpMethod !== 'POST') return methodNotAllowed(['POST', 'OPTIONS']);

  const session = await requireAuth(event);
  if (!session) return json(401, { ok: false, error: 'Founder session or signed bearer token required.' });

  const body = await readJsonBody(event);
  if (!body.ok) return body.response;
  const files = sanitizeFiles(body.value?.files);
  const sknore = evaluateSknore(files);

  return json(200, {
    scope: 'workspace',
    updated_at: nowIso(),
    source: 'server-storage',
    sknore,
  });
};