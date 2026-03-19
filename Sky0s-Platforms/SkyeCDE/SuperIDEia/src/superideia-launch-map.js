export const superideiaLaunchMap = {
  self: './index.html',
  hub: '../index.html',
  currentSuperIDE: '../../SuperIDE/index.html',
  skydexia: '../SkyDexia/index.html'
};

export function resolveSuperIDEiaLaunchTarget(key) {
  return superideiaLaunchMap[key] || superideiaLaunchMap.hub;
}

export function getSuperIDEiaFullAppButtons() {
  return [
    { label: 'Open SuperIDEia full app', href: resolveSuperIDEiaLaunchTarget('self'), openTargetKey: 'self' },
    { label: 'Open current SuperIDE', href: resolveSuperIDEiaLaunchTarget('currentSuperIDE'), openTargetKey: 'currentSuperIDE', secondary: true },
    { label: 'Open SkyDexia', href: resolveSuperIDEiaLaunchTarget('skydexia'), openTargetKey: 'skydexia', secondary: true }
  ];
}