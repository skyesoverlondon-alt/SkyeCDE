export const skaixuProIDEiaLaunchMap = {
  self: './index.html',
  hub: '../index.html',
  currentSkaixuProIDE: '../../SkaixuPro-IDE/SkaixuPro-IDE-Platform/index.html',
  skydexia: '../SkyDexia/index.html'
};

export function resolveSkaixuProIDEiaLaunchTarget(key) {
  return skaixuProIDEiaLaunchMap[key] || skaixuProIDEiaLaunchMap.hub;
}

export function getSkaixuProIDEiaFullAppButtons() {
  return [
    { label: 'Open SkaixuProIDEia full app', href: resolveSkaixuProIDEiaLaunchTarget('self'), openTargetKey: 'self' },
    { label: 'Open current SkaixuPro-IDE', href: resolveSkaixuProIDEiaLaunchTarget('currentSkaixuProIDE'), openTargetKey: 'currentSkaixuProIDE', secondary: true },
    { label: 'Open SkyDexia', href: resolveSkaixuProIDEiaLaunchTarget('skydexia'), openTargetKey: 'skydexia', secondary: true }
  ];
}