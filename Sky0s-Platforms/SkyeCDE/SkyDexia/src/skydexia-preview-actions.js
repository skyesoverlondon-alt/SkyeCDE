import { resolveLaunchTarget } from './skydexia-launch-map.js';

export function openFullApp(target) {
  const launchTarget = new URL(target, window.location.href).toString();
  window.open(launchTarget, '_blank', 'noopener');
  return launchTarget;
}

export function openSkyDexiaLaunchTarget(key) {
  if (!key || key === 'self') {
    return openFullApp('./index.html');
  }

  const mappedTarget = resolveLaunchTarget(key);
  if (mappedTarget && mappedTarget !== resolveLaunchTarget('hub')) {
    return openFullApp(mappedTarget);
  }

  return openFullApp(key);
}