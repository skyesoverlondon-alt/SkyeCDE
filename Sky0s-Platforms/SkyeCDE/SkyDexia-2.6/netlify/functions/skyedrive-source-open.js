const { clone, getSkyedriveRecords, handleCors, json, methodNotAllowed, readJsonBody, requireSession, requireAuth, updateState } = require('./_lib/runtime');

exports.handler = async (event) => {
  const cors = handleCors(event, ['POST', 'OPTIONS']);
  if (cors) return cors;
  if (event.httpMethod !== 'POST') return methodNotAllowed(['POST', 'OPTIONS']);

  const session = await requireAuth(event);
  if (!session) return json(401, { ok: false, error: 'Founder session or signed bearer token required.' });

  const body = await readJsonBody(event);
  if (!body.ok) return body.response;

  const workspaceId = String(body.value?.ws_id || 'default').trim() || 'default';
  const recordId = String(body.value?.record_id || body.value?.id || '').trim();
  if (!recordId) return json(400, { ok: false, error: 'SkyeDrive record id is required.' });

  const state = await updateState((current) => {
    getSkyedriveRecords(current, workspaceId);
    return current;
  });
  const record = getSkyedriveRecords(state, workspaceId).find((item) => String(item.id) === recordId);
  if (!record) return json(404, { ok: false, error: 'Selected SkyeDrive source was not found.' });

  return json(200, {
    id: record.id,
    record_id: record.id,
    title: record.title,
    files: clone(record.files || []),
    source_kind: record.source_kind || 'workspace-save',
    created_at: record.created_at || null,
    updated_at: record.updated_at || null,
    source: 'server-storage',
  });
};