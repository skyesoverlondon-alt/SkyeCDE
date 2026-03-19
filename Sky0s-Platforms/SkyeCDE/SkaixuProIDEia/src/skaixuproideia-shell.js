import { renderIdeiaShell } from '../../_shared/render-ideia-shell.js';
import { getSharedSkyeHawkRoutes } from '../../_shared/skyehawk-routes.js';
import { describeSkaixuProIDEiaFileActions, getSkaixuProIDEiaFileDefaults, getSkaixuProIDEiaFileHints } from './skaixuproideia-file-actions.js';
import { getSkaixuProIDEiaEnterpriseProfile } from './skaixuproideia-enterprise-profile.js';
import { getSkaixuProIDEiaFullAppButtons } from './skaixuproideia-launch-map.js';
import { getSkaixuProIDEiaSessionState } from './skaixuproideia-session-bridge.js';
import { describeSkaixuProIDEiaRuntimeActions, getSkaixuProIDEiaRuntimeRecipes } from './skaixuproideia-terminal-actions.js';
import { getSkaixuProIDEiaWorkspaceDefaults, getSkaixuProIDEiaWorkspaceStatusItems } from './skaixuproideia-workspace-bridge.js';

const workspaceDefaults = getSkaixuProIDEiaWorkspaceDefaults();
const fileDefaults = getSkaixuProIDEiaFileDefaults();
const sessionState = getSkaixuProIDEiaSessionState();

renderIdeiaShell(document.querySelector('#app'), {
  storageKey: sessionState.storageKey,
  eyebrow: 'SkyeCDE build lane',
  title: 'SkaixuProIDEia keeps the multi-tool platform intact.',
  description: 'This upgraded build lane keeps SkaixuPro-IDE as the core product family while adding bridge-backed workspace, file, runtime, and full-launch controls under SkyeCDE.',
  actions: {
    primary: { label: 'Open SkyeCDE hub', href: '../index.html' },
    secondary: { label: 'Open current SkaixuPro-IDE', href: '../../SkaixuPro-IDE/SkaixuPro-IDE-Platform/index.html' }
  },
  metrics: [
    { value: '30+', label: 'tool pockets preserved' },
    { value: '1', label: 'lane-owned upgrade shell active' },
    { value: '0', label: 'flattening into generic workbench allowed' }
  ],
  supportTitle: 'What gets added in SkaixuProIDEia',
  lanes: [
    { tag: 'Workspace', title: 'Repo and file actions', description: getSkaixuProIDEiaWorkspaceStatusItems().join(' · ') },
    { tag: 'Runtime', title: 'Process control', description: describeSkaixuProIDEiaRuntimeActions().join(' ') },
    { tag: 'Files', title: 'Lane-owned file workflows', description: describeSkaixuProIDEiaFileActions().join(' ') },
    { tag: 'Launch', title: 'Full app mode', description: 'Open the upgraded or original platform in full app windows without preview widgets.' }
  ],
  enterprise: getSkaixuProIDEiaEnterpriseProfile(),
  workspaceRoot: workspaceDefaults.workspaceRoot,
  filePath: fileDefaults.filePath,
  saveAsPath: fileDefaults.saveAsPath,
  fileSeed: fileDefaults.fileSeed,
  fileHints: getSkaixuProIDEiaFileHints(),
  runtimeRecipes: getSkaixuProIDEiaRuntimeRecipes(),
  fullAppButtons: getSkaixuProIDEiaFullAppButtons(),
  skyehawkRoutes: getSharedSkyeHawkRoutes('skaixuproideia'),
  statusTitle: 'Live SkaixuProIDEia bridge state',
  statusItems: [
    `Session bridge source: ${sessionState.source}.`,
    `Gate state: ${sessionState.gate}.`,
    `Theia support layer: ${sessionState.theiaSupportLayer}.`,
    ...getSkaixuProIDEiaWorkspaceStatusItems(),
    'The upgraded lane can manage local dev runtime state without flattening the tool network.'
  ]
});