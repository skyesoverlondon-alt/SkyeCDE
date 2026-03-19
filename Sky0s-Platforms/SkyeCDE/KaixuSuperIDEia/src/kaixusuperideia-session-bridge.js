export const KAIXUSUPERIDEIA_STORAGE_KEY = 'skycde:kaixusuperideia';

export function getKaixuSuperIDEiaSessionState() {
  return {
    source: 'kaixusuperideia-live-lane',
    gate: 'bridge-backed',
    theiaSupportLayer: 'active-support-layer',
    storageKey: KAIXUSUPERIDEIA_STORAGE_KEY,
    originalKaixuSuperIDEPreserved: true
  };
}