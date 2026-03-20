const DEFAULT_URL = 'https://example.com/';
const LAST_BOOTSTRAP_KEY = 'lastManagedBootstrapSignature';
const LAST_BOOTSTRAP_AT = 'lastManagedBootstrapAt';
const MENU_IDS = {
  page: 'chromeboard-import-page',
  link: 'chromeboard-import-link',
  image: 'chromeboard-import-image',
  media: 'chromeboard-import-media'
};

function normalizeBaseUrl(url) {
  const value = (url || DEFAULT_URL).trim();
  return value.endsWith('/') ? value : `${value}/`;
}

function encodePayload(payload) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function getManagedConfig() {
  try {
    return await chrome.storage.managed.get(null);
  } catch (error) {
    console.warn('Managed storage unavailable', error);
    return {};
  }
}

async function getLocalConfig() {
  return await chrome.storage.local.get(['chromeboardUrl', LAST_BOOTSTRAP_KEY, LAST_BOOTSTRAP_AT]);
}

async function getEffectiveBoardUrl() {
  const managed = await getManagedConfig();
  if (managed.chromeboardUrl && String(managed.chromeboardUrl).trim()) {
    return normalizeBaseUrl(String(managed.chromeboardUrl));
  }
  const local = await getLocalConfig();
  return normalizeBaseUrl(local.chromeboardUrl || DEFAULT_URL);
}

function sanitizeHttpUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const value = url.trim();
  if (/^https?:\/\//i.test(value)) return value;
  return '';
}

function inferIconFromName(name = '', url = '') {
  const hay = `${name} ${url}`.toLowerCase();
  const rules = [
    ['gmail', '✉️'], ['mail', '✉️'], ['calendar', '📅'], ['drive', '🗂️'], ['docs', '📝'],
    ['sheets', '📊'], ['slides', '🖥️'], ['photos', '🖼️'], ['youtube', '▶️'], ['music', '🎵'],
    ['spotify', '🎵'], ['video', '🎬'], ['meet', '📞'], ['zoom', '📹'], ['chat', '💬'],
    ['slack', '💬'], ['discord', '💬'], ['github', '🐙'], ['gitlab', '🐙'], ['notion', '🧠'],
    ['figma', '🎨'], ['canva', '🪄'], ['code', '💻'], ['terminal', '⌨️'], ['admin', '⚙️'],
    ['bank', '🏦'], ['shop', '🛒'], ['store', '🛍️'], ['maps', '📍'], ['news', '📰'],
    ['ai', '🤖'], ['cloud', '☁️'], ['security', '🛡️'], ['auth', '🔐'], ['health', '🏥'],
    ['school', '🏫'], ['crm', '📇'], ['finance', '💰'], ['ops', '🧩'], ['dashboard', '📈']
  ];
  for (const [needle, icon] of rules) {
    if (hay.includes(needle)) return icon;
  }
  return '🚀';
}

function dedupeItems(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    if (!item || !item.url) continue;
    const key = `${item.url}::${item.name || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function tabToItem(tab, extraTags = []) {
  return {
    name: tab.title || 'Imported page',
    url: tab.url || '',
    description: 'Imported from Chrome tabs into ChromeBoard.',
    icon: inferIconFromName(tab.title || '', tab.url || ''),
    tags: ['browser', 'imported', ...extraTags]
  };
}

function bookmarkNodesToItems(nodes, extraTags = []) {
  const items = [];
  const walk = (node) => {
    if (node.url) {
      items.push({
        name: node.title || 'Bookmark',
        url: node.url,
        description: 'Imported from the bookmark bar.',
        icon: inferIconFromName(node.title || '', node.url || ''),
        tags: ['bookmark', 'imported', ...extraTags]
      });
    }
    (node.children || []).forEach(walk);
  };
  nodes.forEach(walk);
  return items;
}

function managementInfoToItem(info) {
  const launchUrl = sanitizeHttpUrl(info.appLaunchUrl) || sanitizeHttpUrl(info.homepageUrl);
  if (!launchUrl) return null;
  return {
    name: info.shortName || info.name || 'Installed app',
    url: launchUrl,
    description: `Imported from installed Chrome-visible app list (${info.type || 'app'}).`,
    icon: inferIconFromName(info.shortName || info.name || '', launchUrl),
    tags: ['installed-app', 'chrome-management', info.type || 'app'].filter(Boolean)
  };
}

function normalizeManagedSeedItem(raw, managed) {
  const url = sanitizeHttpUrl(raw?.url);
  if (!url) return null;
  return {
    name: String(raw?.name || raw?.url || 'Managed item'),
    url,
    description: String(raw?.description || 'Imported from enterprise-managed ChromeBoard seed.'),
    icon: String(raw?.icon || inferIconFromName(raw?.name || '', url)),
    desktopId: String(raw?.desktopId || managed.seedDesktopId || ''),
    pinned: typeof raw?.pinned === 'boolean' ? raw.pinned : Boolean(managed.seedPinned),
    tags: [...new Set([...(Array.isArray(managed.seedTags) ? managed.seedTags : []), ...(Array.isArray(raw?.tags) ? raw.tags : []), 'managed-seed'])]
  };
}

async function collectManagedSeedItems() {
  const managed = await getManagedConfig();
  const rawItems = Array.isArray(managed.seedItems) ? managed.seedItems : [];
  return dedupeItems(rawItems.map(item => normalizeManagedSeedItem(item, managed)).filter(Boolean));
}

async function collectInstalledApps() {
  const infos = await chrome.management.getAll();
  return dedupeItems(
    infos.filter(info => info.enabled).map(managementInfoToItem).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name))
  );
}

async function collectBookmarkBar() {
  const tree = await chrome.bookmarks.getTree();
  const bar = (tree[0]?.children || []).find(node => node.id === '1' || /bookmark bar/i.test(node.title || ''));
  return dedupeItems(bookmarkNodesToItems(bar ? [bar] : tree, ['bookmark-bar']));
}

async function collectOpenTabs(scope = 'all') {
  const query = scope === 'window' ? { currentWindow: true } : {};
  const tabs = await chrome.tabs.query(query);
  return dedupeItems(
    tabs.filter(tab => tab.url && !tab.url.startsWith('chrome://')).map(tab => tabToItem(tab, [scope === 'window' ? 'window' : 'all-tabs']))
  );
}

async function collectCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url ? [tabToItem(tab)] : [];
}

async function collectFullBootstrap() {
  const managed = await getManagedConfig();
  const items = [];
  items.push(...await collectManagedSeedItems());
  if (managed.seedFromInstalledApps) items.push(...await collectInstalledApps());
  if (managed.seedFromBookmarkBar) items.push(...await collectBookmarkBar());
  if (managed.seedFromOpenTabs) items.push(...await collectOpenTabs('all'));
  return {
    items: dedupeItems(items),
    meta: { source: 'managed bootstrap', mode: 'full-bootstrap' }
  };
}

async function openBatch(payload) {
  const base = await getEffectiveBoardUrl();
  const url = new URL(base);
  url.searchParams.set('cb_action', 'batch');
  url.searchParams.set('data', encodePayload(payload));
  await chrome.tabs.create({ url: url.toString() });
}

function buildImportUrl(baseUrl, payload) {
  const url = new URL(normalizeBaseUrl(baseUrl));
  url.searchParams.set('cb_action', 'import');
  for (const [key, value] of Object.entries(payload)) {
    if (value) url.searchParams.set(key, Array.isArray(value) ? value.join(',') : value);
  }
  return url.toString();
}

async function openImport(payload) {
  const baseUrl = await getEffectiveBoardUrl();
  const finalUrl = buildImportUrl(baseUrl, payload);
  await chrome.tabs.create({ url: finalUrl });
}

async function importCurrentTabViaMenu(tab) {
  if (!tab?.url) return;
  await openImport({
    name: tab.title || 'Imported page',
    url: tab.url,
    description: 'Imported from the ChromeBoard helper extension.',
    icon: inferIconFromName(tab.title || '', tab.url || ''),
    tags: 'browser,imported'
  });
}

function createMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_IDS.page, title: 'Import page to ChromeBoard', contexts: ['page'] });
    chrome.contextMenus.create({ id: MENU_IDS.link, title: 'Import link to ChromeBoard', contexts: ['link'] });
    chrome.contextMenus.create({ id: MENU_IDS.image, title: 'Import image source to ChromeBoard', contexts: ['image'] });
    chrome.contextMenus.create({ id: MENU_IDS.media, title: 'Import media source to ChromeBoard', contexts: ['video', 'audio'] });
  });
}

async function bootstrapIfManaged(reason = 'startup') {
  const managed = await getManagedConfig();
  if (!managed.autoBootstrapOnStartup) return { ok: false, skipped: true, reason: 'autoBootstrapOnStartup disabled' };
  const payload = await collectFullBootstrap();
  if (!payload.items.length) return { ok: false, skipped: true, reason: 'no seed items available' };
  const signature = JSON.stringify({
    url: managed.chromeboardUrl || '',
    items: payload.items.map(item => [item.name, item.url, item.icon, item.desktopId || '', item.pinned || false, (item.tags || []).join('|')]),
    flags: [managed.seedFromInstalledApps, managed.seedFromBookmarkBar, managed.seedFromOpenTabs]
  });
  const local = await getLocalConfig();
  if (!managed.forceReimportOnStartup && local[LAST_BOOTSTRAP_KEY] === signature) {
    return { ok: false, skipped: true, reason: 'signature unchanged' };
  }
  await openBatch(payload);
  await chrome.storage.local.set({ [LAST_BOOTSTRAP_KEY]: signature, [LAST_BOOTSTRAP_AT]: new Date().toISOString() });
  return { ok: true, reason };
}

chrome.runtime.onInstalled.addListener(async () => {
  createMenus();
  await bootstrapIfManaged('install');
});
chrome.runtime.onStartup.addListener(async () => {
  createMenus();
  await bootstrapIfManaged('startup');
});
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== 'managed') return;
  if (Object.keys(changes).length) {
    await bootstrapIfManaged('managed-change');
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === MENU_IDS.page) {
      await importCurrentTabViaMenu(tab);
      return;
    }
    if (info.menuItemId === MENU_IDS.link) {
      await openImport({
        name: info.selectionText || tab?.title || 'Imported link',
        url: info.linkUrl,
        description: 'Imported from a right-clicked link in Chrome.',
        icon: '🔗',
        tags: 'link,imported'
      });
      return;
    }
    if (info.menuItemId === MENU_IDS.image) {
      await openImport({
        name: tab?.title || 'Imported image',
        url: info.srcUrl,
        description: 'Imported image source from Chrome.',
        icon: '🖼️',
        tags: 'image,imported'
      });
      return;
    }
    if (info.menuItemId === MENU_IDS.media) {
      await openImport({
        name: tab?.title || 'Imported media',
        url: info.srcUrl,
        description: 'Imported media source from Chrome.',
        icon: '🎬',
        tags: 'media,imported'
      });
    }
  } catch (error) {
    console.error('ChromeBoard import failed', error);
  }
});

chrome.action.onClicked?.addListener(async (tab) => {
  await importCurrentTabViaMenu(tab);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'import-current-tab') return;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  await importCurrentTabViaMenu(tab);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message?.type === 'status') {
        const managed = await getManagedConfig();
        const local = await getLocalConfig();
        const effectiveUrl = await getEffectiveBoardUrl();
        const managedSeedItems = await collectManagedSeedItems();
        sendResponse({
          ok: true,
          data: {
            effectiveUrl,
            localUrl: local.chromeboardUrl || '',
            managedUrl: managed.chromeboardUrl || '',
            managedSeedCount: managedSeedItems.length,
            managedFlags: {
              autoBootstrapOnStartup: Boolean(managed.autoBootstrapOnStartup),
              seedFromInstalledApps: Boolean(managed.seedFromInstalledApps),
              seedFromBookmarkBar: Boolean(managed.seedFromBookmarkBar),
              seedFromOpenTabs: Boolean(managed.seedFromOpenTabs)
            },
            lastBootstrapAt: local[LAST_BOOTSTRAP_AT] || ''
          }
        });
        return;
      }
      if (message?.type === 'saveUrl') {
        await chrome.storage.local.set({ chromeboardUrl: String(message.url || '').trim() });
        sendResponse({ ok: true });
        return;
      }
      if (message?.type === 'runAction') {
        let payload;
        switch (message.action) {
          case 'importCurrentTab':
            payload = { items: await collectCurrentTab(), meta: { source: 'current tab' } };
            break;
          case 'importCurrentWindowTabs':
            payload = { items: await collectOpenTabs('window'), meta: { source: 'current window tabs' } };
            break;
          case 'importAllTabs':
            payload = { items: await collectOpenTabs('all'), meta: { source: 'all open tabs' } };
            break;
          case 'importBookmarkBar':
            payload = { items: await collectBookmarkBar(), meta: { source: 'bookmark bar' } };
            break;
          case 'importInstalledApps':
            payload = { items: await collectInstalledApps(), meta: { source: 'installed Chrome-visible apps' } };
            break;
          case 'importManagedSeed':
            payload = { items: await collectManagedSeedItems(), meta: { source: 'managed seed items' } };
            break;
          case 'fullBootstrap':
            payload = await collectFullBootstrap();
            break;
          default:
            throw new Error(`Unknown action: ${message.action}`);
        }
        if (!payload.items.length) {
          sendResponse({ ok: false, error: 'No importable items were found for that action.' });
          return;
        }
        await openBatch(payload);
        sendResponse({ ok: true, count: payload.items.length });
        return;
      }
      sendResponse({ ok: false, error: 'Unknown message.' });
    } catch (error) {
      console.error(error);
      sendResponse({ ok: false, error: error?.message || String(error) });
    }
  })();
  return true;
});
