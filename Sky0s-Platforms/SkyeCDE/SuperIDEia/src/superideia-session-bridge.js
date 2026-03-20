export const SUPERIDEIA_STORAGE_KEY = 'skycde:superideia';
export const GATE_URL = 'https://0megaskyegate.skyesoverlondon.workers.dev';
export const GATE_SESSION_KEY = '0s_session';

/**
 * Get the active 0megaSkyeGate session token from localStorage.
 */
export function getGateToken() {
  try {
    const raw = localStorage.getItem(GATE_SESSION_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.token) return null;
    if (obj.expires_at && new Date(obj.expires_at) <= new Date()) return null;
    return obj.token;
  } catch { return null; }
}

export function getSuperIDEiaSessionState() {
  return {
    source: 'superideia-live-lane',
    gate: 'bridge-backed',
    gateUrl: GATE_URL,
    gateSessionKey: GATE_SESSION_KEY,
    theiaSupportLayer: 'active-support-layer',
    storageKey: SUPERIDEIA_STORAGE_KEY,
    originalSuperIDEPreserved: true
  };
}