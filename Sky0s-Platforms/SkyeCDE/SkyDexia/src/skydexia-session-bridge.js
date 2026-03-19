export const SKYDEXIA_STORAGE_KEY = 'skycde:skydexia';

export function getSkyDexiaSessionState() {
  return {
    source: 'skydexia-live-lane',
    gate: 'bridge-backed',
    theiaSupportLayer: 'active-support-layer',
    storageKey: SKYDEXIA_STORAGE_KEY,
    originalSkyDexPreserved: true
  };
}