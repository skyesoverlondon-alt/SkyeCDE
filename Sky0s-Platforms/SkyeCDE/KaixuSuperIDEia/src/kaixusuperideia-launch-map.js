export const kaixuSuperIDEiaLaunchMap = {
  self: './index.html',
  hub: '../index.html',
  currentKaixuSuperIDE: '../../KaixuSuper-IDE-(Internal Gate)/index.html',
  skydexia: '../SkyDexia-2.6/index.html'
};

export function resolveKaixuSuperIDEiaLaunchTarget(key) {
  return kaixuSuperIDEiaLaunchMap[key] || kaixuSuperIDEiaLaunchMap.hub;
}

export function getKaixuSuperIDEiaFullAppButtons() {
  return [
    { label: 'Open KaixuSuperIDEia full app', href: resolveKaixuSuperIDEiaLaunchTarget('self'), openTargetKey: 'self' },
    { label: 'Open current KaixuSuper-IDE', href: resolveKaixuSuperIDEiaLaunchTarget('currentKaixuSuperIDE'), openTargetKey: 'currentKaixuSuperIDE', secondary: true },
    { label: 'Open SkyDexia', href: resolveKaixuSuperIDEiaLaunchTarget('skydexia'), openTargetKey: 'skydexia', secondary: true }
  ];
}