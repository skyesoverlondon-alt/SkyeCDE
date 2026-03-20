async function ask(type, payload = {}) {
  return chrome.runtime.sendMessage({ type, ...payload });
}

function setStatus(text) {
  document.getElementById('status').textContent = text;
}

async function refresh() {
  const res = await ask('status');
  if (!res?.ok) {
    setStatus(`Status failed: ${res?.error || 'Unknown error'}`);
    return;
  }
  const { effectiveUrl, localUrl, managedUrl, managedSeedCount, managedFlags, lastBootstrapAt } = res.data;
  document.getElementById('urlInput').value = localUrl || managedUrl || '';
  setStatus([
    `Effective URL: ${effectiveUrl}`,
    `Managed URL: ${managedUrl || '(none)'}`,
    `Managed seed items: ${managedSeedCount}`,
    `Flags: apps=${managedFlags.seedFromInstalledApps} bookmarks=${managedFlags.seedFromBookmarkBar} tabs=${managedFlags.seedFromOpenTabs} auto=${managedFlags.autoBootstrapOnStartup}`,
    `Last bootstrap: ${lastBootstrapAt || '(never)'}`
  ].join('\n'));
}

async function saveUrl() {
  const url = document.getElementById('urlInput').value.trim();
  const res = await ask('saveUrl', { url });
  if (!res?.ok) {
    setStatus(`Save failed: ${res?.error || 'Unknown error'}`);
    return;
  }
  await refresh();
}

async function runAction(action) {
  setStatus(`Running ${action}…`);
  const res = await ask('runAction', { action });
  if (!res?.ok) {
    setStatus(`${action} failed: ${res?.error || 'Unknown error'}`);
    return;
  }
  setStatus(`${action} opened ChromeBoard with ${res.count} item(s).`);
  window.close();
}

document.getElementById('saveBtn').addEventListener('click', saveUrl);
document.getElementById('fullBootstrapBtn').addEventListener('click', () => runAction('fullBootstrap'));
document.getElementById('managedSeedBtn').addEventListener('click', () => runAction('importManagedSeed'));
document.getElementById('installedAppsBtn').addEventListener('click', () => runAction('importInstalledApps'));
document.getElementById('bookmarkBarBtn').addEventListener('click', () => runAction('importBookmarkBar'));
document.getElementById('allTabsBtn').addEventListener('click', () => runAction('importAllTabs'));
document.getElementById('windowTabsBtn').addEventListener('click', () => runAction('importCurrentWindowTabs'));
document.getElementById('currentTabBtn').addEventListener('click', () => runAction('importCurrentTab'));
refresh();
