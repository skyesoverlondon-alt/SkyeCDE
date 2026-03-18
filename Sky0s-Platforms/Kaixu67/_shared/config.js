(function () {
  const DEFAULT_API_BASE = 'https://0megaskyegate.skyesoverlondon.workers.dev';

  function normalizeBaseUrl(raw) {
    const value = String(raw || '').trim();
    if (!value) return DEFAULT_API_BASE;
    return value.replace(/\/+$/, '');
  }

  function getStoredValue(key) {
    try {
      return localStorage.getItem(key) || '';
    } catch (_) {
      return '';
    }
  }

  function setStoredValue(key, value) {
    try {
      if (!value) {
        localStorage.removeItem(key);
        return;
      }
      localStorage.setItem(key, value);
    } catch (_) {}
  }

  function inferSameOriginGate() {
    try {
      const protocol = String(location.protocol || '');
      const hostname = String(location.hostname || '').trim();
      const meta = document.querySelector('meta[name="omega-gate-same-origin"]');
      if (!/^https?:$/.test(protocol) || !hostname) return '';
      if (/^(localhost|127(?:\.\d+){3}|0\.0\.0\.0)$/i.test(hostname)) return '';
      if (meta && String(meta.content || '').trim().toLowerCase() === 'true') return location.origin;
      return '';
    } catch (_) {
      return '';
    }
  }

  function resolveApiBase(fallback) {
    if (typeof window.resolveOmegaGateUrl === 'function') {
      return normalizeBaseUrl(window.resolveOmegaGateUrl(fallback || inferSameOriginGate() || DEFAULT_API_BASE));
    }
    return normalizeBaseUrl(
      window.OMEGA_GATE_URL || getStoredValue('OMEGA_GATE_URL') || fallback || inferSameOriginGate() || DEFAULT_API_BASE
    );
  }

  function bindTokenInput(input, storageKey, onChange) {
    if (!input) return;
    const saved = getStoredValue(storageKey);
    if (saved && !input.value) input.value = saved;
    input.addEventListener('input', () => {
      setStoredValue(storageKey, input.value.trim());
      if (typeof onChange === 'function') onChange(input.value.trim());
    });
  }

  function buildNoticeMessage(options) {
    const apiBase = normalizeBaseUrl(options && options.apiBase);
    const tokenValue = String((options && options.tokenValue) || '').trim();
    const tokenLabel = (options && options.tokenLabel) || 'app token';
    const modeLabel = options && options.modeLabel ? ` (${options.modeLabel})` : '';

    if (!tokenValue) {
      return {
        state: 'warning',
        text: `Missing ${tokenLabel}. Requests to ${apiBase}${modeLabel} will fail until you paste one.`
      };
    }

    return {
      state: 'ready',
      text: `${tokenLabel[0].toUpperCase() + tokenLabel.slice(1)} loaded. Using ${apiBase}${modeLabel}.`
    };
  }

  function renderConfigNotice(element, options) {
    if (!element) return;
    const notice = buildNoticeMessage(options);
    element.textContent = notice.text;
    element.dataset.state = notice.state;
    element.style.display = 'block';
    element.style.color = notice.state === 'ready' ? 'var(--muted, #aab0c5)' : 'var(--gold, #ffd55a)';
    element.style.borderColor = notice.state === 'ready'
      ? 'rgba(255,255,255,.08)'
      : 'rgba(255,213,90,.28)';
    element.style.background = notice.state === 'ready'
      ? 'rgba(255,255,255,.04)'
      : 'rgba(255,213,90,.08)';
  }

  window.Kaixu67SharedConfig = {
    DEFAULT_API_BASE,
    normalizeBaseUrl,
    inferSameOriginGate,
    resolveApiBase,
    getStoredValue,
    setStoredValue,
    bindTokenInput,
    buildNoticeMessage,
    renderConfigNotice,
  };
})();