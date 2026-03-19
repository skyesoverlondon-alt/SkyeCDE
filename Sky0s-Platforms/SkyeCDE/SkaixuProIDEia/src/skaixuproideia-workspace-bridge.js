export const SKAIXUPROIDEIA_WORKSPACE_ROOT = 'Sky0s-Platforms/SkaixuPro-IDE/SkaixuPro-IDE-Platform';

export function getSkaixuProIDEiaWorkspaceStatus() {
  return {
    navigator: 'live',
    fileActions: 'live',
    runtimeControl: 'live',
    shellRouting: 'live'
  };
}

export function getSkaixuProIDEiaWorkspaceDefaults() {
  return {
    workspaceRoot: SKAIXUPROIDEIA_WORKSPACE_ROOT,
    filePath: 'Sky0s-Platforms/SkyeCDE/SkaixuProIDEia/README.md',
    selectedPath: SKAIXUPROIDEIA_WORKSPACE_ROOT,
    targetPath: SKAIXUPROIDEIA_WORKSPACE_ROOT
  };
}

export function getSkaixuProIDEiaWorkspaceStatusItems() {
  const status = getSkaixuProIDEiaWorkspaceStatus();
  return [
    `Workspace navigator: ${status.navigator}`,
    `File actions: ${status.fileActions}`,
    `Runtime control: ${status.runtimeControl}`,
    `Shell routing: ${status.shellRouting}`
  ];
}