import { getSharedSkyeHawkRoutes } from '../../_shared/skyehawk-routes.js';
import { getSkyDexiaFileDefaults, getSkyDexiaFileHints, describeSkyDexiaFileActions } from './skydexia-file-actions.js';
import { getSkyDexiaEnterpriseProfile } from './skydexia-enterprise-profile.js';
import { getSkyDexiaFullAppButtons } from './skydexia-launch-map.js';
import { getSkyDexiaOperatingModel } from './skydexia-operating-model.js';
import { renderSkyDexiaShell } from './skydexia-renderer.js';
import { getSkyDexiaSessionState } from './skydexia-session-bridge.js';
import { getSkyDexiaRuntimeRecipes, describeSkyDexiaRuntimeActions } from './skydexia-terminal-actions.js';
import { getSkyDexiaWorkspaceDefaults, getSkyDexiaWorkspaceStatusItems } from './skydexia-workspace-bridge.js';
import { openSkyDexiaLaunchTarget } from './skydexia-preview-actions.js';

const workspaceDefaults = getSkyDexiaWorkspaceDefaults();
const fileDefaults = getSkyDexiaFileDefaults();
const sessionState = getSkyDexiaSessionState();
const operatingModel = getSkyDexiaOperatingModel();

renderSkyDexiaShell(document.querySelector('#app'), {
  storageKey: sessionState.storageKey,
  sessionState,
  operatingModel,
  eyebrow: 'SkyeCDE build lane one',
  title: 'SkyDexia runs as the SkyDex-first operating package.',
  description: 'SkyDexia now treats SkyDex as the preserved product authority while expanding into dedicated operator pages for workspace control, runtime operations, cloud posture, mail and identity, sovereign controls, and evidence-backed delivery.',
  actions: {
    primary: { label: 'Open current SkyDex', href: '../../SkyDex/SkyDex4_fixed/index.html' },
    secondary: { label: 'Open SkyeCDE hub', href: '../index.html' }
  },
  metrics: [
    { value: 'P1', label: 'release lane tier' },
    { value: '8', label: 'dedicated operating pages' },
    { value: '100%', label: 'SkyDex product identity preserved' }
  ],
  supportTitle: 'What gets added in SkyDexia',
  lanes: [
    { tag: 'Workspace', title: 'Navigator and file control', description: getSkyDexiaWorkspaceStatusItems().join(' · ') },
    { tag: 'Runtime', title: 'Terminal and server control', description: describeSkyDexiaRuntimeActions().join(' ') },
    { tag: 'Files', title: 'Lane-owned file workflows', description: describeSkyDexiaFileActions().join(' ') },
    { tag: 'Launch', title: 'Full app routing', description: 'Buttons route users into full app surfaces and built projects, never preview widgets.' },
    { tag: 'Cloud', title: 'GitHub, Netlify, and Cloudflare posture', description: 'Dedicated operating pages hold cloud promotion and storage posture instead of hiding them in one stacked rail.' },
    { tag: 'Sovereign', title: 'Gate, policy, and .skye posture', description: 'SkyDexia now carries sovereign controls as first-class pages instead of implicit notes.' }
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
    'Full app buttons open independent app surfaces instead of preview widgets.',
    'Cloud, mail, identity, and sovereign posture now live on dedicated pages instead of a single stacked shell.',
    'Deployment guide, runtime runbook, and release command assets are lane-owned in SkyDexia.'
  ]
});