const workspaceEndpoint = '/launcher/skycde/workspace';
const fileEndpoint = '/launcher/skycde/file';
const fileRenameEndpoint = '/launcher/skycde/file/rename';
const fileMoveEndpoint = '/launcher/skycde/file/move';
const fileDeleteEndpoint = '/launcher/skycde/file/delete';
const directoryEndpoint = '/launcher/skycde/directory';
const terminalStartEndpoint = '/launcher/skycde/terminal/start';
const terminalStatusEndpoint = '/launcher/skycde/terminal/status';
const terminalLogsEndpoint = '/launcher/skycde/terminal/logs';
const terminalRestartEndpoint = '/launcher/skycde/terminal/restart';
const terminalStopEndpoint = '/launcher/skycde/terminal/stop';

export async function loadWorkspaceEntries(root = '.', options = {}) {
  const params = new URLSearchParams({ root });
  if (options.recursive) {
    params.set('recursive', 'true');
  }
  if (Number.isFinite(options.limit)) {
    params.set('limit', String(options.limit));
  }
  const response = await fetch(`${workspaceEndpoint}?${params.toString()}`);
  return handleJson(response, 'Failed to load workspace entries.');
}

export async function readWorkspaceFile(filePath) {
  const response = await fetch(`${fileEndpoint}?path=${encodeURIComponent(filePath)}`);
  return handleJson(response, 'Failed to read workspace file.');
}

export async function writeWorkspaceFile(filePath, content) {
  const response = await fetch(fileEndpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath, content })
  });
  return handleJson(response, 'Failed to write workspace file.');
}

export async function renameWorkspacePath(sourcePath, targetPath) {
  const response = await fetch(fileRenameEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourcePath, targetPath })
  });
  return handleJson(response, 'Failed to rename workspace path.');
}

export async function moveWorkspacePath(sourcePath, targetPath) {
  const response = await fetch(fileMoveEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourcePath, targetPath })
  });
  return handleJson(response, 'Failed to move workspace path.');
}

export async function deleteWorkspacePath(filePath) {
  const response = await fetch(fileDeleteEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: filePath })
  });
  return handleJson(response, 'Failed to delete workspace path.');
}

export async function createWorkspaceDirectory(dirPath) {
  const response = await fetch(directoryEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: dirPath })
  });
  return handleJson(response, 'Failed to create directory.');
}

export async function startRuntime(recipe) {
  const response = await fetch(terminalStartEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recipe)
  });
  return handleJson(response, 'Failed to start runtime.');
}

export async function listRuntimes() {
  const response = await fetch(terminalStatusEndpoint);
  return handleJson(response, 'Failed to load runtime status.');
}

export async function getRuntimeLogs(runtimeId, options = {}) {
  const params = new URLSearchParams({ id: runtimeId });
  if (Number.isFinite(options.stdoutOffset)) {
    params.set('stdoutOffset', String(options.stdoutOffset));
  }
  if (Number.isFinite(options.stderrOffset)) {
    params.set('stderrOffset', String(options.stderrOffset));
  }
  if (Number.isFinite(options.limit)) {
    params.set('limit', String(options.limit));
  }
  const response = await fetch(`${terminalLogsEndpoint}?${params.toString()}`);
  return handleJson(response, 'Failed to load runtime logs.');
}

export async function restartRuntime(runtimeId) {
  const response = await fetch(terminalRestartEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: runtimeId })
  });
  return handleJson(response, 'Failed to restart runtime.');
}

export async function stopRuntime(runtimeId) {
  const response = await fetch(terminalStopEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: runtimeId })
  });
  return handleJson(response, 'Failed to stop runtime.');
}

export function openFullApp(target) {
  const launchTarget = new URL(target, window.location.href).toString();
  window.open(launchTarget, '_blank', 'noopener');
  return launchTarget;
}

async function handleJson(response, fallbackMessage) {
  const payload = await safeJson(response);
  if (!response.ok) {
    throw new Error(payload?.error || fallbackMessage);
  }
  return payload;
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}