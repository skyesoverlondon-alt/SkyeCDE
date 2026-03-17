
const DEFAULT_URL = 'https://example.com/';
const MENU_IDS = {
  page: 'chromeboard-import-page',
  link: 'chromeboard-import-link',
  image: 'chromeboard-import-image',
  media: 'chromeboard-import-media'
};

async function getBaseUrl() {
  const stored = await chrome.storage.local.get(['chromeboardUrl']);
  return (stored.chromeboardUrl || DEFAULT_URL).trim();
}

function normalizeBaseUrl(url) {
  if (!url) return DEFAULT_URL;
  return url.endsWith('/') ? url : `${url}/`;
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
  const baseUrl = await getBaseUrl();
  const finalUrl = buildImportUrl(baseUrl, payload);
  await chrome.tabs.create({ url: finalUrl });
}

async function importCurrentTab(tab) {
  if (!tab?.url) return;
  await openImport({
    name: tab.title || 'Imported page',
    url: tab.url,
    description: 'Imported from the ChromeBoard helper extension.',
    icon: '🚀',
    tags: 'browser,imported'
  });
}

function createMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_IDS.page, title: 'Import page to ChromeBoard', contexts: ['page'] });
    chrome.contextMenus.create({ id: MENU_IDS.link, title: 'Import link to ChromeBoard', contexts: ['link'] });
    chrome.contextMenus.create({ id: MENU_IDS.image, title: 'Import image source to ChromeBoard', contexts: ['image'] });
    chrome.contextMenus.create({ id: MENU_IDS.media, title: 'Import media source to ChromeBoard', contexts: ['video','audio'] });
  });
}

chrome.runtime.onInstalled.addListener(createMenus);
chrome.runtime.onStartup.addListener(createMenus);

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === MENU_IDS.page) {
      await importCurrentTab(tab);
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
  await importCurrentTab(tab);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'import-current-tab') return;
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  await importCurrentTab(tab);
});
