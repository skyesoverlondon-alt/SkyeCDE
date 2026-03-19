export const kaixuSuperIDEiaLaunchRecipes = {
  kaixuSuperIDE: {
    id: 'kaixusuperide',
    label: 'Start KaixuSuper-IDE dev',
    cwd: 'Sky0s-Platforms/KaixuSuper-IDE-(Internal Gate)',
    command: 'npm',
    args: ['run', 'dev'],
    launchUrl: 'http://127.0.0.1:8888'
  },
  skydexia: {
    id: 'skydexia',
    label: 'Start SkyDexia server',
    cwd: 'Sky0s-Platforms/SkyeCDE/SkyDexia',
    command: 'python3',
    args: ['-m', 'http.server', '4186'],
    launchUrl: 'http://127.0.0.1:4186'
  }
};

export function getKaixuSuperIDEiaRuntimeRecipes() {
  return [
    buildRuntimeRecipe(kaixuSuperIDEiaLaunchRecipes.kaixuSuperIDE),
    buildRuntimeRecipe(kaixuSuperIDEiaLaunchRecipes.skydexia, true)
  ];
}

export function describeKaixuSuperIDEiaRuntimeActions() {
  return [
    'Start the main KaixuSuper-IDE dev runtime from the lane.',
    'Check logs, restart, and stop from the shared bridge controls.',
    'Cross-launch SkyDexia when the upgrade lane needs comparison work.'
  ];
}

function buildRuntimeRecipe(recipe, secondary = false) {
  return {
    id: recipe.id,
    label: recipe.label,
    secondary,
    request: {
      id: `${recipe.id}-runtime`,
      cwd: recipe.cwd,
      command: recipe.command,
      args: recipe.args,
      launchUrl: recipe.launchUrl
    }
  };
}