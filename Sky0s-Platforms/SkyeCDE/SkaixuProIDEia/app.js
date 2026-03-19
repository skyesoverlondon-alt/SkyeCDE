import { renderIdeiaShell } from '../_shared/render-ideia-shell.js';

renderIdeiaShell(document.querySelector('#app'), {
  storageKey: 'skycde:skaixuproideia',
  eyebrow: 'SkyeCDE build lane',
  title: 'SkaixuProIDEia keeps the multi-tool platform intact.',
  description: 'This upgraded build lane keeps SkaixuPro-IDE as the core product family while adding bridge-backed workspace, file, runtime, and full-launch controls under SkyeCDE.',
  actions: {
    primary: { label: 'Open SkyeCDE hub', href: '../index.html' },
    secondary: { label: 'Open current SkaixuPro-IDE', href: '../../SkaixuPro-IDE/SkaixuPro-IDE-Platform/index.html' }
  },
  metrics: [
    { value: '30+', label: 'tool pockets preserved' },
    { value: '1', label: 'SkyeCDE upgrade lane now scaffold-backed' },
    { value: '0', label: 'flattening into generic workbench allowed' }
  ],
  supportTitle: 'What gets added in SkaixuProIDEia',
  lanes: [
    { tag: 'Workspace', title: 'Repo and file actions', description: 'Inspect and modify workspace files through the SkyeCDE bridge.' },
    { tag: 'Runtime', title: 'Process control', description: 'Start and manage the local runtime that powers the multi-tool platform.' },
    { tag: 'Shell', title: 'Upgrade orchestration', description: 'SkyeCDE can route users into the upgraded build while preserving the original tool network.' },
    { tag: 'Launch', title: 'Full app mode', description: 'Open the upgraded or original platform in full app windows without preview widgets.' }
  ],
  workspaceRoot: 'Sky0s-Platforms/SkaixuPro-IDE/SkaixuPro-IDE-Platform',
  filePath: 'Sky0s-Platforms/SkyeCDE/SkaixuProIDEia/README.md',
  fileSeed: '# SkaixuProIDEia\n\nSkyeCDE-hosted upgrade lane for SkaixuPro-IDE.\n',
  runtimeRecipes: [
    {
      id: 'skaixuPro',
      label: 'Start SkaixuPro-IDE',
      request: {
        id: 'skaixupro-runtime',
        cwd: 'Sky0s-Platforms/SkaixuPro-IDE/SkaixuPro-IDE-Platform',
        command: 'npm',
        args: ['run', 'dev'],
        launchUrl: 'http://127.0.0.1:8080'
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
    { label: 'Open SkaixuProIDEia full app', href: './index.html' },
    { label: 'Open current SkaixuPro-IDE', href: '../../SkaixuPro-IDE/SkaixuPro-IDE-Platform/index.html', secondary: true },
    { label: 'Open SkyDexia', href: '../SkyDexia/index.html', secondary: true }
  ],
  statusTitle: 'Live SkaixuProIDEia bridge state',
  statusItems: [
    'SkaixuPro-IDE remains the product family.',
    'SkyeCDE now provides live workspace, file, runtime, and full-launch controls.',
    'The upgraded lane can manage local dev runtime state without flattening the tool network.'
  ]
});