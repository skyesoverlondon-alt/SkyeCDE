const {
  clone,
  createId,
  evaluateSknore,
  getIntegrations,
  getSkyedriveRecords,
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

  const workspaceId = String(body.value?.ws_id || 'default').trim() || 'default';
  const state = await updateState((current) => {
    getWorkspace(current, workspaceId);
    getIntegrations(current, workspaceId);
    getSkyedriveRecords(current, workspaceId);
    return current;
  });

  const workspace = getWorkspace(state, workspaceId);
  const incomingFiles = sanitizeFiles(body.value?.files);
  const files = incomingFiles.length ? incomingFiles : sanitizeFiles(workspace.files);
  const sknore = evaluateSknore(files);
  const allowed = files.filter((file) => !sknore.blocked_paths.includes(file.path));
  const stamp = nowIso();
  const recordId = createId('drive');
  const title = String(body.value?.title || workspace.workspace_name || 'SkyDexia 2.6 Workspace Snapshot').trim() || 'SkyDexia 2.6 Workspace Snapshot';
  const record = {
    id: recordId,
    ws_id: workspaceId,
    title,
    note: String(body.value?.note || '').trim(),
    files: clone(allowed),
    file_count: allowed.length,
    source_kind: String(body.value?.source_kind || 'workspace-save').trim() || 'workspace-save',
    source_name: String(body.value?.source_name || workspace.workspace_name || '').trim(),
    created_at: stamp,
    updated_at: stamp,
    actor: session.sub,
    sknore,
  };

  await updateState((current) => {
    getSkyedriveRecords(current, workspaceId).unshift(record);
    const integrations = getIntegrations(current, workspaceId);
    integrations.skyedrive = { connected: true, ws_id: workspaceId, record_id: recordId, title };
    return current;
  });

  return json(200, {
    ok: true,
    record_id: recordId,
    title,
    file_count: allowed.length,
    included_count: sknore.included_count,
    blocked_count: sknore.blocked_count,
    sknore,
    source: 'server-storage',
  });
};