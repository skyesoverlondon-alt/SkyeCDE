export function getSuperIDEiaFileDefaults() {
  return {
    filePath: 'Sky0s-Platforms/SkyeCDE/SuperIDEia/README.md',
    saveAsPath: 'Sky0s-Platforms/SkyeCDE/SuperIDEia/README.md',
    fileSeed: '# SuperIDEia\n\nSkyeCDE-hosted upgrade lane for SuperIDE.\n'
  };
}

export function getSuperIDEiaFileHints() {
  return [
    { label: 'Lane brief', path: 'Sky0s-Platforms/SkyeCDE/SuperIDEia/README.md' },
    { label: 'Shell entry', path: 'Sky0s-Platforms/SkyeCDE/SuperIDEia/src/superideia-shell.js' },
    { label: 'Launch map', path: 'Sky0s-Platforms/SkyeCDE/SuperIDEia/src/superideia-launch-map.js' },
    { label: 'Runtime recipes', path: 'Sky0s-Platforms/SkyeCDE/SuperIDEia/src/superideia-terminal-actions.js' }
  ];
}

export function describeSuperIDEiaFileActions() {
  return [
    'Read SuperIDEia lane files without leaving the build lane.',
    'Write or save-as lane changes into repo-safe paths.',
    'Keep core SuperIDEia control files one click away.'
  ];
}