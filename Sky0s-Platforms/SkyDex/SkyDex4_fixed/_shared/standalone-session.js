(function(){
  const TOKEN_KEY = 'kx.api.accessToken';
  const EMAIL_KEY = 'kx.api.tokenEmail';
  const INTENT_KEY = 'skydex.intent.log';

  function readToken(){ try { return String(localStorage.getItem(TOKEN_KEY) || '').trim(); } catch { return ''; } }
  function readTokenEmail(){ try { return String(localStorage.getItem(EMAIL_KEY) || '').trim(); } catch { return ''; } }
  function saveManualToken(token, email){
    try {
      if (token) localStorage.setItem(TOKEN_KEY, String(token));
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
