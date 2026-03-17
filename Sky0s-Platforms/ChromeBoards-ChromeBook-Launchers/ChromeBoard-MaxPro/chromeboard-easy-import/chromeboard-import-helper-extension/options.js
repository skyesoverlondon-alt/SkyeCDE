
async function init() {
  const data = await chrome.storage.local.get(['chromeboardUrl']);
  document.getElementById('urlInput').value = data.chromeboardUrl || '';
}

document.getElementById('saveBtn').addEventListener('click', async () => {
  const value = document.getElementById('urlInput').value.trim();
  await chrome.storage.local.set({ chromeboardUrl: value });
  document.getElementById('status').textContent = value ? `Saved: ${value}` : 'Saved. Add a URL when you deploy ChromeBoard.';
});

init();
