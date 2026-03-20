const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

let storagePool = null;
let storageReady = null;

function resolveDataDir() {
  const configured = localEnv('SKYDEXIA_DATA_DIR') || localEnv('SKYDEXIA_STATE_DIR');
  if (configured) return path.resolve(configured);
  return path.join(__dirname, '..', '.runtime-data');
}

const DATA_DIR = resolveDataDir();
const DATA_FILE = path.join(DATA_DIR, 'skydexia-2.6.json');
const SESSION_COOKIE = 'kx_session';

function normalizeTableName(value) {
  const raw = String(value || 'skydexia_runtime_state').trim().toLowerCase();
  return /^[a-z_][a-z0-9_]*$/.test(raw) ? raw : 'skydexia_runtime_state';
}

function normalizeOrigin(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw).origin;
  } catch {
    return '';
  }
}

function resolveAllowedOrigin() {
  const candidates = [
    process.env.SKYDEXIA_ALLOWED_ORIGIN,
    process.env.SITE_URL,
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
  ];
  for (const candidate of candidates) {
    const origin = normalizeOrigin(candidate);
    if (origin) return origin;
  }
  return '';
}

const ALLOWED_ORIGIN = resolveAllowedOrigin();

const BASE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  ...(ALLOWED_ORIGIN ? {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  } : {}),
};

function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...BASE_HEADERS, ...extraHeaders },
    body: JSON.stringify(body),
  };
}

function handleCors(event, methods) {
  const allowMethods = Array.isArray(methods) && methods.length ? methods.join(', ') : BASE_HEADERS['Access-Control-Allow-Methods'];
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: { ...BASE_HEADERS, 'Access-Control-Allow-Methods': allowMethods },
      body: '',
    };
  }
  return null;
}

function methodNotAllowed(methods) {
  return json(405, { ok: false, error: 'Method not allowed.' }, { Allow: methods.join(', ') });
}

function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function readJsonBody(event) {
  return { ok: true, value: safeJsonParse(event.body || '{}', {}) };
}

function queryParams(event) {
  const url = new URL(event.rawUrl || `https://skydexia.local${event.path || '/'}${event.rawQuery ? `?${event.rawQuery}` : ''}`);
  const out = {};
  for (const [key, value] of url.searchParams.entries()) out[key] = value;
  return out;
}

function localEnv(name, fallback = '') {
  return String(process.env[name] || fallback || '').trim();
}

function firstEnv(...names) {
  for (const name of names) {
    const value = localEnv(name);
    if (value) return value;
  }
  return '';
}

const DATABASE_URL = firstEnv('SKYDEXIA_DATABASE_URL', 'DATABASE_URL', 'POSTGRES_URL');
const DATABASE_TABLE = normalizeTableName(localEnv('SKYDEXIA_DATABASE_TABLE', 'skydexia_runtime_state'));
const STORAGE_BACKEND = DATABASE_URL ? 'postgres' : 'file';

function resolveDatabaseSsl() {
  const mode = localEnv('SKYDEXIA_DATABASE_SSL', 'prefer').toLowerCase();
  if (!DATABASE_URL || mode === 'disable' || mode === 'false' || mode === '0') return undefined;
  if (mode === 'require' || mode === 'true' || mode === '1') {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

function resolvePgPool() {
  if (!DATABASE_URL) return null;
  if (storagePool) return storagePool;
  let pg;
  try {
    pg = require('pg');
  } catch {
    throw new Error('SKYDEXIA_DATABASE_URL is configured but the pg package is not installed. Run npm install in the SkyDexia 2.6 package lane.');
  }
  storagePool = new pg.Pool({
    connectionString: DATABASE_URL,
    max: 1,
    ssl: resolveDatabaseSsl(),
  });
  storagePool.on('error', () => null);
  return storagePool;
}

async function closeStorage() {
  const pool = storagePool;
  storageReady = null;
  storagePool = null;
  if (!pool) return;
  await pool.end().catch(() => null);
}

async function ensureStorageReady() {
  if (!DATABASE_URL) return null;
  if (!storageReady) {
    storageReady = (async () => {
      const pool = resolvePgPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ${DATABASE_TABLE} (
          state_key TEXT PRIMARY KEY,
          payload JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      return pool;
    })();
  }
  return storageReady;
}

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

function sanitizeFiles(files) {
  if (!Array.isArray(files)) return [];
  return files
    .map((file) => ({
      path: String(file?.path || '').replace(/^\/+/, '').trim(),
      content: typeof file?.content === 'string' ? file.content : '',
    }))
    .filter((file) => file.path);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function sessionSecret() {
  return localEnv('SKYDEXIA_SESSION_SECRET') || localEnv('SESSION_SECRET');
}

function hasConfiguredSessionSecret() {
  return Boolean(sessionSecret());
}

function secretKey() {
  if (!hasConfiguredSessionSecret()) throw new Error('SKYDEXIA_SESSION_SECRET or SESSION_SECRET must be configured for sealed runtime secrets and signed sessions.');
  return crypto.createHash('sha256').update(sessionSecret()).digest();
}

function sealSecret(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: ciphertext.toString('base64'),
  };
}

function unsealSecret(sealed) {
  if (!sealed || typeof sealed !== 'object') return '';
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey(), Buffer.from(String(sealed.iv || ''), 'base64'));
    decipher.setAuthTag(Buffer.from(String(sealed.tag || ''), 'base64'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(String(sealed.data || ''), 'base64')),
      decipher.final(),
    ]);
    return plaintext.toString('utf8').trim();
  } catch {
    return '';
  }
}

function readStoredSecret(container, cipherKey, legacyKey) {
  const fromCipher = unsealSecret(container?.[cipherKey]);
  if (fromCipher) return fromCipher;
  return String(container?.[legacyKey] || '').trim();
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64url(input) {
  const normalized = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, 'base64').toString('utf8');
}

function signTokenPayload(payload) {
  if (!hasConfiguredSessionSecret()) throw new Error('SKYDEXIA_SESSION_SECRET or SESSION_SECRET must be configured for signed runtime tokens.');
  const encoded = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', sessionSecret()).update(encoded).digest('base64url');
  return `sxt.${encoded}.${signature}`;
}

function verifyToken(token) {
  if (!hasConfiguredSessionSecret()) return null;
  const raw = String(token || '').trim();
  const [prefix, encoded, signature] = raw.split('.');
  if (prefix !== 'sxt' || !encoded || !signature) return null;
  const expected = crypto.createHmac('sha256', sessionSecret()).update(encoded).digest('base64url');
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) return null;
  const payload = safeJsonParse(fromBase64url(encoded), null);
  if (!payload || typeof payload !== 'object') return null;
  if (payload.exp && Date.now() > Number(payload.exp)) return null;
  return payload;
}

function parseCookies(headerValue) {
  const cookies = {};
  if (!headerValue) return cookies;
  String(headerValue)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const [name, ...rest] = part.split('=');
      cookies[name] = rest.join('=');
    });
  return cookies;
}

function readAuthToken(event) {
  const authHeader = String(event.headers?.authorization || event.headers?.Authorization || '').trim();
  if (/^Bearer\s+/i.test(authHeader)) return authHeader.replace(/^Bearer\s+/i, '').trim();
  const cookies = parseCookies(event.headers?.cookie || event.headers?.Cookie || '');
  return String(cookies[SESSION_COOKIE] || '').trim();
}

function readFounderGatewaySecret() {
  return localEnv('Founders_GateWay_Key') || localEnv('FOUNDERS_GATEWAY_KEY');
}

function readFounderGatewayEmail() {
  return localEnv('Founders_GateWay_Email') || localEnv('FOUNDERS_GATEWAY_EMAIL') || 'founder@skydexia.local';
}

function hasValidFounderGatewayKey(key) {
  const expected = readFounderGatewaySecret();
  const provided = String(key || '').trim();
  if (!expected || !provided) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function issueSessionToken(email) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 90 * 24 * 60 * 60 * 1000;
  return {
    token: signTokenPayload({
      sub: String(email || readFounderGatewayEmail()).trim().toLowerCase(),
      role: 'owner',
      founder_gateway: true,
      scopes: ['admin'],
      iat: issuedAt,
      exp: expiresAt,
    }),
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

function requireSession(event) {
  const token = readAuthToken(event);
  if (!token) return null;
  return verifyToken(token);
}

function isLocalHost(hostname) {
  const value = String(hostname || '').trim().toLowerCase();
  return !value || value === 'localhost' || value === '127.0.0.1' || value === '::1';
}

function shouldUseSecureCookie(event) {
  const forwardedProto = String(event?.headers?.['x-forwarded-proto'] || event?.headers?.['X-Forwarded-Proto'] || '').trim().toLowerCase();
  if (forwardedProto === 'https') return true;
  if (forwardedProto === 'http') return false;
  const forwardedHost = String(event?.headers?.['x-forwarded-host'] || event?.headers?.['X-Forwarded-Host'] || event?.headers?.host || event?.headers?.Host || '').trim();
  const hostname = forwardedHost.split(':')[0];
  return !isLocalHost(hostname);
}

function sessionCookie(token, expiresAt, event) {
  const secure = shouldUseSecureCookie(event);
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}${secure ? '; Secure' : ''}`;
}

function defaultWorkspace(id) {
  return {
    id,
    workspace_name: 'SkyDexia 2.6 Workspace',
    revision: '',
    files: [
      {
        path: 'README.md',
        content: '# SkyDexia 2.6 Workspace\n\nYour workspace server lane is ready. Save this snapshot to persist it through the packaged Netlify runtime.\n',
      },
    ],
    updated_at: null,
  };
}

function defaultIntegrations(workspaceId) {
  return {
    skyedrive: { connected: false, ws_id: workspaceId, record_id: null, title: null },
    github: { connected: false, repo: null, branch: null, installation_id: null, token_cipher: null, token_present: false, mode: 'server-storage' },
    netlify: { connected: false, site_id: null, site_name: null, token_cipher: null, token_present: false, mode: 'server-storage' },
  };
}

function sanitizeIntegrations(integrations) {
  const source = integrations || defaultIntegrations('default');
  return {
    skyedrive: clone(source.skyedrive || { connected: false }),
    github: {
      connected: Boolean(source.github?.connected),
      repo: source.github?.repo || null,
      branch: source.github?.branch || null,
      installation_id: source.github?.installation_id || null,
      token_present: Boolean(source.github?.token_present || source.github?.token_cipher || source.github?.token || firstEnv('SKYDEXIA_GITHUB_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN')),
      mode: source.github?.mode || 'server-storage',
      updated_at: source.github?.updated_at || null,
    },
    netlify: {
      connected: Boolean(source.netlify?.connected),
      site_id: source.netlify?.site_id || null,
      site_name: source.netlify?.site_name || null,
      token_present: Boolean(source.netlify?.token_present || source.netlify?.token_cipher || source.netlify?.token || firstEnv('SKYDEXIA_NETLIFY_TOKEN', 'NETLIFY_AUTH_TOKEN', 'NETLIFY_TOKEN')),
      mode: source.netlify?.mode || 'server-storage',
      updated_at: source.netlify?.updated_at || null,
    },
  };
}

function sanitizeReleaseRecord(record) {
  if (!record || typeof record !== 'object') return null;
  return {
    id: record.id || null,
    status: record.status || 'completed',
    channel: record.channel || null,
    ws_id: record.ws_id || 'default',
    created_at: record.created_at || null,
    updated_at: record.updated_at || record.created_at || null,
    actor: record.actor || null,
    source: record.source || 'server-storage',
    repo: record.repo || null,
    branch: record.branch || null,
    commit_sha: record.commit_sha || null,
    site_id: record.site_id || null,
    site_name: record.site_name || null,
    deploy_id: record.deploy_id || null,
    url: record.url || null,
    included_count: Number(record.included_count || 0),
    blocked_count: Number(record.blocked_count || 0),
    message: record.message || '',
    files_uploaded: Number(record.files_uploaded || 0),
    files_deleted: Number(record.files_deleted || 0),
    title: record.title || '',
    reason_code: record.reason_code || null,
    reason: record.reason || null,
    deferred: Boolean(record.deferred || record.status === 'deferred'),
  };
}

function ensureReleaseCollections(state) {
  if (!Array.isArray(state.releaseHistory)) state.releaseHistory = [];
  if (!Array.isArray(state.deferredReleases)) state.deferredReleases = [];
}

function appendReleaseHistory(state, record) {
  ensureReleaseCollections(state);
  const sanitized = sanitizeReleaseRecord({ ...record, status: 'completed', deferred: false });
  state.releaseHistory.unshift(sanitized);
  state.releaseHistory = state.releaseHistory.slice(0, 50);
  return sanitized;
}

function appendDeferredRelease(state, record) {
  ensureReleaseCollections(state);
  const sanitized = sanitizeReleaseRecord({ ...record, status: 'deferred', deferred: true });
  state.deferredReleases.unshift(sanitized);
  state.deferredReleases = state.deferredReleases.slice(0, 50);
  return sanitized;
}

function clearDeferredReleases(state, matcher) {
  ensureReleaseCollections(state);
  state.deferredReleases = state.deferredReleases.filter((record) => !matcher(record));
}

function findDeferredRelease(state, releaseId, workspaceId) {
  ensureReleaseCollections(state);
  const normalizedReleaseId = String(releaseId || '').trim();
  const normalizedWorkspaceId = String(workspaceId || '').trim();
  return state.deferredReleases
    .map((record) => sanitizeReleaseRecord(record))
    .filter(Boolean)
    .find((record) => {
      if (normalizedReleaseId && String(record.id || '').trim() !== normalizedReleaseId) return false;
      if (normalizedWorkspaceId && String(record.ws_id || 'default').trim() !== normalizedWorkspaceId) return false;
      return true;
    }) || null;
}

function listReleaseHistory(state, workspaceId) {
  ensureReleaseCollections(state);
  const id = String(workspaceId || '').trim() || 'default';
  return state.releaseHistory
    .filter((record) => String(record?.ws_id || 'default') === id)
    .map((record) => sanitizeReleaseRecord(record))
    .filter(Boolean);
}

function listDeferredReleases(state, workspaceId) {
  ensureReleaseCollections(state);
  const id = String(workspaceId || '').trim() || 'default';
  return state.deferredReleases
    .filter((record) => String(record?.ws_id || 'default') === id)
    .map((record) => sanitizeReleaseRecord(record))
    .filter(Boolean);
}

function emptyState() {
  return {
    workspaces: {},
    integrations: {},
    skyedrive: {},
    notifications: [],
    blogRecords: {},
    releaseHistory: [],
    deferredReleases: [],
  };
}

let writeChain = Promise.resolve();

async function loadState() {
  if (STORAGE_BACKEND === 'postgres') {
    const pool = await ensureStorageReady();
    const result = await pool.query(`SELECT payload FROM ${DATABASE_TABLE} WHERE state_key = $1 LIMIT 1`, ['global']);
    const payload = result.rows[0]?.payload;
    return payload && typeof payload === 'object' ? payload : emptyState();
  }
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = safeJsonParse(raw, null);
    return parsed && typeof parsed === 'object' ? parsed : emptyState();
  } catch {
    return emptyState();
  }
}

async function saveState(state) {
  if (STORAGE_BACKEND === 'postgres') {
    const pool = await ensureStorageReady();
    await pool.query(
      `
        INSERT INTO ${DATABASE_TABLE} (state_key, payload, updated_at)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (state_key)
        DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
      `,
      ['global', JSON.stringify(state)]
    );
    return;
  }
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
  await fs.chmod(DATA_FILE, 0o600).catch(() => {});
}

async function updateState(mutator) {
  writeChain = writeChain.then(async () => {
    const current = await loadState();
    const next = (await mutator(current)) || current;
    await saveState(next);
    return next;
  });
  return writeChain;
}

function evaluateSknore(files) {
  const blockedPatterns = [/^\.env(\.|$)/i, /secret/i, /private[_-]?key/i, /id_rsa/i, /\.pem$/i, /\.p12$/i, /\.crt$/i, /credentials/i, /service-account/i];
  const normalized = sanitizeFiles(files);
  const blockedPaths = normalized
    .map((file) => file.path)
    .filter((pathValue) => blockedPatterns.some((pattern) => pattern.test(pathValue)));
  return {
    total_count: normalized.length,
    included_count: Math.max(0, normalized.length - blockedPaths.length),
    blocked_count: blockedPaths.length,
    blocked_paths: blockedPaths,
    patterns_count: blockedPatterns.length,
  };
}

function getWorkspace(state, workspaceId) {
  const id = String(workspaceId || '').trim() || 'default';
  if (!state.workspaces[id]) state.workspaces[id] = defaultWorkspace(id);
  return state.workspaces[id];
}

function getIntegrations(state, workspaceId) {
  const id = String(workspaceId || '').trim() || 'default';
  if (!state.integrations[id]) state.integrations[id] = defaultIntegrations(id);
  return state.integrations[id];
}

function getSkyedriveRecords(state, workspaceId) {
  const id = String(workspaceId || '').trim() || 'default';
  if (!Array.isArray(state.skyedrive[id])) state.skyedrive[id] = [];
  return state.skyedrive[id];
}

// ── 0megaSkyeGate verification ───────────────────────────────────────────────
// Verifies an incoming Bearer token against the live gate /v1/auth/me endpoint.
// Returns { ok: true, session } on success, or { ok: false, response } with a
// pre-built 401/503 JSON response on failure.
// Pattern: additive — existing cookie session checks stay, this adds gate SSO.
const GATE_URL_RUNTIME = process.env.OMEGA_GATE_URL || 'https://0megaskyegate.skyesoverlondon.workers.dev';

// requireAuth: tries internal SkyDexia session first (fast, no network),
// then falls back to 0megaSkyeGate session. Returns session object or null.
async function requireAuth(event) {
  const internal = requireSession(event);
  if (internal) return internal;
  const gate = await requireGateSession(event);
  return gate.ok ? gate.session : null;
}

async function requireGateSession(event) {
  const authHeader = String(
    event?.headers?.authorization || event?.headers?.Authorization || ''
  ).trim();
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return { ok: false, response: json(401, { ok: false, error: 'missing_gate_token' }) };
  try {
    const res = await fetch(`${GATE_URL_RUNTIME}/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.ok) return { ok: true, session: body.session };
    return { ok: false, response: json(401, { ok: false, error: 'invalid_gate_session' }) };
  } catch {
    return { ok: false, response: json(503, { ok: false, error: 'gate_unreachable' }) };
  }
}

module.exports = {
  DATABASE_TABLE,
  PACKAGE_DATA_DIR: DATA_DIR,
  PACKAGE_STATE_BACKEND: STORAGE_BACKEND,
  appendDeferredRelease,
  appendReleaseHistory,
  clearDeferredReleases,
  clone,
  createId,
  evaluateSknore,
  findDeferredRelease,
  firstEnv,
  getIntegrations,
  listDeferredReleases,
  listReleaseHistory,
  getSkyedriveRecords,
  getWorkspace,
  handleCors,
  hasConfiguredSessionSecret,
  hasValidFounderGatewayKey,
  issueSessionToken,
  json,
  methodNotAllowed,
  nowIso,
  queryParams,
  readFounderGatewayEmail,
  readJsonBody,
  readStoredSecret,
  requireSession,
  requireGateSession,
  requireAuth,
  sanitizeIntegrations,
  sanitizeReleaseRecord,
  sanitizeFiles,
  sealSecret,
  sessionCookie,
  shouldUseSecureCookie,
  closeStorage,
  unsealSecret,
  updateState,
};