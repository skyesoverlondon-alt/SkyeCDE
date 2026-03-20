const { clone, getWorkspace, handleCors, json, methodNotAllowed, queryParams, requireSession, requireAuth, updateState } = require('./_lib/runtime');

exports.handler = async (event) => {
  const cors = handleCors(event, ['GET', 'OPTIONS']);
  if (cors) return cors;
  if (event.httpMethod !== 'GET') return methodNotAllowed(['GET', 'OPTIONS']);

  const session = await requireAuth(event);
  if (!session) return json(401, { ok: false, error: 'Founder session or signed bearer token required.' });

  const params = queryParams(event);
  const workspaceId = String(params.id || params.ws_id || 'default').trim() || 'default';
  const state = await updateState((current) => {
    getWorkspace(current, workspaceId);
    return current;
  });
  const workspace = getWorkspace(state, workspaceId);
  return json(200, {
    id: workspace.id,
    files: clone(workspace.files),
    revision: workspace.revision || '',
    workspace_name: workspace.workspace_name || 'SkyDexia 2.6 Workspace',
    updated_at: workspace.updated_at || null,
    source: 'server-storage',
  });
};