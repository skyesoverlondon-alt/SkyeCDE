const {
  clone,
  getWorkspace,
  handleCors,
  json,
  methodNotAllowed,
  nowIso,
  readJsonBody,
  requireSession, requireAuth,
  sanitizeFiles,
  updateState,
} = require('./_lib/runtime');

exports.handler = async (event) => {
  const cors = handleCors(event, ['POST', 'OPTIONS']);
  if (cors) return cors;
  if (event.httpMethod !== 'POST') return methodNotAllowed(['POST', 'OPTIONS']);

  const session = await requireAuth(event);
  if (!session) return json(401, { ok: false, error: 'Founder session or signed bearer token required.' });

  const body = await readJsonBody(event);
  if (!body.ok) return body.response;

  const workspaceId = String(body.value?.id || body.value?.ws_id || 'default').trim() || 'default';
  const files = sanitizeFiles(body.value?.files);
  if (!files.length) return json(400, { ok: false, error: 'Missing files object.' });

  const revision = nowIso();
  const workspaceName = String(body.value?.workspace_name || body.value?.name || 'SkyDexia 2.6 Workspace').trim() || 'SkyDexia 2.6 Workspace';

  const state = await updateState((current) => {
    const workspace = getWorkspace(current, workspaceId);
    workspace.workspace_name = workspaceName;
    workspace.files = clone(files);
    workspace.revision = revision;
    workspace.updated_at = revision;
    return current;
  });

  const workspace = getWorkspace(state, workspaceId);
  return json(200, {
    ok: true,
    revision: workspace.revision,
    workspace_name: workspace.workspace_name,
    workspace: {
      id: workspace.id,
      name: workspace.workspace_name,
      updated_at: workspace.updated_at,
    },
    source: 'server-storage',
    actor: session.sub,
  });
};