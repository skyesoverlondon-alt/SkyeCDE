export const superideiaLaunchRecipes = {
  superIDE: {
    id: 'superIDE',
    label: 'Start SuperIDE dev',
    cwd: 'Sky0s-Platforms/SuperIDE',
    command: 'npm',
    args: ['run', 'dev'],
    launchUrl: 'http://127.0.0.1:5173'
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

export function getSuperIDEiaRuntimeRecipes() {
  return [
    buildRuntimeRecipe(superideiaLaunchRecipes.superIDE),
    buildRuntimeRecipe(superideiaLaunchRecipes.skydexia, true)
  ];
}

export function describeSuperIDEiaRuntimeActions() {
  return [
    'Start the main SuperIDE dev runtime from the lane.',
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