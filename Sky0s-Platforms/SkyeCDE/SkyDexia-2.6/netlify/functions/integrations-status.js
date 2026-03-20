const { PACKAGE_STATE_BACKEND, getIntegrations, handleCors, json, listDeferredReleases, listReleaseHistory, methodNotAllowed, queryParams, requireSession, requireAuth, sanitizeIntegrations, updateState } = require('./_lib/runtime');

exports.handler = async (event) => {
  const cors = handleCors(event, ['GET', 'OPTIONS']);
  if (cors) return cors;
  if (event.httpMethod !== 'GET') return methodNotAllowed(['GET', 'OPTIONS']);

  const session = await requireAuth(event);
  if (!session) return json(401, { ok: false, error: 'Founder session or signed bearer token required.' });

  const params = queryParams(event);
  const workspaceId = String(params.ws_id || params.id || 'default').trim() || 'default';
  const state = await updateState((current) => {
    getIntegrations(current, workspaceId);
    return current;
  });

  return json(200, {
    ...sanitizeIntegrations(getIntegrations(state, workspaceId)),
    storage_backend: PACKAGE_STATE_BACKEND,
    deferred_releases: listDeferredReleases(state, workspaceId),
    release_history: listReleaseHistory(state, workspaceId),
  });
};