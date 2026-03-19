import { resolveLaunchTarget } from './skydexia-launch-map.js';

export function openFullApp(target) {
  const launchTarget = new URL(target, window.location.href).toString();
  window.open(launchTarget, '_blank', 'noopener');
  return launchTarget;
}

export function openSkyDexiaLaunchTarget(key) {
  return openFullApp(resolveLaunchTarget(key));
}