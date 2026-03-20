const {
  appendDeferredRelease,
  appendReleaseHistory,
  clearDeferredReleases,
  createId,
  evaluateSknore,
  firstEnv,
  getIntegrations,
  getWorkspace,
  handleCors,
  json,
  methodNotAllowed,
  nowIso,
  readJsonBody,
  readStoredSecret,
  requireSession, requireAuth,
  sanitizeFiles,
  updateState,
} = require('./_lib/runtime');

function makeZip(files) {
  const entries = files.map((file) => [file.path, file.content]);
  const encoder = new TextEncoder();
  const local = [];
  const central = [];
  let offset = 0;

  function crc32(buffer) {
    let current = ~0;
    const table = crc32.table || (crc32.table = Array.from({ length: 256 }, (_, value) => {
      let next = value;
      for (let index = 0; index < 8; index += 1) next = (next & 1) ? (0xEDB88320 ^ (next >>> 1)) : (next >>> 1);
      return next >>> 0;
    }));
    for (let index = 0; index < buffer.length; index += 1) current = table[(current ^ buffer[index]) & 255] ^ (current >>> 8);
    return (~current) >>> 0;
  }

  for (const [name, content] of entries) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(String(content));
    const crc = crc32(data);

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, data.length, true);
    localView.setUint32(22, data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localHeader.set(nameBytes, 30);
    local.push(Buffer.from(localHeader), Buffer.from(data));

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    central.push(Buffer.from(centralHeader));
    offset += localHeader.length + data.length;
  }

  const centralSize = central.reduce((sum, entry) => sum + entry.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  return Buffer.concat([...local, ...central, Buffer.from(end)]);
}

async function netlifyFetch(token, method, pathname, body, contentType = 'application/json') {
  const response = await fetch(`https://api.netlify.com/api/v1${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': contentType,
    },
    body: body || null,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || `Netlify ${response.status}`);
  return payload;
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
  const state = await updateState((current) => {
    getIntegrations(current, workspaceId);
    getWorkspace(current, workspaceId);
    return current;
  });

  const integrations = getIntegrations(state, workspaceId);
  const workspace = getWorkspace(state, workspaceId);
  const files = sanitizeFiles(workspace.files);
  const sknore = evaluateSknore(files);
  const releasableFiles = files.filter((file) => !sknore.blocked_paths.includes(file.path));
  if (!releasableFiles.length) {
    return json(400, { ok: false, error: 'No releasable files remain after SKNore policy filtering.' });
  }
  const token = readStoredSecret(integrations.netlify, 'token_cipher', 'token') || firstEnv('SKYDEXIA_NETLIFY_TOKEN', 'NETLIFY_AUTH_TOKEN', 'NETLIFY_TOKEN');
  let siteId = String(integrations.netlify?.site_id || '').trim();
  let siteName = String(integrations.netlify?.site_name || '').trim();
  const stamp = nowIso();
  if (!token) {
    let deferredRelease = null;
    const reason = 'Netlify deploy was deferred because no deploy token is currently available in the package lane.';
    await updateState((current) => {
      clearDeferredReleases(current, (record) => String(record?.ws_id || '') === workspaceId && record?.channel === 'Netlify');
      deferredRelease = appendDeferredRelease(current, {
        id: createId('release'),
        channel: 'Netlify',
        ws_id: workspaceId,
        site_id: siteId || null,
        site_name: siteName || null,
        title: String(body.value?.title || '').trim(),
        created_at: stamp,
        updated_at: stamp,
        actor: session.sub,
        source: 'server-storage',
        included_count: sknore.included_count,
        blocked_count: sknore.blocked_count,
        reason_code: 'missing-token',
        reason,
      });
      return current;
    });
    return json(202, {
      ok: true,
      deferred: true,
      release: deferredRelease,
      site_id: siteId || null,
      site_name: siteName || null,
      included_count: sknore.included_count,
      blocked_count: sknore.blocked_count,
      sknore,
      warning: reason,
      source: 'server-storage',
    });
  }

  try {
    if (!siteId && siteName) {
      const sites = await netlifyFetch(token, 'GET', '/sites');
      const matchedSite = Array.isArray(sites) ? sites.find((site) => String(site?.name || '').trim() === siteName) : null;
      if (!matchedSite) return json(404, { ok: false, error: 'Configured Netlify site name was not found for the active token.' });
      siteId = String(matchedSite.id || '').trim();
      siteName = String(matchedSite.name || siteName).trim();
    }
  if (!siteId) {
    return json(400, { ok: false, error: 'Netlify site id is not configured. Connect a site first.' });
  }
  const zipBuffer = makeZip(releasableFiles);
  const deploy = await netlifyFetch(token, 'POST', `/sites/${encodeURIComponent(siteId)}/deploys`, zipBuffer, 'application/zip');
  const deployId = String(deploy?.id || createId('deploy')).trim();
  const url = String(deploy?.ssl_url || deploy?.deploy_url || deploy?.url || '').trim() || `https://${siteName || 'skydexia-2-6'}.netlify.app`;

    await updateState((current) => {
      const nextIntegrations = getIntegrations(current, workspaceId);
      nextIntegrations.netlify = {
        ...nextIntegrations.netlify,
        connected: true,
        site_id: siteId,
        site_name: siteName || nextIntegrations.netlify?.site_name || null,
        token_present: true,
        updated_at: stamp,
      };
      clearDeferredReleases(current, (record) => String(record?.ws_id || '') === workspaceId && record?.channel === 'Netlify');
      appendReleaseHistory(current, {
        id: createId('release'),
        channel: 'Netlify',
        ws_id: workspaceId,
        deploy_id: deployId,
        url,
        site_id: siteId,
        site_name: siteName || null,
        title: String(body.value?.title || '').trim(),
        created_at: stamp,
        updated_at: stamp,
        actor: session.sub,
        source: 'server-storage',
        included_count: sknore.included_count,
        blocked_count: sknore.blocked_count,
      });
      return current;
    });

    return json(200, {
      ok: true,
      deploy_id: deployId,
      url,
      site_id: siteId,
      site_name: siteName || null,
      included_count: sknore.included_count,
      blocked_count: sknore.blocked_count,
      sknore,
      source: 'server-storage',
    });
  } catch (error) {
    let deferredRelease = null;
    await updateState((current) => {
      clearDeferredReleases(current, (record) => String(record?.ws_id || '') === workspaceId && record?.channel === 'Netlify');
      deferredRelease = appendDeferredRelease(current, {
        id: createId('release'),
        channel: 'Netlify',
        ws_id: workspaceId,
        site_id: siteId || null,
        site_name: siteName || null,
        title: String(body.value?.title || '').trim(),
        created_at: stamp,
        updated_at: stamp,
        actor: session.sub,
        source: 'server-storage',
        included_count: sknore.included_count,
        blocked_count: sknore.blocked_count,
        reason_code: 'adapter-unavailable',
        reason: error?.message || 'Netlify deploy failed before a remote deploy could be created.',
      });
      return current;
    });
    return json(202, {
      ok: true,
      deferred: true,
      release: deferredRelease,
      site_id: siteId || null,
      site_name: siteName || null,
      included_count: sknore.included_count,
      blocked_count: sknore.blocked_count,
      sknore,
      warning: deferredRelease.reason,
      source: 'server-storage',
    });
  }
};