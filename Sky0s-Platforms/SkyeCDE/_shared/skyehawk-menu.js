const SKYEHAWK_STYLE_ID = 'skycde-skyehawk-style';
const SKYEHAWK_OVERLAY_ID = 'skycde-skyehawk-overlay';

export function installSkyeHawkMenu(options) {
  const routes = dedupeRoutes(options.routes || []);
  if (!routes.length) {
    return { open() {}, close() {}, destroy() {} };
  }

  ensureStyles();

  const triggerButton = options.triggerButton;
  const storageKey = options.storageKey || 'skycde:skyehawk';
  const commandPhrases = (options.commandPhrases || ['skyehawk', 'open menu', 'show system']).map(value => value.toLowerCase());
  const keyboardShortcutLabel = options.keyboardShortcutLabel || 'Ctrl/Cmd+Shift+K';
  const recentRouteKey = `${storageKey}:recent-route`;
  let overlay;
  let searchInput;
  let listContainer;
  let emptyState;
  let phraseBuffer = '';
  let phraseTimer;

  const state = {
    routes,
    search: '',
    activeIndex: 0,
    recentRouteId: loadRecentRouteId(recentRouteKey)
  };

  function getFilteredRoutes() {
    const query = state.search.trim().toLowerCase();
    const filteredRoutes = (!query ? state.routes : state.routes.filter(route => {
      const haystack = [route.label, route.category, route.description, ...(route.keywords || [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    }));

    return filteredRoutes.slice().sort((left, right) => {
      if (left.id === state.recentRouteId && right.id !== state.recentRouteId) {
        return -1;
      }
      if (right.id === state.recentRouteId && left.id !== state.recentRouteId) {
        return 1;
      }
      return 0;
    });
  }

  function openRoute(route) {
    if (!route) {
      return;
    }
    state.recentRouteId = route.id;
    try {
      window.localStorage.setItem(recentRouteKey, route.id);
    } catch {
      // Ignore localStorage failures.
    }
    close();
    const targetUrl = new URL(route.href, window.location.href).toString();
    if (route.newTab) {
      window.open(targetUrl, '_blank', 'noopener');
      return;
    }
    window.location.assign(targetUrl);
  }

  function renderRoutes() {
    if (!listContainer || !emptyState) {
      return;
    }

    const filteredRoutes = getFilteredRoutes();
    state.activeIndex = Math.min(state.activeIndex, Math.max(filteredRoutes.length - 1, 0));
    listContainer.innerHTML = filteredRoutes.map(route => `
      <button type="button" class="skyehawk-route${filteredRoutes[state.activeIndex]?.id === route.id ? ' active' : ''}" data-route-id="${escapeAttribute(route.id)}">
        <span class="skyehawk-route-copy">
          <strong>${escapeHtml(route.label)}</strong>
          <small>${escapeHtml(route.description || route.category || 'System route')}</small>
        </span>
        <span class="skyehawk-route-meta">${escapeHtml(route.category || 'Route')}</span>
      </button>
    `).join('');

    emptyState.hidden = filteredRoutes.length > 0;

    listContainer.querySelectorAll('[data-route-id]').forEach(button => {
      button.addEventListener('click', () => {
        const route = state.routes.find(entry => entry.id === button.dataset.routeId);
        openRoute(route);
      });
    });
  }

  function buildOverlay() {
    const shell = document.createElement('div');
    shell.className = 'skyehawk-overlay';
    shell.id = SKYEHAWK_OVERLAY_ID;
    shell.innerHTML = `
      <div class="skyehawk-dialog" role="dialog" aria-modal="true" aria-label="SkyeHawk system menu">
        <div class="skyehawk-header">
          <div>
            <div class="skyehawk-eyebrow">SkyeHawk</div>
            <h2>${escapeHtml(options.title || 'Sovereign system menu')}</h2>
            <p>${escapeHtml(options.description || 'Search routes, IDE lanes, and preserved product surfaces from one command layer.')}</p>
          </div>
          <button type="button" class="skyehawk-close" aria-label="Close SkyeHawk">Close</button>
        </div>
        <div class="skyehawk-search-wrap">
          <input class="skyehawk-search" type="text" placeholder="Type a route, lane, or command phrase..." aria-label="Search SkyeHawk routes" />
          <span class="skyehawk-shortcut">${escapeHtml(keyboardShortcutLabel)}</span>
        </div>
        <div class="skyehawk-command-hint">Hidden commands: ${escapeHtml(commandPhrases.join(' · '))}</div>
        <div class="skyehawk-route-list"></div>
        <div class="skyehawk-empty" hidden>No routes match the current search.</div>
      </div>
    `;

    shell.addEventListener('click', event => {
      if (event.target === shell) {
        close();
      }
    });

    shell.querySelector('.skyehawk-close').addEventListener('click', close);
    searchInput = shell.querySelector('.skyehawk-search');
    listContainer = shell.querySelector('.skyehawk-route-list');
    emptyState = shell.querySelector('.skyehawk-empty');
    searchInput.addEventListener('input', () => {
      state.search = searchInput.value;
      state.activeIndex = 0;
      renderRoutes();
    });
    searchInput.addEventListener('keydown', event => {
      const filteredRoutes = getFilteredRoutes();
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        state.activeIndex = Math.min(state.activeIndex + 1, Math.max(filteredRoutes.length - 1, 0));
        renderRoutes();
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        state.activeIndex = Math.max(state.activeIndex - 1, 0);
        renderRoutes();
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        openRoute(filteredRoutes[state.activeIndex] || filteredRoutes[0]);
      }
    });

    renderRoutes();
    return shell;
  }

  function open(prefill = '') {
    if (!overlay) {
      overlay = buildOverlay();
    }
    if (!overlay.isConnected) {
      document.body.appendChild(overlay);
    }
    state.search = prefill;
    searchInput.value = prefill;
    renderRoutes();
    window.requestAnimationFrame(() => searchInput.focus());
  }

  function close() {
    if (overlay?.isConnected) {
      overlay.remove();
    }
  }

  function shouldIgnoreKeyTarget(target) {
    return target instanceof HTMLElement && (
      target.tagName === 'INPUT'
      || target.tagName === 'TEXTAREA'
      || target.isContentEditable
      || target.closest('.skyehawk-dialog')
    );
  }

  function onKeydown(event) {
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      open();
      return;
    }

    if (event.key === 'Escape' && overlay?.isConnected) {
      close();
      return;
    }

    if (shouldIgnoreKeyTarget(event.target) || event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) {
      return;
    }

    phraseBuffer = `${phraseBuffer}${event.key.toLowerCase()}`.slice(-48);
    window.clearTimeout(phraseTimer);
    phraseTimer = window.setTimeout(() => {
      phraseBuffer = '';
    }, 1200);

    if (commandPhrases.some(phrase => phraseBuffer.endsWith(phrase))) {
      phraseBuffer = '';
      open();
    }
  }

  document.addEventListener('keydown', onKeydown);

  if (triggerButton) {
    triggerButton.addEventListener('click', () => open());
  }

  return {
    open,
    close,
    destroy() {
      document.removeEventListener('keydown', onKeydown);
      close();
    }
  };
}

export function buildSkyeHawkRoutes(options = {}) {
  const routes = [];
  const baseId = slugify(options.baseId || 'skycde');

  if (options.actions?.primary) {
    routes.push(makeRoute(`${baseId}-primary`, options.actions.primary.label, options.actions.primary.href, 'Hub route'));
  }
  if (options.actions?.secondary) {
    routes.push(makeRoute(`${baseId}-secondary`, options.actions.secondary.label, options.actions.secondary.href, 'Preserved product'));
  }
  (options.fullAppButtons || []).forEach((button, index) => {
    routes.push(makeRoute(`${baseId}-full-${index + 1}`, button.label, button.href, button.secondary ? 'Secondary route' : 'Primary route'));
  });
  (options.additionalRoutes || []).forEach((route, index) => {
    routes.push(makeRoute(route.id || `${baseId}-extra-${index + 1}`, route.label, route.href, route.category || 'System route', route));
  });

  return dedupeRoutes(routes);
}

function makeRoute(id, label, href, category, route = {}) {
  return {
    id,
    label,
    href,
    category,
    description: route.description || category,
    keywords: route.keywords || [],
    newTab: Boolean(route.newTab)
  };
}

function dedupeRoutes(routes) {
  const seen = new Set();
  return routes.filter(route => {
    if (!route?.label || !route?.href) {
      return false;
    }
    const key = `${route.label}:${route.href}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function ensureStyles() {
  if (document.getElementById(SKYEHAWK_STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = SKYEHAWK_STYLE_ID;
  style.textContent = `
    .skyehawk-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: grid;
      place-items: center;
      background: rgba(11, 10, 16, 0.66);
      backdrop-filter: blur(12px);
      padding: 24px;
    }
    .skyehawk-dialog {
      width: min(860px, calc(100vw - 32px));
      max-height: min(720px, calc(100vh - 32px));
      overflow: auto;
      display: grid;
      gap: 16px;
      padding: 24px;
      border-radius: 28px;
      color: #f5efe4;
      background: linear-gradient(180deg, rgba(14, 23, 35, 0.97), rgba(24, 17, 28, 0.98));
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.4);
    }
    .skyehawk-header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
    }
    .skyehawk-header h2 {
      margin: 0;
      font-size: clamp(28px, 4vw, 42px);
      line-height: 1;
    }
    .skyehawk-header p,
    .skyehawk-command-hint,
    .skyehawk-route-copy small,
    .skyehawk-route-meta,
    .skyehawk-shortcut {
      color: rgba(242, 233, 223, 0.72);
    }
    .skyehawk-eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 11px;
      font-weight: 800;
      color: #f7b661;
      margin-bottom: 10px;
    }
    .skyehawk-close,
    .skyehawk-route {
      font: inherit;
      border: 0;
      cursor: pointer;
    }
    .skyehawk-close {
      min-height: 42px;
      padding: 0 14px;
      border-radius: 999px;
      background: rgba(255,255,255,0.1);
      color: #fff;
      font-weight: 700;
    }
    .skyehawk-search-wrap {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      align-items: center;
      padding: 10px 12px;
      border-radius: 18px;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.1);
    }
    .skyehawk-search {
      width: 100%;
      min-height: 44px;
      border: 0;
      outline: none;
      color: #fff;
      background: transparent;
      font: inherit;
    }
    .skyehawk-route-list {
      display: grid;
      gap: 10px;
    }
    .skyehawk-route {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 16px;
      align-items: center;
      padding: 14px 16px;
      border-radius: 18px;
      text-align: left;
      color: #fff;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.09);
    }
    .skyehawk-route.active {
      border-color: rgba(247, 182, 97, 0.8);
      background: rgba(247, 182, 97, 0.14);
    }
    .skyehawk-route strong {
      display: block;
      margin-bottom: 4px;
    }
    .skyehawk-route-meta {
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 11px;
      font-weight: 800;
    }
    .skyehawk-empty {
      padding: 12px 0 4px;
      color: rgba(242, 233, 223, 0.72);
    }
    @media (max-width: 720px) {
      .skyehawk-header,
      .skyehawk-route,
      .skyehawk-search-wrap {
        grid-template-columns: 1fr;
      }
      .skyehawk-header {
        display: grid;
      }
    }
  `;
  document.head.appendChild(style);
}

function slugify(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function loadRecentRouteId(storageKey) {
  try {
    return window.localStorage.getItem(storageKey) || '';
  } catch {
    return '';
  }
}