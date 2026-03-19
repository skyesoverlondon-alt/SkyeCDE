import { renderIdeiaShell } from '../../_shared/render-ideia-shell.js';
import { getSharedSkyeHawkRoutes } from '../../_shared/skyehawk-routes.js';
import { describeSuperIDEiaFileActions, getSuperIDEiaFileDefaults, getSuperIDEiaFileHints } from './superideia-file-actions.js';
import { getSuperIDEiaEnterpriseProfile } from './superideia-enterprise-profile.js';
import { getSuperIDEiaFullAppButtons } from './superideia-launch-map.js';
import { getSuperIDEiaSessionState } from './superideia-session-bridge.js';
import { describeSuperIDEiaRuntimeActions, getSuperIDEiaRuntimeRecipes } from './superideia-terminal-actions.js';
import { getSuperIDEiaWorkspaceDefaults, getSuperIDEiaWorkspaceStatusItems } from './superideia-workspace-bridge.js';

const workspaceDefaults = getSuperIDEiaWorkspaceDefaults();
const fileDefaults = getSuperIDEiaFileDefaults();
const sessionState = getSuperIDEiaSessionState();

renderIdeiaShell(document.querySelector('#app'), {
  storageKey: sessionState.storageKey,
  eyebrow: 'SkyeCDE build lane',
  title: 'SuperIDEia keeps SuperIDE in charge.',
  description: 'This upgraded build lane keeps SuperIDE as the platform core while adding bridge-backed workspace, file, runtime, and full-launch controls under SkyeCDE.',
  actions: {
    primary: { label: 'Open SkyeCDE hub', href: '../index.html' },
    secondary: { label: 'Open current SuperIDE', href: '../../SuperIDE/index.html' }
  },
  metrics: [
    { value: '40+', label: 'embedded SuperIDE surfaces preserved' },
    { value: '1', label: 'lane-owned upgrade shell active' },
    { value: '0', label: 'platform replacement allowance' }
  ],
  supportTitle: 'What gets added in SuperIDEia',
  lanes: [
    { tag: 'Workspace', title: 'File and workspace support', description: getSuperIDEiaWorkspaceStatusItems().join(' · ') },
    { tag: 'Runtime', title: 'Live process control', description: describeSuperIDEiaRuntimeActions().join(' ') },
    { tag: 'Files', title: 'Lane-owned file workflows', description: describeSuperIDEiaFileActions().join(' ') },
    { tag: 'Launch', title: 'Full app mode', description: 'Open the upgraded or original platform in full app windows without preview widgets.' }
  ],
  enterprise: getSuperIDEiaEnterpriseProfile(),
  workspaceRoot: workspaceDefaults.workspaceRoot,
  filePath: fileDefaults.filePath,
  saveAsPath: fileDefaults.saveAsPath,
  fileSeed: fileDefaults.fileSeed,
  fileHints: getSuperIDEiaFileHints(),
  runtimeRecipes: getSuperIDEiaRuntimeRecipes(),
  fullAppButtons: getSuperIDEiaFullAppButtons(),
  skyehawkRoutes: getSharedSkyeHawkRoutes('superideia'),
  statusTitle: 'Live SuperIDEia bridge state',
  statusItems: [
    `Session bridge source: ${sessionState.source}.`,
    `Gate state: ${sessionState.gate}.`,
    `Theia support layer: ${sessionState.theiaSupportLayer}.`,
    ...getSuperIDEiaWorkspaceStatusItems(),
    'The upgraded lane can manage local dev runtime state without swallowing SuperIDE identity.'
  ]
});