const path = require('path');
const { spawn } = require('child_process');
const { handleCors, issueSessionToken, json, methodNotAllowed, requireSession, updateState, getWorkspace, sanitizeFiles } = require('./runtime');

let nativeRuntimeServer = null;
let nativeRuntimeBaseUrl = '';
let nativeRuntimeReady = null;

function normalizeBaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return '';
  }
}

function runtimeControlOrigin(baseUrl) {
  const target = normalizeBaseUrl(baseUrl || '');
  if (!target) return '';
  try {
    return new URL(target).origin;
  } catch {
    return '';
  }
}

function configuredRuntimeControlBaseUrl() {
  return normalizeBaseUrl(process.env.SKYDEXIA_RUNTIME_CONTROL_URL || process.env.SKYDEXIA_RUNTIME_CONTROL_BASE_URL);
}

function hostedNativeRuntimeEnabled() {
  return String(process.env.SKYDEXIA_HOSTED_NATIVE_RUNTIME || '1').trim() !== '0';
}

function nativeRuntimePort() {
  return Number(process.env.SKYDEXIA_HOSTED_RUNTIME_PORT || 4592);
}

function nativeRuntimeRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

function nativeRuntimeUrl() {
  return `http://127.0.0.1:${nativeRuntimePort()}`;
}

function runtimeLaneMetadata(available, mode = 'hosted-unconfigured', controlOrigin = null) {
  return {
    available,
    mode,
    control_origin: controlOrigin || null,
  };
}

async function waitForNativeRuntimeServer(baseUrl) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15000) {
    try {
      const response = await fetch(`${baseUrl}/`, { method: 'GET' });
      if (response.ok) return;
    } catch {
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Hosted native runtime sidecar did not become ready in time.');
}

async function ensureNativeRuntimeControlServer() {
  if (nativeRuntimeBaseUrl) return nativeRuntimeBaseUrl;
  if (nativeRuntimeReady) return nativeRuntimeReady;
  nativeRuntimeReady = (async () => {
    const baseUrl = nativeRuntimeUrl();
    nativeRuntimeServer = spawn(process.execPath, ['server.js'], {
      cwd: nativeRuntimeRoot(),
      env: {
        ...process.env,
        HOST: '127.0.0.1',
        PORT: String(nativeRuntimePort()),
        SKYDEXIA_ALLOWED_ORIGIN: '',
        SKYDEXIA_DATABASE_URL: '',
        DATABASE_URL: '',
        POSTGRES_URL: '',
      },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    nativeRuntimeServer.stderr?.on('data', () => {
      // ignore sidecar stderr; route failures are surfaced via HTTP
    });
    nativeRuntimeServer.once('close', () => {
      nativeRuntimeServer = null;
      nativeRuntimeBaseUrl = '';
      nativeRuntimeReady = null;
    });
    await waitForNativeRuntimeServer(baseUrl);
    nativeRuntimeBaseUrl = baseUrl;
    return nativeRuntimeBaseUrl;
  })();
  return nativeRuntimeReady;
}

async function resolveRuntimeControl() {
  const configured = configuredRuntimeControlBaseUrl();
  if (configured) {
    return {
      available: true,
      mode: 'hosted-runtime-bridge',
      baseUrl: configured,
      controlOrigin: runtimeControlOrigin(configured) || null,
    };
  }
  if (hostedNativeRuntimeEnabled()) {
    const baseUrl = await ensureNativeRuntimeControlServer();
    return {
      available: true,
      mode: 'hosted-native-runtime',
      baseUrl,
      controlOrigin: runtimeControlOrigin(baseUrl) || null,
    };
  }
  return {
    available: false,
    mode: 'hosted-unconfigured',
    baseUrl: '',
    controlOrigin: null,
  };
}

async function runtimeControlBaseUrl() {
  const resolved = await resolveRuntimeControl();
  return resolved.baseUrl;
}

async function runtimeControlMetadata() {
  const resolved = await resolveRuntimeControl();
  return runtimeLaneMetadata(resolved.available, resolved.mode, resolved.controlOrigin);
}

function workspaceIdFromEvent(event) {
  const query = new URLSearchParams(String(event?.rawQuery || ''));
  const body = event?.body ? safeParseBody(event.body) : {};
  return String(query.get('ws_id') || body?.ws_id || body?.id || '').trim();
}

function safeParseBody(body) {
  try {
    return JSON.parse(String(body || ''));
  } catch {
    return {};
  }
}

async function syncWorkspaceToNativeRuntime(baseUrl, session, event) {
  const workspaceId = workspaceIdFromEvent(event);
  if (!workspaceId) return;
  const body = event?.body ? safeParseBody(event.body) : {};
  let workspaceName = String(body?.workspace_name || body?.workspaceName || '').trim();
  let files = Array.isArray(body?.files) ? sanitizeFiles(body.files) : null;
  if (!files || !files.length) {
    const state = await updateState((current) => {
      getWorkspace(current, workspaceId);
      return current;
    });
    const workspace = getWorkspace(state, workspaceId);
    workspaceName = workspaceName || workspace.workspace_name || workspace.workspaceName || 'SkyDexia 2.6 Workspace';
    files = sanitizeFiles(workspace.files);
  }
  const token = issueSessionToken(session.sub).token;
  const response = await fetch(new URL('/api/ws-save', `${baseUrl}/`), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ws_id: workspaceId,
      id: workspaceId,
      workspace_name: workspaceName || 'SkyDexia 2.6 Workspace',
      files,
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || 'Failed to sync hosted workspace into the native runtime sidecar.');
  }
}

async function proxyRuntimeRoute(event, methods, routePath) {
  const cors = handleCors(event, methods);
  if (cors) return cors;
  if (!methods.includes(event.httpMethod)) return methodNotAllowed(methods);

  const session = requireSession(event);
  if (!session) return json(401, { ok: false, error: 'Founder session or signed bearer token required.' });

  const resolved = await resolveRuntimeControl();
  if (!resolved.baseUrl) {
    return json(501, {
      ok: false,
      error: 'Hosted runtime control is not configured for this origin. Set SKYDEXIA_RUNTIME_CONTROL_URL or leave hosted native runtime enabled so SkyDexia can boot its own sidecar runtime lane.',
      runtime_lane: runtimeLaneMetadata(false, resolved.mode, resolved.controlOrigin),
    });
  }

  if (resolved.mode === 'hosted-native-runtime') {
    await syncWorkspaceToNativeRuntime(resolved.baseUrl, session, event);
  }

  const target = new URL(routePath, `${resolved.baseUrl}/`);
  if (event.rawQuery) target.search = event.rawQuery;
  const bridgedToken = issueSessionToken(session.sub).token;
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${bridgedToken}`,
    'X-SkyDexia-Runtime-Bridge': resolved.mode,
  };
  if (event.body && event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') {
    headers['Content-Type'] = String(event.headers?.['content-type'] || event.headers?.['Content-Type'] || 'application/json');
  }

  try {
    const response = await fetch(target, {
      method: event.httpMethod,
      headers,
      body: event.httpMethod === 'GET' || event.httpMethod === 'HEAD' ? undefined : event.body,
    });
    const text = await response.text();
    let body = text;
    const contentType = String(response.headers.get('content-type') || 'application/json; charset=utf-8');
    if (contentType.includes('application/json')) {
      const payload = text ? JSON.parse(text) : {};
      body = JSON.stringify({
        ...(payload && typeof payload === 'object' ? payload : { ok: response.ok }),
        runtime_lane: runtimeLaneMetadata(true, resolved.mode, resolved.controlOrigin),
      });
    }
    return {
      statusCode: response.status,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
      body,
    };
  } catch (error) {
    return json(502, {
      ok: false,
      error: error instanceof Error ? error.message : 'Hosted runtime bridge failed.',
      runtime_lane: runtimeLaneMetadata(false, resolved.mode, resolved.controlOrigin),
    });
  }
}

module.exports = {
  proxyRuntimeRoute,
  runtimeControlBaseUrl,
  runtimeControlMetadata,
  runtimeLaneMetadata,
};