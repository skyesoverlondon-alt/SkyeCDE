import { renderIdeiaShell } from '../_shared/render-ideia-shell.js';

renderIdeiaShell(document.querySelector('#app'), {
  storageKey: 'skycde:superideia',
  eyebrow: 'SkyeCDE build lane',
  title: 'SuperIDEia keeps SuperIDE in charge.',
  description: 'This upgraded build lane keeps SuperIDE as the platform core while adding bridge-backed workspace, file, runtime, and full-launch controls under SkyeCDE.',
  actions: {
    primary: { label: 'Open SkyeCDE hub', href: '../index.html' },
    secondary: { label: 'Open current SuperIDE', href: '../../SuperIDE/index.html' }
  },
  metrics: [
    { value: '40+', label: 'embedded SuperIDE surfaces preserved' },
    { value: '1', label: 'SkyeCDE upgrade lane now scaffold-backed' },
    { value: '0', label: 'platform replacement allowance' }
  ],
  supportTitle: 'What gets added in SuperIDEia',
  lanes: [
    { tag: 'Workspace', title: 'File and workspace support', description: 'Bridge-backed repo inspection and file actions can supplement the existing SuperIDE shell.' },
    { tag: 'Runtime', title: 'Live process control', description: 'Start, inspect, and stop dev runtimes from the upgraded build lane.' },
    { tag: 'Shell', title: 'Launcher orchestration', description: 'SkyeCDE can route users into SuperIDEia and back out to the original SuperIDE cleanly.' },
    { tag: 'Launch', title: 'Full app mode', description: 'Open the upgraded or original platform in full app windows without preview widgets.' }
  ],
  workspaceRoot: 'Sky0s-Platforms/SuperIDE',
  filePath: 'Sky0s-Platforms/SkyeCDE/SuperIDEia/README.md',
  fileSeed: '# SuperIDEia\n\nSkyeCDE-hosted upgrade lane for SuperIDE.\n',
  runtimeRecipes: [
    {
      id: 'superIDE',
      label: 'Start SuperIDE dev',
      request: {
        id: 'superide-runtime',
        cwd: 'Sky0s-Platforms/SuperIDE',
        command: 'npm',
        args: ['run', 'dev'],
        launchUrl: 'http://127.0.0.1:5173'
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
    { label: 'Open SuperIDEia full app', href: './index.html' },
    { label: 'Open current SuperIDE', href: '../../SuperIDE/index.html', secondary: true },
    { label: 'Open SkyDexia', href: '../SkyDexia/index.html', secondary: true }
  ],
  statusTitle: 'Live SuperIDEia bridge state',
  statusItems: [
    'SuperIDE remains the product core.',
    'SkyeCDE now provides live workspace, file, runtime, and full-launch controls.',
    'The upgraded lane can manage local dev runtime state without swallowing SuperIDE identity.'
  ]
});