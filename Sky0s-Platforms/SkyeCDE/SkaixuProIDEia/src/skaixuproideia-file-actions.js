export function getSkaixuProIDEiaFileDefaults() {
  return {
    filePath: 'Sky0s-Platforms/SkyeCDE/SkaixuProIDEia/README.md',
    saveAsPath: 'Sky0s-Platforms/SkyeCDE/SkaixuProIDEia/README.md',
    fileSeed: '# SkaixuProIDEia\n\nSkyeCDE-hosted upgrade lane for SkaixuPro-IDE.\n'
  };
}

export function getSkaixuProIDEiaFileHints() {
  return [
    { label: 'Lane brief', path: 'Sky0s-Platforms/SkyeCDE/SkaixuProIDEia/README.md' },
    { label: 'Shell entry', path: 'Sky0s-Platforms/SkyeCDE/SkaixuProIDEia/src/skaixuproideia-shell.js' },
    { label: 'Launch map', path: 'Sky0s-Platforms/SkyeCDE/SkaixuProIDEia/src/skaixuproideia-launch-map.js' },
    { label: 'Runtime recipes', path: 'Sky0s-Platforms/SkyeCDE/SkaixuProIDEia/src/skaixuproideia-terminal-actions.js' }
  ];
}

export function describeSkaixuProIDEiaFileActions() {
  return [
    'Read SkaixuProIDEia lane files without leaving the upgrade lane.',
    'Write or save-as lane changes into repo-safe paths.',
    'Keep core SkaixuProIDEia control files immediately reachable.'
  ];
}