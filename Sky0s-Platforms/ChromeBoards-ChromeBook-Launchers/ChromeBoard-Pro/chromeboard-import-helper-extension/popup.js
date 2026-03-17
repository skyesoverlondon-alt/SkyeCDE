
async function loadUrl() {
  const data = await chrome.storage.local.get(['chromeboardUrl']);
  document.getElementById('urlInput').value = data.chromeboardUrl || '';
}

async function saveUrl() {
  const value = document.getElementById('urlInput').value.trim();
  await chrome.storage.local.set({ chromeboardUrl: value });
  window.close();
}

async function importCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const stored = await chrome.storage.local.get(['chromeboardUrl']);
  const base = (stored.chromeboardUrl || 'https://example.com/').trim();
  const url = new URL(base.endsWith('/') ? base : `${base}/`);
  url.searchParams.set('cb_action','import');
  url.searchParams.set('name', tab.title || 'Imported page');
  url.searchParams.set('url', tab.url || '');
  url.searchParams.set('description', 'Imported from the ChromeBoard helper popup.');
  url.searchParams.set('icon', '🚀');
  url.searchParams.set('tags', 'browser,imported');
  await chrome.tabs.create({ url: url.toString() });
  window.close();
}

document.getElementById('saveBtn').addEventListener('click', saveUrl);
document.getElementById('importCurrentBtn').addEventListener('click', importCurrentTab);
loadUrl();
