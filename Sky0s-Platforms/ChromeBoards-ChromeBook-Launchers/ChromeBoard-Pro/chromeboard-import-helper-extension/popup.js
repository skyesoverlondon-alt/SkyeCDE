
async function loadUrl() {
  const data = await chrome.storage.local.get(['chromeboardUrl']);
  const value = data.chromeboardUrl || '';
  document.getElementById('urlInput').value = value;
  updateUi(value);
}

function updateUi(value) {
  const configured = !!String(value || '').trim();
  const importButton = document.getElementById('importCurrentBtn');
  const hint = document.getElementById('statusText');
  importButton.disabled = !configured;
  hint.textContent = configured
    ? 'Right-click pages or links in Chrome after you set the URL.'
    : 'Set your ChromeBoard URL first. Import actions stay disabled until the helper knows where to send them.';
}

async function saveUrl() {
  const value = document.getElementById('urlInput').value.trim();
  await chrome.storage.local.set({ chromeboardUrl: value });
  updateUi(value);
  window.close();
}

async function importCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const stored = await chrome.storage.local.get(['chromeboardUrl']);
  const base = (stored.chromeboardUrl || '').trim();
  if (!base) {
    await chrome.runtime.openOptionsPage();
    return;
  }
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

document.getElementById('urlInput').addEventListener('input', event => updateUi(event.target.value));
document.getElementById('saveBtn').addEventListener('click', saveUrl);
document.getElementById('importCurrentBtn').addEventListener('click', importCurrentTab);
loadUrl();
