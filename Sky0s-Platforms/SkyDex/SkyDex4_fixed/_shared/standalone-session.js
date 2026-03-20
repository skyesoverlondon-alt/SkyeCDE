(function(){
  // Token storage is now backed by 0megaSkyeGate via OmegaAuth.
  // Legacy kx.api.accessToken key is kept as a fallback for older pages not yet migrated.
  const LEGACY_TOKEN_KEY = 'kx.api.accessToken';
  const EMAIL_KEY = 'kx.api.tokenEmail';
  const INTENT_KEY = 'skydex.intent.log';

  function readToken(){
    // Prefer gate session token (0s_session) from OmegaAuth / auth-unlock,
    // then legacy kx.api.accessToken for backward compat.
    try {
      if (window.OmegaAuth) {
        const t = window.OmegaAuth.getToken();
        if (t) return t;
      }
      // auth-unlock.js stores the verified gate token under 0s_session
      const gateRaw = localStorage.getItem('0s_session');
      if (gateRaw) {
        try {
          const gateObj = JSON.parse(gateRaw);
          if (gateObj && gateObj.token) return gateObj.token;
        } catch {}
      }
      return String(localStorage.getItem(LEGACY_TOKEN_KEY) || '').trim();
    } catch { return ''; }
  }
  function readTokenEmail(){ try { return String(localStorage.getItem(EMAIL_KEY) || '').trim(); } catch { return ''; } }
  function saveManualToken(token, email){
    try {
      if (token) {
        // Store in both locations for backward compat
        localStorage.setItem(LEGACY_TOKEN_KEY, String(token));
      }
      if (email) localStorage.setItem(EMAIL_KEY, String(email));
    } catch {}
  }
  async function request(url, options){
    const headers = new Headers(options?.headers || {});
    const token = readToken();
    if (token && !headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + token);
    const response = await fetch(url, { ...options, headers, credentials: 'include' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || `${response.status} ${response.statusText}`);
    return payload;
  }
  async function recordSuiteIntent(record){
    try {
      const current = JSON.parse(localStorage.getItem(INTENT_KEY) || '[]');
      current.unshift({ id: Date.now().toString(36), created_at: new Date().toISOString(), ...(record || {}) });
      localStorage.setItem(INTENT_KEY, JSON.stringify(current.slice(0, 50)));
      return { ok: true };
    } catch { return { ok: false }; }
  }
  function openApp(appName, params){
    console.info('SkyeStandaloneSession.openApp', appName, params || {});
  }
  window.SkyeStandaloneSession = { readToken, readTokenEmail, saveManualToken, request, recordSuiteIntent, openApp };
})();
