export const SKYDEXIA_WORKSPACE_ROOT = 'Sky0s-Platforms/SkyeCDE';

export function getWorkspaceBridgeStatus() {
  return {
    navigator: 'live',
    terminal: 'live',
    tasks: 'bridge-backed',
    serverControl: 'live'
  };
}

export function getSkyDexiaWorkspaceDefaults() {
  return {
    workspaceRoot: SKYDEXIA_WORKSPACE_ROOT,
    filePath: 'Sky0s-Platforms/SkyeCDE/SkyDexia/README.md',
    selectedPath: 'Sky0s-Platforms/SkyeCDE/SkyDexia',
    targetPath: 'Sky0s-Platforms/SkyeCDE/SkyDexia'
  };
}

export function getSkyDexiaWorkspaceStatusItems() {
  const status = getWorkspaceBridgeStatus();
  return [
    `Workspace navigator: ${status.navigator}`,
    `Terminal controls: ${status.terminal}`,
    `Task flows: ${status.tasks}`,
    `Server control: ${status.serverControl}`
  ];
}