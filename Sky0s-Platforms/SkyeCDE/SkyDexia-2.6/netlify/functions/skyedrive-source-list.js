const { getSkyedriveRecords, handleCors, json, methodNotAllowed, queryParams, requireSession, requireAuth, updateState } = require('./_lib/runtime');

exports.handler = async (event) => {
  const cors = handleCors(event, ['GET', 'OPTIONS']);
  if (cors) return cors;
  if (event.httpMethod !== 'GET') return methodNotAllowed(['GET', 'OPTIONS']);

  const session = await requireAuth(event);
  if (!session) return json(401, { ok: false, error: 'Founder session or signed bearer token required.' });

  const params = queryParams(event);
  const workspaceId = String(params.ws_id || params.id || 'default').trim() || 'default';
  const state = await updateState((current) => {
    getSkyedriveRecords(current, workspaceId);
    return current;
  });
  const records = getSkyedriveRecords(state, workspaceId)
    .slice()
    .sort((left, right) => String(right.updated_at || '').localeCompare(String(left.updated_at || '')));
  return json(200, { records, source: 'server-storage' });
};