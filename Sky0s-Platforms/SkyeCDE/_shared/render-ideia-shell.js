import {
  createWorkspaceDirectory,
  deleteWorkspacePath,
  getRuntimeLogs,
  listRuntimes,
  loadWorkspaceEntries,
  moveWorkspacePath,
  openFullApp,
  readWorkspaceFile,
  renameWorkspacePath,
  restartRuntime,
  startRuntime,
  stopRuntime,
  writeWorkspaceFile
} from './skycde-bridge-client.js';

export function renderIdeiaShell(root, config) {
  root.innerHTML = `
    <main class="shell">
      <section class="hero">
        <div class="hero-copy">
          <div class="eyebrow">${config.eyebrow}</div>
          <h1>${config.title}</h1>
          <p>${config.description}</p>
          <div class="hero-actions">
            <a class="button" href="${config.actions.primary.href}">${config.actions.primary.label}</a>
            <a class="button secondary" href="${config.actions.secondary.href}">${config.actions.secondary.label}</a>
          </div>
        </div>
        <div class="metric-list">
          ${config.metrics.map(metric => `
            <div class="metric">
              <strong>${metric.value}</strong>
              <span>${metric.label}</span>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="layout">
        <section class="stack">
          <section class="panel">
            <div>
              <div class="eyebrow">Support lanes</div>
              <h2>${config.supportTitle}</h2>
            </div>
            <div class="lane-grid">
              ${config.lanes.map(lane => `
                <article class="lane">
                  <span class="lane-tag">${lane.tag}</span>
                  <h3>${lane.title}</h3>
                  <p>${lane.description}</p>
                </article>
              `).join('')}
            </div>
          </section>

          <section class="panel">
            <div>
              <div class="eyebrow">Workspace bridge</div>
              <h2>Inspect repo lanes</h2>
            </div>
            <form id="workspace-form" class="field">
              <label for="workspace-root">Workspace root inside the repo</label>
              <input id="workspace-root" value="${config.workspaceRoot}" />
              <label class="toggle-row" for="workspace-recursive">
                <input id="workspace-recursive" type="checkbox" />
                <span>Deep browse recursively</span>
              </label>
              <label for="workspace-limit">Entry limit</label>
              <input id="workspace-limit" type="number" min="1" max="2000" value="200" />
              <div class="card-actions">
                <button type="submit" class="button">Load workspace</button>
              </div>
            </form>
            <div id="workspace-results" class="workspace-results"><strong>Workspace entries will appear here.</strong></div>
            <form id="directory-form" class="field">
              <label for="directory-path">Create directory inside repo</label>
              <input id="directory-path" value="${config.workspaceRoot}" />
              <div class="card-actions">
                <button type="submit" class="button secondary">Create directory</button>
              </div>
            </form>
            <form id="workspace-actions-form" class="field">
              <label for="workspace-selected-path">Selected workspace path</label>
              <input id="workspace-selected-path" value="${config.filePath}" />
              <label for="workspace-target-path">Target path for rename or move</label>
              <input id="workspace-target-path" value="${config.filePath}" />
              <div class="card-actions">
                <button type="button" class="button secondary" id="reload-workspace">Reload workspace</button>
                <button type="button" class="button secondary" id="rename-path">Rename path</button>
                <button type="button" class="button secondary" id="move-path">Move path</button>
                <button type="button" class="button danger" id="delete-path">Delete path</button>
              </div>
            </form>
          </section>

          <section class="panel">
            <div>
              <div class="eyebrow">File bridge</div>
              <h2>Read and write local files</h2>
            </div>
            <div class="file-editor">
              <div class="field">
                <label for="file-path">File path inside repo</label>
                <input id="file-path" value="${config.filePath}" />
              </div>
              <div class="card-actions">
                <button class="button" id="read-file">Read file</button>
                <button class="button secondary" id="write-file">Write file</button>
              </div>
              <div class="field">
                <label for="file-content">File content</label>
                <textarea id="file-content">${escapeHtml(config.fileSeed || '')}</textarea>
              </div>
              <div class="console recent-actions-panel">
                <strong>Recent lane actions</strong>
                <ul id="recent-actions"></ul>
              </div>
            </div>
          </section>

          <section class="panel">
            <div>
              <div class="eyebrow">Runtime bridge</div>
              <h2>Manage live runtimes</h2>
            </div>
            <div class="card-actions">
              ${config.runtimeRecipes.map(recipe => `<button class="button${recipe.secondary ? ' secondary' : ''}" data-recipe="${recipe.id}">${recipe.label}</button>`).join('')}
            </div>
            <div class="card-actions">
              <button class="button" id="refresh-runtimes">Refresh runtimes</button>
              <button class="button secondary" id="restart-runtime">Restart selected runtime</button>
              <button class="button secondary" id="stop-runtime">Stop selected runtime</button>
              <button class="button secondary" id="load-logs">Load runtime logs</button>
            </div>
            <div class="runtime-stream-toolbar">
              <label class="toggle-row" for="live-logs-enabled">
                <input id="live-logs-enabled" type="checkbox" checked />
                <span>Follow live logs</span>
              </label>
              <div class="card-actions compact-actions">
                <button class="button" id="start-live-logs">Start live logs</button>
                <button class="button secondary" id="stop-live-logs">Stop live logs</button>
                <button class="button secondary" id="clear-runtime-logs">Clear log view</button>
              </div>
              <div id="runtime-stream-status" class="runtime-stream-status">Live log polling is idle.</div>
            </div>
            <div id="runtime-result" class="runtime-result"><strong>Runtime status will appear here.</strong></div>
            <div class="field">
              <label for="runtime-id">Selected runtime id</label>
              <input id="runtime-id" />
            </div>
            <div class="console">
              <strong>Runtime logs</strong>
              <pre id="runtime-logs">No logs loaded.</pre>
            </div>
          </section>

          <section class="panel">
            <div>
              <div class="eyebrow">Full app mode</div>
              <h2>Open build surfaces as full app windows</h2>
            </div>
            <div class="card-actions">
              ${config.fullAppButtons.map(button => `<button class="button${button.secondary ? ' secondary' : ''}" data-open-target="${button.href}">${button.label}</button>`).join('')}
            </div>
          </section>
        </section>

        <aside class="panel">
          <div>
            <div class="eyebrow">Bridge status</div>
            <h2>${config.statusTitle}</h2>
          </div>
          <ul>
            ${config.statusItems.map(item => `<li>${item}</li>`).join('')}
          </ul>
        </aside>
      </section>
    </main>
  `;

  const workspaceForm = root.querySelector('#workspace-form');
  const workspaceRootInput = root.querySelector('#workspace-root');
  const workspaceRecursiveInput = root.querySelector('#workspace-recursive');
  const workspaceLimitInput = root.querySelector('#workspace-limit');
  const workspaceResults = root.querySelector('#workspace-results');
  const directoryForm = root.querySelector('#directory-form');
  const directoryPathInput = root.querySelector('#directory-path');
  const workspaceSelectedPathInput = root.querySelector('#workspace-selected-path');
  const workspaceTargetPathInput = root.querySelector('#workspace-target-path');
  const filePathInput = root.querySelector('#file-path');
  const fileContentInput = root.querySelector('#file-content');
  const recentActionsList = root.querySelector('#recent-actions');
  const runtimeResult = root.querySelector('#runtime-result');
  const runtimeIdInput = root.querySelector('#runtime-id');
  const runtimeLogs = root.querySelector('#runtime-logs');
  const liveLogsEnabledInput = root.querySelector('#live-logs-enabled');
  const runtimeStreamStatus = root.querySelector('#runtime-stream-status');
  const storageKey = config.storageKey || `skycde:${config.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const storedState = loadStoredState(storageKey);

  const runtimeLogState = {
    runtimeId: '',
    stdout: '',
    stderr: '',
    stdoutOffset: 0,
    stderrOffset: 0,
    timer: undefined
  };

  function renderRecentActions(items = []) {
    recentActionsList.innerHTML = items.length
      ? items.map(item => `<li>${escapeHtml(item)}</li>`).join('')
      : '<li>No recent lane actions yet.</li>';
  }

  function snapshotState() {
    return {
      workspaceRoot: workspaceRootInput.value,
      workspaceRecursive: workspaceRecursiveInput.checked,
      workspaceLimit: workspaceLimitInput.value,
      selectedPath: workspaceSelectedPathInput.value,
      targetPath: workspaceTargetPathInput.value,
      filePath: filePathInput.value,
      runtimeId: runtimeIdInput.value,
      recentActions: storedState.recentActions || []
    };
  }

  function persistState(partialState = {}) {
    Object.assign(storedState, snapshotState(), partialState);
    window.localStorage.setItem(storageKey, JSON.stringify(storedState));
    renderRecentActions(storedState.recentActions || []);
  }

  function recordRecentAction(action) {
    const timestamp = new Date().toLocaleTimeString();
    const nextActions = [`${timestamp} - ${action}`, ...(storedState.recentActions || [])].slice(0, 8);
    persistState({ recentActions: nextActions });
  }

  function restoreState() {
    workspaceRootInput.value = storedState.workspaceRoot || workspaceRootInput.value;
    workspaceRecursiveInput.checked = Boolean(storedState.workspaceRecursive);
    workspaceLimitInput.value = storedState.workspaceLimit || workspaceLimitInput.value;
    workspaceSelectedPathInput.value = storedState.selectedPath || workspaceSelectedPathInput.value;
    workspaceTargetPathInput.value = storedState.targetPath || workspaceTargetPathInput.value;
    filePathInput.value = storedState.filePath || filePathInput.value;
    runtimeIdInput.value = storedState.runtimeId || runtimeIdInput.value;
    renderRecentActions(storedState.recentActions || []);
  }

  function renderRuntimeLogs() {
    runtimeLogs.textContent = `STDOUT\n${runtimeLogState.stdout || '(empty)'}\n\nSTDERR\n${runtimeLogState.stderr || '(empty)'}`;
  }

  function stopLiveLogs(message = 'Live log polling is idle.') {
    if (runtimeLogState.timer) {
      window.clearInterval(runtimeLogState.timer);
      runtimeLogState.timer = undefined;
    }
    runtimeStreamStatus.textContent = message;
  }

  function resetRuntimeLogs(runtimeId = runtimeIdInput.value.trim()) {
    runtimeLogState.runtimeId = runtimeId;
    runtimeLogState.stdout = '';
    runtimeLogState.stderr = '';
    runtimeLogState.stdoutOffset = 0;
    runtimeLogState.stderrOffset = 0;
    renderRuntimeLogs();
  }

  async function loadRuntimeLogs(incremental = false) {
    const runtimeId = runtimeIdInput.value.trim();
    if (!runtimeId) {
      throw new Error('Runtime id is required.');
    }

    if (!incremental || runtimeLogState.runtimeId !== runtimeId) {
      resetRuntimeLogs(runtimeId);
    }

    const payload = await getRuntimeLogs(runtimeId, incremental ? {
      stdoutOffset: runtimeLogState.stdoutOffset,
      stderrOffset: runtimeLogState.stderrOffset,
      limit: 24000
    } : {});

    runtimeLogState.runtimeId = runtimeId;
    runtimeLogState.stdout = incremental ? `${runtimeLogState.stdout}${payload.stdout || ''}` : (payload.stdout || '');
    runtimeLogState.stderr = incremental ? `${runtimeLogState.stderr}${payload.stderr || ''}` : (payload.stderr || '');
    runtimeLogState.stdoutOffset = payload.stdoutOffset || 0;
    runtimeLogState.stderrOffset = payload.stderrOffset || 0;
    renderRuntimeLogs();
    runtimeResult.innerHTML = renderRuntimeList([payload.runtime]);
    runtimeStreamStatus.textContent = payload.runtime.status === 'running'
      ? `Live log polling ready for ${payload.runtime.id}.`
      : `Runtime ${payload.runtime.id} is stopped.`;
    if (payload.runtime.status !== 'running') {
      stopLiveLogs(`Runtime ${payload.runtime.id} is stopped.`);
    }
    return payload;
  }

  async function startLiveLogs() {
    const runtimeId = runtimeIdInput.value.trim();
    if (!runtimeId) {
      runtimeStreamStatus.textContent = 'Select a runtime before starting live logs.';
      return;
    }

    stopLiveLogs(`Connecting live logs for ${runtimeId}...`);
    await loadRuntimeLogs(false);
    runtimeStreamStatus.textContent = `Live log polling active for ${runtimeId}.`;
    runtimeLogState.timer = window.setInterval(async () => {
      try {
        await loadRuntimeLogs(true);
      } catch (error) {
        stopLiveLogs(`Live log polling failed: ${error.message}`);
      }
    }, 2000);
  }

  async function refreshWorkspace(rootPath = workspaceRootInput.value.trim() || '.') {
    const recursive = workspaceRecursiveInput.checked;
    const limit = Number.parseInt(workspaceLimitInput.value, 10);
    const payload = await loadWorkspaceEntries(rootPath, {
      recursive,
      limit: Number.isFinite(limit) ? limit : undefined
    });
    workspaceRootInput.value = payload.root;
    workspaceResults.innerHTML = renderWorkspaceEntries(payload);
    persistState();
  }

  restoreState();
  renderRecentActions(storedState.recentActions || []);

  workspaceForm.addEventListener('submit', async event => {
    event.preventDefault();
    workspaceResults.innerHTML = '<strong>Loading workspace entries...</strong>';
    try {
      await refreshWorkspace();
      recordRecentAction(`Loaded workspace ${workspaceRootInput.value.trim() || '.'}`);
    } catch (error) {
      workspaceResults.innerHTML = `<strong>Workspace bridge failed:</strong> ${error.message}`;
    }
  });

  directoryForm.addEventListener('submit', async event => {
    event.preventDefault();
    workspaceResults.innerHTML = '<strong>Creating directory...</strong>';
    try {
      const payload = await createWorkspaceDirectory(directoryPathInput.value.trim());
      workspaceResults.innerHTML = `<strong>Created:</strong> <code>${payload.path}</code>`;
      await refreshWorkspace(workspaceRootInput.value.trim() || '.');
      recordRecentAction(`Created directory ${payload.path}`);
    } catch (error) {
      workspaceResults.innerHTML = `<strong>Directory create failed:</strong> ${error.message}`;
    }
  });

  root.querySelector('#reload-workspace').addEventListener('click', async () => {
    workspaceResults.innerHTML = '<strong>Reloading workspace entries...</strong>';
    try {
      await refreshWorkspace(workspaceRootInput.value.trim() || '.');
      recordRecentAction(`Reloaded workspace ${workspaceRootInput.value.trim() || '.'}`);
    } catch (error) {
      workspaceResults.innerHTML = `<strong>Workspace reload failed:</strong> ${error.message}`;
    }
  });

  root.querySelector('#rename-path').addEventListener('click', async () => {
    workspaceResults.innerHTML = '<strong>Renaming workspace path...</strong>';
    try {
      const payload = await renameWorkspacePath(
        workspaceSelectedPathInput.value.trim(),
        workspaceTargetPathInput.value.trim()
      );
      workspaceSelectedPathInput.value = payload.targetPath;
      workspaceTargetPathInput.value = payload.targetPath;
      workspaceResults.innerHTML = `<strong>Renamed:</strong> <code>${payload.sourcePath}</code> → <code>${payload.targetPath}</code>`;
      await refreshWorkspace(workspaceRootInput.value.trim() || '.');
      recordRecentAction(`Renamed ${payload.sourcePath} to ${payload.targetPath}`);
    } catch (error) {
      workspaceResults.innerHTML = `<strong>Rename failed:</strong> ${error.message}`;
    }
  });

  root.querySelector('#move-path').addEventListener('click', async () => {
    workspaceResults.innerHTML = '<strong>Moving workspace path...</strong>';
    try {
      const payload = await moveWorkspacePath(
        workspaceSelectedPathInput.value.trim(),
        workspaceTargetPathInput.value.trim()
      );
      workspaceSelectedPathInput.value = payload.targetPath;
      workspaceTargetPathInput.value = payload.targetPath;
      workspaceResults.innerHTML = `<strong>Moved:</strong> <code>${payload.sourcePath}</code> → <code>${payload.targetPath}</code>`;
      await refreshWorkspace(workspaceRootInput.value.trim() || '.');
      recordRecentAction(`Moved ${payload.sourcePath} to ${payload.targetPath}`);
    } catch (error) {
      workspaceResults.innerHTML = `<strong>Move failed:</strong> ${error.message}`;
    }
  });

  root.querySelector('#delete-path').addEventListener('click', async () => {
    workspaceResults.innerHTML = '<strong>Deleting workspace path...</strong>';
    try {
      const payload = await deleteWorkspacePath(workspaceSelectedPathInput.value.trim());
      workspaceResults.innerHTML = `<strong>Deleted:</strong> <code>${payload.path}</code>`;
      await refreshWorkspace(workspaceRootInput.value.trim() || '.');
      recordRecentAction(`Deleted ${payload.path}`);
    } catch (error) {
      workspaceResults.innerHTML = `<strong>Delete failed:</strong> ${error.message}`;
    }
  });

  root.querySelector('#read-file').addEventListener('click', async () => {
    try {
      const payload = await readWorkspaceFile(filePathInput.value.trim());
      fileContentInput.value = payload.content;
      persistState();
      recordRecentAction(`Read file ${payload.path}`);
    } catch (error) {
      fileContentInput.value = `Read failed: ${error.message}`;
    }
  });

  root.querySelector('#write-file').addEventListener('click', async () => {
    try {
      const payload = await writeWorkspaceFile(filePathInput.value.trim(), fileContentInput.value);
      fileContentInput.value = `${fileContentInput.value}\n`;
      workspaceResults.innerHTML = `<strong>Saved:</strong> <code>${payload.path}</code>`;
      persistState();
      recordRecentAction(`Wrote file ${payload.path}`);
    } catch (error) {
      workspaceResults.innerHTML = `<strong>Write failed:</strong> ${error.message}`;
    }
  });

  root.querySelectorAll('[data-recipe]').forEach(button => {
    button.addEventListener('click', async () => {
      const recipe = config.runtimeRecipes.find(entry => entry.id === button.dataset.recipe);
      runtimeResult.innerHTML = `<strong>Starting:</strong> ${button.textContent}`;
      try {
        const payload = await startRuntime(recipe.request);
        runtimeIdInput.value = payload.runtime.id;
        resetRuntimeLogs(payload.runtime.id);
        runtimeResult.innerHTML = renderRuntimeList([payload.runtime]);
        persistState();
        recordRecentAction(`Started runtime ${payload.runtime.id}`);
        if (liveLogsEnabledInput.checked) {
          await startLiveLogs();
        }
      } catch (error) {
        runtimeResult.innerHTML = `<strong>Runtime start failed:</strong> ${error.message}`;
      }
    });
  });

  root.querySelector('#refresh-runtimes').addEventListener('click', async () => {
    try {
      const payload = await listRuntimes();
      runtimeResult.innerHTML = renderRuntimeList(payload.runtimes || []);
      recordRecentAction('Refreshed runtimes');
    } catch (error) {
      runtimeResult.innerHTML = `<strong>Runtime refresh failed:</strong> ${error.message}`;
    }
  });

  root.querySelector('#restart-runtime').addEventListener('click', async () => {
    try {
      const payload = await restartRuntime(runtimeIdInput.value.trim());
      resetRuntimeLogs(payload.runtime.id);
      runtimeResult.innerHTML = renderRuntimeList([payload.runtime]);
      persistState();
      recordRecentAction(`Restarted runtime ${payload.runtime.id}`);
      if (liveLogsEnabledInput.checked) {
        await startLiveLogs();
      }
    } catch (error) {
      runtimeResult.innerHTML = `<strong>Runtime restart failed:</strong> ${error.message}`;
    }
  });

  root.querySelector('#stop-runtime').addEventListener('click', async () => {
    try {
      const payload = await stopRuntime(runtimeIdInput.value.trim());
      stopLiveLogs(`Runtime ${payload.runtime.id} stopped.`);
      runtimeResult.innerHTML = renderRuntimeList([payload.runtime]);
      persistState({ runtimeId: payload.runtime.id });
      recordRecentAction(`Stopped runtime ${payload.runtime.id}`);
    } catch (error) {
      runtimeResult.innerHTML = `<strong>Runtime stop failed:</strong> ${error.message}`;
    }
  });

  root.querySelector('#load-logs').addEventListener('click', async () => {
    try {
      await loadRuntimeLogs(false);
      recordRecentAction(`Loaded logs for ${runtimeIdInput.value.trim()}`);
    } catch (error) {
      runtimeLogs.textContent = `Log load failed: ${error.message}`;
    }
  });

  root.querySelector('#start-live-logs').addEventListener('click', async () => {
    try {
      await startLiveLogs();
    } catch (error) {
      stopLiveLogs(`Live log polling failed: ${error.message}`);
    }
  });

  root.querySelector('#stop-live-logs').addEventListener('click', () => {
    stopLiveLogs();
  });

  root.querySelector('#clear-runtime-logs').addEventListener('click', () => {
    resetRuntimeLogs(runtimeIdInput.value.trim());
    runtimeStreamStatus.textContent = 'Runtime log view cleared.';
  });

  root.querySelectorAll('[data-open-target]').forEach(button => {
    button.addEventListener('click', () => openFullApp(button.dataset.openTarget));
  });

  workspaceResults.addEventListener('click', async event => {
    const target = event.target.closest('[data-entry-path]');
    if (!target) {
      return;
    }

    const entryPath = target.dataset.entryPath;
    const entryKind = target.dataset.entryKind;
    if (!entryPath || !entryKind) {
      return;
    }

    if (entryKind === 'directory') {
      workspaceSelectedPathInput.value = entryPath;
      workspaceTargetPathInput.value = entryPath;
      workspaceRootInput.value = entryPath;
      persistState();
      workspaceResults.innerHTML = '<strong>Loading workspace entries...</strong>';
      try {
        await refreshWorkspace(entryPath);
        recordRecentAction(`Opened directory ${entryPath}`);
      } catch (error) {
        workspaceResults.innerHTML = `<strong>Workspace bridge failed:</strong> ${error.message}`;
      }
      return;
    }

    filePathInput.value = entryPath;
    workspaceSelectedPathInput.value = entryPath;
    workspaceTargetPathInput.value = entryPath;
    persistState();
    try {
      const payload = await readWorkspaceFile(entryPath);
      fileContentInput.value = payload.content;
      workspaceResults.innerHTML = `<strong>Loaded file:</strong> <code>${payload.path}</code>`;
      recordRecentAction(`Opened file ${payload.path}`);
    } catch (error) {
      workspaceResults.innerHTML = `<strong>File load failed:</strong> ${error.message}`;
    }
  });

  runtimeResult.addEventListener('click', event => {
    const target = event.target.closest('[data-runtime-id]');
    if (!target?.dataset.runtimeId) {
      return;
    }
    runtimeIdInput.value = target.dataset.runtimeId;
    persistState();
    if (runtimeLogState.runtimeId !== target.dataset.runtimeId) {
      resetRuntimeLogs(target.dataset.runtimeId);
      if (liveLogsEnabledInput.checked) {
        startLiveLogs().catch(error => {
          stopLiveLogs(`Live log polling failed: ${error.message}`);
        });
      }
    }
    recordRecentAction(`Selected runtime ${target.dataset.runtimeId}`);
  });

  [workspaceRootInput, workspaceLimitInput, workspaceSelectedPathInput, workspaceTargetPathInput, filePathInput, runtimeIdInput].forEach(input => {
    input.addEventListener('change', () => persistState());
  });
  workspaceRecursiveInput.addEventListener('change', () => persistState());
}

function renderRuntimeList(runtimes) {
  if (!runtimes.length) {
    return '<strong>No runtimes registered.</strong>';
  }
  return `<ul>${runtimes.map(runtime => `
    <li class="runtime-item" data-runtime-id="${runtime.id}">
      <strong>${runtime.id}</strong>
      <div><code>${runtime.command} ${runtime.args.join(' ')}</code></div>
      <div>Status: <code>${runtime.status}</code> · PID: <code>${runtime.pid}</code></div>
      <div>CWD: <code>${runtime.cwd}</code></div>
      ${runtime.launchUrl ? `<div><a class="button" href="${runtime.launchUrl}" target="_blank" rel="noreferrer">Open live runtime</a></div>` : ''}
    </li>
  `).join('')}</ul>`;
}

function renderWorkspaceEntries(payload) {
  const items = payload.entries.map(entry => `
    <li>
      <button class="entry-button" type="button" data-entry-path="${entry.path}" data-entry-kind="${entry.kind}">
        <span><code>${entry.kind}</code> ${entry.path}</span>
      </button>
    </li>
  `).join('');

  return `<strong>Root:</strong> <code>${payload.root}</code>
    <div><strong>Mode:</strong> <code>${payload.recursive ? 'recursive' : 'direct'}</code> · <strong>Limit:</strong> <code>${payload.limit}</code></div>
    <ul>${items || '<li>No entries returned.</li>'}</ul>`;
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function loadStoredState(storageKey) {
  try {
    const rawState = window.localStorage.getItem(storageKey);
    return rawState ? JSON.parse(rawState) : {};
  } catch {
    return {};
  }
}