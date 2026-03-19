import { renderIdeiaShell } from '../../_shared/render-ideia-shell.js';
import { getSharedSkyeHawkRoutes } from '../../_shared/skyehawk-routes.js';
import { getSkyDexiaFileDefaults, getSkyDexiaFileHints, describeSkyDexiaFileActions } from './skydexia-file-actions.js';
import { getSkyDexiaEnterpriseProfile } from './skydexia-enterprise-profile.js';
import { getSkyDexiaFullAppButtons } from './skydexia-launch-map.js';
import { getSkyDexiaSessionState } from './skydexia-session-bridge.js';
import { getSkyDexiaRuntimeRecipes, describeSkyDexiaRuntimeActions } from './skydexia-terminal-actions.js';
import { getSkyDexiaWorkspaceDefaults, getSkyDexiaWorkspaceStatusItems } from './skydexia-workspace-bridge.js';
import { openSkyDexiaLaunchTarget } from './skydexia-preview-actions.js';

const workspaceDefaults = getSkyDexiaWorkspaceDefaults();
const fileDefaults = getSkyDexiaFileDefaults();
const sessionState = getSkyDexiaSessionState();

renderIdeiaShell(document.querySelector('#app'), {
  storageKey: sessionState.storageKey,
  eyebrow: 'SkyeCDE build lane one',
  title: 'SkyDexia starts from SkyDex, not from Theia.',
  description: 'SkyDexia is the upgraded coding build under the SkyeCDE hub. The original SkyDex stays intact. Theia contributes support systems for files, runtimes, autonomous coding, and full app launches without taking over the product identity.',
  actions: {
    primary: { label: 'Open current SkyDex', href: '../../SkyDex/SkyDex4_fixed/index.html' },
    secondary: { label: 'Open SkyeCDE hub', href: '../index.html' }
  },
  metrics: [
    { value: '1', label: 'active upgrade build scaffold' },
    { value: '0', label: 'preview-widget launch paths allowed' },
    { value: '100%', label: 'SkyDex product identity preserved' }
  ],
  supportTitle: 'What gets added in SkyDexia',
  lanes: [
    { tag: 'Workspace', title: 'Navigator and file control', description: getSkyDexiaWorkspaceStatusItems().join(' · ') },
    { tag: 'Runtime', title: 'Terminal and server control', description: describeSkyDexiaRuntimeActions().join(' ') },
    { tag: 'Files', title: 'Lane-owned file workflows', description: describeSkyDexiaFileActions().join(' ') },
    { tag: 'Launch', title: 'Full app routing', description: 'Buttons route users into full app surfaces and built projects, never preview widgets.' }
  ],
  enterprise: getSkyDexiaEnterpriseProfile(),
  workspaceRoot: workspaceDefaults.workspaceRoot,
  filePath: fileDefaults.filePath,
  saveAsPath: fileDefaults.saveAsPath,
  fileSeed: fileDefaults.fileSeed,
  fileHints: getSkyDexiaFileHints(),
  runtimeRecipes: getSkyDexiaRuntimeRecipes(),
  fullAppButtons: getSkyDexiaFullAppButtons(),
  skyehawkRoutes: getSharedSkyeHawkRoutes('skydexia'),
  openFullAppTarget: openSkyDexiaLaunchTarget,
  statusTitle: 'Live SkyDexia bridge state',
  statusItems: [
    `Session bridge source: ${sessionState.source}.`,
    `Gate state: ${sessionState.gate}.`,
    `Theia support layer: ${sessionState.theiaSupportLayer}.`,
    ...getSkyDexiaWorkspaceStatusItems(),
    'Full app buttons open independent app surfaces instead of preview widgets.'
  ]
});