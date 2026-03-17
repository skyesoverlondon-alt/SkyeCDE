
const DEFAULT_URL = 'https://example.com/';

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

async function loadUrl() {
  const data = await chrome.storage.local.get(['chromeboardUrl']);
  document.getElementById('urlInput').value = data.chromeboardUrl || '';
}

async function saveUrl() {
  const value = document.getElementById('urlInput').value.trim();
  await chrome.storage.local.set({ chromeboardUrl: value });
}

async function getBaseUrl() {
  const stored = await chrome.storage.local.get(['chromeboardUrl']);
  return normalizeBaseUrl(stored.chromeboardUrl || DEFAULT_URL);
}

function tabToItem(tab, extraTags = []) {
  return {
    name: tab.title || 'Imported page',
    url: tab.url || '',
    description: 'Imported from the ChromeBoard helper popup.',
    icon: '🚀',
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
        icon: '⭐',
        tags: ['bookmark', 'imported', ...extraTags]
      });
    }
    (node.children || []).forEach(walk);
  };
  nodes.forEach(walk);
  return items;
}

async function openBatch(items, source = 'helper batch') {
  const base = await getBaseUrl();
  const url = new URL(base);
  url.searchParams.set('cb_action', 'batch');
  url.searchParams.set('data', encodePayload({ items, meta: { source } }));
  await chrome.tabs.create({ url: url.toString() });
  window.close();
}

async function importCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;
  await openBatch([tabToItem(tab)], 'current tab');
}

async function importCurrentWindowTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const items = tabs.filter(tab => tab.url && !tab.url.startsWith('chrome://')).map(tab => tabToItem(tab, ['window']));
  if (!items.length) return;
  await openBatch(items, 'current window tabs');
}

async function importAllTabs() {
  const tabs = await chrome.tabs.query({});
  const items = tabs.filter(tab => tab.url && !tab.url.startsWith('chrome://')).map(tab => tabToItem(tab, ['all-tabs']));
  if (!items.length) return;
  await openBatch(items, 'all open tabs');
}

async function importBookmarkBar() {
  const tree = await chrome.bookmarks.getTree();
  const bar = (tree[0]?.children || []).find(node => node.id === '1' || /bookmark bar/i.test(node.title || ''));
  const items = bookmarkNodesToItems(bar ? [bar] : tree, ['bookmark-bar']);
  if (!items.length) return;
  await openBatch(items, 'bookmark bar');
}

document.getElementById('saveBtn').addEventListener('click', async () => {
  await saveUrl();
  window.close();
});
document.getElementById('importCurrentBtn').addEventListener('click', importCurrentTab);
document.getElementById('importWindowBtn').addEventListener('click', importCurrentWindowTabs);
document.getElementById('importAllTabsBtn').addEventListener('click', importAllTabs);
document.getElementById('importBookmarkBarBtn').addEventListener('click', importBookmarkBar);
loadUrl();
