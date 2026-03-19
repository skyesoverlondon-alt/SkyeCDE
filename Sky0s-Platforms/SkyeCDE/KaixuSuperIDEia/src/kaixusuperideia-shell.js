import { renderIdeiaShell } from '../../_shared/render-ideia-shell.js';
import { getSharedSkyeHawkRoutes } from '../../_shared/skyehawk-routes.js';
import { describeKaixuSuperIDEiaFileActions, getKaixuSuperIDEiaFileDefaults, getKaixuSuperIDEiaFileHints } from './kaixusuperideia-file-actions.js';
import { getKaixuSuperIDEiaEnterpriseProfile } from './kaixusuperideia-enterprise-profile.js';
import { getKaixuSuperIDEiaFullAppButtons } from './kaixusuperideia-launch-map.js';
import { getKaixuSuperIDEiaSessionState } from './kaixusuperideia-session-bridge.js';
import { describeKaixuSuperIDEiaRuntimeActions, getKaixuSuperIDEiaRuntimeRecipes } from './kaixusuperideia-terminal-actions.js';
import { getKaixuSuperIDEiaWorkspaceDefaults, getKaixuSuperIDEiaWorkspaceStatusItems } from './kaixusuperideia-workspace-bridge.js';

const workspaceDefaults = getKaixuSuperIDEiaWorkspaceDefaults();
const fileDefaults = getKaixuSuperIDEiaFileDefaults();
const sessionState = getKaixuSuperIDEiaSessionState();

renderIdeiaShell(document.querySelector('#app'), {
  storageKey: sessionState.storageKey,
  eyebrow: 'SkyeCDE build lane',
  title: 'KaixuSuperIDEia keeps the browser IDE in charge.',
  description: 'This upgraded build lane keeps KaixuSuper-IDE as the browser IDE core while adding bridge-backed workspace, file, runtime, and full-launch controls under SkyeCDE.',
  actions: {
    primary: { label: 'Open SkyeCDE hub', href: '../index.html' },
    secondary: { label: 'Open current KaixuSuper-IDE', href: '../../KaixuSuper-IDE-(Internal Gate)/index.html' }
  },
  metrics: [
    { value: '1', label: 'browser IDE core preserved' },
    { value: '1', label: 'lane-owned upgrade shell active' },
    { value: '0', label: 'editor/explorer replacement allowed' }
  ],
  supportTitle: 'What gets added in KaixuSuperIDEia',
  lanes: [
    { tag: 'Workspace', title: 'Repo and file actions', description: getKaixuSuperIDEiaWorkspaceStatusItems().join(' · ') },
    { tag: 'Runtime', title: 'Process control', description: describeKaixuSuperIDEiaRuntimeActions().join(' ') },
    { tag: 'Files', title: 'Lane-owned file workflows', description: describeKaixuSuperIDEiaFileActions().join(' ') },
    { tag: 'Launch', title: 'Full app mode', description: 'Open the upgraded or original platform in full app windows without preview widgets.' }
  ],
  enterprise: getKaixuSuperIDEiaEnterpriseProfile(),
  workspaceRoot: workspaceDefaults.workspaceRoot,
  filePath: fileDefaults.filePath,
  saveAsPath: fileDefaults.saveAsPath,
  fileSeed: fileDefaults.fileSeed,
  fileHints: getKaixuSuperIDEiaFileHints(),
  runtimeRecipes: getKaixuSuperIDEiaRuntimeRecipes(),
  fullAppButtons: getKaixuSuperIDEiaFullAppButtons(),
  skyehawkRoutes: getSharedSkyeHawkRoutes('kaixusuperideia'),
  statusTitle: 'Live KaixuSuperIDEia bridge state',
  statusItems: [
    `Session bridge source: ${sessionState.source}.`,
    `Gate state: ${sessionState.gate}.`,
    `Theia support layer: ${sessionState.theiaSupportLayer}.`,
    ...getKaixuSuperIDEiaWorkspaceStatusItems(),
    'The upgraded lane can manage local dev runtime state without replacing the browser IDE model.'
  ]
});