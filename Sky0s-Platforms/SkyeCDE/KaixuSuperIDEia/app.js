import { renderIdeiaShell } from '../_shared/render-ideia-shell.js';

renderIdeiaShell(document.querySelector('#app'), {
  storageKey: 'skycde:kaixusuperideia',
  eyebrow: 'SkyeCDE build lane',
  title: 'KaixuSuperIDEia keeps the browser IDE in charge.',
  description: 'This upgraded build lane keeps KaixuSuper-IDE as the core platform while adding bridge-backed workspace, file, runtime, and full-launch controls under SkyeCDE.',
  actions: {
    primary: { label: 'Open SkyeCDE hub', href: '../index.html' },
    secondary: { label: 'Open current KaixuSuper-IDE', href: '../../KaixuSuper-IDE-(Internal Gate)/index.html' }
  },
  metrics: [
    { value: '1', label: 'browser IDE core preserved' },
    { value: '1', label: 'SkyeCDE upgrade lane now scaffold-backed' },
    { value: '0', label: 'editor/explorer replacement allowed' }
  ],
  supportTitle: 'What gets added in KaixuSuperIDEia',
  lanes: [
    { tag: 'Workspace', title: 'Repo and file actions', description: 'Inspect and modify workspace files through the SkyeCDE bridge.' },
    { tag: 'Runtime', title: 'Process control', description: 'Start and manage the local runtime that powers the browser IDE.' },
    { tag: 'Shell', title: 'Upgrade orchestration', description: 'SkyeCDE can route users into the upgraded build while preserving the existing browser IDE flow.' },
    { tag: 'Launch', title: 'Full app mode', description: 'Open the upgraded or original platform in full app windows without preview widgets.' }
  ],
  workspaceRoot: 'Sky0s-Platforms/KaixuSuper-IDE-(Internal Gate)',
  filePath: 'Sky0s-Platforms/SkyeCDE/KaixuSuperIDEia/README.md',
  fileSeed: '# KaixuSuperIDEia\n\nSkyeCDE-hosted upgrade lane for KaixuSuper-IDE.\n',
  runtimeRecipes: [
    {
      id: 'kaixuSuper',
      label: 'Start KaixuSuper-IDE',
      request: {
        id: 'kaixusuper-runtime',
        cwd: 'Sky0s-Platforms/KaixuSuper-IDE-(Internal Gate)',
        command: 'npm',
        args: ['run', 'dev'],
        launchUrl: 'http://127.0.0.1:8888'
      }
    },
    {
      id: 'skydexia',
      label: 'Start SkyDexia server',
      secondary: true,
      request: {
        id: 'skydexia-runtime',
        cwd: 'Sky0s-Platforms/SkyeCDE/SkyDexia',
        command: 'python3',
        args: ['-m', 'http.server', '4186'],
        launchUrl: 'http://127.0.0.1:4186'
      }
    }
  ],
  fullAppButtons: [
    { label: 'Open KaixuSuperIDEia full app', href: './index.html' },
    { label: 'Open current KaixuSuper-IDE', href: '../../KaixuSuper-IDE-(Internal Gate)/index.html', secondary: true },
    { label: 'Open SkyDexia', href: '../SkyDexia/index.html', secondary: true }
  ],
  statusTitle: 'Live KaixuSuperIDEia bridge state',
  statusItems: [
    'KaixuSuper-IDE remains the browser IDE core.',
    'SkyeCDE now provides live workspace, file, runtime, and full-launch controls.',
    'The upgraded lane can manage local dev runtime state without replacing the current browser IDE model.'
  ]
});