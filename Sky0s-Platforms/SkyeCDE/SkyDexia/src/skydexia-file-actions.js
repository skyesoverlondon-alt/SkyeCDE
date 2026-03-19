export function getSkyDexiaFileDefaults() {
  return {
    filePath: 'Sky0s-Platforms/SkyeCDE/SkyDexia/README.md',
    saveAsPath: 'Sky0s-Platforms/SkyeCDE/SkyDexia/README.md',
    fileSeed: '# SkyDexia\n\nBridge-backed coding surface under SkyeCDE.\n',
    recentFileHints: [
      'Sky0s-Platforms/SkyeCDE/SkyDexia/README.md',
      'Sky0s-Platforms/SkyeCDE/SkyDexia/src/skydexia-shell.js',
      'Sky0s-Platforms/SkyeCDE/SkyDexia/src/skydexia-launch-map.js'
    ]
  };
}

export function describeSkyDexiaFileActions() {
  return [
    'Read bridge-backed files from the SkyDexia lane.',
    'Write bridge-backed files without leaving the lane.',
    'Save current content into a new repo-safe path when needed.',
    'Keep recent SkyDexia-owned source files close at hand.'
  ];
}

export function getSkyDexiaFileHints() {
  return [
    { label: 'README lane brief', path: 'Sky0s-Platforms/SkyeCDE/SkyDexia/README.md' },
    { label: 'Shell entry', path: 'Sky0s-Platforms/SkyeCDE/SkyDexia/src/skydexia-shell.js' },
    { label: 'Launch map', path: 'Sky0s-Platforms/SkyeCDE/SkyDexia/src/skydexia-launch-map.js' },
    { label: 'Runtime recipes', path: 'Sky0s-Platforms/SkyeCDE/SkyDexia/src/skydexia-terminal-actions.js' }
  ];
}