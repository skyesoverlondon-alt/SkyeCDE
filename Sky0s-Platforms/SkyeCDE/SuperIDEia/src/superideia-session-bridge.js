export const SUPERIDEIA_STORAGE_KEY = 'skycde:superideia';

export function getSuperIDEiaSessionState() {
  return {
    source: 'superideia-live-lane',
    gate: 'bridge-backed',
    theiaSupportLayer: 'active-support-layer',
    storageKey: SUPERIDEIA_STORAGE_KEY,
    originalSuperIDEPreserved: true
  };
}