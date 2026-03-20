const { handleCors, json, methodNotAllowed, queryParams, requireSession, requireAuth, updateState } = require('./_lib/runtime');

exports.handler = async (event) => {
  const cors = handleCors(event, ['GET', 'OPTIONS']);
  if (cors) return cors;
  if (event.httpMethod !== 'GET') return methodNotAllowed(['GET', 'OPTIONS']);

  const session = await requireAuth(event);
  if (!session) return json(401, { ok: false, error: 'Founder session or signed bearer token required.' });

  const params = queryParams(event);
  const workspaceId = String(params.ws_id || 'default').trim() || 'default';
  const app = String(params.app || '').trim();
  const limit = Math.max(1, Math.min(50, Number(params.limit || 12) || 12));

  const state = await updateState((current) => {
    if (!current.blogRecords[workspaceId]) current.blogRecords[workspaceId] = [];
    return current;
  });

  const records = app === 'SkyeBlog' ? state.blogRecords[workspaceId].slice(0, limit) : [];
  return json(200, { records, app, source: 'server-storage' });
};