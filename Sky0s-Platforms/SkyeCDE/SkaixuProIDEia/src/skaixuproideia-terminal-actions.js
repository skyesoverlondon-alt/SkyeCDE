export const skaixuProIDEiaLaunchRecipes = {
  skaixuPro: {
    id: 'skaixuPro',
    label: 'Start SkaixuPro-IDE',
    cwd: 'Sky0s-Platforms/SkaixuPro-IDE/SkaixuPro-IDE-Platform',
    command: 'npm',
    args: ['run', 'dev'],
    launchUrl: 'http://127.0.0.1:8080'
  },
  skydexia: {
    id: 'skydexia',
    label: 'Start SkyDexia server',
    cwd: 'Sky0s-Platforms/SkyeCDE/SkyDexia-2.6',
    command: 'python3',
    args: ['-m', 'http.server', '4186'],
    launchUrl: 'http://127.0.0.1:4186'
  }
};

export function getSkaixuProIDEiaRuntimeRecipes() {
  return [
    buildRuntimeRecipe(skaixuProIDEiaLaunchRecipes.skaixuPro),
    buildRuntimeRecipe(skaixuProIDEiaLaunchRecipes.skydexia, true)
  ];
}

export function describeSkaixuProIDEiaRuntimeActions() {
  return [
    'Start the main SkaixuPro-IDE runtime from the lane.',
    'Inspect, restart, and stop from the shared runtime controls.',
    'Cross-launch SkyDexia when comparing upgrade behavior.'
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