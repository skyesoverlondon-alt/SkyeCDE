const http = require('http');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { spawn } = require('child_process');
const { URL } = require('url');

const {
  PACKAGE_DATA_DIR,
  getWorkspace,
  requireSession,
  requireAuth,
  sanitizeFiles,
  updateState,
} = require('./netlify/functions/_lib/runtime');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 4192);
const ROOT_DIR = __dirname;
const STATIC_INDEX = path.join(ROOT_DIR, 'index.html');
const RUNTIME_ROOT = path.join(PACKAGE_DATA_DIR, 'local-package-server');
const MATERIALIZED_ROOT = path.join(RUNTIME_ROOT, 'materialized-workspaces');
const RUNTIME_STATE_FILE = path.join(RUNTIME_ROOT, 'runtime-state.json');
const RUNTIME_LOGS_ROOT = path.join(RUNTIME_ROOT, 'runtime-logs');
const TASK_LOGS_ROOT = path.join(RUNTIME_ROOT, 'task-logs');

const runtimeRecords = new Map();
const taskRecords = new Map();
let runtimeState = { workspaces: {} };
let runtimeStateWrite = Promise.resolve();

const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
};

function resolveInside(baseDir, targetPath = '.') {
  const resolved = path.resolve(baseDir, String(targetPath || '.'));
  if (resolved !== baseDir && !resolved.startsWith(`${baseDir}${path.sep}`)) {
    throw new Error(`Path escapes the allowed root: ${targetPath}`);
  }
  return resolved;
}

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trimBuffer(value, limit = 1_000_000) {
  const text = String(value || '');
  if (text.length <= limit) return text;
  return text.slice(text.length - limit);
}

function parseJson(text, fallback = {}) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function emptyRuntimeState() {
  return { workspaces: {} };
}

function sanitizeRuntimeConfig(config) {
  if (!config || typeof config !== 'object') return null;
  const command = String(config.command || '').trim();
  if (!command) return null;
  return {
    command,
    args: Array.isArray(config.args) ? config.args.map((entry) => String(entry || '').trim()).filter(Boolean) : [],
    cwd_relative: String(config.cwd_relative || config.cwd || '.').trim() || '.',
    env_text: String(config.env_text || '').trim(),
    port: Number(config.port || 0) || null,
    launch_url: String(config.launch_url || config.launchUrl || '').trim() || null,
    probe_path: String(config.probe_path || config.probePath || '/').trim() || '/',
    probe_expected_status: Number(config.probe_expected_status || config.probeExpectedStatus || 200) || 200,
    probe_contains_text: String(config.probe_contains_text || config.probeContainsText || '').trim() || null,
    stop_recipe: sanitizeStopRecipe(config.stop_recipe || {
      command: config.stop_command,
      args: config.stop_args,
      cwd_relative: config.stop_cwd_relative || config.stop_cwd,
      wait_ms: config.stop_wait_ms,
    }),
    updated_at: String(config.updated_at || nowIso()),
  };
}

function sanitizeStopRecipe(recipe) {
  if (!recipe || typeof recipe !== 'object') return null;
  const command = String(recipe.command || recipe.stop_command || '').trim();
  if (!command) return null;
  return {
    command,
    args: normalizeArgs(recipe.args || recipe.stop_args),
    cwd_relative: String(recipe.cwd_relative || recipe.cwd || recipe.stop_cwd || '.').trim() || '.',
    wait_ms: Math.max(250, Math.min(Number(recipe.wait_ms || recipe.stop_wait_ms || 4000) || 4000, 20000)),
  };
}

function sanitizeStopOutcome(outcome) {
  if (!outcome || typeof outcome !== 'object') return null;
  return {
    result: String(outcome.result || '').trim() || 'unknown',
    graceful: Boolean(outcome.graceful),
    forced: Boolean(outcome.forced),
    reason: String(outcome.reason || '').trim() || null,
    requested_at: String(outcome.requested_at || '').trim() || null,
    completed_at: String(outcome.completed_at || '').trim() || null,
    signal_sent: String(outcome.signal_sent || '').trim() || null,
    close_signal: String(outcome.close_signal || '').trim() || null,
    exit_code: typeof outcome.exit_code === 'number' ? outcome.exit_code : null,
    recipe: outcome.recipe && typeof outcome.recipe === 'object' ? {
      command: String(outcome.recipe.command || '').trim() || null,
      args: Array.isArray(outcome.recipe.args) ? outcome.recipe.args.map((entry) => String(entry || '').trim()).filter(Boolean) : [],
      cwd_relative: String(outcome.recipe.cwd_relative || '').trim() || '.',
      wait_ms: Number(outcome.recipe.wait_ms || 0) || 0,
      started_at: String(outcome.recipe.started_at || '').trim() || null,
      completed_at: String(outcome.recipe.completed_at || '').trim() || null,
      exit_code: typeof outcome.recipe.exit_code === 'number' ? outcome.recipe.exit_code : null,
      signal: String(outcome.recipe.signal || '').trim() || null,
      timed_out: Boolean(outcome.recipe.timed_out),
    } : null,
  };
}

function sanitizeTaskDefinition(task) {
  if (!task || typeof task !== 'object') return null;
  const command = String(task.command || '').trim();
  if (!command) return null;
  const id = String(task.id || '').trim() || slugifyTaskLabel(task.label || command);
  return {
    id,
    label: String(task.label || id).trim() || id,
    command,
    args: normalizeArgs(task.args),
    cwd_relative: String(task.cwd_relative || task.cwd || '.').trim() || '.',
    env_text: String(task.env_text || '').trim(),
    port: Number(task.port || 0) || null,
    open_url: String(task.open_url || task.launch_url || '').trim() || null,
  };
}

function sanitizeTaskSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  return {
    id: String(snapshot.id || '').trim() || null,
    workspace_id: String(snapshot.workspace_id || snapshot.workspaceId || '').trim() || null,
    workspace_name: String(snapshot.workspace_name || snapshot.workspaceName || '').trim() || null,
    label: String(snapshot.label || '').trim() || null,
    source: String(snapshot.source || 'custom').trim() || 'custom',
    status: String(snapshot.status || 'stopped').trim() || 'stopped',
    command: String(snapshot.command || '').trim() || null,
    args: Array.isArray(snapshot.args) ? snapshot.args.map((entry) => String(entry || '').trim()).filter(Boolean) : [],
    cwd_relative: String(snapshot.cwd_relative || snapshot.cwdRelative || snapshot.cwd || '.').trim() || '.',
    port: Number(snapshot.port || 0) || null,
    open_url: String(snapshot.open_url || snapshot.openUrl || '').trim() || null,
    started_at: String(snapshot.started_at || snapshot.startedAt || '').trim() || null,
    completed_at: String(snapshot.completed_at || snapshot.completedAt || '').trim() || null,
    exit_code: typeof snapshot.exit_code === 'number' ? snapshot.exit_code : (typeof snapshot.exitCode === 'number' ? snapshot.exitCode : null),
    signal: String(snapshot.signal || '').trim() || null,
    pid: Number(snapshot.pid || 0) || null,
    stdout_size: Number(snapshot.stdout_size || snapshot.stdoutSize || 0) || 0,
    stderr_size: Number(snapshot.stderr_size || snapshot.stderrSize || 0) || 0,
    updated_at: String(snapshot.updated_at || snapshot.updatedAt || '').trim() || null,
  };
}

function slugifyTaskLabel(value) {
  return String(value || 'task')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'task';
}

function readWorkbenchConfigFromText(text) {
  const parsed = parseJson(text, null);
  if (!parsed || typeof parsed !== 'object') return null;
  const runtime = sanitizeRuntimeConfig(parsed.runtime) || null;
  const tasks = Array.isArray(parsed.tasks) ? parsed.tasks.map(sanitizeTaskDefinition).filter(Boolean) : [];
  return {
    template_id: String(parsed.templateId || parsed.template_id || '').trim() || null,
    runtime_preset_id: String(parsed.runtimePresetId || parsed.runtime_preset_id || '').trim() || null,
    runtime,
    tasks,
  };
}

async function readMaterializedWorkbenchConfig(workspaceDir) {
  try {
    const raw = await fsp.readFile(path.join(workspaceDir, '.skydexia', 'workbench.json'), 'utf8');
    return readWorkbenchConfigFromText(raw);
  } catch {
    return null;
  }
}

function sanitizePersistedRuntimeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  return {
    id: String(snapshot.id || '').trim() || null,
    status: String(snapshot.status || '').trim() || 'stopped',
    command: String(snapshot.command || '').trim() || null,
    args: Array.isArray(snapshot.args) ? snapshot.args.map((entry) => String(entry || '').trim()).filter(Boolean) : [],
    cwd_relative: String(snapshot.cwd_relative || snapshot.cwd || '.').trim() || '.',
    launch_url: String(snapshot.launch_url || '').trim() || null,
    port: Number(snapshot.port || 0) || null,
    probe_path: String(snapshot.probe_path || '/').trim() || '/',
    probe_expected_status: Number(snapshot.probe_expected_status || 200) || 200,
    probe_contains_text: String(snapshot.probe_contains_text || '').trim() || null,
    started_at: String(snapshot.started_at || '').trim() || null,
    stopped_at: String(snapshot.stopped_at || '').trim() || null,
    exit_code: typeof snapshot.exit_code === 'number' ? snapshot.exit_code : null,
    signal: String(snapshot.signal || '').trim() || null,
    pid: Number(snapshot.pid || 0) || null,
    stop_recipe: sanitizeStopRecipe(snapshot.stop_recipe || {
      command: snapshot.stop_command,
      args: snapshot.stop_args,
      cwd_relative: snapshot.stop_cwd_relative,
      wait_ms: snapshot.stop_wait_ms,
    }),
    stop_outcome: sanitizeStopOutcome(snapshot.stop_outcome),
  };
}

function workspaceRuntimeState(workspaceId) {
  const id = String(workspaceId || 'default').trim() || 'default';
  if (!runtimeState.workspaces[id]) {
    runtimeState.workspaces[id] = {
      workspace_id: id,
      workspace_name: 'SkyDexia 2.6 Workspace',
      workspace_path: '',
      materialized_at: null,
      revision: '',
      file_count: 0,
      last_runtime_config: null,
      last_runtime: null,
      last_runtime_logs: null,
      task_history: [],
      updated_at: null,
    };
  }
  return runtimeState.workspaces[id];
}

function workspaceRuntimeLogPaths(workspaceId) {
  const id = String(workspaceId || 'default').trim() || 'default';
  const workspaceLogsDir = path.join(RUNTIME_LOGS_ROOT, id);
  return {
    workspaceLogsDir,
    stdoutPath: path.join(workspaceLogsDir, 'stdout.log'),
    stderrPath: path.join(workspaceLogsDir, 'stderr.log'),
  };
}

async function resetPersistedRuntimeLogs(workspaceId) {
  const { workspaceLogsDir, stdoutPath, stderrPath } = workspaceRuntimeLogPaths(workspaceId);
  await fsp.mkdir(workspaceLogsDir, { recursive: true });
  await Promise.all([
    fsp.writeFile(stdoutPath, '', 'utf8'),
    fsp.writeFile(stderrPath, '', 'utf8'),
  ]);
}

async function appendPersistedRuntimeLog(workspaceId, streamName, chunk) {
  const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk || '');
  if (!text) return 0;
  const { workspaceLogsDir, stdoutPath, stderrPath } = workspaceRuntimeLogPaths(workspaceId);
  await fsp.mkdir(workspaceLogsDir, { recursive: true });
  const targetPath = streamName === 'stderr' ? stderrPath : stdoutPath;
  await fsp.appendFile(targetPath, text, 'utf8');
  return Buffer.byteLength(text, 'utf8');
}

async function readPersistedRuntimeLogs(workspaceId) {
  const { stdoutPath, stderrPath } = workspaceRuntimeLogPaths(workspaceId);
  const [stdout, stderr] = await Promise.all([
    fsp.readFile(stdoutPath, 'utf8').catch(() => ''),
    fsp.readFile(stderrPath, 'utf8').catch(() => ''),
  ]);
  return { stdout, stderr };
}

function workspaceTaskLogPaths(workspaceId, taskId) {
  const workspaceLogsDir = path.join(TASK_LOGS_ROOT, String(workspaceId || 'default').trim() || 'default');
  const taskLogsDir = path.join(workspaceLogsDir, String(taskId || 'task').trim() || 'task');
  return {
    workspaceLogsDir,
    taskLogsDir,
    stdoutPath: path.join(taskLogsDir, 'stdout.log'),
    stderrPath: path.join(taskLogsDir, 'stderr.log'),
  };
}

async function resetPersistedTaskLogs(workspaceId, taskId) {
  const { taskLogsDir, stdoutPath, stderrPath } = workspaceTaskLogPaths(workspaceId, taskId);
  await fsp.mkdir(taskLogsDir, { recursive: true });
  await Promise.all([
    fsp.writeFile(stdoutPath, '', 'utf8'),
    fsp.writeFile(stderrPath, '', 'utf8'),
  ]);
}

async function appendPersistedTaskLog(workspaceId, taskId, streamName, chunk) {
  const text = Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk || '');
  if (!text) return 0;
  const { taskLogsDir, stdoutPath, stderrPath } = workspaceTaskLogPaths(workspaceId, taskId);
  await fsp.mkdir(taskLogsDir, { recursive: true });
  const targetPath = streamName === 'stderr' ? stderrPath : stdoutPath;
  await fsp.appendFile(targetPath, text, 'utf8');
  return Buffer.byteLength(text, 'utf8');
}

async function readPersistedTaskLogs(workspaceId, taskId) {
  const { stdoutPath, stderrPath } = workspaceTaskLogPaths(workspaceId, taskId);
  const [stdout, stderr] = await Promise.all([
    fsp.readFile(stdoutPath, 'utf8').catch(() => ''),
    fsp.readFile(stderrPath, 'utf8').catch(() => ''),
  ]);
  return { stdout, stderr };
}

function listPersistedTaskHistory(workspaceId) {
  return (Array.isArray(workspaceRuntimeState(workspaceId).task_history) ? workspaceRuntimeState(workspaceId).task_history : [])
    .map(sanitizeTaskSnapshot)
    .filter(Boolean);
}

async function persistTaskSnapshot(workspaceId, snapshot) {
  const sanitized = sanitizeTaskSnapshot(snapshot);
  if (!sanitized?.id) return;
  await updateWorkspaceRuntimeState(workspaceId, (current) => {
    const existing = Array.isArray(current.task_history) ? current.task_history.map(sanitizeTaskSnapshot).filter(Boolean) : [];
    return {
      ...current,
      task_history: [sanitized, ...existing.filter((entry) => entry.id !== sanitized.id)].slice(0, 12),
    };
  });
}

function listWorkspaceTasks(workspaceId) {
  const live = Array.from(taskRecords.values())
    .filter((record) => record.workspaceId === workspaceId)
    .map(sanitizeTaskSnapshot);
  const persisted = listPersistedTaskHistory(workspaceId);
  const byId = new Map();
  [...live, ...persisted].forEach((task) => {
    if (task?.id && !byId.has(task.id)) byId.set(task.id, task);
  });
  return Array.from(byId.values()).sort((left, right) => String(right?.started_at || right?.completed_at || '').localeCompare(String(left?.started_at || left?.completed_at || '')));
}

function findWorkspaceIdForTask(taskId) {
  const normalizedTaskId = String(taskId || '').trim();
  if (!normalizedTaskId) return null;
  return Object.values(runtimeState.workspaces).find((workspace) => {
    const history = Array.isArray(workspace?.task_history) ? workspace.task_history : [];
    return history.some((entry) => String(entry?.id || '').trim() === normalizedTaskId);
  })?.workspace_id || null;
}

function summarizePersistedRuntimeLogs(workspaceId, overrides = {}) {
  const current = workspaceRuntimeState(workspaceId).last_runtime_logs || {};
  const summary = {
    runtime_id: String(overrides.runtime_id || current.runtime_id || '').trim() || null,
    stdout_size: Number(overrides.stdout_size ?? current.stdout_size ?? 0) || 0,
    stderr_size: Number(overrides.stderr_size ?? current.stderr_size ?? 0) || 0,
    updated_at: String(overrides.updated_at || current.updated_at || '').trim() || null,
  };
  return summary.runtime_id || summary.stdout_size || summary.stderr_size || summary.updated_at ? summary : null;
}

function findWorkspaceIdForRuntime(runtimeId) {
  const normalizedRuntimeId = String(runtimeId || '').trim();
  if (!normalizedRuntimeId) return null;
  return Object.values(runtimeState.workspaces).find((workspace) => {
    const lastRuntime = sanitizePersistedRuntimeSnapshot(workspace?.last_runtime);
    return String(lastRuntime?.id || '').trim() === normalizedRuntimeId;
  })?.workspace_id || null;
}

function persistRuntimeStateSoon() {
  runtimeStateWrite = runtimeStateWrite.then(async () => {
    await fsp.mkdir(RUNTIME_ROOT, { recursive: true });
    await fsp.writeFile(RUNTIME_STATE_FILE, JSON.stringify(runtimeState, null, 2), { mode: 0o600 });
    await fsp.chmod(RUNTIME_STATE_FILE, 0o600).catch(() => {});
  }).catch(() => null);
  return runtimeStateWrite;
}

async function loadPersistedRuntimeState() {
  try {
    const raw = await fsp.readFile(RUNTIME_STATE_FILE, 'utf8');
    const parsed = parseJson(raw, emptyRuntimeState());
    runtimeState = parsed && typeof parsed === 'object' ? parsed : emptyRuntimeState();
  } catch {
    runtimeState = emptyRuntimeState();
  }
}

function updateWorkspaceRuntimeState(workspaceId, updater) {
  const current = workspaceRuntimeState(workspaceId);
  const next = updater(current) || current;
  runtimeState.workspaces[current.workspace_id] = {
    ...current,
    ...next,
    workspace_id: current.workspace_id,
    updated_at: nowIso(),
  };
  return persistRuntimeStateSoon();
}

function summarizeWorkspaceRuntimeState(workspaceId) {
  const stateForWorkspace = workspaceRuntimeState(workspaceId);
  return {
    workspace_id: stateForWorkspace.workspace_id,
    workspace_name: stateForWorkspace.workspace_name || 'SkyDexia 2.6 Workspace',
    workspace_path: stateForWorkspace.workspace_path || '',
    materialized_at: stateForWorkspace.materialized_at || null,
    revision: stateForWorkspace.revision || '',
    file_count: Number(stateForWorkspace.file_count || 0) || 0,
    recoverable_runtime_config: sanitizeRuntimeConfig(stateForWorkspace.last_runtime_config),
    last_runtime: sanitizePersistedRuntimeSnapshot(stateForWorkspace.last_runtime),
    last_runtime_logs: summarizePersistedRuntimeLogs(workspaceId),
    task_history: listPersistedTaskHistory(workspaceId),
    updated_at: stateForWorkspace.updated_at || null,
  };
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

function sendJson(res, statusCode, body, extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
}

function sendText(res, statusCode, body, contentType = 'text/plain; charset=utf-8', extraHeaders = {}) {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    ...extraHeaders,
  });
  res.end(body);
}

function buildFunctionEvent(req, bodyText, urlObject) {
  return {
    httpMethod: req.method,
    headers: req.headers,
    body: bodyText,
    path: urlObject.pathname,
    rawUrl: `${req.socket.encrypted ? 'https' : 'http'}://${req.headers.host || `${HOST}:${PORT}`}${urlObject.pathname}${urlObject.search}`,
    rawQuery: urlObject.search ? urlObject.search.slice(1) : '',
  };
}

async function invokeFunction(functionName, req, res, bodyText, urlObject) {
  const functionPath = path.join(ROOT_DIR, 'netlify', 'functions', `${functionName}.js`);
  if (!fs.existsSync(functionPath)) {
    sendJson(res, 404, { ok: false, error: `Unknown function route: ${functionName}` });
    return;
  }
  try {
    delete require.cache[require.resolve(functionPath)];
    const mod = require(functionPath);
    const result = await mod.handler(buildFunctionEvent(req, bodyText, urlObject));
    const headers = { ...(result?.headers || {}) };
    res.writeHead(Number(result?.statusCode || 200), headers);
    res.end(typeof result?.body === 'string' ? result.body : '');
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : 'Function invocation failed.' });
  }
}

async function ensureWorkspaceState(workspaceId) {
  const state = await updateState((current) => {
    getWorkspace(current, workspaceId);
    return current;
  });
  return getWorkspace(state, workspaceId);
}

async function materializeWorkspace(workspaceId) {
  const workspace = await ensureWorkspaceState(workspaceId);
  const files = sanitizeFiles(workspace.files);
  const workspaceDir = resolveInside(MATERIALIZED_ROOT, workspaceId);
  const materializedAt = nowIso();
  await fsp.rm(workspaceDir, { recursive: true, force: true });
  await fsp.mkdir(workspaceDir, { recursive: true });

  for (const file of files) {
    const targetPath = resolveInside(workspaceDir, file.path);
    await fsp.mkdir(path.dirname(targetPath), { recursive: true });
    await fsp.writeFile(targetPath, file.content, 'utf8');
  }

  await fsp.writeFile(
    path.join(workspaceDir, '.skydexia-runtime.json'),
    JSON.stringify({ workspace_id: workspaceId, revision: workspace.revision || '', file_count: files.length, materialized_at: materializedAt }, null, 2),
    'utf8'
  );

  await updateWorkspaceRuntimeState(workspaceId, (current) => ({
    ...current,
    workspace_name: workspace.workspace_name || current.workspace_name,
    workspace_path: workspaceDir,
    materialized_at: materializedAt,
    revision: workspace.revision || '',
    file_count: files.length,
  }));

  return {
    workspaceDir,
    fileCount: files.length,
    revision: workspace.revision || '',
    workspaceName: workspace.workspace_name || 'SkyDexia 2.6 Workspace',
    materializedAt,
  };
}

function parseEnvText(rawText) {
  const env = {};
  String(rawText || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .forEach((line) => {
      const index = line.indexOf('=');
      if (index <= 0) return;
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1);
      if (key) env[key] = value;
    });
  return env;
}

function normalizeArgs(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  }
  return String(value || '')
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function sanitizeRuntime(record) {
  return {
    id: record.id,
    workspace_id: record.workspaceId,
    workspace_name: record.workspaceName,
    workspace_path: record.workspacePath,
    materialized_at: record.materializedAt,
    revision: record.revision,
    file_count: record.fileCount,
    command: record.command,
    args: record.args,
    cwd: record.cwd,
    cwd_relative: record.cwdRelative,
    status: record.status,
    pid: record.pid,
    launch_url: record.launchUrl,
    port: record.port,
    probe_path: record.probePath,
    probe_expected_status: record.probeExpectedStatus,
    probe_contains_text: record.probeContainsText,
    stop_recipe: sanitizeStopRecipe(record.stopRecipe),
    stop_outcome: sanitizeStopOutcome(record.stopOutcome),
    started_at: record.startedAt,
    stopped_at: record.stoppedAt || null,
    exit_code: typeof record.exitCode === 'number' ? record.exitCode : null,
    signal: record.signal || null,
  };
}

function attachRuntimeListeners(record, child) {
  record.child = child;
  record.pid = child.pid || null;
  record.status = 'running';
  child.stdout?.on('data', (chunk) => {
    const text = chunk.toString();
    record.stdout = trimBuffer(`${record.stdout}${text}`);
    void appendPersistedRuntimeLog(record.workspaceId, 'stdout', text)
      .then((written) => {
        record.stdoutSize += written;
        record.logUpdatedAt = nowIso();
        return updateWorkspaceRuntimeState(record.workspaceId, (current) => ({
          ...current,
          last_runtime_logs: summarizePersistedRuntimeLogs(record.workspaceId, {
            runtime_id: record.id,
            stdout_size: record.stdoutSize,
            stderr_size: record.stderrSize,
            updated_at: record.logUpdatedAt,
          }),
        }));
      })
      .catch(() => null);
  });
  child.stderr?.on('data', (chunk) => {
    const text = chunk.toString();
    record.stderr = trimBuffer(`${record.stderr}${text}`);
    void appendPersistedRuntimeLog(record.workspaceId, 'stderr', text)
      .then((written) => {
        record.stderrSize += written;
        record.logUpdatedAt = nowIso();
        return updateWorkspaceRuntimeState(record.workspaceId, (current) => ({
          ...current,
          last_runtime_logs: summarizePersistedRuntimeLogs(record.workspaceId, {
            runtime_id: record.id,
            stdout_size: record.stdoutSize,
            stderr_size: record.stderrSize,
            updated_at: record.logUpdatedAt,
          }),
        }));
      })
      .catch(() => null);
  });
  child.on('close', (code, signal) => {
    record.status = 'stopped';
    record.exitCode = typeof code === 'number' ? code : null;
    record.signal = signal || null;
    record.stoppedAt = nowIso();
    record.child = null;
    const stopContext = record.stopContext || null;
    record.stopOutcome = sanitizeStopOutcome(stopContext ? {
      result: stopContext.forced ? 'forced' : 'graceful',
      graceful: !stopContext.forced,
      forced: Boolean(stopContext.forced),
      reason: stopContext.reason || 'manual',
      requested_at: stopContext.requestedAt || record.startedAt,
      completed_at: record.stoppedAt,
      signal_sent: stopContext.signalSent || null,
      close_signal: record.signal,
      exit_code: record.exitCode,
      recipe: stopContext.recipe || null,
    } : {
      result: 'natural-exit',
      graceful: false,
      forced: false,
      reason: 'process-exit',
      requested_at: record.startedAt,
      completed_at: record.stoppedAt,
      signal_sent: null,
      close_signal: record.signal,
      exit_code: record.exitCode,
      recipe: null,
    });
    record.stopContext = null;
    record.persistedStatePromise = updateWorkspaceRuntimeState(record.workspaceId, (current) => ({
      ...current,
      last_runtime: sanitizePersistedRuntimeSnapshot({
        ...(current.last_runtime || {}),
        id: record.id,
        status: 'stopped',
        command: record.command,
        args: record.args,
        cwd_relative: record.cwdRelative,
        launch_url: record.launchUrl,
        port: record.port,
        probe_path: record.probePath,
        probe_expected_status: record.probeExpectedStatus,
        probe_contains_text: record.probeContainsText,
        started_at: record.startedAt,
        stopped_at: record.stoppedAt,
        exit_code: record.exitCode,
        signal: record.signal,
        pid: record.pid,
        stop_recipe: record.stopRecipe,
        stop_outcome: record.stopOutcome,
      }),
      last_runtime_logs: summarizePersistedRuntimeLogs(record.workspaceId, {
        runtime_id: record.id,
        stdout_size: record.stdoutSize,
        stderr_size: record.stderrSize,
        updated_at: record.logUpdatedAt || record.stoppedAt,
      }),
    })).catch(() => null);
  });
}

async function runStopRecipe(record) {
  const recipe = sanitizeStopRecipe(record?.stopRecipe);
  if (!record || !recipe) return null;
  let cwd = record.workspacePath;
  try {
    cwd = resolveInside(record.workspacePath, recipe.cwd_relative || '.');
  } catch {
    cwd = record.workspacePath;
  }
  const startedAt = nowIso();
  const child = spawn(recipe.command, recipe.args, {
    cwd,
    env: {
      ...process.env,
      SKYDEXIA_WORKSPACE_ID: record.workspaceId,
      SKYDEXIA_WORKSPACE_PATH: record.workspacePath,
      SKYDEXIA_RUNTIME_ID: record.id,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });
  let exitCode = null;
  let signal = null;
  let timedOut = false;
  await Promise.race([
    new Promise((resolve) => {
      child.once('close', (code, closeSignal) => {
        exitCode = typeof code === 'number' ? code : null;
        signal = closeSignal || null;
        resolve();
      });
    }),
    sleep(recipe.wait_ms).then(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }),
  ]);
  if (timedOut) {
    await Promise.race([
      new Promise((resolve) => child.once('close', resolve)),
      sleep(1000),
    ]);
  }
  return {
    command: recipe.command,
    args: recipe.args,
    cwd_relative: recipe.cwd_relative,
    wait_ms: recipe.wait_ms,
    started_at: startedAt,
    completed_at: nowIso(),
    exit_code: exitCode,
    signal,
    timed_out: timedOut,
  };
}

async function stopRuntimeRecord(record, reason = 'manual') {
  if (!record) return null;
  if (!record.child || record.status !== 'running') {
    await record.persistedStatePromise?.catch(() => null);
    return sanitizeRuntime(record);
  }
  const child = record.child;
  const requestedAt = nowIso();
  const recipeResult = await runStopRecipe(record).catch(() => null);
  record.stopContext = {
    reason,
    requestedAt,
    signalSent: 'SIGTERM',
    forced: false,
    recipe: recipeResult,
  };
  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    child.once('close', finish);
    child.kill('SIGTERM');
    setTimeout(() => {
      if (!settled) {
        record.stopContext = {
          ...(record.stopContext || {}),
          forced: true,
          signalSent: 'SIGKILL',
        };
        child.kill('SIGKILL');
      }
    }, 2500);
    setTimeout(finish, 5000);
  });
  await record.persistedStatePromise?.catch(() => null);
  return sanitizeRuntime(record);
}

async function startRuntimeFromBody(body) {
  const workspaceId = String(body?.ws_id || 'default').trim() || 'default';
  const persistedWorkspaceState = workspaceRuntimeState(workspaceId);
  const incomingArgs = normalizeArgs(body?.args);
  const materialized = await materializeWorkspace(workspaceId);
  const workbenchConfig = await readMaterializedWorkbenchConfig(materialized.workspaceDir);
  const workbenchRuntimeConfig = sanitizeRuntimeConfig(workbenchConfig?.runtime) || null;
  const persistedConfig = sanitizeRuntimeConfig(persistedWorkspaceState.last_runtime_config) || null;
  const fallbackConfig = sanitizeRuntimeConfig({
    ...(workbenchRuntimeConfig || {}),
    ...(persistedConfig || {}),
  }) || workbenchRuntimeConfig || persistedConfig || {};
  const command = String(body?.command || fallbackConfig.command || '').trim();
  if (!command) throw new Error('Runtime command is required.');
  const args = incomingArgs.length ? incomingArgs : Array.isArray(fallbackConfig.args) ? fallbackConfig.args : [];
  const cwdRelative = String(body?.cwd || fallbackConfig.cwd_relative || '.').trim() || '.';
  const cwd = resolveInside(materialized.workspaceDir, cwdRelative);
  const envText = String(body?.env_text || fallbackConfig.env_text || '');
  const env = {
    ...process.env,
    ...parseEnvText(envText),
    ...(body?.env && typeof body.env === 'object' ? body.env : {}),
    SKYDEXIA_WORKSPACE_ID: workspaceId,
    SKYDEXIA_WORKSPACE_PATH: materialized.workspaceDir,
  };
  const port = Number(body?.port || fallbackConfig.port || 0) || null;
  const probePath = String(body?.probe_path || fallbackConfig.probe_path || '/').trim() || '/';
  const launchUrl = String(body?.launch_url || fallbackConfig.launch_url || '').trim() || (port ? `http://127.0.0.1:${port}${probePath}` : '');
  const probeExpectedStatus = Number(body?.probe_expected_status || fallbackConfig.probe_expected_status || 200) || 200;
  const probeContainsText = String(body?.probe_contains_text || fallbackConfig.probe_contains_text || '').trim();
  const stopRecipeFromBody = body?.stop_recipe || (body?.stop_command ? {
    command: body?.stop_command,
    args: body?.stop_args,
    cwd_relative: body?.stop_cwd_relative || body?.stop_cwd,
    wait_ms: body?.stop_wait_ms,
  } : null);
  const stopRecipe = sanitizeStopRecipe(stopRecipeFromBody || fallbackConfig.stop_recipe);
  await resetPersistedRuntimeLogs(workspaceId);
  const startedAt = nowIso();
  const runtimeRecord = {
    id: createId('runtime'),
    workspaceId,
    workspaceName: materialized.workspaceName,
    workspacePath: materialized.workspaceDir,
    materializedAt: startedAt,
    revision: materialized.revision,
    fileCount: materialized.fileCount,
    command,
    args,
    cwd,
    cwdRelative,
    envText,
    launchUrl,
    port,
    probePath,
    probeExpectedStatus,
    probeContainsText,
    stopRecipe,
    stopOutcome: null,
    stopContext: null,
    startedAt,
    stoppedAt: null,
    stdout: '',
    stderr: '',
    stdoutSize: 0,
    stderrSize: 0,
    logUpdatedAt: startedAt,
    status: 'starting',
    exitCode: null,
    signal: null,
    child: null,
    pid: null,
    persistedStatePromise: null,
  };
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });
  attachRuntimeListeners(runtimeRecord, child);
  runtimeRecords.set(runtimeRecord.id, runtimeRecord);
  await updateWorkspaceRuntimeState(workspaceId, (current) => ({
    ...current,
    workspace_name: materialized.workspaceName,
    workspace_path: materialized.workspaceDir,
    materialized_at: runtimeRecord.materializedAt,
    revision: materialized.revision,
    file_count: materialized.fileCount,
    last_runtime_config: sanitizeRuntimeConfig({
      command,
      args,
      cwd_relative: cwdRelative,
      env_text: envText,
      port,
      launch_url: launchUrl,
      probe_path: probePath,
      probe_expected_status: probeExpectedStatus,
      probe_contains_text: probeContainsText,
      stop_recipe: stopRecipe,
      updated_at: runtimeRecord.startedAt,
    }),
    last_runtime: sanitizePersistedRuntimeSnapshot({
      id: runtimeRecord.id,
      status: runtimeRecord.status,
      command,
      args,
      cwd_relative: cwdRelative,
      launch_url: launchUrl,
      port,
      probe_path: probePath,
      probe_expected_status: probeExpectedStatus,
      probe_contains_text: probeContainsText,
      stop_recipe: stopRecipe,
      started_at: runtimeRecord.startedAt,
      pid: runtimeRecord.pid,
    }),
    last_runtime_logs: summarizePersistedRuntimeLogs(workspaceId, {
      runtime_id: runtimeRecord.id,
      stdout_size: 0,
      stderr_size: 0,
      updated_at: runtimeRecord.startedAt,
    }),
  }));
  return sanitizeRuntime(runtimeRecord);
}

function sanitizeTaskRecord(record) {
  return sanitizeTaskSnapshot({
    id: record.id,
    workspace_id: record.workspaceId,
    workspace_name: record.workspaceName,
    label: record.label,
    source: record.source,
    status: record.status,
    command: record.command,
    args: record.args,
    cwd_relative: record.cwdRelative,
    port: record.port,
    open_url: record.openUrl,
    started_at: record.startedAt,
    completed_at: record.completedAt,
    exit_code: record.exitCode,
    signal: record.signal,
    pid: record.pid,
    stdout_size: record.stdoutSize,
    stderr_size: record.stderrSize,
    updated_at: record.updatedAt,
  });
}

function attachTaskListeners(record, child) {
  record.child = child;
  record.pid = child.pid || null;
  record.status = 'running';
  child.stdout?.on('data', (chunk) => {
    const text = chunk.toString();
    record.stdout = trimBuffer(`${record.stdout}${text}`);
    void appendPersistedTaskLog(record.workspaceId, record.id, 'stdout', text)
      .then((written) => {
        record.stdoutSize += written;
        record.updatedAt = nowIso();
        return persistTaskSnapshot(record.workspaceId, sanitizeTaskRecord(record));
      })
      .catch(() => null);
  });
  child.stderr?.on('data', (chunk) => {
    const text = chunk.toString();
    record.stderr = trimBuffer(`${record.stderr}${text}`);
    void appendPersistedTaskLog(record.workspaceId, record.id, 'stderr', text)
      .then((written) => {
        record.stderrSize += written;
        record.updatedAt = nowIso();
        return persistTaskSnapshot(record.workspaceId, sanitizeTaskRecord(record));
      })
      .catch(() => null);
  });
  child.on('close', (code, signal) => {
    record.status = 'stopped';
    record.exitCode = typeof code === 'number' ? code : null;
    record.signal = signal || null;
    record.completedAt = nowIso();
    record.updatedAt = record.completedAt;
    record.child = null;
    record.persistedStatePromise = persistTaskSnapshot(record.workspaceId, sanitizeTaskRecord(record)).catch(() => null);
  });
}

async function startTaskFromBody(body) {
  const workspaceId = String(body?.ws_id || 'default').trim() || 'default';
  const materialized = await materializeWorkspace(workspaceId);
  const workbenchConfig = await readMaterializedWorkbenchConfig(materialized.workspaceDir);
  const runtimeConfig = sanitizeRuntimeConfig(workbenchConfig?.runtime) || null;
  const presetMap = new Map((Array.isArray(workbenchConfig?.tasks) ? workbenchConfig.tasks : []).map((task) => [task.id, task]));
  const presetTask = presetMap.get(String(body?.preset_id || '').trim()) || null;
  const command = String(body?.command || presetTask?.command || '').trim();
  if (!command) throw new Error('Task command is required.');
  const args = normalizeArgs(body?.args).length ? normalizeArgs(body?.args) : (Array.isArray(presetTask?.args) ? presetTask.args : []);
  const cwdRelative = String(body?.cwd || presetTask?.cwd_relative || runtimeConfig?.cwd_relative || '.').trim() || '.';
  const cwd = resolveInside(materialized.workspaceDir, cwdRelative);
  const envText = String(body?.env_text || presetTask?.env_text || runtimeConfig?.env_text || '').trim();
  const port = Number(body?.port || presetTask?.port || 0) || null;
  const openUrl = String(body?.open_url || presetTask?.open_url || '').trim() || (port ? `http://127.0.0.1:${port}/` : null);
  const label = String(body?.label || presetTask?.label || `${command} ${args.join(' ')}`.trim()).trim() || command;
  const source = String(body?.source || (presetTask ? 'preset' : 'custom')).trim() || 'custom';
  const taskRecord = {
    id: createId('task'),
    workspaceId,
    workspaceName: materialized.workspaceName,
    workspacePath: materialized.workspaceDir,
    label,
    source,
    command,
    args,
    cwdRelative,
    envText,
    port,
    openUrl,
    status: 'starting',
    startedAt: nowIso(),
    completedAt: null,
    updatedAt: nowIso(),
    stdout: '',
    stderr: '',
    stdoutSize: 0,
    stderrSize: 0,
    exitCode: null,
    signal: null,
    child: null,
    pid: null,
    persistedStatePromise: null,
  };
  await resetPersistedTaskLogs(workspaceId, taskRecord.id);
  const child = spawn(command, args, {
    cwd,
    env: {
      ...process.env,
      ...parseEnvText(envText),
      SKYDEXIA_WORKSPACE_ID: workspaceId,
      SKYDEXIA_WORKSPACE_PATH: materialized.workspaceDir,
      SKYDEXIA_TASK_ID: taskRecord.id,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
  });
  attachTaskListeners(taskRecord, child);
  taskRecords.set(taskRecord.id, taskRecord);
  await persistTaskSnapshot(workspaceId, sanitizeTaskRecord(taskRecord));
  return sanitizeTaskRecord(taskRecord);
}

async function stopTaskRecord(record) {
  if (!record) return null;
  if (!record.child || record.status !== 'running') {
    await record.persistedStatePromise?.catch(() => null);
    return sanitizeTaskRecord(record);
  }
  const child = record.child;
  await new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    child.once('close', finish);
    child.kill('SIGTERM');
    setTimeout(() => {
      if (!settled) child.kill('SIGKILL');
    }, 2500);
    setTimeout(finish, 5000);
  });
  await record.persistedStatePromise?.catch(() => null);
  return sanitizeTaskRecord(record);
}

function readRuntimeLogSlice(text, offset, limit) {
  const safeOffset = Math.max(0, Math.min(Number(offset || 0) || 0, text.length));
  const safeLimit = Math.max(1024, Math.min(Number(limit || 24000) || 24000, 200000));
  return {
    chunk: text.slice(safeOffset, safeOffset + safeLimit),
    nextOffset: Math.min(text.length, safeOffset + safeLimit),
    size: text.length,
  };
}

async function handleRuntimeRoute(req, res, bodyText, urlObject) {
  const event = buildFunctionEvent(req, bodyText, urlObject);
  const session = await requireAuth(event);
  if (!session) {
    sendJson(res, 401, { ok: false, error: 'Founder session or signed bearer token required.' });
    return;
  }

  const body = bodyText ? parseJson(bodyText, {}) : {};
  const pathname = urlObject.pathname;

  if (pathname === '/api/runtime/list' && req.method === 'GET') {
    const workspaceId = String(urlObject.searchParams.get('ws_id') || '').trim();
    const runtimes = Array.from(runtimeRecords.values())
      .filter((record) => !workspaceId || record.workspaceId === workspaceId)
      .sort((left, right) => String(right.startedAt).localeCompare(String(left.startedAt)))
      .map(sanitizeRuntime);
    sendJson(res, 200, {
      ok: true,
      runtime_lane: {
        available: true,
        mode: 'local-package-server',
      },
      runtimes,
      workspace_runtime: workspaceId ? summarizeWorkspaceRuntimeState(workspaceId) : null,
    });
    return;
  }

  if (pathname === '/api/runtime/materialize' && req.method === 'POST') {
    const workspaceId = String(body?.ws_id || 'default').trim() || 'default';
    const materialized = await materializeWorkspace(workspaceId);
    sendJson(res, 200, {
      ok: true,
      runtime_lane: {
        available: true,
        mode: 'local-package-server',
      },
      workspace_id: workspaceId,
      workspace_name: materialized.workspaceName,
      workspace_path: materialized.workspaceDir,
      revision: materialized.revision,
      file_count: materialized.fileCount,
      materialized_at: materialized.materializedAt,
      workspace_runtime: summarizeWorkspaceRuntimeState(workspaceId),
    });
    return;
  }

  if (pathname === '/api/runtime/start' && req.method === 'POST') {
    const runtime = await startRuntimeFromBody(body);
    sendJson(res, 200, {
      ok: true,
      runtime_lane: {
        available: true,
        mode: 'local-package-server',
      },
      runtime,
      workspace_runtime: summarizeWorkspaceRuntimeState(runtime.workspace_id),
    });
    return;
  }

  if (pathname === '/api/runtime/restart' && req.method === 'POST') {
    const runtimeId = String(body?.id || '').trim();
    const existing = runtimeRecords.get(runtimeId);
    if (!existing) {
      sendJson(res, 404, { ok: false, error: 'Runtime not found.' });
      return;
    }
    await stopRuntimeRecord(existing, 'restart');
    runtimeRecords.delete(runtimeId);
    const runtime = await startRuntimeFromBody({
      ws_id: existing.workspaceId,
      command: existing.command,
      args: existing.args,
      cwd: existing.cwdRelative,
      env_text: existing.envText,
      launch_url: existing.launchUrl,
      port: existing.port,
      probe_path: existing.probePath,
      probe_expected_status: existing.probeExpectedStatus,
      probe_contains_text: existing.probeContainsText,
    });
    sendJson(res, 200, {
      ok: true,
      runtime_lane: {
        available: true,
        mode: 'local-package-server',
      },
      runtime,
      workspace_runtime: summarizeWorkspaceRuntimeState(runtime.workspace_id),
    });
    return;
  }

  if (pathname === '/api/runtime/stop' && req.method === 'POST') {
    const runtimeId = String(body?.id || '').trim();
    const existing = runtimeRecords.get(runtimeId);
    if (!existing) {
      sendJson(res, 404, { ok: false, error: 'Runtime not found.' });
      return;
    }
    const runtime = await stopRuntimeRecord(existing, 'manual');
    sendJson(res, 200, {
      ok: true,
      runtime_lane: {
        available: true,
        mode: 'local-package-server',
      },
      runtime,
      workspace_runtime: summarizeWorkspaceRuntimeState(existing.workspaceId),
    });
    return;
  }

  if (pathname === '/api/runtime/logs' && req.method === 'GET') {
    const runtimeId = String(urlObject.searchParams.get('id') || '').trim();
    const workspaceId = String(urlObject.searchParams.get('ws_id') || '').trim() || findWorkspaceIdForRuntime(runtimeId);
    const existing = runtimeRecords.get(runtimeId);
    if (!existing && !workspaceId) {
      sendJson(res, 404, { ok: false, error: 'Runtime not found.' });
      return;
    }
    const runtime = existing
      ? sanitizeRuntime(existing)
      : sanitizePersistedRuntimeSnapshot(workspaceRuntimeState(workspaceId).last_runtime);
    const runtimeLogs = workspaceId ? summarizePersistedRuntimeLogs(workspaceId) : null;
    let stdoutText = existing?.stdout || '';
    let stderrText = existing?.stderr || '';
    if (!existing && workspaceId) {
      const persistedLogs = await readPersistedRuntimeLogs(workspaceId);
      stdoutText = persistedLogs.stdout;
      stderrText = persistedLogs.stderr;
    }
    const stdoutSlice = readRuntimeLogSlice(stdoutText, urlObject.searchParams.get('stdout_offset'), urlObject.searchParams.get('limit'));
    const stderrSlice = readRuntimeLogSlice(stderrText, urlObject.searchParams.get('stderr_offset'), urlObject.searchParams.get('limit'));
    sendJson(res, 200, {
      ok: true,
      runtime_lane: {
        available: true,
        mode: 'local-package-server',
      },
      runtime,
      workspace_runtime: workspaceId ? summarizeWorkspaceRuntimeState(workspaceId) : null,
      runtime_logs: runtimeLogs,
      stdout: stdoutSlice.chunk,
      stderr: stderrSlice.chunk,
      stdoutOffset: stdoutSlice.nextOffset,
      stderrOffset: stderrSlice.nextOffset,
      stdoutSize: stdoutSlice.size,
      stderrSize: stderrSlice.size,
    });
    return;
  }

  if (pathname === '/api/runtime/probe' && req.method === 'POST') {
    const runtimeId = String(body?.id || '').trim();
    const existing = runtimeRecords.get(runtimeId);
    if (!existing) {
      sendJson(res, 404, { ok: false, error: 'Runtime not found.' });
      return;
    }
    const targetUrl = String(body?.url || existing.launchUrl || '').trim();
    if (!targetUrl) {
      sendJson(res, 400, { ok: false, error: 'Runtime has no launch URL. Supply url explicitly or set port/launch_url when starting the runtime.' });
      return;
    }
    const startedAt = Date.now();
    const response = await fetch(targetUrl, { method: 'GET' });
    const text = await response.text();
    const expectedStatus = Number(body?.expected_status || existing.probeExpectedStatus || 200) || 200;
    const containsText = String(body?.contains_text || existing.probeContainsText || '').trim();
    const ok = response.status === expectedStatus && (!containsText || text.includes(containsText));
    sendJson(res, 200, {
      ok: true,
      runtime_lane: {
        available: true,
        mode: 'local-package-server',
      },
      probe: {
        runtimeId: existing.id,
        url: targetUrl,
        status: response.status,
        expectedStatus,
        containsText: containsText || null,
        containsTextMatched: containsText ? text.includes(containsText) : true,
        ok,
        durationMs: Date.now() - startedAt,
        timestamp: nowIso(),
        excerpt: text.slice(0, 800),
      },
    });
    return;
  }

  if (pathname === '/api/runtime/task-list' && req.method === 'GET') {
    const workspaceId = String(urlObject.searchParams.get('ws_id') || '').trim() || 'default';
    sendJson(res, 200, {
      ok: true,
      runtime_lane: {
        available: true,
        mode: 'local-package-server',
      },
      tasks: listWorkspaceTasks(workspaceId),
      workspace_runtime: summarizeWorkspaceRuntimeState(workspaceId),
    });
    return;
  }

  if (pathname === '/api/runtime/task-start' && req.method === 'POST') {
    const task = await startTaskFromBody(body);
    sendJson(res, 200, {
      ok: true,
      runtime_lane: {
        available: true,
        mode: 'local-package-server',
      },
      task,
      tasks: listWorkspaceTasks(task.workspace_id),
      workspace_runtime: summarizeWorkspaceRuntimeState(task.workspace_id),
    });
    return;
  }

  if (pathname === '/api/runtime/task-stop' && req.method === 'POST') {
    const taskId = String(body?.id || '').trim();
    const existing = taskRecords.get(taskId);
    if (!existing) {
      sendJson(res, 404, { ok: false, error: 'Task not found.' });
      return;
    }
    const task = await stopTaskRecord(existing);
    sendJson(res, 200, {
      ok: true,
      runtime_lane: {
        available: true,
        mode: 'local-package-server',
      },
      task,
      tasks: listWorkspaceTasks(existing.workspaceId),
      workspace_runtime: summarizeWorkspaceRuntimeState(existing.workspaceId),
    });
    return;
  }

  if (pathname === '/api/runtime/task-logs' && req.method === 'GET') {
    const taskId = String(urlObject.searchParams.get('id') || '').trim();
    const workspaceId = String(urlObject.searchParams.get('ws_id') || '').trim() || findWorkspaceIdForTask(taskId);
    const liveTask = taskRecords.get(taskId);
    const task = liveTask
      ? sanitizeTaskRecord(liveTask)
      : (workspaceId ? listPersistedTaskHistory(workspaceId).find((entry) => entry.id === taskId) : null);
    if (!task || !workspaceId) {
      sendJson(res, 404, { ok: false, error: 'Task not found.' });
      return;
    }
    let stdoutText = liveTask?.stdout || '';
    let stderrText = liveTask?.stderr || '';
    if (!liveTask) {
      const persistedLogs = await readPersistedTaskLogs(workspaceId, task.id);
      stdoutText = persistedLogs.stdout;
      stderrText = persistedLogs.stderr;
    }
    const stdoutSlice = readRuntimeLogSlice(stdoutText, urlObject.searchParams.get('stdout_offset'), urlObject.searchParams.get('limit'));
    const stderrSlice = readRuntimeLogSlice(stderrText, urlObject.searchParams.get('stderr_offset'), urlObject.searchParams.get('limit'));
    sendJson(res, 200, {
      ok: true,
      runtime_lane: {
        available: true,
        mode: 'local-package-server',
      },
      task,
      stdout: stdoutSlice.chunk,
      stderr: stderrSlice.chunk,
      stdoutOffset: stdoutSlice.nextOffset,
      stderrOffset: stderrSlice.nextOffset,
      stdoutSize: stdoutSlice.size,
      stderrSize: stderrSlice.size,
      workspace_runtime: summarizeWorkspaceRuntimeState(workspaceId),
    });
    return;
  }

  sendJson(res, 405, { ok: false, error: 'Runtime route not allowed.' });
}

async function serveStatic(req, res, urlObject) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
    return;
  }

  const requestedPath = decodeURIComponent(urlObject.pathname === '/' ? '/index.html' : urlObject.pathname);
  let filePath;
  try {
    filePath = resolveInside(ROOT_DIR, `.${requestedPath}`);
  } catch {
    sendJson(res, 400, { ok: false, error: 'Invalid path.' });
    return;
  }

  let stat;
  try {
    stat = await fsp.stat(filePath);
  } catch {
    filePath = STATIC_INDEX;
    stat = await fsp.stat(filePath);
  }

  if (stat.isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
  const stream = fs.createReadStream(filePath);
  res.writeHead(200, { 'Content-Type': contentType });
  stream.pipe(res);
}

async function handleRequest(req, res) {
  const urlObject = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  const bodyText = req.method === 'GET' || req.method === 'HEAD' ? '' : await readRequestBody(req);

  if (urlObject.pathname.startsWith('/api/runtime/')) {
    try {
      await handleRuntimeRoute(req, res, bodyText, urlObject);
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : 'Runtime route failed.' });
    }
    return;
  }

  if (urlObject.pathname.startsWith('/api/')) {
    const functionName = urlObject.pathname.replace(/^\/api\//, '').replace(/[^a-z0-9_-]/gi, '');
    await invokeFunction(functionName, req, res, bodyText, urlObject);
    return;
  }

  try {
    await serveStatic(req, res, urlObject);
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : 'Static serve failed.' });
  }
}

async function shutdown() {
  const records = Array.from(runtimeRecords.values());
  const tasks = Array.from(taskRecords.values());
  await Promise.all(records.map((record) => stopRuntimeRecord(record, 'server-shutdown').catch(() => null)));
  await Promise.all(tasks.map((task) => stopTaskRecord(task).catch(() => null)));
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

fsp.mkdir(RUNTIME_ROOT, { recursive: true })
  .then(async () => {
    await loadPersistedRuntimeState();
    await fsp.mkdir(RUNTIME_LOGS_ROOT, { recursive: true });
    await fsp.mkdir(TASK_LOGS_ROOT, { recursive: true });
    const server = http.createServer((req, res) => {
      void handleRequest(req, res);
    });
    server.listen(PORT, HOST, () => {
      console.log(`SkyDexia 2.6 local package server listening on http://${HOST}:${PORT}`);
    });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });