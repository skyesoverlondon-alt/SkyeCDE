(function () {
  const DEFAULT_API_BASE = 'https://0megaskyegate.skyesoverlondon.workers.dev';
  const DEFAULT_GATE_ALIAS = 'kaixu/code';
  const GATE_URL_KEYS = ['OMEGA_GATE_URL'];
  const TOKEN_KEYS = ['KAIXU_APP_TOKEN', 'OMEGA_GATE_SERVICE_KEY', 'KAIXU_VIRTUAL_KEY'];
  const WORKBENCH_KEYS = ['SKYE_WORKBENCH_CONTEXT', 'KAIXU_WORKBENCH_CONTEXT', 'SKYE_WORKBENCH'];

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

  function firstNonEmpty(values) {
    for (const value of values) {
      const text = String(value || '').trim();
      if (text) {
        return text;
      }
    }
    return '';
  }

  function resolveGateUrl(options) {
    const fallback = options && options.fallback;
    const fromWindow = GATE_URL_KEYS.map(key => window[key]);
    const fromStorage = GATE_URL_KEYS.map(key => getStoredValue(key));
    return normalizeBaseUrl(firstNonEmpty([...fromWindow, ...fromStorage, fallback, inferSameOriginGate(), DEFAULT_API_BASE]));
  }

  function resolveGateAlias(options) {
    const fallback = options && options.fallback;
    return firstNonEmpty([
      options && options.alias,
      window.KAIXU_GATE_ALIAS,
      getStoredValue('KAIXU_GATE_ALIAS'),
      fallback,
      DEFAULT_GATE_ALIAS,
    ]);
  }

  function hydrateGateToken(options) {
    const fallback = options && options.fallback;
    const fromWindow = TOKEN_KEYS.map(key => window[key]);
    const fromStorage = TOKEN_KEYS.map(key => getStoredValue(key));
    const token = firstNonEmpty([options && options.token, ...fromWindow, ...fromStorage, fallback]);
    if (token) {
      setStoredValue('KAIXU_APP_TOKEN', token);
    }
    return token;
  }

  function hydrateGateBootstrap(options) {
    return {
      apiBase: resolveGateUrl({ fallback: options && options.apiBase }),
      alias: resolveGateAlias({ alias: options && options.alias, fallback: options && options.defaultAlias }),
      token: hydrateGateToken({ token: options && options.token }),
      tokenLabel: (options && options.tokenLabel) || 'app token',
      modeLabel: (options && options.modeLabel) || '0mega gate lane'
    };
  }

  function importPersistentWorkbench(source) {
    const value = String(source || '').trim();
    if (value) {
      setStoredValue('SKYE_WORKBENCH_CONTEXT', value);
      return value;
    }
    const existing = firstNonEmpty(WORKBENCH_KEYS.map(key => getStoredValue(key)));
    if (existing) {
      setStoredValue('SKYE_WORKBENCH_CONTEXT', existing);
      return existing;
    }
    return '';
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
    const bootstrap = hydrateGateBootstrap(options);
    const apiBase = bootstrap.apiBase;
    const tokenValue = bootstrap.token;
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

  function buildNormalizedStatusMessage(options) {
    const bootstrap = hydrateGateBootstrap(options);
    if (!bootstrap.token) {
      return {
        state: 'warning',
        text: `Gate bootstrap pending. Missing ${bootstrap.tokenLabel} for ${bootstrap.apiBase}.`,
        bootstrap
      };
    }
    return {
      state: 'ready',
      text: `Gate bootstrap ready for ${bootstrap.alias} via ${bootstrap.apiBase}.`,
      bootstrap
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
    DEFAULT_GATE_ALIAS,
    normalizeBaseUrl,
    inferSameOriginGate,
    resolveApiBase,
    resolveGateUrl,
    resolveGateAlias,
    hydrateGateToken,
    hydrateGateBootstrap,
    importPersistentWorkbench,
    getStoredValue,
    setStoredValue,
    bindTokenInput,
    buildNoticeMessage,
    buildNormalizedStatusMessage,
    renderConfigNotice,
  };
})();