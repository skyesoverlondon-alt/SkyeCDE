import {
  connectCloudflareWorker,
  connectGitHubIntegration,
  connectNetlifySite,
  createWorkspaceDirectory,
  deployCloudflareWorker,
  deployNetlifySite,
  getAutomationState,
  deleteWorkspacePath,
  getRuntimeLogs,
  listRuntimes,
  loadWorkspaceEntries,
  moveWorkspacePath,
  probeRuntimeHealth,
  pushGitHubPromotion,
  readWorkspaceFile,
  renameWorkspacePath,
  restartRuntime,
  startRuntime,
  stopRuntime,
  writeWorkspaceFile
} from '../../_shared/skycde-bridge-client.js';
import { buildSkyeHawkRoutes, installSkyeHawkMenu } from '../../_shared/skyehawk-menu.js';

export function renderSkyDexiaShell(root, config) {
  const storageKey = config.storageKey || 'skycde:skydexia';
  const state = loadStoredState(storageKey);
  const sectionState = loadStoredState(`${storageKey}:sections`);
  const postureState = loadStoredState(`${storageKey}:posture`);
  const operatingModel = config.operatingModel || { pages: [] };
  const enterprise = config.enterprise || {};
  const validationChecks = enterprise.validationChecks || [];
  const workflowActions = enterprise.workflowActions || [];
  const artifactTemplates = enterprise.artifactTemplates || [];
  const missionConsole = enterprise.missionConsole || {};
  const releaseHandoffPath = resolveReleaseHandoffPath(artifactTemplates, storageKey);

  root.innerHTML = `
    <main class="skydexia-shell">
      <section class="skydexia-hero">
        <div class="skydexia-hero-copy">
          <div class="eyebrow">${escapeHtml(config.eyebrow)}</div>
          <h1>${escapeHtml(config.title)}</h1>
          <p>${escapeHtml(config.description)}</p>
          <div class="hero-actions">
            <a class="button" href="${config.actions.primary.href}">${escapeHtml(config.actions.primary.label)}</a>
            <a class="button secondary" href="${config.actions.secondary.href}">${escapeHtml(config.actions.secondary.label)}</a>
            <button class="button secondary" type="button" id="open-skyehawk">Open SkyeHawk</button>
          </div>
        </div>
        <div class="skydexia-hero-side">
          <div class="score-card">
            <span class="score-label">Current score</span>
            <strong>${escapeHtml(String(operatingModel.audit?.currentScore || 0))} / 100</strong>
            <p>${escapeHtml(operatingModel.audit?.summary || '')}</p>
          </div>
          <div class="metric-grid">
            ${(config.metrics || []).map(metric => `
              <article class="metric-card">
                <strong>${escapeHtml(metric.value)}</strong>
                <span>${escapeHtml(metric.label)}</span>
              </article>
            `).join('')}
          </div>
        </div>
      </section>

      <section class="page-toolbar shell-section" data-section-id="page-toolbar">
        <header class="shell-section-header">
          <div>
            <div class="eyebrow">Page map</div>
            <h2>SkyDexia operating package</h2>
            <p>Dedicated pages replace the old one-shell pileup.</p>
          </div>
          <div class="section-actions">
            <button class="section-toggle" type="button" data-section-action="collapse" data-section-id="page-toolbar">Collapse</button>
            <button class="section-toggle" type="button" data-section-action="minimize" data-section-id="page-toolbar">Minimize</button>
          </div>
        </header>
        <div class="shell-section-body">
          <div class="page-tab-row">
            ${(operatingModel.pages || []).map(page => `
              <button class="page-tab" type="button" data-page-tab="${escapeAttribute(page.id)}">
                <strong>${escapeHtml(page.label)}</strong>
                <span>${escapeHtml(page.summary)}</span>
              </button>
            `).join('')}
          </div>
        </div>
      </section>

      <section class="shell-grid">
        <aside class="shell-sidebar">
          ${renderSection('score-rail', 'Skye Standard rail', 'Audit rail', `
            <div class="status-stack">
              <article class="status-card accent-card">
                <strong>Target score</strong>
                <div>${escapeHtml(String(operatingModel.audit?.targetScore || 85))} / 100</div>
              </article>
              <article class="status-card">
                <strong>Session bridge</strong>
                <div>${escapeHtml(config.sessionState?.source || 'lane')}</div>
              </article>
              <article class="status-card">
                <strong>Gate posture</strong>
                <div>${escapeHtml(config.sessionState?.gate || 'bridge-backed')}</div>
              </article>
              <article class="status-card">
                <strong>Theia support</strong>
                <div>${escapeHtml(config.sessionState?.theiaSupportLayer || 'active')}</div>
              </article>
            </div>
            <div class="directive-list">
              ${(operatingModel.directives || []).map(item => `<div class="directive-item">${escapeHtml(item)}</div>`).join('')}
            </div>
          `, true)}

          ${renderSection('recent-rail', 'Recent actions', 'Operator memory', '<ul id="recent-actions" class="bullet-list"></ul>', true)}

          ${renderSection('status-rail', config.statusTitle || 'Bridge status', 'Live lane status', `<ul class="bullet-list">${(config.statusItems || []).map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`, true)}
        </aside>

        <div class="shell-pages">
          <section class="page-view" data-page="command">
            ${renderSection('support-lanes', config.supportTitle || 'Support lanes', 'Command Center', `
              <div class="lane-grid">
                ${(config.lanes || []).map(lane => renderSimpleCard(lane.tag, lane.title, lane.description)).join('')}
              </div>
            `)}

            ${renderSection('mission-console', missionConsole.title || 'Mission console', 'Command Center', `
              <div class="three-column-grid">
                ${renderMissionGroup('Launch deck', missionConsole.launchDeck, 'launch-target', 'Open target')}
                ${renderMissionGroup('Ownership deck', missionConsole.ownershipDeck, 'file-path', 'Open file')}
                ${renderMissionGroup('Runtime deck', missionConsole.runtimeDeck, 'runtime-recipe', 'Start runtime')}
              </div>
            `)}

            ${renderSection('page-readiness', 'Build directives', 'What changed', `
              <div class="status-stack">
                <article class="status-card"><strong>Multi-page shell</strong><div>SkyDexia now has dedicated operator pages instead of one stacked dashboard.</div></article>
                <article class="status-card"><strong>Universal panel contract</strong><div>Every section in this shell supports scroll, collapse, and minimize state.</div></article>
                <article class="status-card"><strong>Product continuity</strong><div>Current SkyDex remains launchable as the authoritative product surface.</div></article>
              </div>
            `)}
          </section>

          <section class="page-view" data-page="workspace" hidden>
            ${renderSection('workspace-bridge', 'Inspect repo lanes', 'Workspace bridge', `
              <form id="workspace-form" class="field-grid-form">
                <label>Workspace root inside repo<input id="workspace-root" value="${escapeAttribute(config.workspaceRoot)}" /></label>
                <label class="checkbox-field"><input id="workspace-recursive" type="checkbox" />Deep browse recursively</label>
                <label>Entry limit<input id="workspace-limit" type="number" min="1" max="2000" value="200" /></label>
                <div class="card-actions"><button type="submit" class="button">Load workspace</button></div>
              </form>
              <div id="workspace-results" class="result-panel"><strong>Workspace entries will appear here.</strong></div>
              <div class="quick-pack-grid">
                ${(enterprise.workspacePacks || []).map(pack => `
                  <button class="mini-card-button" type="button" data-workspace-pack="${escapeAttribute(pack.id)}">
                    <strong>${escapeHtml(pack.label)}</strong>
                    <span>${escapeHtml(pack.description)}</span>
                  </button>
                `).join('')}
              </div>
            `)}

            ${renderSection('workspace-actions', 'Path operations', 'Workspace actions', `
              <form id="directory-form" class="field-grid-form">
                <label>Create directory inside repo<input id="directory-path" value="${escapeAttribute(config.workspaceRoot)}" /></label>
                <div class="card-actions"><button type="submit" class="button secondary">Create directory</button></div>
              </form>
              <form id="workspace-actions-form" class="field-grid-form">
                <label>Selected workspace path<input id="workspace-selected-path" value="${escapeAttribute(config.filePath)}" /></label>
                <label>Target path for rename or move<input id="workspace-target-path" value="${escapeAttribute(config.filePath)}" /></label>
                <div class="card-actions">
                  <button type="button" class="button secondary" id="reload-workspace">Reload workspace</button>
                  <button type="button" class="button secondary" id="rename-path">Rename path</button>
                  <button type="button" class="button secondary" id="move-path">Move path</button>
                  <button type="button" class="button danger" id="delete-path">Delete path</button>
                </div>
              </form>
            `)}

            ${renderSection('file-bridge', 'Read and write lane files', 'File bridge', `
              <div class="quick-pack-grid">
                ${(config.fileHints || []).map(fileHint => `
                  <button class="mini-card-button" type="button" data-file-hint="${escapeAttribute(fileHint.path)}">
                    <strong>${escapeHtml(fileHint.label)}</strong>
                    <span>${escapeHtml(fileHint.path)}</span>
                  </button>
                `).join('')}
              </div>
              <div class="field-grid-form compact-form">
                <label>File path inside repo<input id="file-path" value="${escapeAttribute(config.filePath)}" /></label>
                <label>Save as path inside repo<input id="save-as-path" value="${escapeAttribute(config.saveAsPath || config.filePath)}" /></label>
              </div>
              <div class="card-actions">
                <button class="button" type="button" id="read-file">Read file</button>
                <button class="button secondary" type="button" id="write-file">Write file</button>
                <button class="button secondary" type="button" id="save-file-as">Save as</button>
              </div>
              <label class="textarea-field">File content<textarea id="file-content">${escapeHtml(config.fileSeed || '')}</textarea></label>
            `)}
          </section>

          <section class="page-view" data-page="runtime" hidden>
            ${renderSection('runtime-controls', 'Runtime command deck', 'Runtime + Logs', `
              <div class="card-actions">
                ${(config.runtimeRecipes || []).map(recipe => `<button class="button${recipe.secondary ? ' secondary' : ''}" type="button" data-runtime-recipe-id="${escapeAttribute(recipe.id)}">${escapeHtml(recipe.label)}</button>`).join('')}
              </div>
              <div class="card-actions">
                <button class="button" type="button" id="refresh-runtimes">Refresh runtimes</button>
                <button class="button secondary" type="button" id="restart-runtime">Restart selected runtime</button>
                <button class="button secondary" type="button" id="stop-runtime">Stop selected runtime</button>
                <button class="button secondary" type="button" id="load-logs">Load runtime logs</button>
                <button class="button secondary" type="button" id="probe-runtime">Run health probe</button>
              </div>
              <label class="checkbox-field"><input id="live-logs-enabled" type="checkbox" checked />Follow live logs automatically</label>
              <div class="card-actions compact-actions">
                <button class="button" type="button" id="start-live-logs">Start live logs</button>
                <button class="button secondary" type="button" id="stop-live-logs">Stop live logs</button>
                <button class="button secondary" type="button" id="clear-runtime-logs">Clear log view</button>
              </div>
              <div id="runtime-stream-status" class="inline-note">Live log polling is idle.</div>
              <label>Selected runtime id<input id="runtime-id" /></label>
              <div id="runtime-probe-status" class="result-panel"><strong>Runtime probes will appear here.</strong></div>
              <div id="runtime-result" class="result-panel"><strong>Runtime status will appear here.</strong></div>
            `)}

            ${renderSection('runtime-logs', 'Runtime logs', 'Runtime + Logs', `
              <div class="console-panel"><pre id="runtime-logs">No logs loaded.</pre></div>
              <div class="card-grid two-col">
                ${((enterprise.runbooks || []).slice(0, 4)).map(runbook => renderStatusCard(runbook.title || runbook.name, runbook.summary || runbook.outcome || 'Runbook guidance available in lane docs.')).join('')}
              </div>
            `)}

            ${renderSection('runtime-recovery', 'Recovery desk', 'Runtime + Logs', `
              <div class="card-grid two-col">
                <article class="action-card">
                  <div class="card-topline"><span class="badge">runbook</span></div>
                  <h3>Runtime incident runbook</h3>
                  <p>Open the lane-owned runtime runbook before restarting a failing runtime or resuming promotion work.</p>
                  <div class="card-actions">
                    <button class="button secondary" type="button" data-open-file-path="Sky0s-Platforms/SkyeCDE/SkyDexia/ops/SKYDEXIA_RUNTIME_RUNBOOK.md">Open runtime runbook</button>
                    <button class="button secondary" type="button" data-artifact-template="skydexia-incident-log">Generate incident log</button>
                  </div>
                </article>
                <article class="action-card">
                  <div class="card-topline"><span class="badge">recovery</span></div>
                  <h3>Rollback and recovery actions</h3>
                  <p>Use lane-owned runtime actions and evidence artifacts together so rollback work remains auditable inside SkyDexia.</p>
                  <div class="card-actions">
                    <button class="button secondary" type="button" id="restart-runtime-inline">Restart selected runtime</button>
                    <button class="button secondary" type="button" id="stop-runtime-inline">Stop selected runtime</button>
                    <button class="button secondary" type="button" data-artifact-template="skydexia-smoke-report">Generate smoke report</button>
                  </div>
                </article>
              </div>
            `)}
          </section>

          <section class="page-view" data-page="launch" hidden>
            ${renderSection('launch-surfaces', 'Full app routing', 'Launch Surfaces', `
              <div class="card-actions">
                ${(config.fullAppButtons || []).map(button => `<button class="button${button.secondary ? ' secondary' : ''}" type="button" data-open-target="${escapeAttribute(button.href)}"${button.openTargetKey ? ` data-open-key="${escapeAttribute(button.openTargetKey)}"` : ''}>${escapeHtml(button.label)}</button>`).join('')}
              </div>
              <div class="card-grid">
                ${(operatingModel.launchLanes || []).map(lane => renderActionCard(lane)).join('')}
              </div>
            `)}
          </section>

          <section class="page-view" data-page="delivery" hidden>
            ${renderSection('preflight-checks', 'Preflight checks', 'Delivery + Proof', `
              <div class="card-grid two-col">
                ${(enterprise.preflightChecks || []).map(check => `
                  <article class="action-card">
                    <div class="card-topline"><span class="badge">${escapeHtml(check.owner)}</span></div>
                    <h3>${escapeHtml(check.title)}</h3>
                    <p>${escapeHtml(check.outcome)}</p>
                    <ol class="step-list">${(check.steps || []).map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
                  </article>
                `).join('')}
              </div>
            `)}

            ${renderSection('validation-lab', 'Executable readiness checks', 'Delivery + Proof', `
              <div class="card-grid">
                ${validationChecks.map(check => `
                  <article class="action-card validation-card">
                    <div class="card-topline"><span class="badge">${escapeHtml(check.owner)}</span></div>
                    <h3>${escapeHtml(check.title)}</h3>
                    <p>${escapeHtml(check.description)}</p>
                    <div class="validation-result" data-validation-result="${escapeAttribute(check.id)}"><span class="validation-state validation-idle">Not run yet.</span></div>
                    <ol class="step-list">${(check.summarySteps || []).map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
                    <div class="card-actions"><button class="button secondary" type="button" data-validation-check="${escapeAttribute(check.id)}">Run check</button></div>
                  </article>
                `).join('')}
              </div>
            `)}

            ${renderSection('workflow-automation', 'Workflow actions', 'Delivery + Proof', `
              <div class="card-grid two-col">
                ${workflowActions.map(workflow => `
                  <article class="action-card">
                    <div class="card-topline"><span class="badge">workflow</span></div>
                    <h3>${escapeHtml(workflow.label)}</h3>
                    <p>${escapeHtml(workflow.description)}</p>
                    <div class="inline-note">${escapeHtml(workflow.outcome || '')}</div>
                    <ol class="step-list">${(workflow.summarySteps || []).map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
                    <div class="card-actions"><button class="button secondary" type="button" data-workflow-action="${escapeAttribute(workflow.id)}">Run workflow</button></div>
                  </article>
                `).join('')}
              </div>
            `)}

            ${renderSection('artifact-factory', 'Artifact templates', 'Delivery + Proof', `
              <div class="card-grid two-col">
                ${artifactTemplates.map(template => `
                  <article class="action-card">
                    <div class="card-topline"><span class="badge">artifact</span></div>
                    <h3>${escapeHtml(template.label)}</h3>
                    <p>${escapeHtml(template.description)}</p>
                    <div class="inline-note">${escapeHtml(template.path)}</div>
                    <div class="card-actions"><button class="button secondary" type="button" data-artifact-template="${escapeAttribute(template.id)}">Generate artifact</button></div>
                  </article>
                `).join('')}
              </div>
            `)}

            ${renderSection('release-governance', 'Release gates and verification', 'Delivery + Proof', `
              <div class="card-grid two-col">
                ${renderGovernanceList('Release gates', enterprise.releaseGates || [], gate => `
                  <strong>${escapeHtml(gate.gate)}</strong>
                  <div>${escapeHtml(gate.status)}</div>
                  <p>${escapeHtml(gate.evidence)}</p>
                  <div class="inline-note">Next: ${escapeHtml(gate.nextAction)}</div>
                `)}
                ${renderGovernanceList('Verification matrix', enterprise.verificationMatrix || [], item => `
                  <strong>${escapeHtml(item.name)}</strong>
                  <div>${escapeHtml(item.command)}</div>
                  <p>${escapeHtml(item.evidence)}</p>
                `)}
              </div>
            `)}

            ${renderSection('runtime-health-proof', 'Runtime health proof', 'Delivery + Proof', `
              <div id="runtime-health-proof-panel" class="result-panel"><strong>No runtime probe evidence recorded yet.</strong></div>
            `)}

            ${renderSection('promotion-proof', 'Promotion automation proof', 'Delivery + Proof', `
              <div id="promotion-proof-panel" class="result-panel"><strong>No GitHub, Netlify, or Cloudflare executions recorded yet.</strong></div>
            `)}

            ${renderSection('risk-and-runbook', 'Risk and rollback discipline', 'Delivery + Proof', `
              <div class="card-grid two-col">
                ${renderGovernanceList('Risk register', enterprise.riskRegister || [], item => `
                  <strong>${escapeHtml(item.title)}</strong>
                  <div>${escapeHtml(item.severity)}</div>
                  <p>${escapeHtml(item.mitigation)}</p>
                `)}
                ${renderGovernanceList('Runbooks', enterprise.runbooks || [], item => `
                  <strong>${escapeHtml(item.title)}</strong>
                  <div>${escapeHtml(item.trigger)}</div>
                  <p>${escapeHtml(item.owner)}</p>
                  <ol class="step-list">${(item.steps || []).map(step => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
                `)}
              </div>
              <div class="card-grid two-col">
                <article class="action-card">
                  <div class="card-topline"><span class="badge">rollback</span></div>
                  <h3>Rollback packet</h3>
                  <p>Generate the minimum incident, smoke, and rollout files before resuming promotion after a runtime or deployment failure.</p>
                  <div class="card-actions">
                    <button class="button secondary" type="button" data-artifact-template="skydexia-incident-log">Incident log</button>
                    <button class="button secondary" type="button" data-artifact-template="skydexia-smoke-report">Smoke report</button>
                    <button class="button secondary" type="button" data-artifact-template="skydexia-rollout-plan">Rollout plan</button>
                    <button class="button secondary" type="button" data-artifact-template="skydexia-environment-audit">Environment audit</button>
                  </div>
                </article>
                <article class="action-card">
                  <div class="card-topline"><span class="badge">continuity</span></div>
                  <h3>Continuity checks</h3>
                  <p>Recovery is not complete until the preserved SkyDex surface still opens, the target runtime recovers, and the lane can generate evidence again.</p>
                  <div class="card-actions">
                    <button class="button secondary" type="button" data-launch-target="currentSkyDex">Open current SkyDex</button>
                    <button class="button secondary" type="button" id="load-logs-inline">Load selected runtime logs</button>
                    <button class="button secondary" type="button" id="generate-release-handoff-inline">Generate release handoff</button>
                  </div>
                </article>
              </div>
            `)}

            ${renderSection('release-handoff', 'Release handoff', 'Delivery + Proof', `
              <article class="action-card">
                <div class="card-topline"><span class="badge">handoff</span></div>
                <h3>Current release handoff</h3>
                <p>Generate a lane-owned markdown file with validation, artifact, runtime, and gate state.</p>
                <div class="inline-note">${escapeHtml(releaseHandoffPath || 'No handoff path available.')}</div>
                <div class="validation-result" id="release-handoff-result"><span class="validation-state validation-idle">Pending</span></div>
                <div class="card-actions"><button class="button secondary" type="button" id="generate-release-handoff">Generate release handoff</button></div>
              </article>
            `)}
          </section>

          <section class="page-view" data-page="cloud" hidden>
            ${renderSection('cloud-ops', 'GitHub, Netlify, Cloudflare, and data', 'GitHub + Cloud', `
              <div class="card-grid two-col">
                ${(operatingModel.cloudLanes || []).map(lane => renderActionCard(lane)).join('')}
              </div>
            `)}

            ${renderSection('cloud-posture', 'Live promotion controls', 'GitHub + Cloud', `
              <form id="cloud-posture-form" class="field-grid-form three-col-form">
                <label>GitHub repo<input name="githubRepo" placeholder="owner/repo" /></label>
                <label>GitHub branch<input name="githubBranch" placeholder="main" /></label>
                <label>GitHub token<input name="githubToken" type="password" placeholder="ghp_..." /></label>
                <label>GitHub source root<input name="githubSourceRoot" placeholder="." /></label>
                <label>GitHub release message<input name="githubMessage" placeholder="SkyDexia promotion" /></label>
                <label>Netlify site id<input name="netlifySiteId" placeholder="site-id" /></label>
                <label>Netlify site name<input name="netlifySiteName" placeholder="site-name" /></label>
                <label>Netlify token<input name="netlifyToken" type="password" placeholder="NETLIFY_AUTH_TOKEN" /></label>
                <label>Netlify publish dir<input name="netlifyPublishDir" placeholder="Sky0s-Platforms/SkyeCDE/SkyDexia" /></label>
                <label>Netlify cwd<input name="netlifyCwd" placeholder="." /></label>
                <label>Cloudflare worker root<input name="cloudflareWorkerRoot" placeholder="Sky0s-Platforms/SuperIDE/worker" /></label>
                <label>Cloudflare account id<input name="cloudflareAccountId" placeholder="account-id" /></label>
                <label>Cloudflare API token<input name="cloudflareApiToken" type="password" placeholder="CLOUDFLARE_API_TOKEN" /></label>
                <label>Cloudflare config path<input name="cloudflareConfigPath" placeholder="wrangler.toml" /></label>
                <label>Cloudflare environment<input name="cloudflareEnvironment" placeholder="production" /></label>
                <label>Neon project<input name="neonProject" placeholder="project or database" /></label>
                <label>R2 bucket<input name="r2Bucket" placeholder="bucket-name" /></label>
                <label>Blobs namespace<input name="blobsNamespace" placeholder="namespace" /></label>
              </form>
              <div id="automation-state-panel" class="result-panel"><strong>Automation connection state will appear here.</strong></div>
              <div id="cloud-action-result" class="result-panel"><strong>Cloud execution results will appear here.</strong></div>
              <div class="card-actions">
                <button class="button" type="button" id="save-cloud-posture">Save posture</button>
                <button class="button secondary" type="button" id="refresh-automation-state">Refresh automation state</button>
                <button class="button secondary" type="button" id="connect-github">Connect GitHub</button>
                <button class="button secondary" type="button" id="push-github">Push GitHub</button>
                <button class="button secondary" type="button" id="connect-netlify">Connect Netlify</button>
                <button class="button secondary" type="button" id="deploy-netlify">Deploy Netlify</button>
                <button class="button secondary" type="button" id="connect-cloudflare">Connect Cloudflare</button>
                <button class="button secondary" type="button" id="deploy-cloudflare">Deploy Cloudflare</button>
                <button class="button secondary" type="button" id="generate-cloud-brief">Generate cloud ops brief</button>
              </div>
            `)}
          </section>

          <section class="page-view" data-page="mail" hidden>
            ${renderSection('mail-identity-lanes', 'Mail and identity surfaces', 'Mail + Identity', `
              <div class="card-grid two-col">
                ${(operatingModel.mailIdentityLanes || []).map(lane => renderActionCard(lane)).join('')}
              </div>
            `)}

            ${renderSection('mail-identity-posture', 'Mail and identity posture', 'Mail + Identity', `
              <form id="mail-posture-form" class="field-grid-form three-col-form">
                <label>SMTP host<input name="smtpHost" placeholder="smtp.gmail.com" /></label>
                <label>SMTP port<input name="smtpPort" placeholder="587" /></label>
                <label>SMTP sender<input name="smtpFrom" placeholder="alerts@domain.com" /></label>
                <label>Resend sender<input name="resendSender" placeholder="noreply@domain.com" /></label>
                <label>Identity mode<input name="identityMode" placeholder="Netlify Identity / custom / none" /></label>
                <label>Admin lane<input name="adminLane" placeholder="admin page or route" /></label>
                <label>Forms lane<input name="formsLane" placeholder="forms capture route" /></label>
              </form>
              <div class="card-actions">
                <button class="button" type="button" id="save-mail-posture">Save posture</button>
                <button class="button secondary" type="button" id="generate-mail-brief">Generate mail and identity brief</button>
              </div>
            `)}
          </section>

          <section class="page-view" data-page="sovereign" hidden>
            ${renderSection('sovereign-lanes', 'Sovereign controls', 'Sovereign Controls', `
              <div class="card-grid two-col">
                ${(operatingModel.sovereignLanes || []).map(lane => renderActionCard(lane)).join('')}
              </div>
            `)}

            ${renderSection('sovereign-posture', 'Sovereign boundary posture', 'Sovereign Controls', `
              <form id="sovereign-posture-form" class="field-grid-form three-col-form">
                <label>Gate root<input name="gateRoot" placeholder="Sky0s-Platforms/0megaSkyeGate/0megaSkyeGate-The-Actual-Gate" /></label>
                <label>SKNore scope<input name="sknoreScope" placeholder="workspace / org" /></label>
                <label>SovereignVariables root<input name="variablesRoot" placeholder="Sky0s-Platforms/SuperIDE/SovereignVariables" /></label>
                <label>.skye package root<input name="skyePackageRoot" placeholder="package or vault path" /></label>
                <label>Evidence root<input name="evidenceRoot" placeholder="delivery or artifacts path" /></label>
                <label>Release policy note<input name="releasePolicy" placeholder="policy posture" /></label>
              </form>
              <div class="card-actions">
                <button class="button" type="button" id="save-sovereign-posture">Save posture</button>
                <button class="button secondary" type="button" id="generate-sovereign-brief">Generate sovereign boundary brief</button>
              </div>
            `)}
          </section>
        </div>
      </section>
    </main>
  `;

  const pageTabs = Array.from(root.querySelectorAll('[data-page-tab]'));
  const pageViews = Array.from(root.querySelectorAll('[data-page]'));
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
  const runtimeProbeStatus = root.querySelector('#runtime-probe-status');
  const runtimeStreamStatus = root.querySelector('#runtime-stream-status');
  const liveLogsEnabledInput = root.querySelector('#live-logs-enabled');
  const releaseHandoffResult = root.querySelector('#release-handoff-result');
  const runtimeHealthProofPanel = root.querySelector('#runtime-health-proof-panel');
  const promotionProofPanel = root.querySelector('#promotion-proof-panel');
  const skyehawkTriggerButton = root.querySelector('#open-skyehawk');
  const cloudPostureForm = root.querySelector('#cloud-posture-form');
  const mailPostureForm = root.querySelector('#mail-posture-form');
  const sovereignPostureForm = root.querySelector('#sovereign-posture-form');
  const automationStatePanel = root.querySelector('#automation-state-panel');
  const cloudActionResult = root.querySelector('#cloud-action-result');

  const runtimeLogState = {
    runtimeId: '',
    stdout: '',
    stderr: '',
    stdoutOffset: 0,
    stderrOffset: 0,
    timer: undefined
  };

  installSkyeHawkMenu({
    triggerButton: skyehawkTriggerButton,
    storageKey: `${storageKey}:skyehawk`,
    title: `${config.title} SkyeHawk`,
    description: 'Search SkyDexia pages, preserved product surfaces, and upgrade routes from one sovereign menu.',
    routes: buildSkyeHawkRoutes({
      baseId: storageKey,
      actions: config.actions,
      fullAppButtons: config.fullAppButtons,
      additionalRoutes: (config.skyehawkRoutes || []).concat((operatingModel.pages || []).map(page => ({
        id: `page-${page.id}`,
        label: page.label,
        href: `#page=${page.id}`,
        category: 'SkyDexia page',
        description: page.summary
      })))
    })
  });

  function snapshotState() {
    return {
      activePage: state.activePage || 'command',
      workspaceRoot: workspaceRootInput.value,
      workspaceRecursive: workspaceRecursiveInput.checked,
      workspaceLimit: workspaceLimitInput.value,
      selectedPath: workspaceSelectedPathInput.value,
      targetPath: workspaceTargetPathInput.value,
      filePath: filePathInput.value,
      saveAsPath: saveAsPathInput.value,
      runtimeId: runtimeIdInput.value,
      recentActions: state.recentActions || [],
      validationResults: state.validationResults || {},
      probeResults: state.probeResults || {},
      promotionResults: state.promotionResults || [],
      automationState: state.automationState || {},
      generatedArtifacts: state.generatedArtifacts || [],
      releaseHandoff: state.releaseHandoff || undefined
    };
  }

  function persistState(partial = {}) {
    Object.assign(state, snapshotState(), partial);
    window.localStorage.setItem(storageKey, JSON.stringify(state));
    renderRecentActions(state.recentActions || []);
  }

  function persistSectionState() {
    window.localStorage.setItem(`${storageKey}:sections`, JSON.stringify(sectionState));
  }

  function persistPostureState() {
    window.localStorage.setItem(`${storageKey}:posture`, JSON.stringify(postureState));
  }

  function recordRecentAction(action) {
    const stamp = new Date().toLocaleTimeString();
    const recentActions = [`${stamp} - ${action}`, ...(state.recentActions || [])].slice(0, 12);
    persistState({ recentActions });
  }

  function renderRecentActions(items) {
    recentActionsList.innerHTML = items.length
      ? items.map(item => `<li>${escapeHtml(item)}</li>`).join('')
      : '<li>No recent lane actions yet.</li>';
  }

  function setActivePage(pageId) {
    state.activePage = pageId;
    persistState({ activePage: pageId });
    pageTabs.forEach(tab => tab.classList.toggle('active', tab.dataset.pageTab === pageId));
    pageViews.forEach(view => {
      view.hidden = view.dataset.page !== pageId;
    });
    window.location.hash = `page=${pageId}`;
  }

  function applySectionState() {
    root.querySelectorAll('.shell-section').forEach(section => {
      const sectionId = section.dataset.sectionId;
      const nextState = sectionState[sectionId] || { collapsed: false, minimized: false };
      section.classList.toggle('is-collapsed', Boolean(nextState.collapsed));
      section.classList.toggle('is-minimized', Boolean(nextState.minimized));
    });
  }

  function toggleSection(sectionId, mode) {
    const nextState = { ...(sectionState[sectionId] || { collapsed: false, minimized: false }) };
    if (mode === 'collapse') {
      nextState.collapsed = !nextState.collapsed;
      if (nextState.collapsed) {
        nextState.minimized = false;
      }
    }
    if (mode === 'minimize') {
      nextState.minimized = !nextState.minimized;
      if (nextState.minimized) {
        nextState.collapsed = false;
      }
    }
    sectionState[sectionId] = nextState;
    persistSectionState();
    applySectionState();
  }

  function fillForm(form, values = {}) {
    if (!form) {
      return;
    }
    Array.from(form.elements).forEach(field => {
      if (!(field instanceof HTMLInputElement)) {
        return;
      }
      field.value = values[field.name] || '';
    });
  }

  function readForm(form) {
    const values = {};
    Array.from(form.elements).forEach(field => {
      if (!(field instanceof HTMLInputElement)) {
        return;
      }
      values[field.name] = field.value.trim();
    });
    return values;
  }

  function restoreState() {
    workspaceRootInput.value = state.workspaceRoot || config.workspaceRoot;
    workspaceRecursiveInput.checked = Boolean(state.workspaceRecursive);
    workspaceLimitInput.value = state.workspaceLimit || '200';
    workspaceSelectedPathInput.value = state.selectedPath || config.filePath;
    workspaceTargetPathInput.value = state.targetPath || config.filePath;
    filePathInput.value = state.filePath || config.filePath;
    saveAsPathInput.value = state.saveAsPath || config.saveAsPath || config.filePath;
    runtimeIdInput.value = state.runtimeId || '';
    fileContentInput.value = state.fileSeedOverride || config.fileSeed || fileContentInput.value;
    renderRecentActions(state.recentActions || []);
    renderValidationResults();
    renderProbeResults();
    renderPromotionResults();
    renderReleaseHandoffResult();
    fillForm(cloudPostureForm, postureState.cloud || {});
    fillForm(mailPostureForm, postureState.mail || {});
    fillForm(sovereignPostureForm, postureState.sovereign || {});
    renderAutomationState();
    applySectionState();
    const hashPage = window.location.hash.startsWith('#page=') ? window.location.hash.replace('#page=', '') : '';
    setActivePage(hashPage || state.activePage || 'command');
  }

  function renderValidationResults() {
    validationChecks.forEach(check => {
      const target = root.querySelector(`[data-validation-result="${check.id}"]`);
      if (!target) {
        return;
      }
      const result = state.validationResults?.[check.id];
      if (!result) {
        target.innerHTML = '<span class="validation-state validation-idle">Not run yet.</span>';
        return;
      }
      target.innerHTML = `<span class="validation-state validation-${escapeAttribute(result.status)}">${escapeHtml(result.status)}</span><span>${escapeHtml(result.detail)}</span><span class="inline-note">${escapeHtml(result.timestamp)}</span>`;
    });
  }

  function storeValidationResult(checkId, status, detail) {
    const validationResults = {
      ...(state.validationResults || {}),
      [checkId]: {
        status,
        detail,
        timestamp: new Date().toLocaleString()
      }
    };
    persistState({ validationResults });
    renderValidationResults();
  }

  function rememberGeneratedArtifact(path, label) {
    const generatedArtifacts = [
      { path, label, timestamp: new Date().toLocaleString() },
      ...(state.generatedArtifacts || []).filter(item => item.path !== path)
    ].slice(0, 14);
    persistState({ generatedArtifacts });
  }

  function renderAutomationState() {
    const automation = state.automationState || {};
    if (automationStatePanel) {
      automationStatePanel.innerHTML = renderAutomationStateMarkup(automation);
    }
  }

  function storeAutomationState(automation) {
    persistState({ automationState: automation || {} });
    renderAutomationState();
  }

  function renderProbeResults() {
    const probeEntries = Object.values(state.probeResults || {});
    const markup = probeEntries.length
      ? `<ul>${probeEntries.map(entry => `
          <li>
            <strong>${escapeHtml(entry.name || entry.runtimeId || 'runtime probe')}</strong>
            <div>Status: <code>${escapeHtml(entry.ok ? 'passed' : 'failed')}</code> · HTTP <code>${escapeHtml(String(entry.status || 'n/a'))}</code> · ${escapeHtml(entry.timestamp || '')}</div>
            <div>Target: <code>${escapeHtml(entry.url || 'n/a')}</code></div>
            <div>${escapeHtml(entry.excerpt || '(no response excerpt)')}</div>
          </li>
        `).join('')}</ul>`
      : '<strong>No runtime probe evidence recorded yet.</strong>';
    if (runtimeHealthProofPanel) {
      runtimeHealthProofPanel.innerHTML = markup;
    }
    if (runtimeProbeStatus) {
      runtimeProbeStatus.innerHTML = markup;
    }
  }

  function storeProbeResult(probe) {
    const nextProbeResults = {
      ...(state.probeResults || {}),
      [probe.runtimeId || probe.name || `probe-${Date.now()}`]: probe
    };
    persistState({ probeResults: nextProbeResults });
    renderProbeResults();
  }

  function renderPromotionResults() {
    const promotionResults = state.promotionResults || [];
    const markup = promotionResults.length
      ? `<ul>${promotionResults.map(entry => `
          <li>
            <strong>${escapeHtml(entry.label)}</strong>
            <div>${escapeHtml(entry.timestamp)}</div>
            <div>${escapeHtml(entry.summary)}</div>
          </li>
        `).join('')}</ul>`
      : '<strong>No GitHub, Netlify, or Cloudflare executions recorded yet.</strong>';
    if (promotionProofPanel) {
      promotionProofPanel.innerHTML = markup;
    }
    if (cloudActionResult && !promotionResults.length) {
      cloudActionResult.innerHTML = markup;
    }
  }

  function recordPromotionResult(label, summary, details) {
    const promotionResults = [
      {
        label,
        summary,
        timestamp: new Date().toLocaleString(),
        details: details || null
      },
      ...(state.promotionResults || [])
    ].slice(0, 12);
    persistState({ promotionResults });
    renderPromotionResults();
    if (cloudActionResult) {
      cloudActionResult.innerHTML = `<strong>${escapeHtml(label)}</strong><div>${escapeHtml(summary)}</div>${details ? `<pre>${escapeHtml(details)}</pre>` : ''}`;
    }
  }

  function renderReleaseHandoffResult() {
    if (!releaseHandoffResult) {
      return;
    }
    const handoff = state.releaseHandoff;
    if (!handoff?.path) {
      releaseHandoffResult.innerHTML = `<span class="validation-state validation-idle">Pending</span><span>${escapeHtml(releaseHandoffPath || 'No handoff path configured.')}</span>`;
      return;
    }
    releaseHandoffResult.innerHTML = `<span class="validation-state validation-passed">ready</span><span>${escapeHtml(handoff.path)}</span><span class="inline-note">Generated ${escapeHtml(handoff.timestamp || '')}</span>`;
  }

  async function openWorkspaceRoot(rootPath, recursive = true, limit = 160) {
    workspaceRootInput.value = rootPath;
    workspaceRecursiveInput.checked = Boolean(recursive);
    workspaceLimitInput.value = String(limit || 160);
    workspaceSelectedPathInput.value = rootPath;
    workspaceTargetPathInput.value = rootPath;
    setActivePage('workspace');
    await refreshWorkspace(rootPath);
  }

  async function refreshWorkspace(rootPath = workspaceRootInput.value.trim() || '.') {
    const limit = Number.parseInt(workspaceLimitInput.value, 10);
    const payload = await loadWorkspaceEntries(rootPath, {
      recursive: workspaceRecursiveInput.checked,
      limit: Number.isFinite(limit) ? limit : 200
    });
    workspaceRootInput.value = payload.root;
    workspaceResults.innerHTML = renderWorkspaceEntries(payload);
    persistState();
  }

  async function createArtifactTemplate(template) {
    const hydratedContent = hydrateTemplate(template.content || '', {
      laneTitle: config.title,
      today: new Date().toISOString().slice(0, 10),
      timestamp: new Date().toISOString()
    });
    const targetPath = hydrateTemplate(template.path, {
      laneTitle: config.title,
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
    saveAsPathInput.value = payload.path;
    workspaceSelectedPathInput.value = payload.path;
    workspaceTargetPathInput.value = payload.path;
    fileContentInput.value = hydratedContent;
    setActivePage('workspace');
    persistState();
    return payload;
  }

  async function openHintedFile(filePath) {
    const payload = await readWorkspaceFile(filePath);
    filePathInput.value = payload.path;
    saveAsPathInput.value = payload.path;
    workspaceSelectedPathInput.value = payload.path;
    workspaceTargetPathInput.value = payload.path;
    fileContentInput.value = payload.content;
    setActivePage('workspace');
    persistState({ fileSeedOverride: payload.content });
    return payload;
  }

  async function startRuntimeRecipe(recipeId) {
    const recipe = (config.runtimeRecipes || []).find(entry => entry.id === recipeId);
    if (!recipe) {
      throw new Error(`Unknown runtime recipe: ${recipeId}`);
    }
    const payload = await startRuntime(recipe.request);
    runtimeIdInput.value = payload.runtime.id;
    resetRuntimeLogs(payload.runtime.id);
    runtimeResult.innerHTML = renderRuntimeList([payload.runtime]);
    setActivePage('runtime');
    persistState();
    if (recipe.request?.healthCheck) {
      window.setTimeout(async () => {
        try {
          const probePayload = await runRuntimeProbe(payload.runtime.id, recipeId);
          recordRecentAction(`Runtime probe ${probePayload.probe.ok ? 'passed' : 'failed'} for ${payload.runtime.id}`);
        } catch (error) {
          recordRecentAction(`Runtime probe failed for ${payload.runtime.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }, 1500);
    }
    return payload;
  }

  function openWorkflowTarget(targetKey) {
    return typeof config.openFullAppTarget === 'function'
      ? config.openFullAppTarget(targetKey)
      : window.open(targetKey, '_blank', 'noopener');
  }

  async function runWorkflowAction(workflow) {
    for (const step of workflow.steps || []) {
      await performActionStep(step, workflow.label);
    }
  }

  async function performActionStep(step, contextLabel) {
    if (step.type === 'workspace-pack') {
      const pack = (enterprise.workspacePacks || []).find(entry => entry.id === step.packId);
      if (!pack) {
        throw new Error(`Unknown workspace pack: ${step.packId}`);
      }
      await openWorkspaceRoot(pack.root, pack.recursive, pack.limit);
      recordRecentAction(`${contextLabel} opened pack ${pack.label}`);
      return;
    }
    if (step.type === 'artifact-template') {
      const template = artifactTemplates.find(entry => entry.id === step.templateId);
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
      const launchTarget = openWorkflowTarget(step.targetKey);
      recordRecentAction(`${contextLabel} opened ${launchTarget}`);
      return;
    }
    throw new Error(`Unknown workflow step type: ${step.type}`);
  }

  function resetRuntimeLogs(runtimeId = runtimeIdInput.value.trim()) {
    runtimeLogState.runtimeId = runtimeId;
    runtimeLogState.stdout = '';
    runtimeLogState.stderr = '';
    runtimeLogState.stdoutOffset = 0;
    runtimeLogState.stderrOffset = 0;
    renderRuntimeLogs();
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

  function buildReleaseHandoffContent() {
    const validationEntries = validationChecks.map(check => {
      const result = state.validationResults?.[check.id];
      return {
        title: check.title,
        owner: check.owner,
        status: result?.status || 'not-run',
        detail: result?.detail || 'Not run yet.',
        timestamp: result?.timestamp || 'Not recorded'
      };
    });
    return [
      `# ${config.title} Release Handoff`,
      '',
      `Date: ${new Date().toISOString().slice(0, 10)}`,
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Active page',
      `- ${state.activePage || 'command'}`,
      '',
      '## Validation summary',
      ...validationEntries.flatMap(entry => [
        `- ${entry.title} (${entry.owner})`,
        `  - Status: ${entry.status}`,
        `  - Detail: ${entry.detail}`,
        `  - Recorded: ${entry.timestamp}`
      ]),
      '',
      '## Generated artifacts',
      ...((state.generatedArtifacts || []).length
        ? (state.generatedArtifacts || []).flatMap(entry => [`- ${entry.label}: ${entry.path}`, `  - Generated: ${entry.timestamp}`])
        : ['- No generated artifacts recorded.']),
      '',
      '## Release gates',
      ...((enterprise.releaseGates || []).flatMap(gate => [`- ${gate.gate} [${gate.status}]`, `  - Evidence: ${gate.evidence}`, `  - Next: ${gate.nextAction}`])),
      '',
      '## Runtime log preview',
      '```text',
      truncateBlock(runtimeLogState.stdout || '(no stdout captured yet)'),
      '```',
      '',
      '## Recent actions',
      ...((state.recentActions || []).length ? (state.recentActions || []).map(item => `- ${item}`) : ['- No recent actions recorded.']),
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
    renderReleaseHandoffResult();
    return payload;
  }

  async function generateOpsBrief(kind, values) {
    const today = new Date().toISOString().slice(0, 10);
    const fileName = `Sky0s-Platforms/SkyeCDE/SkyDexia/delivery/${today}-${kind}.md`;
    const directoryPath = getParentDirectory(fileName);
    if (directoryPath) {
      await createWorkspaceDirectory(directoryPath);
    }
    const content = buildOpsBriefContent(kind, values, config.title);
    const payload = await writeWorkspaceFile(fileName, content);
    rememberGeneratedArtifact(payload.path, kind);
    await openHintedFile(payload.path);
    return payload;
  }

  async function syncAutomationStateFromBridge() {
    const payload = await getAutomationState();
    storeAutomationState(payload.automation || {});
    return payload;
  }

  function getRuntimeRecipe(recipeId) {
    return (config.runtimeRecipes || []).find(entry => entry.id === recipeId);
  }

  async function runRuntimeProbe(runtimeId = runtimeIdInput.value.trim(), recipeId) {
    const selectedRuntimeId = runtimeId || runtimeIdInput.value.trim();
    if (!selectedRuntimeId) {
      throw new Error('Select a runtime before running a health probe.');
    }
    const recipe = recipeId ? getRuntimeRecipe(recipeId) : (config.runtimeRecipes || []).find(entry => entry.request?.id === selectedRuntimeId || `${entry.id}-runtime` === selectedRuntimeId);
    const probePayload = {
      id: selectedRuntimeId,
      ...(recipe?.request?.healthCheck || {})
    };
    const payload = await probeRuntimeHealth(probePayload);
    storeProbeResult(payload.probe);
    return payload;
  }

  root.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) {
      return;
    }

    if (button.dataset.pageTab) {
      setActivePage(button.dataset.pageTab);
      return;
    }

    if (button.dataset.sectionAction && button.dataset.sectionId) {
      toggleSection(button.dataset.sectionId, button.dataset.sectionAction);
      return;
    }

    try {
      if (button.dataset.workspacePack) {
        const pack = (enterprise.workspacePacks || []).find(entry => entry.id === button.dataset.workspacePack);
        if (pack) {
          await openWorkspaceRoot(pack.root, pack.recursive, pack.limit);
          recordRecentAction(`Opened workspace pack ${pack.label}`);
        }
        return;
      }

      if (button.dataset.fileHint) {
        const payload = await openHintedFile(button.dataset.fileHint);
        recordRecentAction(`Opened file ${payload.path}`);
        return;
      }

      if (button.dataset.runtimeRecipeId) {
        const payload = await startRuntimeRecipe(button.dataset.runtimeRecipeId);
        recordRecentAction(`Started runtime ${payload.runtime.id}`);
        if (liveLogsEnabledInput.checked) {
          await startLiveLogs();
        }
        return;
      }

      if (button.dataset.openKey || button.dataset.openTarget) {
        const launchTarget = typeof config.openFullAppTarget === 'function'
          ? config.openFullAppTarget(button.dataset.openKey || button.dataset.openTarget)
          : button.dataset.openTarget;
        recordRecentAction(`Opened full app ${launchTarget}`);
        return;
      }

      if (button.dataset.launchTarget) {
        const launchTarget = openWorkflowTarget(button.dataset.launchTarget);
        recordRecentAction(`Opened target ${launchTarget}`);
        return;
      }

      if (button.dataset.openFilePath) {
        const payload = await openHintedFile(button.dataset.openFilePath);
        recordRecentAction(`Opened file ${payload.path}`);
        return;
      }

      if (button.dataset.openWorkspaceRoot) {
        await openWorkspaceRoot(button.dataset.openWorkspaceRoot, button.dataset.openWorkspaceRecursive === 'true', Number(button.dataset.openWorkspaceLimit || 160));
        recordRecentAction(`Opened workspace root ${button.dataset.openWorkspaceRoot}`);
        return;
      }

      if (button.dataset.validationCheck) {
        const check = validationChecks.find(entry => entry.id === button.dataset.validationCheck);
        if (!check) {
          return;
        }
        storeValidationResult(check.id, 'running', 'Validation in progress.');
        await runValidationCheck(check);
        return;
      }

      if (button.dataset.workflowAction) {
        const workflow = workflowActions.find(entry => entry.id === button.dataset.workflowAction);
        if (!workflow) {
          return;
        }
        await runWorkflowAction(workflow);
        workspaceResults.innerHTML = `<strong>Workflow complete:</strong> ${escapeHtml(workflow.label)}`;
        return;
      }

      if (button.dataset.artifactTemplate) {
        const template = artifactTemplates.find(entry => entry.id === button.dataset.artifactTemplate);
        if (!template) {
          return;
        }
        const payload = await createArtifactTemplate(template);
        recordRecentAction(`Generated artifact ${payload.path}`);
        return;
      }

      if (button.id === 'read-file') {
        const payload = await openHintedFile(filePathInput.value.trim());
        recordRecentAction(`Read file ${payload.path}`);
        return;
      }

      if (button.id === 'write-file') {
        const payload = await writeWorkspaceFile(filePathInput.value.trim(), fileContentInput.value);
        rememberGeneratedArtifact(payload.path, 'Written file');
        recordRecentAction(`Wrote file ${payload.path}`);
        return;
      }

      if (button.id === 'save-file-as') {
        const payload = await writeWorkspaceFile(saveAsPathInput.value.trim(), fileContentInput.value);
        filePathInput.value = payload.path;
        saveAsPathInput.value = payload.path;
        workspaceSelectedPathInput.value = payload.path;
        workspaceTargetPathInput.value = payload.path;
        rememberGeneratedArtifact(payload.path, 'Saved file as');
        recordRecentAction(`Saved file as ${payload.path}`);
        return;
      }

      if (button.id === 'reload-workspace') {
        await refreshWorkspace();
        recordRecentAction('Reloaded workspace');
        return;
      }

      if (button.id === 'rename-path') {
        const payload = await renameWorkspacePath(workspaceSelectedPathInput.value.trim(), workspaceTargetPathInput.value.trim());
        workspaceSelectedPathInput.value = payload.path;
        workspaceTargetPathInput.value = payload.path;
        recordRecentAction(`Renamed path to ${payload.path}`);
        await refreshWorkspace();
        return;
      }

      if (button.id === 'move-path') {
        const payload = await moveWorkspacePath(workspaceSelectedPathInput.value.trim(), workspaceTargetPathInput.value.trim());
        workspaceSelectedPathInput.value = payload.path;
        workspaceTargetPathInput.value = payload.path;
        recordRecentAction(`Moved path to ${payload.path}`);
        await refreshWorkspace();
        return;
      }

      if (button.id === 'delete-path') {
        const targetPath = workspaceSelectedPathInput.value.trim();
        await deleteWorkspacePath(targetPath);
        recordRecentAction(`Deleted path ${targetPath}`);
        await refreshWorkspace();
        return;
      }

      if (button.id === 'refresh-runtimes') {
        const payload = await listRuntimes();
        runtimeResult.innerHTML = renderRuntimeList(payload.runtimes || []);
        recordRecentAction('Refreshed runtimes');
        return;
      }

      if (button.id === 'restart-runtime') {
        const payload = await restartRuntime(runtimeIdInput.value.trim());
        runtimeResult.innerHTML = renderRuntimeList([payload.runtime]);
        recordRecentAction(`Restarted runtime ${payload.runtime.id}`);
        return;
      }

      if (button.id === 'restart-runtime-inline') {
        const payload = await restartRuntime(runtimeIdInput.value.trim());
        runtimeResult.innerHTML = renderRuntimeList([payload.runtime]);
        setActivePage('runtime');
        recordRecentAction(`Restarted runtime ${payload.runtime.id} from recovery desk`);
        return;
      }

      if (button.id === 'stop-runtime') {
        const payload = await stopRuntime(runtimeIdInput.value.trim());
        runtimeResult.innerHTML = renderRuntimeList([payload.runtime]);
        stopLiveLogs(`Runtime ${payload.runtime.id} is stopped.`);
        recordRecentAction(`Stopped runtime ${payload.runtime.id}`);
        return;
      }

      if (button.id === 'stop-runtime-inline') {
        const payload = await stopRuntime(runtimeIdInput.value.trim());
        runtimeResult.innerHTML = renderRuntimeList([payload.runtime]);
        stopLiveLogs(`Runtime ${payload.runtime.id} is stopped.`);
        setActivePage('runtime');
        recordRecentAction(`Stopped runtime ${payload.runtime.id} from recovery desk`);
        return;
      }

      if (button.id === 'load-logs') {
        await loadRuntimeLogs(false);
        recordRecentAction(`Loaded logs for ${runtimeIdInput.value.trim()}`);
        return;
      }

      if (button.id === 'load-logs-inline') {
        await loadRuntimeLogs(false);
        setActivePage('runtime');
        recordRecentAction(`Loaded logs for ${runtimeIdInput.value.trim()} from continuity desk`);
        return;
      }

      if (button.id === 'probe-runtime') {
        const payload = await runRuntimeProbe(runtimeIdInput.value.trim());
        recordRecentAction(`Runtime probe ${payload.probe.ok ? 'passed' : 'failed'} for ${payload.probe.runtimeId || payload.probe.name}`);
        return;
      }

      if (button.id === 'start-live-logs') {
        await startLiveLogs();
        recordRecentAction(`Started live logs for ${runtimeIdInput.value.trim()}`);
        return;
      }

      if (button.id === 'stop-live-logs') {
        stopLiveLogs();
        recordRecentAction('Stopped live logs');
        return;
      }

      if (button.id === 'clear-runtime-logs') {
        resetRuntimeLogs(runtimeIdInput.value.trim());
        recordRecentAction('Cleared runtime log view');
        return;
      }

      if (button.id === 'generate-release-handoff') {
        const payload = await generateReleaseHandoff();
        recordRecentAction(`Generated release handoff ${payload.path}`);
        return;
      }

      if (button.id === 'generate-release-handoff-inline') {
        const payload = await generateReleaseHandoff();
        setActivePage('delivery');
        recordRecentAction(`Generated release handoff ${payload.path} from continuity desk`);
        return;
      }

      if (button.id === 'save-cloud-posture') {
        postureState.cloud = readForm(cloudPostureForm);
        persistPostureState();
        recordRecentAction('Saved cloud posture state');
        return;
      }

      if (button.id === 'refresh-automation-state') {
        const payload = await syncAutomationStateFromBridge();
        recordRecentAction(`Refreshed automation state ${payload.automation?.updatedAt || ''}`.trim());
        return;
      }

      if (button.id === 'connect-github') {
        postureState.cloud = readForm(cloudPostureForm);
        persistPostureState();
        const payload = await connectGitHubIntegration({
          repo: postureState.cloud.githubRepo,
          branch: postureState.cloud.githubBranch,
          token: postureState.cloud.githubToken,
          sourceRoot: postureState.cloud.githubSourceRoot,
          message: postureState.cloud.githubMessage
        });
        storeAutomationState({ ...(state.automationState || {}), github: payload.github });
        recordPromotionResult('GitHub connected', `${payload.github?.repo || postureState.cloud.githubRepo} on ${payload.verification?.branch || postureState.cloud.githubBranch || 'main'}`, payload.verification?.output || '');
        recordRecentAction(`Connected GitHub automation for ${payload.github?.repo || postureState.cloud.githubRepo}`);
        return;
      }

      if (button.id === 'push-github') {
        postureState.cloud = readForm(cloudPostureForm);
        persistPostureState();
        const payload = await pushGitHubPromotion({
          repo: postureState.cloud.githubRepo,
          branch: postureState.cloud.githubBranch,
          token: postureState.cloud.githubToken,
          sourceRoot: postureState.cloud.githubSourceRoot,
          message: postureState.cloud.githubMessage
        });
        recordPromotionResult('GitHub push executed', `${payload.promotion?.repo || postureState.cloud.githubRepo} -> ${payload.promotion?.branch || postureState.cloud.githubBranch || 'main'} @ ${payload.promotion?.head || 'HEAD'}`, payload.promotion?.push || '');
        recordRecentAction(`Pushed GitHub promotion to ${payload.promotion?.repo || postureState.cloud.githubRepo}`);
        return;
      }

      if (button.id === 'connect-netlify') {
        postureState.cloud = readForm(cloudPostureForm);
        persistPostureState();
        const payload = await connectNetlifySite({
          siteId: postureState.cloud.netlifySiteId,
          siteName: postureState.cloud.netlifySiteName,
          token: postureState.cloud.netlifyToken,
          publishDir: postureState.cloud.netlifyPublishDir,
          cwd: postureState.cloud.netlifyCwd
        });
        storeAutomationState({ ...(state.automationState || {}), netlify: payload.netlify });
        recordPromotionResult('Netlify connected', `${payload.netlify?.siteName || payload.netlify?.siteId || 'site'} using ${payload.netlify?.publishDir || postureState.cloud.netlifyPublishDir}`, payload.verification?.output || '');
        recordRecentAction(`Connected Netlify automation for ${payload.netlify?.siteName || payload.netlify?.siteId || 'site'}`);
        return;
      }

      if (button.id === 'deploy-netlify') {
        postureState.cloud = readForm(cloudPostureForm);
        persistPostureState();
        const payload = await deployNetlifySite({
          siteId: postureState.cloud.netlifySiteId,
          siteName: postureState.cloud.netlifySiteName,
          token: postureState.cloud.netlifyToken,
          publishDir: postureState.cloud.netlifyPublishDir,
          cwd: postureState.cloud.netlifyCwd,
          title: postureState.cloud.githubMessage || 'SkyDexia deploy'
        });
        recordPromotionResult('Netlify deploy executed', `${payload.deployment?.siteUrl || payload.deployment?.deployUrl || payload.deployment?.siteName || 'deploy complete'}`, payload.deployment?.output || '');
        recordRecentAction(`Deployed Netlify site ${payload.deployment?.siteName || payload.deployment?.siteId || ''}`.trim());
        return;
      }

      if (button.id === 'connect-cloudflare') {
        postureState.cloud = readForm(cloudPostureForm);
        persistPostureState();
        const payload = await connectCloudflareWorker({
          workerRoot: postureState.cloud.cloudflareWorkerRoot,
          accountId: postureState.cloud.cloudflareAccountId,
          apiToken: postureState.cloud.cloudflareApiToken,
          configPath: postureState.cloud.cloudflareConfigPath
        });
        storeAutomationState({ ...(state.automationState || {}), cloudflare: payload.cloudflare });
        recordPromotionResult('Cloudflare connected', `${payload.cloudflare?.workerRoot || postureState.cloud.cloudflareWorkerRoot} ready for deploy`, payload.verification?.output || '');
        recordRecentAction(`Connected Cloudflare automation for ${payload.cloudflare?.workerRoot || postureState.cloud.cloudflareWorkerRoot}`);
        return;
      }

      if (button.id === 'deploy-cloudflare') {
        postureState.cloud = readForm(cloudPostureForm);
        persistPostureState();
        const payload = await deployCloudflareWorker({
          workerRoot: postureState.cloud.cloudflareWorkerRoot,
          accountId: postureState.cloud.cloudflareAccountId,
          apiToken: postureState.cloud.cloudflareApiToken,
          configPath: postureState.cloud.cloudflareConfigPath,
          environment: postureState.cloud.cloudflareEnvironment
        });
        recordPromotionResult('Cloudflare deploy executed', `${payload.deployment?.previewUrl || payload.deployment?.workerRoot || postureState.cloud.cloudflareWorkerRoot}`, payload.deployment?.output || '');
        recordRecentAction(`Deployed Cloudflare worker ${payload.deployment?.workerRoot || postureState.cloud.cloudflareWorkerRoot}`);
        return;
      }

      if (button.id === 'generate-cloud-brief') {
        postureState.cloud = readForm(cloudPostureForm);
        persistPostureState();
        const payload = await generateOpsBrief('cloud-ops-brief', postureState.cloud);
        recordRecentAction(`Generated cloud ops brief ${payload.path}`);
        return;
      }

      if (button.id === 'save-mail-posture') {
        postureState.mail = readForm(mailPostureForm);
        persistPostureState();
        recordRecentAction('Saved mail and identity posture state');
        return;
      }

      if (button.id === 'generate-mail-brief') {
        postureState.mail = readForm(mailPostureForm);
        persistPostureState();
        const payload = await generateOpsBrief('mail-identity-brief', postureState.mail);
        recordRecentAction(`Generated mail and identity brief ${payload.path}`);
        return;
      }

      if (button.id === 'save-sovereign-posture') {
        postureState.sovereign = readForm(sovereignPostureForm);
        persistPostureState();
        recordRecentAction('Saved sovereign posture state');
        return;
      }

      if (button.id === 'generate-sovereign-brief') {
        postureState.sovereign = readForm(sovereignPostureForm);
        persistPostureState();
        const payload = await generateOpsBrief('sovereign-boundary-brief', postureState.sovereign);
        recordRecentAction(`Generated sovereign boundary brief ${payload.path}`);
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (workspaceResults) {
        workspaceResults.innerHTML = `<strong>Action failed:</strong> ${escapeHtml(message)}`;
      }
      if (cloudActionResult && button.closest('[data-page="cloud"]')) {
        cloudActionResult.innerHTML = `<strong>Cloud action failed:</strong> ${escapeHtml(message)}`;
      }
      if (runtimeResult && (button.closest('[data-page="runtime"]') || /runtime|logs/.test(button.id))) {
        runtimeResult.innerHTML = `<strong>Runtime action failed:</strong> ${escapeHtml(message)}`;
      }
      recordRecentAction(`Action failed: ${message}`);
    }
  });

  async function runValidationCheck(check) {
    try {
      for (const step of check.steps || []) {
        await performActionStep(step, `Validation ${check.title}`);
      }
      storeValidationResult(check.id, 'passed', check.successDetail || 'Validation completed successfully.');
      workspaceResults.innerHTML = `<strong>Validation passed:</strong> ${escapeHtml(check.title)}`;
      recordRecentAction(`Validation passed ${check.title}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      storeValidationResult(check.id, 'failed', message);
      workspaceResults.innerHTML = `<strong>Validation failed:</strong> ${escapeHtml(message)}`;
      recordRecentAction(`Validation failed ${check.title}`);
    }
  }

  workspaceForm.addEventListener('submit', async event => {
    event.preventDefault();
    workspaceResults.innerHTML = '<strong>Loading workspace entries...</strong>';
    try {
      await refreshWorkspace();
      recordRecentAction(`Loaded workspace ${workspaceRootInput.value.trim()}`);
    } catch (error) {
      workspaceResults.innerHTML = `<strong>Workspace load failed:</strong> ${escapeHtml(error.message)}`;
    }
  });

  directoryForm.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const payload = await createWorkspaceDirectory(directoryPathInput.value.trim());
      recordRecentAction(`Created directory ${payload.path}`);
      await refreshWorkspace();
    } catch (error) {
      workspaceResults.innerHTML = `<strong>Directory create failed:</strong> ${escapeHtml(error.message)}`;
    }
  });

  workspaceResults.addEventListener('click', async event => {
    const target = event.target.closest('[data-entry-path]');
    if (!target) {
      return;
    }
    const path = target.dataset.entryPath;
    const kind = target.dataset.entryKind;
    workspaceSelectedPathInput.value = path;
    workspaceTargetPathInput.value = path;
    if (kind === 'file') {
      try {
        const payload = await openHintedFile(path);
        recordRecentAction(`Opened workspace file ${payload.path}`);
      } catch (error) {
        workspaceResults.innerHTML = `<strong>File open failed:</strong> ${escapeHtml(error.message)}`;
      }
    } else {
      recordRecentAction(`Selected workspace directory ${path}`);
    }
  });

  runtimeResult.addEventListener('click', event => {
    const target = event.target.closest('[data-runtime-id]');
    if (!target) {
      return;
    }
    runtimeIdInput.value = target.dataset.runtimeId;
    recordRecentAction(`Selected runtime ${target.dataset.runtimeId}`);
    persistState();
  });

  [workspaceRootInput, workspaceLimitInput, workspaceSelectedPathInput, workspaceTargetPathInput, filePathInput, saveAsPathInput, runtimeIdInput].forEach(input => {
    input.addEventListener('change', () => persistState());
  });
  workspaceRecursiveInput.addEventListener('change', () => persistState());

  restoreState();
}

function renderSection(id, title, eyebrow, body, sidebar = false) {
  return `
    <section class="shell-section${sidebar ? ' shell-section-sidebar' : ''}" data-section-id="${escapeAttribute(id)}">
      <header class="shell-section-header">
        <div>
          <div class="eyebrow">${escapeHtml(eyebrow)}</div>
          <h2>${escapeHtml(title)}</h2>
        </div>
        <div class="section-actions">
          <button class="section-toggle" type="button" data-section-action="collapse" data-section-id="${escapeAttribute(id)}">Collapse</button>
          <button class="section-toggle" type="button" data-section-action="minimize" data-section-id="${escapeAttribute(id)}">Minimize</button>
        </div>
      </header>
      <div class="shell-section-body">${body}</div>
    </section>
  `;
}

function renderSimpleCard(tag, title, description) {
  return `
    <article class="action-card">
      <div class="card-topline"><span class="badge">${escapeHtml(tag)}</span></div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
    </article>
  `;
}

function renderStatusCard(title, summary) {
  return `<article class="status-card"><strong>${escapeHtml(title)}</strong><div>${escapeHtml(summary)}</div></article>`;
}

function renderMissionGroup(title, items = [], actionType, fallbackLabel) {
  return `
    <section class="group-card">
      <h3>${escapeHtml(title)}</h3>
      <div class="card-grid">
        ${items.map(item => `
          <article class="action-card">
            <div class="card-topline"><span class="badge">${escapeHtml(item.meta || item.label)}</span></div>
            <h3>${escapeHtml(item.label)}</h3>
            <p>${escapeHtml(item.description)}</p>
            <div class="card-actions">
              ${renderMissionAction(item, actionType, fallbackLabel)}
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function renderMissionAction(item, actionType, fallbackLabel) {
  if (actionType === 'launch-target') {
    return `<button class="button secondary" type="button" data-launch-target="${escapeAttribute(item.targetKey)}">${escapeHtml(item.buttonLabel || fallbackLabel)}</button>`;
  }
  if (actionType === 'file-path') {
    return `<button class="button secondary" type="button" data-open-file-path="${escapeAttribute(item.path)}">${escapeHtml(item.buttonLabel || fallbackLabel)}</button>`;
  }
  if (actionType === 'runtime-recipe') {
    return `<button class="button secondary" type="button" data-runtime-recipe-id="${escapeAttribute(item.recipeId)}">${escapeHtml(item.buttonLabel || fallbackLabel)}</button>`;
  }
  return '';
}

function renderActionCard(item) {
  return `
    <article class="action-card">
      <div class="card-topline">
        <span class="badge">${escapeHtml(item.tag)}</span>
        <span class="inline-note">${escapeHtml(item.status)}</span>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.summary)}</p>
      <div class="card-actions">
        ${(item.actions || []).map(renderInlineAction).join('')}
      </div>
    </article>
  `;
}

function renderInlineAction(action) {
  if (action.type === 'launch-target') {
    return `<button class="button secondary" type="button" data-launch-target="${escapeAttribute(action.targetKey)}">${escapeHtml(action.label)}</button>`;
  }
  if (action.type === 'file-path') {
    return `<button class="button secondary" type="button" data-open-file-path="${escapeAttribute(action.path)}">${escapeHtml(action.label)}</button>`;
  }
  if (action.type === 'workspace-root') {
    return `<button class="button secondary" type="button" data-open-workspace-root="${escapeAttribute(action.root)}" data-open-workspace-recursive="${action.recursive ? 'true' : 'false'}" data-open-workspace-limit="${escapeAttribute(String(action.limit || 160))}">${escapeHtml(action.label)}</button>`;
  }
  return '';
}

function renderGovernanceList(title, items = [], rowRenderer) {
  return `
    <section class="group-card">
      <h3>${escapeHtml(title)}</h3>
      <div class="card-grid">
        ${items.map(item => `<article class="action-card governance-card">${rowRenderer(item)}</article>`).join('')}
      </div>
    </section>
  `;
}

function resolveReleaseHandoffPath(artifactTemplates, storageKey) {
  const releaseTemplate = artifactTemplates.find(item => item.id === 'skydexia-release-brief');
  if (!releaseTemplate) {
    return `Sky0s-Platforms/SkyeCDE/SkyDexia/delivery/${storageKey.replace(/[^a-z0-9]+/gi, '-')}-release-handoff.md`;
  }
  return hydrateTemplate(releaseTemplate.path.replace('release-brief', 'release-handoff'), {
    laneTitle: 'SkyDexia',
    today: new Date().toISOString().slice(0, 10),
    timestamp: new Date().toISOString()
  });
}

function renderRuntimeList(runtimes) {
  if (!runtimes.length) {
    return '<strong>No runtimes registered.</strong>';
  }
  return `<ul>${runtimes.map(runtime => `
    <li class="runtime-item" data-runtime-id="${escapeAttribute(runtime.id)}">
      <strong>${escapeHtml(runtime.id)}</strong>
      <div><code>${escapeHtml(runtime.command || 'unknown')} ${escapeHtml(Array.isArray(runtime.args) ? runtime.args.join(' ') : '')}</code></div>
      <div>Status: <code>${escapeHtml(runtime.status || 'unknown')}</code> · PID: <code>${escapeHtml(String(runtime.pid || 'n/a'))}</code></div>
      <div>CWD: <code>${escapeHtml(runtime.cwd || 'n/a')}</code></div>
      ${runtime.launchUrl ? `<div><a class="button" href="${runtime.launchUrl}" target="_blank" rel="noreferrer">Open live runtime</a></div>` : ''}
    </li>
  `).join('')}</ul>`;
}

function renderWorkspaceEntries(payload) {
  const items = (payload.entries || []).map(entry => `
    <li>
      <button class="entry-button" type="button" data-entry-path="${escapeAttribute(entry.path)}" data-entry-kind="${escapeAttribute(entry.kind)}">
        <span><code>${escapeHtml(entry.kind)}</code> ${escapeHtml(entry.path)}</span>
      </button>
    </li>
  `).join('');

  return `<strong>Root:</strong> <code>${escapeHtml(payload.root)}</code>
    <div><strong>Mode:</strong> <code>${escapeHtml(payload.recursive ? 'recursive' : 'direct')}</code> · <strong>Limit:</strong> <code>${escapeHtml(String(payload.limit))}</code></div>
    <ul>${items || '<li>No entries returned.</li>'}</ul>`;
}

function buildOpsBriefContent(kind, values, title) {
  const heading = kind.replace(/-/g, ' ');
  return [
    `# ${title} ${heading}`,
    '',
    `Date: ${new Date().toISOString().slice(0, 10)}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Captured posture',
    ...Object.entries(values || {}).map(([key, value]) => `- ${key}: ${value || '(empty)'}`),
    '',
    '## Operator notes',
    '- ',
    '',
    '## Release impact',
    '- ',
    ''
  ].join('\n');
}

function hydrateTemplate(content, variables) {
  return content
    .replace(/{{LANE_TITLE}}/g, variables.laneTitle || '')
    .replace(/{{TODAY}}/g, variables.today || '')
    .replace(/{{TIMESTAMP}}/g, variables.timestamp || '');
}

function getParentDirectory(path) {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/');
}

function truncateBlock(text, limit = 5000) {
  if (!text || text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}\n... truncated ...`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttribute(value) {
  return escapeHtml(String(value)).replace(/'/g, '&#39;');
}

function loadStoredState(storageKey) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}