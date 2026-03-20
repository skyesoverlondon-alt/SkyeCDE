async function saveUrl() {
  const url = document.getElementById('urlInput').value.trim();
  await chrome.storage.local.set({ chromeboardUrl: url });
  document.getElementById('saveStatus').textContent = 'Saved.';
}

async function init() {
  const managed = await chrome.storage.managed.get(null).catch(() => ({}));
  const local = await chrome.storage.local.get(['chromeboardUrl']);
  document.getElementById('urlInput').value = local.chromeboardUrl || managed.chromeboardUrl || '';
  if (managed.chromeboardUrl) {
    document.getElementById('saveStatus').textContent = 'Managed policy URL detected. Local value is only a fallback.';
  }
}

document.getElementById('saveBtn').addEventListener('click', saveUrl);
init();
