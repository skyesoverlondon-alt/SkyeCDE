const { findDeferredRelease, handleCors, json, methodNotAllowed, readJsonBody, requireSession, requireAuth, updateState } = require('./_lib/runtime');

function buildReplayEvent(event, functionName, payload) {
  return {
    ...event,
    httpMethod: 'POST',
    path: `/api/${functionName}`,
    rawUrl: `https://skydexia.local/api/${functionName}`,
    rawQuery: '',
    body: JSON.stringify(payload),
  };
}

function parseHandlerBody(result) {
  if (!result || typeof result.body !== 'string' || !result.body.trim()) return {};
  try {
    return JSON.parse(result.body);
  } catch {
    return {};
  }
}

exports.handler = async (event) => {
  const cors = handleCors(event, ['POST', 'OPTIONS']);
  if (cors) return cors;
  if (event.httpMethod !== 'POST') return methodNotAllowed(['POST', 'OPTIONS']);

  const session = await requireAuth(event);
  if (!session) return json(401, { ok: false, error: 'Founder session or signed bearer token required.' });

  const body = await readJsonBody(event);
  if (!body.ok) return body.response;

  const workspaceId = String(body.value?.ws_id || 'default').trim() || 'default';
  const releaseId = String(body.value?.release_id || body.value?.id || '').trim();
  if (!releaseId) return json(400, { ok: false, error: 'release_id is required.' });

  const state = await updateState((current) => current);
  const deferredRelease = findDeferredRelease(state, releaseId, workspaceId);
  if (!deferredRelease) return json(404, { ok: false, error: 'Deferred release record was not found.' });

  let functionName = '';
  let replayPayload = { ws_id: deferredRelease.ws_id || workspaceId };

  if (deferredRelease.channel === 'GitHub') {
    functionName = 'github-push';
    if (deferredRelease.message) replayPayload.message = deferredRelease.message;
  } else if (deferredRelease.channel === 'Netlify') {
    functionName = 'netlify-deploy';
    if (deferredRelease.title) replayPayload.title = deferredRelease.title;
  } else {
    return json(400, { ok: false, error: `Replay is not supported for ${deferredRelease.channel || 'this channel'}.` });
  }

  const handler = require(`./${functionName}`).handler;
  const result = await handler(buildReplayEvent(event, functionName, replayPayload));
  const payload = parseHandlerBody(result);

  return json(Number(result?.statusCode || 200), {
    ...payload,
    replayed_release_id: deferredRelease.id,
    replay_channel: deferredRelease.channel,
  });
};