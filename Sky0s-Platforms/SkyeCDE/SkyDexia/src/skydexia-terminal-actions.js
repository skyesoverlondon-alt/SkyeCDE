export const skydexiaLaunchRecipes = {
  skydexia: {
    label: 'Start SkyDexia static server',
    id: 'skydexia',
    cwd: 'Sky0s-Platforms/SkyeCDE/SkyDexia',
    command: 'python3',
    args: ['-m', 'http.server', '4186'],
    launchUrl: 'http://127.0.0.1:4186'
  },
  superIDE: {
    label: 'Start SuperIDE dev server',
    id: 'superIDE',
    cwd: 'Sky0s-Platforms/SuperIDE',
    command: 'npm',
    args: ['run', 'dev'],
    launchUrl: 'http://127.0.0.1:5173'
  },
  skaixuPro: {
    label: 'Start SkaixuPro-IDE runtime',
    id: 'skaixuPro',
    cwd: 'Sky0s-Platforms/SkaixuPro-IDE/SkaixuPro-IDE-Platform',
    command: 'npm',
    args: ['run', 'dev'],
    launchUrl: 'http://127.0.0.1:8080'
  },
  kaixuSuper: {
    label: 'Start KaixuSuper-IDE runtime',
    id: 'kaixuSuper',
    cwd: 'Sky0s-Platforms/KaixuSuper-IDE-(Internal Gate)',
    command: 'npm',
    args: ['run', 'dev'],
    launchUrl: 'http://127.0.0.1:8888'
  }
};

export function getSkyDexiaRuntimeRecipes() {
  return [
    buildRuntimeRecipe(skydexiaLaunchRecipes.skydexia),
    buildRuntimeRecipe(skydexiaLaunchRecipes.superIDE, true),
    buildRuntimeRecipe(skydexiaLaunchRecipes.skaixuPro, true),
    buildRuntimeRecipe(skydexiaLaunchRecipes.kaixuSuper, true)
  ];
}

export function describeSkyDexiaRuntimeActions() {
  return [
    'Start the SkyDexia lane itself under a local static server.',
    'Reach companion IDE runtimes without leaving SkyDexia.',
    'Use shared restart, stop, and live log controls from one lane.'
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