export function getKaixuSuperIDEiaFileDefaults() {
  return {
    filePath: 'Sky0s-Platforms/SkyeCDE/KaixuSuperIDEia/README.md',
    saveAsPath: 'Sky0s-Platforms/SkyeCDE/KaixuSuperIDEia/README.md',
    fileSeed: '# KaixuSuperIDEia\n\nSkyeCDE-hosted upgrade lane for KaixuSuper-IDE.\n'
  };
}

export function getKaixuSuperIDEiaFileHints() {
  return [
    { label: 'Lane brief', path: 'Sky0s-Platforms/SkyeCDE/KaixuSuperIDEia/README.md' },
    { label: 'Shell entry', path: 'Sky0s-Platforms/SkyeCDE/KaixuSuperIDEia/src/kaixusuperideia-shell.js' },
    { label: 'Launch map', path: 'Sky0s-Platforms/SkyeCDE/KaixuSuperIDEia/src/kaixusuperideia-launch-map.js' },
    { label: 'Runtime recipes', path: 'Sky0s-Platforms/SkyeCDE/KaixuSuperIDEia/src/kaixusuperideia-terminal-actions.js' }
  ];
}

export function describeKaixuSuperIDEiaFileActions() {
  return [
    'Read KaixuSuperIDEia lane files without leaving the build lane.',
    'Write or save-as lane changes into repo-safe paths.',
    'Keep browser IDE control files and route maps one click away.'
  ];
}