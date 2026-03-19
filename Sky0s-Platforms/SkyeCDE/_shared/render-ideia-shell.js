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
import { buildSkyeHawkRoutes, installSkyeHawkMenu } from './skyehawk-menu.js';

export function renderIdeiaShell(root, config) {
  const enterprisePacks = config.enterprise?.workspacePacks || [];
  const enterpriseArtifacts = config.enterprise?.artifactTemplates || [];
  const workflowActions = config.enterprise?.workflowActions || [];
  const missionConsole = config.enterprise?.missionConsole || {};
  const validationChecks = config.enterprise?.validationChecks || [];
  const releaseHandoffPath = resolveReleaseHandoffPath(enterpriseArtifacts, enterprisePacks, storageKeyFallback(config));
  const enterpriseWorkbench = config.enterprise
    ? renderEnterpriseWorkbench(config.enterprise, { releaseHandoffPath })
    : '';

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
            <button class="button secondary" type="button" id="open-skyehawk">Open SkyeHawk</button>
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

          ${enterpriseWorkbench}

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
              ${Array.isArray(config.fileHints) && config.fileHints.length ? `
                <div class="field quick-files-panel">
                  <label>Lane-owned file lanes</label>
                  <div class="card-actions">
                    ${config.fileHints.map(fileHint => `<button class="button secondary" type="button" data-file-hint="${fileHint.path}">${fileHint.label}</button>`).join('')}
                  </div>
                </div>
              ` : ''}
              <div class="field">
                <label for="file-path">File path inside repo</label>
                <input id="file-path" value="${config.filePath}" />
              </div>
              <div class="field">
                <label for="save-as-path">Save as path inside repo</label>
                <input id="save-as-path" value="${config.saveAsPath || config.filePath}" />
              </div>
              <div class="card-actions">
                <button class="button" id="read-file">Read file</button>
                <button class="button secondary" id="write-file">Write file</button>
                <button class="button secondary" id="save-file-as">Save as</button>
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
              ${config.fullAppButtons.map(button => `<button class="button${button.secondary ? ' secondary' : ''}" data-open-target="${button.href}"${button.openTargetKey ? ` data-open-key="${button.openTargetKey}"` : ''}>${button.label}</button>`).join('')}
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
  const saveAsPathInput = root.querySelector('#save-as-path');
  const fileContentInput = root.querySelector('#file-content');
  const recentActionsList = root.querySelector('#recent-actions');
  const runtimeResult = root.querySelector('#runtime-result');
  const runtimeIdInput = root.querySelector('#runtime-id');
  const runtimeLogs = root.querySelector('#runtime-logs');
  const liveLogsEnabledInput = root.querySelector('#live-logs-enabled');
  const runtimeStreamStatus = root.querySelector('#runtime-stream-status');
  const releaseHandoffResult = root.querySelector('#release-handoff-result');
  const skyehawkTriggerButton = root.querySelector('#open-skyehawk');
  const storageKey = config.storageKey || `skycde:${config.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const storedState = loadStoredState(storageKey);

  installSkyeHawkMenu({
    triggerButton: skyehawkTriggerButton,
    storageKey: `${storageKey}:skyehawk`,
    title: `${config.title} SkyeHawk`,
    description: 'Search the SkyeCDE hub, lane routes, preserved product surfaces, and upgrade targets from one menu.',
    routes: buildSkyeHawkRoutes({
      baseId: storageKey,
      actions: config.actions,
      fullAppButtons: config.fullAppButtons,
      additionalRoutes: config.skyehawkRoutes || []
    })
  });

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
      saveAsPath: saveAsPathInput ? saveAsPathInput.value : filePathInput.value,
      runtimeId: runtimeIdInput.value,
      recentActions: storedState.recentActions || [],
      validationResults: storedState.validationResults || {},
      generatedArtifacts: storedState.generatedArtifacts || [],
      releaseHandoff: storedState.releaseHandoff || undefined
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
    if (saveAsPathInput) {
      saveAsPathInput.value = storedState.saveAsPath || saveAsPathInput.value;
    }
    runtimeIdInput.value = storedState.runtimeId || runtimeIdInput.value;
    renderRecentActions(storedState.recentActions || []);
    renderValidationResults();
    renderReleaseHandoffResult();
  }

  function renderValidationResults() {
    validationChecks.forEach(check => {
      const resultNode = root.querySelector(`[data-validation-result="${check.id}"]`);
      if (!resultNode) {
        return;
      }
      const result = storedState.validationResults?.[check.id];
      if (!result) {
        resultNode.innerHTML = '<span class="validation-state validation-idle">Not run yet.</span>';
        return;
      }
      resultNode.innerHTML = `<span class="validation-state validation-${result.status}">${escapeHtml(result.status)}</span><span>${escapeHtml(result.detail)}</span><span class="enterprise-meta">${escapeHtml(result.timestamp)}</span>`;
    });
  }

  function storeValidationResult(checkId, status, detail) {
    const nextResults = {
      ...(storedState.validationResults || {}),
      [checkId]: {
        status,
        detail,
        timestamp: new Date().toLocaleString()
      }
    };
    persistState({ validationResults: nextResults });
    renderValidationResults();
  }

  function rememberGeneratedArtifact(path, label = 'Artifact') {
    const nextArtifacts = [
      {
        path,
        label,
        timestamp: new Date().toLocaleString()
      },
      ...(storedState.generatedArtifacts || []).filter(entry => entry.path !== path)
    ].slice(0, 10);
    persistState({ generatedArtifacts: nextArtifacts });
  }

  function renderReleaseHandoffResult() {
    if (!releaseHandoffResult) {
      return;
    }

    if (!releaseHandoffPath) {
      releaseHandoffResult.innerHTML = '<span class="validation-state validation-idle">Unavailable</span><span>No delivery path is available for a release handoff yet.</span>';
      return;
    }

    const handoff = storedState.releaseHandoff;
    if (!handoff?.path) {
      releaseHandoffResult.innerHTML = `<span class="validation-state validation-idle">Pending</span><span>Target path: ${escapeHtml(releaseHandoffPath)}</span>`;
      return;
    }

    releaseHandoffResult.innerHTML = `<span class="validation-state validation-passed">ready</span><span>${escapeHtml(handoff.path)}</span><span class="enterprise-meta">Generated ${escapeHtml(handoff.timestamp || '')}</span>`;
  }

  function buildReleaseHandoffContent() {
    const validationEntries = validationChecks.map(check => {
      const result = storedState.validationResults?.[check.id];
      return {
        title: check.title,
        owner: check.owner,
        status: result?.status || 'not-run',
        detail: result?.detail || 'Not run yet.',
        timestamp: result?.timestamp || 'Not recorded'
      };
    });

    const artifactEntries = storedState.generatedArtifacts || [];
    const activeRuntimeId = runtimeIdInput.value.trim() || 'None selected';
    const stdoutPreview = truncateBlock(runtimeLogState.stdout || '(no stdout captured yet)');
    const stderrPreview = truncateBlock(runtimeLogState.stderr || '(no stderr captured yet)');

    return [
      `# ${config.title} Release Handoff`,
      '',
      `Date: ${new Date().toISOString().slice(0, 10)}`,
      `Generated: ${new Date().toISOString()}`,
      `Lane storage key: ${storageKey}`,
      '',
      '## Lane state',
      `- Workspace root: ${workspaceRootInput.value.trim() || '.'}`,
      `- Selected path: ${workspaceSelectedPathInput.value.trim() || '(none selected)'}`,
      `- Active file path: ${filePathInput.value.trim() || '(none selected)'}`,
      `- Active runtime id: ${activeRuntimeId}`,
      `- Live logs enabled: ${liveLogsEnabledInput.checked ? 'yes' : 'no'}`,
      '',
      '## Validation summary',
      ...(validationEntries.length ? validationEntries.flatMap(entry => [
        `- ${entry.title} (${entry.owner})`,
        `  - Status: ${entry.status}`,
        `  - Detail: ${entry.detail}`,
        `  - Recorded: ${entry.timestamp}`
      ]) : ['- No validation checks configured.']),
      '',
      '## Generated artifacts',
      ...(artifactEntries.length ? artifactEntries.flatMap(entry => [
        `- ${entry.label}: ${entry.path}`,
        `  - Generated: ${entry.timestamp}`
      ]) : ['- No artifacts have been generated in this lane session.']),
      '',
      '## Release gates',
      ...((config.enterprise?.releaseGates || []).flatMap(gate => [
        `- ${gate.gate} [${gate.status}]`,
        `  - Evidence: ${gate.evidence}`,
        `  - Next: ${gate.nextAction}`
      ])),
      '',
      '## Verification matrix',
      ...((config.enterprise?.verificationMatrix || []).flatMap(check => [
        `- ${check.name}`,
        `  - Command: ${check.command}`,
        `  - Evidence: ${check.evidence}`
      ])),
      '',
      '## Recent lane actions',
      ...((storedState.recentActions || []).length
        ? (storedState.recentActions || []).map(entry => `- ${entry}`)
        : ['- No recent actions recorded.']),
      '',
      '## Runtime log preview',
      '### STDOUT',
      '```text',
      stdoutPreview,
      '```',
      '',
      '### STDERR',
      '```text',
      stderrPreview,
      '```',
      ''
    ].join('\n');
  }

  async function generateReleaseHandoff() {
    if (!releaseHandoffPath) {
      throw new Error('No release handoff path is configured for this lane.');
    }

    const directoryPath = getParentDirectory(releaseHandoffPath);
    if (directoryPath) {
      await createWorkspaceDirectory(directoryPath);
    }

    const content = buildReleaseHandoffContent();
    const payload = await writeWorkspaceFile(releaseHandoffPath, content);
    rememberGeneratedArtifact(payload.path, 'Release handoff');
    persistState({
      releaseHandoff: {
        path: payload.path,
        timestamp: new Date().toLocaleString()
      }
    });
    filePathInput.value = payload.path;
    if (saveAsPathInput) {
      saveAsPathInput.value = payload.path;
    }
    workspaceSelectedPathInput.value = payload.path;
    workspaceTargetPathInput.value = payload.path;
    fileContentInput.value = content;
    renderReleaseHandoffResult();
    return payload;
  }

  function openWorkspacePack(pack) {
    workspaceRootInput.value = pack.root;
    workspaceRecursiveInput.checked = Boolean(pack.recursive);
    workspaceLimitInput.value = String(pack.limit || workspaceLimitInput.value || 200);
    workspaceSelectedPathInput.value = pack.root;
    workspaceTargetPathInput.value = pack.root;
    persistState();
    return refreshWorkspace(pack.root);
  }

  async function createArtifactTemplate(template) {
    const hydratedContent = hydrateTemplate(template.content || '', {
      laneTitle: config.title,
      laneId: storageKey,
      today: new Date().toISOString().slice(0, 10),
      timestamp: new Date().toISOString()
    });
    const targetPath = hydrateTemplate(template.path, {
      laneTitle: config.title,
      laneId: storageKey,
      today: new Date().toISOString().slice(0, 10),
      timestamp: new Date().toISOString()
    });
    const directoryPath = getParentDirectory(targetPath);

    if (directoryPath) {
      await createWorkspaceDirectory(directoryPath);
    }

    const payload = await writeWorkspaceFile(targetPath, hydratedContent);
    rememberGeneratedArtifact(payload.path, template.label);
    filePathInput.value = payload.path;
    if (saveAsPathInput) {
      saveAsPathInput.value = payload.path;
    }
    workspaceSelectedPathInput.value = payload.path;
    workspaceTargetPathInput.value = payload.path;
    fileContentInput.value = hydratedContent;
    workspaceResults.innerHTML = `<strong>Generated artifact:</strong> <code>${payload.path}</code>`;
    persistState();
    return payload;
  }

  async function openHintedFile(filePath) {
    const payload = await readWorkspaceFile(filePath);
    filePathInput.value = payload.path;
    if (saveAsPathInput) {
      saveAsPathInput.value = payload.path;
    }
    workspaceSelectedPathInput.value = payload.path;
    workspaceTargetPathInput.value = payload.path;
    fileContentInput.value = payload.content;
    workspaceResults.innerHTML = `<strong>Loaded file:</strong> <code>${payload.path}</code>`;
    persistState();
    return payload;
  }

  async function startRuntimeRecipe(recipeId) {
    const recipe = config.runtimeRecipes.find(entry => entry.id === recipeId);
    if (!recipe) {
      throw new Error(`Unknown runtime recipe: ${recipeId}`);
    }
    const payload = await startRuntime(recipe.request);
    runtimeIdInput.value = payload.runtime.id;
    resetRuntimeLogs(payload.runtime.id);
    runtimeResult.innerHTML = renderRuntimeList([payload.runtime]);
    persistState();
    return payload;
  }

  function openWorkflowTarget(targetKey) {
    const button = config.fullAppButtons.find(entry => entry.openTargetKey === targetKey);
    if (!button) {
      throw new Error(`Unknown launch target: ${targetKey}`);
    }
    const launchTarget = typeof config.openFullAppTarget === 'function'
      ? config.openFullAppTarget(targetKey)
      : openFullApp(button.href);
    return launchTarget;
  }

  async function runWorkflowAction(workflow) {
    for (const step of workflow.steps || []) {
      await performActionStep(step, `Workflow ${workflow.label}`);
    }
  }

  async function performActionStep(step, contextLabel) {
    if (step.type === 'workspace-pack') {
      const pack = enterprisePacks.find(entry => entry.id === step.packId);
      if (!pack) {
        throw new Error(`Unknown workspace pack: ${step.packId}`);
      }
      await openWorkspacePack(pack);
      recordRecentAction(`${contextLabel} opened pack ${pack.label}`);
      return;
    }

    if (step.type === 'artifact-template') {
      const template = enterpriseArtifacts.find(entry => entry.id === step.templateId);
      if (!template) {
        throw new Error(`Unknown artifact template: ${step.templateId}`);
      }
      const payload = await createArtifactTemplate(template);
      recordRecentAction(`${contextLabel} generated ${payload.path}`);
      return;
    }

    if (step.type === 'file-hint') {
      const payload = await openHintedFile(step.path);
      recordRecentAction(`${contextLabel} opened file ${payload.path}`);
      return;
    }

    if (step.type === 'runtime-recipe') {
      const payload = await startRuntimeRecipe(step.recipeId);
      recordRecentAction(`${contextLabel} started runtime ${payload.runtime.id}`);
      return;
    }

    if (step.type === 'launch-target') {
      const target = openWorkflowTarget(step.targetKey);
      recordRecentAction(`${contextLabel} opened ${target}`);
      return;
    }

    throw new Error(`Unknown workflow step type: ${step.type}`);
  }

  async function runValidationCheck(check) {
    for (const step of check.steps || []) {
      await performActionStep(step, `Validation ${check.title}`);
    }
    storeValidationResult(check.id, 'passed', check.successDetail || 'Validation completed successfully.');
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

  root.querySelectorAll('[data-workspace-pack]').forEach(button => {
    button.addEventListener('click', async () => {
      const pack = enterprisePacks.find(entry => entry.id === button.dataset.workspacePack);
      if (!pack) {
        return;
      }
      workspaceResults.innerHTML = `<strong>Loading pack:</strong> ${pack.label}`;
      try {
        await openWorkspacePack(pack);
        recordRecentAction(`Opened workspace pack ${pack.label}`);
      } catch (error) {
        workspaceResults.innerHTML = `<strong>Workspace pack failed:</strong> ${error.message}`;
      }
    });
  });

  root.querySelectorAll('[data-artifact-template]').forEach(button => {
    button.addEventListener('click', async () => {
      const template = enterpriseArtifacts.find(entry => entry.id === button.dataset.artifactTemplate);
      if (!template) {
        return;
      }
      workspaceResults.innerHTML = `<strong>Generating artifact:</strong> ${template.label}`;
      try {
        const payload = await createArtifactTemplate(template);
        recordRecentAction(`Generated artifact ${payload.path}`);
      } catch (error) {
        workspaceResults.innerHTML = `<strong>Artifact generation failed:</strong> ${error.message}`;
      }
    });
  });

  root.querySelectorAll('[data-workflow-action]').forEach(button => {
    button.addEventListener('click', async () => {
      const workflow = workflowActions.find(entry => entry.id === button.dataset.workflowAction);
      if (!workflow) {
        return;
      }
      workspaceResults.innerHTML = `<strong>Running workflow:</strong> ${workflow.label}`;
      try {
        await runWorkflowAction(workflow);
        workspaceResults.innerHTML = `<strong>Workflow complete:</strong> ${workflow.label}`;
      } catch (error) {
        workspaceResults.innerHTML = `<strong>Workflow failed:</strong> ${error.message}`;
      }
    });
  });

  root.querySelectorAll('[data-validation-check]').forEach(button => {
    button.addEventListener('click', async () => {
      const check = validationChecks.find(entry => entry.id === button.dataset.validationCheck);
      if (!check) {
        return;
      }
      workspaceResults.innerHTML = `<strong>Running validation:</strong> ${check.title}`;
      storeValidationResult(check.id, 'running', 'Validation in progress.');
      try {
        await runValidationCheck(check);
        workspaceResults.innerHTML = `<strong>Validation passed:</strong> ${check.title}`;
      } catch (error) {
        storeValidationResult(check.id, 'failed', error.message);
        workspaceResults.innerHTML = `<strong>Validation failed:</strong> ${error.message}`;
      }
    });
  });

  root.querySelectorAll('[data-launch-target-key]').forEach(button => {
    button.addEventListener('click', () => {
      const targetKey = button.dataset.launchTargetKey;
      if (!targetKey) {
        return;
      }
      const launchTarget = openWorkflowTarget(targetKey);
      recordRecentAction(`Opened mission target ${launchTarget}`);
    });
  });

  root.querySelectorAll('[data-owned-file-path]').forEach(button => {
    button.addEventListener('click', async () => {
      const ownedFilePath = button.dataset.ownedFilePath;
      if (!ownedFilePath) {
        return;
      }
      try {
        const payload = await openHintedFile(ownedFilePath);
        recordRecentAction(`Opened owned file ${payload.path}`);
      } catch (error) {
        workspaceResults.innerHTML = `<strong>Owned file failed:</strong> ${error.message}`;
      }
    });
  });

  root.querySelectorAll('[data-runtime-recipe-id]').forEach(button => {
    button.addEventListener('click', async () => {
      const recipeId = button.dataset.runtimeRecipeId;
      if (!recipeId) {
        return;
      }
      try {
        const payload = await startRuntimeRecipe(recipeId);
        recordRecentAction(`Started mission runtime ${payload.runtime.id}`);
        if (liveLogsEnabledInput.checked) {
          await startLiveLogs();
        }
      } catch (error) {
        runtimeResult.innerHTML = `<strong>Mission runtime failed:</strong> ${error.message}`;
      }
    });
  });

  root.querySelector('[data-generate-handoff]')?.addEventListener('click', async () => {
    workspaceResults.innerHTML = '<strong>Generating release handoff...</strong>';
    try {
      const payload = await generateReleaseHandoff();
      workspaceResults.innerHTML = `<strong>Release handoff ready:</strong> <code>${payload.path}</code>`;
      recordRecentAction(`Generated release handoff ${payload.path}`);
    } catch (error) {
      workspaceResults.innerHTML = `<strong>Release handoff failed:</strong> ${error.message}`;
    }
  });

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
      if (saveAsPathInput) {
        saveAsPathInput.value = payload.path;
      }
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
      if (saveAsPathInput) {
        saveAsPathInput.value = payload.path;
      }
      persistState();
      recordRecentAction(`Wrote file ${payload.path}`);
    } catch (error) {
      workspaceResults.innerHTML = `<strong>Write failed:</strong> ${error.message}`;
    }
  });

  root.querySelector('#save-file-as').addEventListener('click', async () => {
    try {
      const saveTarget = saveAsPathInput ? saveAsPathInput.value.trim() : filePathInput.value.trim();
      const payload = await writeWorkspaceFile(saveTarget, fileContentInput.value);
      filePathInput.value = payload.path;
      if (saveAsPathInput) {
        saveAsPathInput.value = payload.path;
      }
      workspaceSelectedPathInput.value = payload.path;
      workspaceTargetPathInput.value = payload.path;
      workspaceResults.innerHTML = `<strong>Saved as:</strong> <code>${payload.path}</code>`;
      persistState();
      recordRecentAction(`Saved file as ${payload.path}`);
    } catch (error) {
      workspaceResults.innerHTML = `<strong>Save as failed:</strong> ${error.message}`;
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
    button.addEventListener('click', () => {
      const target = button.dataset.openTarget;
      const targetKey = button.dataset.openKey;
      const launchTarget = targetKey
        ? openWorkflowTarget(targetKey)
        : openFullApp(target);
      recordRecentAction(`Opened full app ${launchTarget}`);
    });
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
    if (saveAsPathInput) {
      saveAsPathInput.value = entryPath;
    }
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

  root.querySelectorAll('[data-file-hint]').forEach(button => {
    button.addEventListener('click', async () => {
      const hintedPath = button.dataset.fileHint;
      if (!hintedPath) {
        return;
      }
      filePathInput.value = hintedPath;
      if (saveAsPathInput) {
        saveAsPathInput.value = hintedPath;
      }
      workspaceSelectedPathInput.value = hintedPath;
      workspaceTargetPathInput.value = hintedPath;
      persistState();
      try {
        const payload = await readWorkspaceFile(hintedPath);
        fileContentInput.value = payload.content;
        workspaceResults.innerHTML = `<strong>Loaded file:</strong> <code>${payload.path}</code>`;
        recordRecentAction(`Opened hinted file ${payload.path}`);
      } catch (error) {
        workspaceResults.innerHTML = `<strong>File load failed:</strong> ${error.message}`;
      }
    });
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

  [workspaceRootInput, workspaceLimitInput, workspaceSelectedPathInput, workspaceTargetPathInput, filePathInput, saveAsPathInput, runtimeIdInput].filter(Boolean).forEach(input => {
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
      <div><code>${escapeHtml(runtime.command || 'unknown')} ${escapeHtml(Array.isArray(runtime.args) ? runtime.args.join(' ') : '')}</code></div>
      <div>Status: <code>${escapeHtml(runtime.status || 'unknown')}</code> · PID: <code>${escapeHtml(String(runtime.pid || 'n/a'))}</code></div>
      <div>CWD: <code>${escapeHtml(runtime.cwd || 'n/a')}</code></div>
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

function renderEnterpriseWorkbench(enterprise, options = {}) {
  const missionConsole = enterprise.missionConsole || {};
  const releaseHandoffPath = options.releaseHandoffPath || '';

  return `
    <section class="panel enterprise-panel">
      <div>
        <div class="eyebrow">Enterprise workbench</div>
        <h2>${enterprise.title}</h2>
        <p>${enterprise.description}</p>
      </div>
      <div class="enterprise-highlight-grid">
        ${(enterprise.highlights || []).map(highlight => `
          <article class="enterprise-highlight">
            <strong>${highlight.value}</strong>
            <span>${highlight.label}</span>
          </article>
        `).join('')}
      </div>
      <div class="enterprise-board-grid">
        <section class="enterprise-group enterprise-group-wide">
          <div>
            <div class="eyebrow">Mission console</div>
            <h3>${missionConsole.title || 'Lane command surfaces'}</h3>
            <p>${missionConsole.description || 'Open preserved products, owned files, and runtime controls directly from the lane.'}</p>
          </div>
          <div class="enterprise-mission-grid">
            <section class="enterprise-group enterprise-subgroup">
              <div>
                <div class="eyebrow">Launch deck</div>
                <h3>Preserved and upgrade surfaces</h3>
              </div>
              <div class="enterprise-card-grid">
                ${(missionConsole.launchDeck || []).map(card => `
                  <article class="enterprise-card">
                    <div class="enterprise-card-topline">
                      <strong>${card.label}</strong>
                      ${renderBadge('launch', 'status')}
                    </div>
                    <div class="enterprise-meta">${card.meta}</div>
                    <p>${card.description}</p>
                    <div class="card-actions">
                      <button class="button secondary" type="button" data-launch-target-key="${card.targetKey}">${card.buttonLabel || 'Open target'}</button>
                    </div>
                  </article>
                `).join('')}
              </div>
            </section>
            <section class="enterprise-group enterprise-subgroup">
              <div>
                <div class="eyebrow">Ownership map</div>
                <h3>Lane-owned modules</h3>
              </div>
              <div class="enterprise-card-grid">
                ${(missionConsole.ownershipDeck || []).map(card => `
                  <article class="enterprise-card">
                    <div class="enterprise-card-topline">
                      <strong>${card.label}</strong>
                      ${renderBadge('owned', 'status')}
                    </div>
                    <div class="enterprise-meta">${card.path}</div>
                    <p>${card.description}</p>
                    <div class="card-actions">
                      <button class="button secondary" type="button" data-owned-file-path="${card.path}">${card.buttonLabel || 'Open file'}</button>
                    </div>
                  </article>
                `).join('')}
              </div>
            </section>
            <section class="enterprise-group enterprise-subgroup">
              <div>
                <div class="eyebrow">Runtime deck</div>
                <h3>Operational targets</h3>
              </div>
              <div class="enterprise-card-grid">
                ${(missionConsole.runtimeDeck || []).map(card => `
                  <article class="enterprise-card">
                    <div class="enterprise-card-topline">
                      <strong>${card.label}</strong>
                      ${renderBadge('runtime', 'status')}
                    </div>
                    <div class="enterprise-meta">${card.meta}</div>
                    <p>${card.description}</p>
                    <div class="card-actions">
                      <button class="button secondary" type="button" data-runtime-recipe-id="${card.recipeId}">${card.buttonLabel || 'Start runtime'}</button>
                    </div>
                  </article>
                `).join('')}
              </div>
            </section>
          </div>
        </section>
        <section class="enterprise-group enterprise-group-wide">
          <div>
            <div class="eyebrow">Validation lab</div>
            <h3>Executable readiness checks</h3>
          </div>
          <div class="enterprise-card-grid">
            ${(enterprise.validationChecks || []).map(check => `
              <article class="enterprise-card validation-card">
                <div class="enterprise-card-topline">
                  <strong>${check.title}</strong>
                  ${renderBadge('check', 'status')}
                </div>
                <div class="enterprise-meta">Owner: ${check.owner}</div>
                <p>${check.description}</p>
                <div class="validation-result" data-validation-result="${check.id}">
                  <span class="validation-state validation-idle">Not run yet.</span>
                </div>
                <ol class="enterprise-steps">
                  ${(check.summarySteps || []).map(step => `<li>${step}</li>`).join('')}
                </ol>
                <div class="card-actions">
                  <button class="button secondary" type="button" data-validation-check="${check.id}">Run check</button>
                </div>
              </article>
            `).join('')}
          </div>
        </section>
        <section class="enterprise-group enterprise-group-wide">
          <div>
            <div class="eyebrow">Release handoff</div>
            <h3>Package current evidence into a lane-owned file</h3>
            <p>Generate a handoff markdown file with validation results, generated artifacts, release gates, verification proof, and recent lane actions.</p>
          </div>
          <article class="enterprise-card">
            <div class="enterprise-card-topline">
              <strong>Current release handoff</strong>
              ${renderBadge('handoff', 'status')}
            </div>
            <div class="enterprise-meta">${releaseHandoffPath || 'No handoff path available.'}</div>
            <div class="validation-result" id="release-handoff-result">
              <span class="validation-state validation-idle">Pending</span>
            </div>
            <div class="card-actions">
              <button class="button secondary" type="button" data-generate-handoff="true">Generate release handoff</button>
            </div>
          </article>
        </section>
        <section class="enterprise-group">
          <div>
            <div class="eyebrow">Workflow actions</div>
            <h3>Lane-native automation</h3>
          </div>
          <div class="enterprise-card-grid">
            ${(enterprise.workflowActions || []).map(workflow => `
              <article class="enterprise-card">
                <div class="enterprise-card-topline">
                  <strong>${workflow.label}</strong>
                  ${renderBadge('workflow', 'status')}
                </div>
                <p>${workflow.description}</p>
                <div class="enterprise-meta">Outcome: ${workflow.outcome}</div>
                <ol class="enterprise-steps">
                  ${(workflow.summarySteps || []).map(step => `<li>${step}</li>`).join('')}
                </ol>
                <div class="card-actions">
                  <button class="button secondary" type="button" data-workflow-action="${workflow.id}">Run workflow</button>
                </div>
              </article>
            `).join('')}
          </div>
        </section>
        <section class="enterprise-group">
          <div>
            <div class="eyebrow">Workspace packs</div>
            <h3>Owned source scopes</h3>
          </div>
          <div class="enterprise-card-grid">
            ${(enterprise.workspacePacks || []).map(pack => `
              <article class="enterprise-card">
                <div class="enterprise-card-topline">
                  <strong>${pack.label}</strong>
                  ${renderBadge(pack.recursive ? 'deep' : 'direct', 'status')}
                </div>
                <div class="enterprise-meta">${pack.root}</div>
                <p>${pack.description}</p>
                <div class="card-actions">
                  <button class="button secondary" type="button" data-workspace-pack="${pack.id}">Open pack</button>
                </div>
              </article>
            `).join('')}
          </div>
        </section>
        <section class="enterprise-group">
          <div>
            <div class="eyebrow">Artifact generator</div>
            <h3>Lane-owned release files</h3>
          </div>
          <div class="enterprise-card-grid">
            ${(enterprise.artifactTemplates || []).map(template => `
              <article class="enterprise-card">
                <div class="enterprise-card-topline">
                  <strong>${template.label}</strong>
                  ${renderBadge('template', 'status')}
                </div>
                <div class="enterprise-meta">${template.path}</div>
                <p>${template.description}</p>
                <div class="card-actions">
                  <button class="button secondary" type="button" data-artifact-template="${template.id}">Generate artifact</button>
                </div>
              </article>
            `).join('')}
          </div>
        </section>
        <section class="enterprise-group">
          <div>
            <div class="eyebrow">Delivery streams</div>
            <h3>Owned work streams</h3>
          </div>
          <div class="enterprise-card-grid">
            ${(enterprise.deliveryStreams || []).map(stream => `
              <article class="enterprise-card">
                <div class="enterprise-card-topline">
                  <strong>${stream.name}</strong>
                  ${renderBadge(stream.status, 'status')}
                </div>
                <div class="enterprise-meta">Owner: ${stream.owner}</div>
                <p>${stream.outcome}</p>
              </article>
            `).join('')}
          </div>
        </section>
        <section class="enterprise-group">
          <div>
            <div class="eyebrow">Release gates</div>
            <h3>Promotion readiness</h3>
          </div>
          <div class="enterprise-list">
            ${(enterprise.releaseGates || []).map(gate => `
              <article class="enterprise-list-item">
                <div class="enterprise-card-topline">
                  <strong>${gate.gate}</strong>
                  ${renderBadge(gate.status, 'status')}
                </div>
                <div><span class="enterprise-list-label">Evidence</span>${gate.evidence}</div>
                <div><span class="enterprise-list-label">Next</span>${gate.nextAction}</div>
              </article>
            `).join('')}
          </div>
        </section>
        <section class="enterprise-group">
          <div>
            <div class="eyebrow">Risk register</div>
            <h3>Known delivery risks</h3>
          </div>
          <div class="enterprise-list">
            ${(enterprise.riskRegister || []).map(risk => `
              <article class="enterprise-list-item">
                <div class="enterprise-card-topline">
                  <strong>${risk.title}</strong>
                  ${renderBadge(risk.severity, 'severity')}
                </div>
                <div><span class="enterprise-list-label">Mitigation</span>${risk.mitigation}</div>
              </article>
            `).join('')}
          </div>
        </section>
        <section class="enterprise-group">
          <div>
            <div class="eyebrow">Runbooks</div>
            <h3>Operator playbooks</h3>
          </div>
          <div class="enterprise-list">
            ${(enterprise.runbooks || []).map(runbook => `
              <article class="enterprise-list-item">
                <div class="enterprise-card-topline">
                  <strong>${runbook.title}</strong>
                  <span class="enterprise-meta">${runbook.owner}</span>
                </div>
                <div><span class="enterprise-list-label">Trigger</span>${runbook.trigger}</div>
                <ol class="enterprise-steps">
                  ${(runbook.steps || []).map(step => `<li>${step}</li>`).join('')}
                </ol>
              </article>
            `).join('')}
          </div>
        </section>
        <section class="enterprise-group enterprise-group-wide">
          <div>
            <div class="eyebrow">Preflight checks</div>
            <h3>Operator readiness checklist</h3>
          </div>
          <div class="enterprise-list">
            ${(enterprise.preflightChecks || []).map(check => `
              <article class="enterprise-list-item">
                <div class="enterprise-card-topline">
                  <strong>${check.title}</strong>
                  <span class="enterprise-meta">${check.owner}</span>
                </div>
                <div><span class="enterprise-list-label">Expected outcome</span>${check.outcome}</div>
                <ol class="enterprise-steps">
                  ${(check.steps || []).map(step => `<li>${step}</li>`).join('')}
                </ol>
              </article>
            `).join('')}
          </div>
        </section>
        <section class="enterprise-group enterprise-group-wide">
          <div>
            <div class="eyebrow">Verification matrix</div>
            <h3>Minimum proof for release</h3>
          </div>
          <div class="enterprise-table">
            ${(enterprise.verificationMatrix || []).map(check => `
              <article class="enterprise-table-row">
                <div>
                  <strong>${check.name}</strong>
                  <div class="enterprise-meta">${check.command}</div>
                </div>
                <p>${check.evidence}</p>
              </article>
            `).join('')}
          </div>
        </section>
      </div>
    </section>
  `;
}

function renderBadge(value, kind) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `<span class="badge badge-${kind} badge-${slug}">${value}</span>`;
}

function storageKeyFallback(config) {
  return config.storageKey || `skycde:${config.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function resolveReleaseHandoffPath(artifactTemplates, workspacePacks, laneId) {
  const today = new Date().toISOString().slice(0, 10);
  const firstArtifactPath = artifactTemplates[0]?.path;
  if (firstArtifactPath) {
    const hydratedPath = hydrateTemplate(firstArtifactPath, {
      laneTitle: '',
      laneId,
      today,
      timestamp: new Date().toISOString()
    });
    const directoryPath = getParentDirectory(hydratedPath);
    if (directoryPath) {
      return `${directoryPath}/${today}-release-handoff.md`;
    }
  }

  const packRoot = workspacePacks[0]?.root;
  if (packRoot) {
    return `${packRoot}/delivery/${today}-release-handoff.md`;
  }

  return '';
}

function truncateBlock(value, maxLength = 2400) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}\n... truncated ...`;
}

function hydrateTemplate(template, values) {
  return template
    .replace(/\{\{LANE_TITLE\}\}/g, values.laneTitle)
    .replace(/\{\{LANE_ID\}\}/g, values.laneId)
    .replace(/\{\{TODAY\}\}/g, values.today)
    .replace(/\{\{TIMESTAMP\}\}/g, values.timestamp);
}

function getParentDirectory(path) {
  const lastSlash = path.lastIndexOf('/');
  if (lastSlash <= 0) {
    return '';
  }
  return path.slice(0, lastSlash);
}