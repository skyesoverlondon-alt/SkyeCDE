const { createId, handleCors, json, methodNotAllowed, nowIso, readJsonBody, requireSession, requireAuth, updateState } = require('./_lib/runtime');

exports.handler = async (event) => {
  const cors = handleCors(event, ['POST', 'OPTIONS']);
  if (cors) return cors;
  if (event.httpMethod !== 'POST') return methodNotAllowed(['POST', 'OPTIONS']);

  const session = await requireAuth(event);
  if (!session) return json(401, { ok: false, error: 'Founder session or signed bearer token required.' });

  const body = await readJsonBody(event);
  if (!body.ok) return body.response;
  const id = createId('notify');
  const record = {
    id,
    ws_id: String(body.value?.ws_id || 'default').trim() || 'default',
    channel: String(body.value?.channel || 'community').trim() || 'community',
    topic: String(body.value?.topic || 'general').trim() || 'general',
    message: String(body.value?.message || '').trim(),
    source: String(body.value?.source || 'SkyDexia 2.6').trim() || 'SkyDexia 2.6',
    created_at: nowIso(),
    actor: session.sub,
  };
  if (!record.message) return json(400, { ok: false, error: 'Message is required.' });

  await updateState((current) => {
    current.notifications.unshift(record);
    current.notifications = current.notifications.slice(0, 100);
    return current;
  });

  return json(200, { ok: true, queued: true, id, source: 'server-storage' });
};