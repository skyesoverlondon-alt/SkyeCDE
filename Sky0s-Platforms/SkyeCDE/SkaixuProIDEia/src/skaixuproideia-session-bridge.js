export const SKAIXUPROIDEIA_STORAGE_KEY = 'skycde:skaixuproideia';

export function getSkaixuProIDEiaSessionState() {
  return {
    source: 'skaixuproideia-live-lane',
    gate: 'bridge-backed',
    theiaSupportLayer: 'active-support-layer',
    storageKey: SKAIXUPROIDEIA_STORAGE_KEY,
    originalSkaixuProIDEPreserved: true
  };
}