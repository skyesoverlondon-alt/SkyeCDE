export const skydexiaLaunchMap = {
  currentSkyDex: '../../SkyDex/SkyDex4_fixed/index.html',
  hub: '../index.html',
  superIDEia: '../SuperIDEia/index.html',
  kaixuSuperIDEia: '../KaixuSuperIDEia/index.html',
  skaixuProIDEia: '../SkaixuProIDEia/index.html',
  superIDE: '../../SuperIDE/index.html',
  skaixuProIDE: '../../SkaixuPro-IDE/SkaixuPro-IDE-Platform/index.html'
};

export function resolveLaunchTarget(key) {
  return skydexiaLaunchMap[key] || skydexiaLaunchMap.hub;
}

export function getSkyDexiaFullAppButtons() {
  return [
    { label: 'Open SkyDexia full app', href: './index.html', openTargetKey: 'self' },
    { label: 'Open current SkyDex full app', href: resolveLaunchTarget('currentSkyDex'), openTargetKey: 'currentSkyDex', secondary: true },
    { label: 'Open SuperIDEia full app', href: resolveLaunchTarget('superIDEia'), openTargetKey: 'superIDEia', secondary: true },
    { label: 'Open SkaixuProIDEia full app', href: resolveLaunchTarget('skaixuProIDEia'), openTargetKey: 'skaixuProIDEia', secondary: true },
    { label: 'Open KaixuSuperIDEia full app', href: resolveLaunchTarget('kaixuSuperIDEia'), openTargetKey: 'kaixuSuperIDEia', secondary: true }
  ];
}