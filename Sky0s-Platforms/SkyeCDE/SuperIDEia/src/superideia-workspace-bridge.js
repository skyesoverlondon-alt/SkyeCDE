export const SUPERIDEIA_WORKSPACE_ROOT = 'Sky0s-Platforms/SuperIDE';

export function getSuperIDEiaWorkspaceStatus() {
  return {
    navigator: 'live',
    fileActions: 'live',
    runtimeControl: 'live',
    shellRouting: 'live'
  };
}

export function getSuperIDEiaWorkspaceDefaults() {
  return {
    workspaceRoot: SUPERIDEIA_WORKSPACE_ROOT,
    filePath: 'Sky0s-Platforms/SkyeCDE/SuperIDEia/README.md',
    selectedPath: 'Sky0s-Platforms/SuperIDE',
    targetPath: 'Sky0s-Platforms/SuperIDE'
  };
}

export function getSuperIDEiaWorkspaceStatusItems() {
  const status = getSuperIDEiaWorkspaceStatus();
  return [
    `Workspace navigator: ${status.navigator}`,
    `File actions: ${status.fileActions}`,
    `Runtime control: ${status.runtimeControl}`,
    `Shell routing: ${status.shellRouting}`
  ];
}