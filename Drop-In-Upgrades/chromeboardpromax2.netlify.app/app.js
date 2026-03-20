
    const DB_NAME = 'chromeboard-db';
    const DB_VERSION = 1;
    const STORE_META = 'meta';
    const STORE_ITEMS = 'items';
    const STORE_HANDLES = 'handles';

    const defaultState = {
      version: 1,
      activeDesktopId: 'desk-main',
      desktops: [{ id: 'desk-main', name: 'Main Desktop', createdAt: Date.now() }],
      wallpaperDataUrl: '',
      items: []
    };

    let db;
    let state;
    let deferredPrompt = null;
    let editingItemId = null;
    let draggedItemId = null;

    const els = {};

    function cacheEls() {
      [
        'statusText','countAll','countPinned','countDesks','desktopTabs','desktopContent','dockList',
        'searchInput','filterType','sortMode','itemDialog','itemDialogTitle','itemDesktopInput',
        'itemNameInput','itemUrlInput','itemDescriptionInput','itemEmojiInput','itemTagsInput','itemPinnedInput',
        'itemIconInput','urlField','deskDialog','newDeskInput','desktopManageList','permissionsDialog','permissionsList',
        'importExportDialog','importFileInput','wallpaperInput','wallpaperLayer','installBtn','importHelperDialog',
        'quickSetupDialog','bulkImportDialog','bulkImportTextarea','bulkImportDesktopInput','bulkImportPinnedInput','bulkImportTagsInput'
      ].forEach(id => els[id] = document.getElementById(id));
    }

    function uid(prefix = 'id') {
      return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
    }

    function setStatus(message) {
      els.statusText.textContent = message;
    }

    function openDb() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META);
          if (!db.objectStoreNames.contains(STORE_ITEMS)) db.createObjectStore(STORE_ITEMS, { keyPath: 'id' });
          if (!db.objectStoreNames.contains(STORE_HANDLES)) db.createObjectStore(STORE_HANDLES, { keyPath: 'id' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    function tx(storeNames, mode = 'readonly') {
      return db.transaction(storeNames, mode);
    }

    function reqToPromise(request) {
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    async function clearAllData() {
      const transaction = tx([STORE_ITEMS, STORE_HANDLES], 'readwrite');
      transaction.objectStore(STORE_ITEMS).clear();
      transaction.objectStore(STORE_HANDLES).clear();
      await new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    }

    async function loadState() {
      const transaction = tx([STORE_META, STORE_ITEMS], 'readonly');
      const metaStore = transaction.objectStore(STORE_META);
      const itemStore = transaction.objectStore(STORE_ITEMS);
      const savedMeta = await reqToPromise(metaStore.get('launcher-state'));
      const savedItems = await reqToPromise(itemStore.getAll());
      const merged = structuredClone(defaultState);
      if (savedMeta) {
        Object.assign(merged, savedMeta);
      }
      merged.items = savedItems.length ? savedItems : (savedMeta?.items || []);
      merged.desktops = Array.isArray(merged.desktops) && merged.desktops.length ? merged.desktops : structuredClone(defaultState.desktops);
      if (!merged.activeDesktopId || !merged.desktops.some(d => d.id === merged.activeDesktopId)) {
        merged.activeDesktopId = merged.desktops[0].id;
      }
      return merged;
    }

    async function saveMetaOnly() {
      const transaction = tx([STORE_META], 'readwrite');
      await reqToPromise(transaction.objectStore(STORE_META).put({
        version: state.version,
        activeDesktopId: state.activeDesktopId,
        desktops: state.desktops,
        wallpaperDataUrl: state.wallpaperDataUrl
      }, 'launcher-state'));
    }

    async function saveItem(item) {
      const transaction = tx([STORE_ITEMS], 'readwrite');
      await reqToPromise(transaction.objectStore(STORE_ITEMS).put(item));
    }

    async function deleteItemById(itemId) {
      const transaction = tx([STORE_ITEMS, STORE_HANDLES], 'readwrite');
      transaction.objectStore(STORE_ITEMS).delete(itemId);
      transaction.objectStore(STORE_HANDLES).delete(itemId);
      await new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    }

    async function saveHandle(id, handle) {
      const transaction = tx([STORE_HANDLES], 'readwrite');
      await reqToPromise(transaction.objectStore(STORE_HANDLES).put({ id, handle }));
    }

    async function getHandle(id) {
      const transaction = tx([STORE_HANDLES], 'readonly');
      const record = await reqToPromise(transaction.objectStore(STORE_HANDLES).get(id));
      return record?.handle || null;
    }

    function activeDesktop() {
      return state.desktops.find(d => d.id === state.activeDesktopId) || state.desktops[0];
    }

    function normalizeTags(raw) {
      return raw.split(',').map(v => v.trim()).filter(Boolean);
    }

    function inferIcon(name, type) {
      if (type === 'folder') return '📁';
      if (type === 'file') {
        const lower = (name || '').toLowerCase();
        if (lower.endsWith('.pdf')) return '📕';
        if (lower.endsWith('.zip')) return '🧱';
        if (lower.endsWith('.doc') || lower.endsWith('.docx')) return '📝';
        if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp')) return '🖼️';
        if (lower.endsWith('.mp4') || lower.endsWith('.mov')) return '🎬';
        if (lower.endsWith('.csv') || lower.endsWith('.xlsx') || lower.endsWith('.xls')) return '📊';
        return '📄';
      }
      if (type === 'note') return '🗒️';
      return '🚀';
    }

    function typeLabel(type) {
      return ({ link: 'Link', file: 'File', folder: 'Folder', note: 'Note' })[type] || 'Item';
    }

    function truncate(text, len = 74) {
      const v = text || '';
      return v.length > len ? `${v.slice(0, len - 1)}…` : v;
    }

    function serializeForExport() {
      return {
        version: state.version,
        exportedAt: new Date().toISOString(),
        activeDesktopId: state.activeDesktopId,
        desktops: state.desktops,
        wallpaperDataUrl: state.wallpaperDataUrl,
        items: state.items.map(item => ({
          ...item,
          handleBacked: item.type === 'file' || item.type === 'folder',
          permission: undefined
        }))
      };
    }

    function setWallpaper(url) {
      state.wallpaperDataUrl = url || '';
      els.wallpaperLayer.style.backgroundImage = url ? `url(${JSON.stringify(url).slice(1, -1)})` : '';
      els.wallpaperLayer.classList.toggle('visible', Boolean(url));
      saveMetaOnly().catch(console.error);
    }

    function render() {
      renderStats();
      renderDesktopTabs();
      renderDesktopGrid();
      renderDock();
      populateDesktopSelects();
      populateBulkImportDesktopSelect();
    }

    function renderStats() {
      els.countAll.textContent = String(state.items.length);
      els.countPinned.textContent = String(state.items.filter(item => item.pinned).length);
      els.countDesks.textContent = String(state.desktops.length);
    }

    function renderDesktopTabs() {
      els.desktopTabs.innerHTML = '';
      state.desktops.forEach(desktop => {
        const button = document.createElement('button');
        button.className = `desktop-tab${desktop.id === state.activeDesktopId ? ' active' : ''}`;
        button.textContent = desktop.name;
        button.addEventListener('click', () => {
          state.activeDesktopId = desktop.id;
          saveMetaOnly().catch(console.error);
          render();
        });
        els.desktopTabs.appendChild(button);
      });
      const addBtn = document.createElement('button');
      addBtn.className = 'desktop-tab';
      addBtn.textContent = '+ New desktop';
      addBtn.addEventListener('click', () => openDeskDialog());
      els.desktopTabs.appendChild(addBtn);
    }

    function filteredItems() {
      const search = (els.searchInput.value || '').trim().toLowerCase();
      const filterType = els.filterType.value;
      const desktopId = state.activeDesktopId;
      let items = state.items.filter(item => item.desktopId === desktopId);
      if (filterType !== 'all') items = items.filter(item => item.type === filterType);
      if (search) {
        items = items.filter(item => {
          const hay = [item.name, item.url, item.description, ...(item.tags || [])].join(' ').toLowerCase();
          return hay.includes(search);
        });
      }
      const sortMode = els.sortMode.value;
      if (sortMode === 'name') items.sort((a, b) => a.name.localeCompare(b.name));
      else if (sortMode === 'recent') items.sort((a, b) => b.createdAt - a.createdAt);
      else if (sortMode === 'pinned') items.sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.order - b.order);
      else items.sort((a, b) => a.order - b.order);
      return items;
    }

    function renderDesktopGrid() {
      const items = filteredItems();
      if (!items.length) {
        els.desktopContent.innerHTML = `<div class="empty-state"><div><strong>No items on ${activeDesktop().name} yet.</strong><p>Add files, folders, links, notes, or Drive surfaces and this board turns into your fake Chromebook desktop.</p><div class="hero-actions" style="justify-content:center;margin-top:14px;"><button class="primary" id="emptyAddBtn">Add first item</button><button id="emptyFolderBtn">Add folder</button></div></div></div>`;
        document.getElementById('emptyAddBtn')?.addEventListener('click', openItemDialog);
        document.getElementById('emptyFolderBtn')?.addEventListener('click', addFolderItems);
        return;
      }

      const grid = document.createElement('div');
      grid.className = 'desktop-grid';

      items.forEach(item => {
        const tile = document.createElement('article');
        tile.className = 'tile';
        tile.draggable = els.sortMode.value === 'manual';
        tile.dataset.itemId = item.id;
        tile.innerHTML = `
          <div class="tile-top">
            <div class="tile-icon">${item.iconImage ? `<img src="${item.iconImage}" alt="">` : `<span>${item.icon || inferIcon(item.name, item.type)}</span>`}</div>
            <div style="display:grid;gap:8px;justify-items:end;">
              <span class="pin-badge ${item.pinned ? 'active' : ''}">${item.pinned ? 'Pinned' : 'Board'}</span>
              <span class="type-badge">${typeLabel(item.type)}</span>
            </div>
          </div>
          <div>
            <div class="tile-title">${escapeHtml(item.name)}</div>
            <div class="tile-meta">${escapeHtml(truncate(item.type === 'link' ? item.url || 'No URL yet' : item.pathDisplay || item.description || ''))}</div>
          </div>
          <div class="tile-desc">${escapeHtml(item.description || item.note || item.pathDisplay || 'No description yet.')}</div>
          <div class="tile-actions">
            <button class="launch primary">Open</button>
            <button class="ghost edit">Edit</button>
            <button class="ghost pin">${item.pinned ? 'Unpin' : 'Pin'}</button>
            <button class="danger remove">Delete</button>
          </div>
        `;

        tile.querySelector('.launch').addEventListener('click', () => launchItem(item));
        tile.querySelector('.edit').addEventListener('click', () => openItemDialog(item));
        tile.querySelector('.pin').addEventListener('click', () => togglePin(item.id));
        tile.querySelector('.remove').addEventListener('click', () => removeItem(item.id));

        if (tile.draggable) {
          tile.addEventListener('dragstart', () => { draggedItemId = item.id; tile.classList.add('dragging'); });
          tile.addEventListener('dragend', () => { draggedItemId = null; tile.classList.remove('dragging'); });
          tile.addEventListener('dragover', event => { event.preventDefault(); });
          tile.addEventListener('drop', event => {
            event.preventDefault();
            if (!draggedItemId || draggedItemId === item.id) return;
            reorderItems(draggedItemId, item.id);
          });
        }

        grid.appendChild(tile);
      });

      els.desktopContent.innerHTML = '';
      els.desktopContent.appendChild(grid);
    }

    function renderDock() {
      const items = state.items.filter(item => item.pinned).sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.order - b.order).slice(0, 10);
      els.dockList.innerHTML = '';
      if (!items.length) {
        els.dockList.innerHTML = '<div class="helper">Nothing pinned yet. Pin items you want to treat like your quick-launch strip.</div>';
        return;
      }
      items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'dock-item';
        row.innerHTML = `
          <div class="mini-icon">${item.iconImage ? `<img src="${item.iconImage}" alt="">` : `<span>${item.icon || inferIcon(item.name, item.type)}</span>`}</div>
          <div>
            <div class="row-title">${escapeHtml(item.name)}</div>
            <div class="row-sub">${escapeHtml(item.desktopName || getDesktopName(item.desktopId) || typeLabel(item.type))}</div>
          </div>
          <button>Open</button>
        `;
        row.querySelector('button').addEventListener('click', () => launchItem(item));
        els.dockList.appendChild(row);
      });
    }

    function getDesktopName(id) {
      return state.desktops.find(d => d.id === id)?.name || 'Desktop';
    }

    function populateDesktopSelects() {
      els.itemDesktopInput.innerHTML = '';
      state.desktops.forEach(desktop => {
        const option = document.createElement('option');
        option.value = desktop.id;
        option.textContent = desktop.name;
        els.itemDesktopInput.appendChild(option);
      });
      els.itemDesktopInput.value = state.activeDesktopId;
    }

    async function togglePin(itemId) {
      const item = state.items.find(i => i.id === itemId);
      if (!item) return;
      item.pinned = !item.pinned;
      item.updatedAt = Date.now();
      await saveItem(item);
      render();
    }

    async function removeItem(itemId) {
      const item = state.items.find(i => i.id === itemId);
      if (!item) return;
      if (!confirm(`Delete ${item.name}?`)) return;
      state.items = state.items.filter(i => i.id !== itemId);
      await deleteItemById(itemId);
      normalizeOrders(state.activeDesktopId);
      render();
      setStatus(`${item.name} removed from ${getDesktopName(item.desktopId)}.`);
    }

    function normalizeOrders(desktopId) {
      state.items
        .filter(item => item.desktopId === desktopId)
        .sort((a, b) => a.order - b.order)
        .forEach((item, index) => {
          item.order = index + 1;
          saveItem(item).catch(console.error);
        });
    }

    function reorderItems(sourceId, targetId) {
      const items = state.items.filter(i => i.desktopId === state.activeDesktopId).sort((a, b) => a.order - b.order);
      const sourceIndex = items.findIndex(i => i.id === sourceId);
      const targetIndex = items.findIndex(i => i.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) return;
      const [moved] = items.splice(sourceIndex, 1);
      items.splice(targetIndex, 0, moved);
      items.forEach((item, index) => {
        item.order = index + 1;
        saveItem(item).catch(console.error);
      });
      render();
    }

    function orderForDesktop(desktopId) {
      const relevant = state.items.filter(item => item.desktopId === desktopId);
      return relevant.length ? Math.max(...relevant.map(item => item.order || 0)) + 1 : 1;
    }

    function baseItem(type, overrides = {}) {
      const desktopId = overrides.desktopId || state.activeDesktopId;
      return {
        id: uid('item'),
        type,
        name: overrides.name || 'Untitled',
        url: overrides.url || '',
        description: overrides.description || '',
        note: overrides.note || '',
        desktopId,
        pinned: Boolean(overrides.pinned),
        order: overrides.order || orderForDesktop(desktopId),
        createdAt: overrides.createdAt || Date.now(),
        updatedAt: Date.now(),
        tags: overrides.tags || [],
        icon: overrides.icon || '',
        iconImage: overrides.iconImage || '',
        pathDisplay: overrides.pathDisplay || '',
        handleKind: overrides.handleKind || '',
        permission: overrides.permission || 'unknown'
      };
    }

    async function addLinkOrNoteItem(data) {
      const item = editingItemId ? state.items.find(i => i.id === editingItemId) : null;
      const payload = editingItemId ? item : baseItem(data.type, { desktopId: data.desktopId });
      Object.assign(payload, {
        type: data.type,
        name: data.name,
        url: data.url,
        description: data.description,
        note: data.type === 'note' ? data.description : '',
        desktopId: data.desktopId,
        pinned: data.pinned,
        tags: data.tags,
        icon: data.icon,
        iconImage: data.iconImage,
        updatedAt: Date.now()
      });

      if (!editingItemId) state.items.push(payload);
      await saveItem(payload);
      render();
      closeDialog(els.itemDialog);
      setStatus(`${payload.name} saved to ${getDesktopName(payload.desktopId)}.`);
      editingItemId = null;
    }

    async function addFileItems() {
      try {
        if (!window.showOpenFilePicker) {
          alert('This browser does not support local file handles. Use Chrome on Chromebook.');
          return;
        }
        const handles = await window.showOpenFilePicker({ multiple: true });
        let added = 0;
        for (const handle of handles) {
          const id = uid('item');
          const item = baseItem('file', {
            name: handle.name,
            desktopId: state.activeDesktopId,
            pathDisplay: handle.name,
            handleKind: 'file',
            permission: await queryPermission(handle)
          });
          item.id = id;
          item.icon = inferIcon(handle.name, 'file');
          state.items.push(item);
          await saveItem(item);
          await saveHandle(id, handle);
          added += 1;
        }
        render();
        setStatus(`Added ${added} local file${added === 1 ? '' : 's'} to ${activeDesktop().name}.`);
      } catch (error) {
        if (error?.name !== 'AbortError') console.error(error);
      }
    }

    async function addFolderItems() {
      try {
        if (!window.showDirectoryPicker) {
          alert('This browser does not support folder handles. Use Chrome on Chromebook.');
          return;
        }
        const handle = await window.showDirectoryPicker();
        const id = uid('item');
        const item = baseItem('folder', {
          name: handle.name,
          desktopId: state.activeDesktopId,
          pathDisplay: handle.name,
          handleKind: 'folder',
          permission: await queryPermission(handle)
        });
        item.id = id;
        item.icon = '📁';
        state.items.push(item);
        await saveItem(item);
        await saveHandle(id, handle);
        render();
        setStatus(`Added folder ${handle.name}.`);
      } catch (error) {
        if (error?.name !== 'AbortError') console.error(error);
      }
    }

    async function launchItem(item) {
      try {
        if (item.type === 'link') {
          if (!item.url) {
            alert('No URL saved for this item yet.');
            return;
          }
          window.open(item.url, '_blank', 'noopener,noreferrer');
          setStatus(`Opened ${item.name}.`);
          return;
        }

        if (item.type === 'note') {
          openItemDialog(item);
          return;
        }

        const handle = await getHandle(item.id);
        if (!handle) {
          alert('This local handle is missing. Re-add the file or folder on this device.');
          return;
        }

        const permission = await ensurePermission(handle, 'read');
        item.permission = permission ? 'granted' : 'denied';
        item.updatedAt = Date.now();
        await saveItem(item);

        if (!permission) {
          setStatus(`Permission denied for ${item.name}.`);
          render();
          return;
        }

        if (item.type === 'file') {
          const file = await handle.getFile();
          const blobUrl = URL.createObjectURL(file);
          window.open(blobUrl, '_blank', 'noopener,noreferrer');
          setStatus(`Opened local file ${item.name}.`);
          return;
        }

        if (item.type === 'folder') {
          const entries = [];
          for await (const entry of handle.values()) {
            entries.push(`${entry.kind === 'directory' ? '📁' : '📄'} ${entry.name}`);
            if (entries.length >= 24) break;
          }
          alert(`Folder: ${item.name}\n\nTop contents:\n${entries.join('\n') || 'Folder is empty or not readable.'}`);
          setStatus(`Reviewed folder ${item.name}.`);
        }
      } catch (error) {
        console.error(error);
        setStatus(`Could not open ${item.name}. Chrome threw a tantrum.`);
      }
    }

    async function queryPermission(handle) {
      if (!handle?.queryPermission) return 'unknown';
      try {
        return await handle.queryPermission({ mode: 'read' });
      } catch {
        return 'unknown';
      }
    }

    async function ensurePermission(handle, mode = 'read') {
      if (!handle?.queryPermission) return true;
      let permission = await handle.queryPermission({ mode });
      if (permission === 'granted') return true;
      if (permission === 'prompt') permission = await handle.requestPermission({ mode });
      return permission === 'granted';
    }


    function decodeBase64Url(value) {
      const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized + '==='.slice((normalized.length + 3) % 4);
      return decodeURIComponent(escape(atob(padded)));
    }

    function encodeSafeUrlValue(raw) {
      return raw.trim();
    }

    function normalizeUrlInput(raw) {
      const value = String(raw || '').trim();
      if (!value) return '';
      if (/^(https?:\/\/|intent:\/\/|chrome:\/\/|file:\/\/|mailto:|tel:|web\+|android-app:\/\/)/i.test(value)) return value;
      if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)) return `https://${value}`;
      return value;
    }

    function deriveNameFromUrl(raw) {
      const value = normalizeUrlInput(raw);
      try {
        const url = new URL(value.startsWith('intent://') ? value.replace('intent://', 'https://') : value);
        return (url.hostname || 'Imported link').replace(/^www\./, '');
      } catch {
        return 'Imported link';
      }
    }

    function parseBulkImportLines(raw, sharedTags = []) {
      return String(raw || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => {
          const parts = line.split('|').map(v => v.trim()).filter(Boolean);
          if (!parts.length) return null;
          if (parts.length === 1) {
            const url = normalizeUrlInput(parts[0]);
            return { name: deriveNameFromUrl(url), url, icon: '🔗', tags: [...sharedTags] };
          }
          const [name, maybeUrl, maybeIcon = '', maybeTags = ''] = parts;
          const url = normalizeUrlInput(maybeUrl || '');
          const icon = maybeIcon && !maybeIcon.includes(',') ? maybeIcon.slice(0, 4) : '🔗';
          const tags = [...sharedTags, ...normalizeTags(maybeTags || (maybeIcon.includes(',') ? maybeIcon : ''))];
          return { name: name || deriveNameFromUrl(url), url, icon, tags };
        })
        .filter(Boolean)
        .filter(item => item.url);
    }

    async function addBatchLinkItems(entries, options = {}) {
      const desktopId = options.desktopId || state.activeDesktopId;
      const pinned = Boolean(options.pinned);
      const sharedTags = Array.isArray(options.sharedTags) ? options.sharedTags : [];
      const existingKeys = new Set(state.items.filter(item => item.type === 'link').map(item => `${item.desktopId}::${normalizeUrlInput(item.url)}`));
      let added = 0;
      let skipped = 0;
      for (const entry of entries) {
        const url = normalizeUrlInput(entry.url || '');
        if (!url) continue;
        const key = `${entry.desktopId || desktopId}::${url}`;
        if (existingKeys.has(key)) {
          skipped += 1;
          continue;
        }
        const item = baseItem('link', {
          desktopId: entry.desktopId || desktopId,
          name: entry.name || deriveNameFromUrl(url),
          url,
          description: entry.description || options.description || 'Imported into ChromeBoard.',
          pinned: entry.pinned ?? pinned,
          tags: [...new Set([...(entry.tags || []), ...sharedTags].filter(Boolean))],
          icon: (entry.icon || '🔗').slice(0, 4),
          iconImage: entry.iconImage || ''
        });
        state.items.push(item);
        await saveItem(item);
        existingKeys.add(key);
        added += 1;
      }
      if (added) render();
      return { added, skipped };
    }

    async function importBatchPayload(payload, sourceLabel = 'batch') {
      const rawItems = Array.isArray(payload?.items) ? payload.items : [];
      if (!rawItems.length) return false;
      const entries = rawItems.map(item => ({
        name: item.name || item.title || deriveNameFromUrl(item.url || ''),
        url: item.url || item.href || '',
        description: item.description || `Imported from ${sourceLabel}.`,
        icon: item.icon || '🚀',
        tags: Array.isArray(item.tags) ? item.tags : normalizeTags(item.tags || sourceLabel),
        pinned: Boolean(item.pinned)
      })).filter(item => item.url);
      const { added, skipped } = await addBatchLinkItems(entries, {
        desktopId: state.activeDesktopId,
        sharedTags: normalizeTags(sourceLabel),
        description: `Imported from ${sourceLabel}.`
      });
      if (added || skipped) {
        setStatus(`Imported ${added} item${added === 1 ? '' : 's'} from ${sourceLabel}${skipped ? `, skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}` : ''}.`);
      }
      return Boolean(added || skipped);
    }

    async function scanFolderIntoBoard() {
      try {
        if (!window.showDirectoryPicker) {
          alert('Folder scanning needs Chrome on Chromebook or another browser with the File System Access API.');
          return;
        }
        const root = await window.showDirectoryPicker();
        let added = 0;
        const limit = 120;
        for await (const entry of root.values()) {
          if (added >= limit) break;
          const id = uid('item');
          const item = baseItem(entry.kind === 'directory' ? 'folder' : 'file', {
            name: entry.name,
            desktopId: state.activeDesktopId,
            pathDisplay: `${root.name}/${entry.name}`,
            handleKind: entry.kind,
            permission: await queryPermission(entry),
            tags: ['scan', root.name]
          });
          item.id = id;
          item.icon = entry.kind === 'directory' ? '📁' : inferIcon(entry.name, 'file');
          state.items.push(item);
          await saveItem(item);
          await saveHandle(id, entry);
          added += 1;
        }
        render();
        setStatus(`Scanned ${root.name} and imported ${added} top-level item${added === 1 ? '' : 's'}.`);
      } catch (error) {
        if (error?.name !== 'AbortError') {
          console.error(error);
          setStatus('Folder scan failed. Chrome threw a small bureaucratic tantrum.');
        }
      }
    }

    async function runBulkImportFromDialog() {
      const text = els.bulkImportTextarea.value;
      const entries = parseBulkImportLines(text, normalizeTags(els.bulkImportTagsInput.value || ''));
      if (!entries.length) {
        alert('Paste at least one valid URL or app link.');
        return;
      }
      const { added, skipped } = await addBatchLinkItems(entries, {
        desktopId: els.bulkImportDesktopInput.value || state.activeDesktopId,
        pinned: els.bulkImportPinnedInput.checked,
        sharedTags: normalizeTags(els.bulkImportTagsInput.value || ''),
        description: 'Imported from the bulk link importer.'
      });
      setStatus(`Bulk import added ${added} item${added === 1 ? '' : 's'}${skipped ? ` and skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}` : ''}.`);
      closeDialog(els.bulkImportDialog);
      els.bulkImportTextarea.value = '';
    }

    function populateBulkImportDesktopSelect() {
      if (!els.bulkImportDesktopInput) return;
      els.bulkImportDesktopInput.innerHTML = state.desktops.map(d => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)}</option>`).join('');
      els.bulkImportDesktopInput.value = state.activeDesktopId;
    }


    async function importClipboardUrl() {
      try {
        if (!navigator.clipboard?.readText) {
          alert('Clipboard read is not available in this browser context.');
          return;
        }
        const raw = (await navigator.clipboard.readText()).trim();
        if (!raw) {
          alert('Clipboard is empty.');
          return;
        }
        const looksUrl = /^(https?:\/\/|intent:\/\/|chrome:\/\/|web\+|mailto:|tel:)/i.test(raw);
        if (!looksUrl) {
          alert('Clipboard does not look like a URL or app link.');
          return;
        }
        const normalized = normalizeUrlInput(raw);
        const fallbackName = deriveNameFromUrl(normalized);
        await addLinkOrNoteItem({
          type: 'link',
          name: fallbackName,
          url: normalized,
          description: 'Imported from clipboard.',
          desktopId: state.activeDesktopId,
          icon: '🔗',
          iconImage: '',
          tags: ['clipboard','imported'],
          pinned: false
        });
      } catch (error) {
        console.error(error);
        alert('Clipboard import failed. Chrome may require a user gesture or permission.');
      }
    }

    async function handleInboundImport() {
      const params = new URLSearchParams(location.search);
      const action = (params.get('cb_action') || '').trim();
      const batchData = params.get('data') || params.get('cb_batch_data') || '';
      if (action === 'batch' && batchData) {
        try {
          const payload = JSON.parse(decodeBase64Url(batchData));
          await importBatchPayload(payload, payload?.meta?.source || 'helper batch');
        } catch (error) {
          console.error(error);
          setStatus('Batch import payload was malformed. Tiny goblin sabotage.');
        }
        const clean = `${location.origin}${location.pathname}${location.hash || ''}`;
        history.replaceState({}, document.title, clean);
        return;
      }

      const isShare = params.has('url') || params.has('text') || action === 'import';
      if (!isShare) return;

      const url = normalizeUrlInput((params.get('url') || '').trim());
      const text = (params.get('text') || '').trim();
      const title = (params.get('title') || params.get('name') || '').trim();
      const description = (params.get('description') || text || 'Imported through the ChromeBoard bridge.').trim();
      const icon = (params.get('icon') || '🚀').trim().slice(0,4) || '🚀';
      const tags = normalizeTags(params.get('tags') || 'imported');
      const pinned = /^(1|true|yes)$/i.test(params.get('pinned') || '');
      const finalName = title || (url ? deriveNameFromUrl(url) : 'Imported item');

      if (!url && !text) return;

      const duplicate = state.items.find(item => item.type === 'link' && normalizeUrlInput(item.url) === url && item.desktopId === state.activeDesktopId);
      if (!duplicate) {
        await addLinkOrNoteItem({
          type: 'link',
          name: finalName,
          url: url || text,
          description,
          desktopId: state.activeDesktopId,
          icon,
          iconImage: '',
          tags,
          pinned
        });
      } else {
        setStatus(`${duplicate.name} is already on this desktop.`);
      }

      const clean = `${location.origin}${location.pathname}${location.hash || ''}`;
      history.replaceState({}, document.title, clean);
    }

    function openDialog(dialog) {
      if (!dialog.open) dialog.showModal();
    }

    function closeDialog(dialog) {
      if (dialog.open) dialog.close();
    }

    function openItemDialog(item = null) {
      editingItemId = item?.id || null;
      const radios = document.querySelectorAll('input[name="itemType"]');
      if (item) {
        els.itemDialogTitle.textContent = `Edit ${item.name}`;
        radios.forEach(r => r.checked = r.value === (item.type === 'note' ? 'note' : 'link'));
        els.itemNameInput.value = item.name || '';
        els.itemUrlInput.value = item.url || '';
        els.itemDescriptionInput.value = item.type === 'note' ? (item.note || item.description || '') : (item.description || '');
        els.itemEmojiInput.value = item.iconImage ? '' : (item.icon || '');
        els.itemTagsInput.value = (item.tags || []).join(', ');
        els.itemPinnedInput.checked = Boolean(item.pinned);
        els.itemDesktopInput.value = item.desktopId || state.activeDesktopId;
      } else {
        els.itemDialogTitle.textContent = 'Add item';
        radios.forEach(r => r.checked = r.value === 'link');
        els.itemNameInput.value = '';
        els.itemUrlInput.value = '';
        els.itemDescriptionInput.value = '';
        els.itemEmojiInput.value = '';
        els.itemTagsInput.value = '';
        els.itemPinnedInput.checked = false;
        els.itemDesktopInput.value = state.activeDesktopId;
        els.itemIconInput.value = '';
      }
      syncItemDialogFields();
      openDialog(els.itemDialog);
    }

    function syncItemDialogFields() {
      const type = document.querySelector('input[name="itemType"]:checked')?.value || 'link';
      els.urlField.style.display = type === 'link' ? 'grid' : 'none';
    }

    async function saveItemDialog() {
      const type = document.querySelector('input[name="itemType"]:checked')?.value || 'link';
      const name = els.itemNameInput.value.trim();
      const url = els.itemUrlInput.value.trim();
      const description = els.itemDescriptionInput.value.trim();
      const desktopId = els.itemDesktopInput.value;
      const icon = els.itemEmojiInput.value.trim();
      const tags = normalizeTags(els.itemTagsInput.value);
      const pinned = els.itemPinnedInput.checked;

      if (!name) {
        alert('Name required. Tiny detail. Massive importance.');
        return;
      }
      if (type === 'link' && !url) {
        alert('URL required for link/app items.');
        return;
      }

      let iconImage = '';
      const existing = editingItemId ? state.items.find(i => i.id === editingItemId) : null;
      if (existing?.iconImage) iconImage = existing.iconImage;
      const file = els.itemIconInput.files?.[0];
      if (file) iconImage = await readFileAsDataUrl(file);

      await addLinkOrNoteItem({
        type,
        name,
        url,
        description,
        desktopId,
        icon,
        iconImage,
        tags,
        pinned
      });
    }

    function openDeskDialog() {
      renderDesktopManager();
      openDialog(els.deskDialog);
    }

    function renderDesktopManager() {
      els.desktopManageList.innerHTML = '';
      state.desktops.forEach(desktop => {
        const count = state.items.filter(item => item.desktopId === desktop.id).length;
        const row = document.createElement('div');
        row.className = 'folder-preview-item';
        row.innerHTML = `
          <div class="inline-row" style="justify-content:space-between;align-items:flex-start;">
            <div>
              <div class="row-title">${escapeHtml(desktop.name)}</div>
              <div class="row-sub">${count} item${count === 1 ? '' : 's'}</div>
            </div>
            <div class="inline-row">
              <button type="button" class="ghost rename">Rename</button>
              ${state.desktops.length > 1 ? '<button type="button" class="danger delete">Delete</button>' : ''}
            </div>
          </div>
        `;
        row.querySelector('.rename').addEventListener('click', async () => {
          const next = prompt('Rename desktop', desktop.name)?.trim();
          if (!next) return;
          desktop.name = next;
          await saveMetaOnly();
          render();
          renderDesktopManager();
        });
        row.querySelector('.delete')?.addEventListener('click', async () => {
          if (!confirm(`Delete desktop ${desktop.name}? Its items will move to ${state.desktops[0].name}.`)) return;
          const fallback = state.desktops.find(d => d.id !== desktop.id);
          state.items.filter(item => item.desktopId === desktop.id).forEach(item => {
            item.desktopId = fallback.id;
            item.updatedAt = Date.now();
            saveItem(item).catch(console.error);
          });
          state.desktops = state.desktops.filter(d => d.id !== desktop.id);
          if (state.activeDesktopId === desktop.id) state.activeDesktopId = fallback.id;
          await saveMetaOnly();
          render();
          renderDesktopManager();
        });
        els.desktopManageList.appendChild(row);
      });
    }

    async function createDesktop() {
      const name = els.newDeskInput.value.trim();
      if (!name) return;
      state.desktops.push({ id: uid('desk'), name, createdAt: Date.now() });
      els.newDeskInput.value = '';
      await saveMetaOnly();
      render();
      renderDesktopManager();
      setStatus(`Desktop ${name} created.`);
    }

    async function renderPermissionsDialog() {
      els.permissionsList.innerHTML = '';
      const handleItems = state.items.filter(item => item.type === 'file' || item.type === 'folder');
      if (!handleItems.length) {
        els.permissionsList.innerHTML = '<div class="helper">No local file or folder handles saved yet.</div>';
        return;
      }
      for (const item of handleItems) {
        const handle = await getHandle(item.id);
        const permission = handle ? await queryPermission(handle) : 'missing';
        item.permission = permission;
        await saveItem(item);
        const row = document.createElement('div');
        row.className = 'permission-item';
        row.innerHTML = `
          <div class="inline-row" style="justify-content:space-between;align-items:flex-start;">
            <div>
              <div class="row-title">${escapeHtml(item.name)}</div>
              <div class="row-sub">${escapeHtml(typeLabel(item.type))} · ${escapeHtml(permission)}</div>
            </div>
            <div class="inline-row">
              <button type="button" class="ghost relink">Re-link</button>
              <button type="button" class="ghost retry">Request permission</button>
            </div>
          </div>
        `;
        row.querySelector('.retry').addEventListener('click', async () => {
          const savedHandle = await getHandle(item.id);
          if (!savedHandle) {
            alert('Handle missing. Re-link it.');
            return;
          }
          const ok = await ensurePermission(savedHandle, item.type === 'folder' ? 'read' : 'readwrite');
          item.permission = ok ? 'granted' : 'denied';
          await saveItem(item);
          await renderPermissionsDialog();
          render();
        });
        row.querySelector('.relink').addEventListener('click', async () => {
          if (item.type === 'file') {
            try {
              const [handleNew] = await window.showOpenFilePicker();
              await saveHandle(item.id, handleNew);
              item.name = handleNew.name;
              item.pathDisplay = handleNew.name;
              item.permission = await queryPermission(handleNew);
              await saveItem(item);
            } catch (error) { if (error?.name !== 'AbortError') console.error(error); }
          } else {
            try {
              const handleNew = await window.showDirectoryPicker();
              await saveHandle(item.id, handleNew);
              item.name = handleNew.name;
              item.pathDisplay = handleNew.name;
              item.permission = await queryPermission(handleNew);
              await saveItem(item);
            } catch (error) { if (error?.name !== 'AbortError') console.error(error); }
          }
          await renderPermissionsDialog();
          render();
        });
        els.permissionsList.appendChild(row);
      }
    }

    function readFileAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    }

    async function exportLayout() {
      const blob = new Blob([JSON.stringify(serializeForExport(), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chromeboard-layout-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Layout exported. File handles stay local and cannot be smuggled through JSON.');
    }

    async function importLayout(file) {
      try {
        const text = await file.text();
        const imported = JSON.parse(text);
        if (!Array.isArray(imported.desktops) || !Array.isArray(imported.items)) {
          throw new Error('Invalid launcher layout file.');
        }
        state.desktops = imported.desktops.length ? imported.desktops : structuredClone(defaultState.desktops);
        await clearAllData();
        state.items = imported.items.map((item, index) => ({
          ...baseItem(item.type || 'link', { desktopId: item.desktopId || state.desktops[0].id }),
          ...item,
          order: item.order || index + 1,
          tags: Array.isArray(item.tags) ? item.tags : [],
          pinned: Boolean(item.pinned)
        }));
        state.wallpaperDataUrl = imported.wallpaperDataUrl || '';
        state.activeDesktopId = imported.activeDesktopId && state.desktops.some(d => d.id === imported.activeDesktopId)
          ? imported.activeDesktopId
          : state.desktops[0].id;
        await saveMetaOnly();
        for (const item of state.items) await saveItem(item);
        setWallpaper(state.wallpaperDataUrl);
        render();
        setStatus('Layout imported. Re-add local files and folders if they came from another device.');
      } catch (error) {
        console.error(error);
        alert('Could not import that layout file.');
      }
    }

    async function clearCurrentDesktop() {
      const desk = activeDesktop();
      if (!confirm(`Clear all items from ${desk.name}?`)) return;
      const ids = state.items.filter(item => item.desktopId === desk.id).map(item => item.id);
      state.items = state.items.filter(item => item.desktopId !== desk.id);
      for (const id of ids) await deleteItemById(id);
      render();
      setStatus(`${desk.name} cleared.`);
    }

    async function openPinnedLinks() {
      const items = state.items.filter(item => item.pinned && item.type === 'link');
      if (!items.length) {
        setStatus('No pinned links to open yet.');
        return;
      }
      items.slice(0, 8).forEach(item => window.open(item.url, '_blank', 'noopener,noreferrer'));
      setStatus(`Opened ${Math.min(items.length, 8)} pinned link${items.length === 1 ? '' : 's'}.`);
    }

    function escapeHtml(str) {
      return String(str ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
    }

    function bindEvents() {
      document.getElementById('addItemBtn').addEventListener('click', () => openItemDialog());
      document.getElementById('quickSetupBtn')?.addEventListener('click', () => openDialog(els.quickSetupDialog));
      document.getElementById('openQuickSetupBtn')?.addEventListener('click', () => openDialog(els.quickSetupDialog));
      document.getElementById('addLinkItemBtn').addEventListener('click', () => openItemDialog());
      document.getElementById('addNoteItemBtn').addEventListener('click', () => {
        openItemDialog();
        document.querySelector('input[name="itemType"][value="note"]').checked = true;
        syncItemDialogFields();
      });
      document.getElementById('addLocalFileBtn').addEventListener('click', addFileItems);
      document.getElementById('addLocalFolderBtn').addEventListener('click', addFolderItems);
      document.getElementById('scanFolderBtn')?.addEventListener('click', scanFolderIntoBoard);
      document.getElementById('scanFolderBridgeBtn')?.addEventListener('click', scanFolderIntoBoard);
      document.getElementById('bulkImportBtn')?.addEventListener('click', () => openDialog(els.bulkImportDialog));
      document.getElementById('openBulkImportDialogBtn')?.addEventListener('click', () => openDialog(els.bulkImportDialog));
      document.getElementById('quickWallpaperBtn').addEventListener('click', () => els.wallpaperInput.click());
      document.getElementById('setWallpaperBtn').addEventListener('click', () => els.wallpaperInput.click());
      document.getElementById('addDeskBtn').addEventListener('click', openDeskDialog);
      document.getElementById('manageDesksBtn').addEventListener('click', openDeskDialog);
      document.getElementById('openPermissionsBtn').addEventListener('click', async () => { await renderPermissionsDialog(); openDialog(els.permissionsDialog); });
      document.getElementById('recheckPermissionsBtn').addEventListener('click', async () => { await renderPermissionsDialog(); openDialog(els.permissionsDialog); });
      document.getElementById('openImportExportBtn').addEventListener('click', () => openDialog(els.importExportDialog));
      document.getElementById('importBtn').addEventListener('click', () => els.importFileInput.click());
      document.getElementById('exportBtn').addEventListener('click', exportLayout);
      document.getElementById('importClipboardBtn')?.addEventListener('click', importClipboardUrl);
      document.getElementById('importClipboardBtnToolbar')?.addEventListener('click', importClipboardUrl);
      document.getElementById('importClipboardBtnSettings')?.addEventListener('click', importClipboardUrl);
      document.getElementById('openImportHelperInfoBtn')?.addEventListener('click', () => openDialog(els.importHelperDialog));
      document.getElementById('closeImportHelperDialogBtn')?.addEventListener('click', () => closeDialog(els.importHelperDialog));
      document.getElementById('closeQuickSetupDialogBtn')?.addEventListener('click', () => closeDialog(els.quickSetupDialog));
      document.getElementById('quickScanFolderBtn')?.addEventListener('click', async () => { closeDialog(els.quickSetupDialog); await scanFolderIntoBoard(); });
      document.getElementById('quickBulkImportBtn')?.addEventListener('click', () => { closeDialog(els.quickSetupDialog); openDialog(els.bulkImportDialog); });
      document.getElementById('openImportHelperFromQuickBtn')?.addEventListener('click', () => { closeDialog(els.quickSetupDialog); openDialog(els.importHelperDialog); });
      document.getElementById('quickClipboardBtn')?.addEventListener('click', async () => { closeDialog(els.quickSetupDialog); await importClipboardUrl(); });
      document.getElementById('closeBulkImportDialogBtn')?.addEventListener('click', () => closeDialog(els.bulkImportDialog));
      document.getElementById('cancelBulkImportBtn')?.addEventListener('click', () => closeDialog(els.bulkImportDialog));
      document.getElementById('runBulkImportBtn')?.addEventListener('click', runBulkImportFromDialog);
      document.getElementById('sampleBulkImportBtn')?.addEventListener('click', () => {
        els.bulkImportTextarea.value = `Gmail | mail.google.com | ✉️ | email,google
Drive | drive.google.com | ☁️ | docs,google
ChromeBoard | https://your-chromeboard-site.example | 🧠 | launcher,home`;
      });
      document.getElementById('copyShareHintBtn')?.addEventListener('click', async () => {
        try {
          const hint = 'Install ChromeBoard, then use Chrome share surfaces or the ChromeBoard Import Helper extension to throw links into it.';
          await navigator.clipboard.writeText(hint);
          setStatus('Copied bridge hint to clipboard.');
        } catch {
          setStatus('Installed ChromeBoard can receive shared links and helper imports.');
        }
      });
      document.getElementById('exportLayoutBtn').addEventListener('click', exportLayout);
      document.getElementById('importLayoutBtn').addEventListener('click', () => els.importFileInput.click());
      document.getElementById('clearDesktopBtn').addEventListener('click', clearCurrentDesktop);
      document.getElementById('openPinnedAllBtn').addEventListener('click', openPinnedLinks);

      document.querySelectorAll('input[name="itemType"]').forEach(radio => radio.addEventListener('change', syncItemDialogFields));
      document.getElementById('saveItemDialogBtn').addEventListener('click', saveItemDialog);
      document.getElementById('cancelItemDialogBtn').addEventListener('click', () => { editingItemId = null; closeDialog(els.itemDialog); });
      document.getElementById('closeItemDialogBtn').addEventListener('click', () => { editingItemId = null; closeDialog(els.itemDialog); });
      document.getElementById('closeDeskDialogBtn').addEventListener('click', () => closeDialog(els.deskDialog));
      document.getElementById('createDeskBtn').addEventListener('click', createDesktop);
      document.getElementById('closePermissionsDialogBtn').addEventListener('click', () => closeDialog(els.permissionsDialog));
      document.getElementById('closeImportExportDialogBtn').addEventListener('click', () => closeDialog(els.importExportDialog));

      els.searchInput.addEventListener('input', renderDesktopGrid);
      els.filterType.addEventListener('change', renderDesktopGrid);
      els.sortMode.addEventListener('change', renderDesktopGrid);

      els.importFileInput.addEventListener('change', async event => {
        const file = event.target.files?.[0];
        if (file) await importLayout(file);
        event.target.value = '';
      });

      els.wallpaperInput.addEventListener('change', async event => {
        const file = event.target.files?.[0];
        if (file) {
          const dataUrl = await readFileAsDataUrl(file);
          setWallpaper(dataUrl);
          setStatus('Wallpaper updated. Semi-home-screen vibes improved.');
        }
        event.target.value = '';
      });
    }

    function setupPwaInstall() {
      window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        deferredPrompt = event;
        els.installBtn.hidden = false;
      });
      els.installBtn.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        deferredPrompt = null;
        els.installBtn.hidden = true;
      });
      window.addEventListener('appinstalled', () => {
        els.installBtn.hidden = true;
        setStatus('ChromeBoard installed. Pin the app and use it like your fake desktop.');
      });
    }

    async function bootstrap() {
      cacheEls();
      db = await openDb();
      state = await loadState();
      bindEvents();
      setupPwaInstall();
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(console.error);
      }
      if (state.wallpaperDataUrl) setWallpaper(state.wallpaperDataUrl);
      render();
      await handleInboundImport();
    }

    bootstrap().catch(error => {
      console.error(error);
      alert('ChromeBoard failed to boot. The browser gremlins won this round.');
    });
  