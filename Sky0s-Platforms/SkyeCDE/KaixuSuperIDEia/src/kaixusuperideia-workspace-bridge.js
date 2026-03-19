export const KAIXUSUPERIDEIA_WORKSPACE_ROOT = 'Sky0s-Platforms/KaixuSuper-IDE-(Internal Gate)';

export function getKaixuSuperIDEiaWorkspaceStatus() {
  return {
    navigator: 'live',
    fileActions: 'live',
    runtimeControl: 'live',
    shellRouting: 'live'
  };
}

export function getKaixuSuperIDEiaWorkspaceDefaults() {
  return {
    workspaceRoot: KAIXUSUPERIDEIA_WORKSPACE_ROOT,
    filePath: 'Sky0s-Platforms/SkyeCDE/KaixuSuperIDEia/README.md',
    selectedPath: 'Sky0s-Platforms/KaixuSuper-IDE-(Internal Gate)',
    targetPath: 'Sky0s-Platforms/KaixuSuper-IDE-(Internal Gate)'
  };
}

export function getKaixuSuperIDEiaWorkspaceStatusItems() {
  const status = getKaixuSuperIDEiaWorkspaceStatus();
  return [
    `Workspace navigator: ${status.navigator}`,
    `File actions: ${status.fileActions}`,
    `Runtime control: ${status.runtimeControl}`,
    `Shell routing: ${status.shellRouting}`
  ];
}