const STORAGE_KEY = 'sovereign-primitives-standalone-v1';
const ITERATIONS = 120000;
const VERSION = 'skye-capsule-v1';

const defaultZones = [
  {
    id: 'CROWN',
    label: 'Crown Files',
    description: 'Files never exposed to AI or public release.',
    rules: { ai_read: false, ai_summarize: false, ai_rewrite: false, ai_delete: false, export: false, publish: false, release: false, deploy: false, backup: true, share: false, human_edit: true }
  },
  {
    id: 'RESTRICTED',
    label: 'Restricted',
    description: 'Summaries allowed, rewrites and public release blocked.',
    rules: { ai_read: true, ai_summarize: true, ai_rewrite: false, ai_delete: false, export: true, publish: false, release: false, deploy: false, backup: true, share: false, human_edit: true }
  },
  {
    id: 'OPERATOR_ONLY',
    label: 'Operator Only',
    description: 'Humans can edit. AI cannot touch it.',
    rules: { ai_read: false, ai_summarize: false, ai_rewrite: false, ai_delete: false, export: true, publish: false, release: false, deploy: false, backup: true, share: false, human_edit: true }
  },
  {
    id: 'BRAIN_SAFE',
    label: 'Brain Safe',
    description: 'Approved for AI context and release when sealed.',
    rules: { ai_read: true, ai_summarize: true, ai_rewrite: true, ai_delete: false, export: true, publish: true, release: true, deploy: true, backup: true, share: true, human_edit: true }
  },
  {
    id: 'EXPORT_BLOCKED',
    label: 'Export Blocked',
    description: 'Can stay in workspace but cannot leave the workspace boundary.',
    rules: { ai_read: true, ai_summarize: true, ai_rewrite: false, ai_delete: false, export: false, publish: false, release: false, deploy: false, backup: true, share: false, human_edit: true }
  },
  {
    id: 'PUBLIC_RELEASE',
    label: 'Public Release',
    description: 'Open for export, publish, release, and deployment when sealed.',
    rules: { ai_read: true, ai_summarize: true, ai_rewrite: true, ai_delete: false, export: true, publish: true, release: true, deploy: true, backup: true, share: true, human_edit: true }
  }
];

let state = loadState();
let importedCapsulePayload = null;

function seedDefaults() {
  return {
    zones: structuredClone(defaultZones),
    objects: [
      {
        id: crypto.randomUUID(),
        name: 'Founder Blueprint',
        type: 'document',
        zoneId: 'CROWN',
        mime: 'text/plain',
        binary: false,
        textContent: 'This is a crown-level founder blueprint. AI cannot access it.',
        createdAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        name: 'AI-Safe Spec Notes',
        type: 'document',
        zoneId: 'BRAIN_SAFE',
        mime: 'text/plain',
        binary: false,
        textContent: 'These notes are approved for AI summarization and rewrite.',
        createdAt: new Date().toISOString()
      }
    ],
    decisions: [],
    capsules: [],
    seals: [],
    keys: null
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedDefaults();
    const parsed = JSON.parse(raw);
    return {
      zones: parsed.zones?.length ? parsed.zones : structuredClone(defaultZones),
      objects: parsed.objects || [],
      decisions: parsed.decisions || [],
      capsules: parsed.capsules || [],
      seals: parsed.seals || [],
      keys: parsed.keys || null
    };
  } catch {
    return seedDefaults();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function $(id) {
  return document.getElementById(id);
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function escapeHtml(str = '') {
  return str.replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}

function zoneById(zoneId) {
  return state.zones.find((zone) => zone.id === zoneId);
}

function objectById(objectId) {
  return state.objects.find((obj) => obj.id === objectId);
}

function hashHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function sha256Object(obj) {
  const canonical = JSON.stringify(obj, Object.keys(obj).sort());
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return `sha256:${hashHex(buffer)}`;
}

async function deriveAesKey(passphrase, saltBytes) {
  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptJson(payload, passphrase) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveAesKey(passphrase, salt);
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return {
    alg: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: ITERATIONS,
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(cipher)
  };
}

async function decryptJson(envelope, passphrase) {
  const salt = new Uint8Array(base64ToBuffer(envelope.salt));
  const iv = new Uint8Array(base64ToBuffer(envelope.iv));
  const cipher = base64ToBuffer(envelope.ciphertext);
  const key = await deriveAesKey(passphrase, salt);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return JSON.parse(new TextDecoder().decode(plain));
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function logDecision(entry) {
  state.decisions.unshift({
    decisionId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...entry
  });
  state.decisions = state.decisions.slice(0, 300);
  saveState();
  renderLedger();
  renderStats();
}

function defaultCapabilityDecision(subject, action, zone) {
  const rules = zone?.rules || {};
  const operatorActions = new Set(['human_edit', 'export', 'share', 'release', 'deploy', 'publish']);
  if (subject === 'operator') {
    if (action === 'human_edit') return { allowed: !!rules.human_edit, reason: rules.human_edit ? 'Operator human edit allowed by zone.' : 'Human edit blocked by zone.' };
    if (operatorActions.has(action)) {
      const allowed = !!rules[action];
      return { allowed, reason: allowed ? `Operator ${action} allowed by zone.` : `Operator ${action} blocked by zone.` };
    }
  }
  const allowed = !!rules[action];
  const reason = allowed
    ? `${subject} may perform ${action} in zone ${zone?.id || 'UNLABELED'}.`
    : `${subject} is blocked from ${action} in zone ${zone?.id || 'UNLABELED'}.`;
  return { allowed, reason };
}

function evaluateAction(subject, action, obj, notes = '') {
  const zone = zoneById(obj.zoneId);
  const decision = defaultCapabilityDecision(subject, action, zone);
  logDecision({
    type: 'action_decision',
    subject,
    action,
    objectId: obj.id,
    objectName: obj.name,
    zoneId: obj.zoneId,
    allowed: decision.allowed,
    reason: decision.reason,
    notes
  });
  return { ...decision, zone };
}

async function generateSigningKeys() {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
  );
  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  state.keys = { publicJwk, privateJwk, createdAt: new Date().toISOString() };
  saveState();
}

async function importPrivateKey(jwk) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
}

async function importPublicKey(jwk) {
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
}

async function signManifest(payload) {
  if (!state.keys?.privateJwk) throw new Error('No signing key available.');
  const privateKey = await importPrivateKey(state.keys.privateJwk);
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, encoded);
  return bufferToBase64(sig);
}

async function verifyManifest(payload, signature, publicJwk = state.keys?.publicJwk) {
  if (!publicJwk) throw new Error('No public key available.');
  const publicKey = await importPublicKey(publicJwk);
  const encoded = new TextEncoder().encode(JSON.stringify(payload));
  return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, base64ToBuffer(signature), encoded);
}

function renderStats() {
  const stats = [
    ['Zones', state.zones.length],
    ['Objects', state.objects.length],
    ['Decisions', state.decisions.length],
    ['Capsules', state.capsules.length],
    ['Seals', state.seals.length],
    ['kAIxU-safe', state.objects.filter((obj) => obj.zoneId === 'BRAIN_SAFE').length]
  ];
  const host = $('statsBar');
  host.innerHTML = '';
  const tpl = $('statTemplate');
  for (const [label, value] of stats) {
    const node = tpl.content.cloneNode(true);
    node.querySelector('.stat-label').textContent = label;
    node.querySelector('.stat-value').textContent = value;
    host.appendChild(node);
  }
}

function renderZoneSelects() {
  const ids = ['objectZone', 'importZone', 'capsuleZone'];
  for (const id of ids) {
    const sel = $(id);
    if (!sel) continue;
    const current = sel.value;
    sel.innerHTML = state.zones.map((zone) => `<option value="${zone.id}">${zone.id} · ${escapeHtml(zone.label)}</option>`).join('');
    if (state.zones.some((zone) => zone.id === current)) sel.value = current;
  }
}

function renderObjectOptions() {
  const guardrailSelect = $('guardrailObject');
  guardrailSelect.innerHTML = state.objects.map((obj) => `<option value="${obj.id}">${escapeHtml(obj.name)} · ${obj.zoneId}</option>`).join('');

  const capsuleChecklist = $('capsuleObjectChecklist');
  const sealChecklist = $('sealObjectChecklist');
  const markup = state.objects.length
    ? state.objects.map((obj) => `
        <label>
          <input type="checkbox" value="${obj.id}" />
          <span><strong>${escapeHtml(obj.name)}</strong><br><small class="muted">${escapeHtml(obj.type)} · ${obj.zoneId}</small></span>
        </label>`).join('')
    : '<p class="muted">No objects yet.</p>';
  capsuleChecklist.innerHTML = markup;
  sealChecklist.innerHTML = markup;
}

function renderZones() {
  renderZoneSelects();
  const host = $('zoneList');
  host.innerHTML = state.zones.map((zone) => {
    const rules = Object.entries(zone.rules).map(([key, value]) => `<span class="badge ${value ? 'green' : 'red'}">${key.replace('_', ' ')}: ${value ? 'on' : 'off'}</span>`).join(' ');
    return `
      <article class="item">
        <h4>${escapeHtml(zone.id)} · ${escapeHtml(zone.label)}</h4>
        <p class="muted">${escapeHtml(zone.description || '')}</p>
        <div class="meta">${rules}</div>
        <div class="small-actions">
          <button class="btn btn-ghost" data-zone-edit="${zone.id}">Edit</button>
          ${defaultZones.some((z) => z.id === zone.id) ? '' : `<button class="btn btn-ghost" data-zone-delete="${zone.id}">Delete</button>`}
        </div>
      </article>`;
  }).join('');
}

function renderObjects() {
  renderObjectOptions();
  const host = $('objectList');
  host.innerHTML = state.objects.map((obj) => {
    const preview = obj.binary
      ? `[binary ${obj.mime || 'application/octet-stream'} · ${Math.round((obj.binaryBase64?.length || 0) * 0.75)} bytes]`
      : (obj.textContent || '').slice(0, 220);
    return `
      <article class="item">
        <h4>${escapeHtml(obj.name)}</h4>
        <div class="meta">
          <span class="badge gold">${escapeHtml(obj.zoneId)}</span>
          <span class="badge">${escapeHtml(obj.type)}</span>
          <span>${formatDate(obj.createdAt)}</span>
        </div>
        <p class="muted code">${escapeHtml(preview)}</p>
        <div class="small-actions">
          <button class="btn btn-ghost" data-object-export="${obj.id}">Export .skye-object</button>
          <button class="btn btn-ghost" data-object-delete="${obj.id}">Delete</button>
        </div>
      </article>`;
  }).join('');
}

function renderCapabilityMatrix() {
  const actions = ['ai_read', 'ai_summarize', 'ai_rewrite', 'ai_delete', 'export', 'publish', 'release', 'deploy', 'share', 'human_edit'];
  const host = $('capabilityMatrix');
  host.innerHTML = state.zones.map((zone) => {
    const rows = actions.map((action) => `<tr><td>${action}</td><td>${zone.rules[action] ? 'Allowed' : 'Blocked'}</td></tr>`).join('');
    return `
      <div class="item">
        <h4>${escapeHtml(zone.id)} · ${escapeHtml(zone.label)}</h4>
        <table class="matrix-table">
          <thead><tr><th>Action</th><th>Default</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }).join('');
}

function renderLedger() {
  $('decisionLedger').innerHTML = state.decisions.length ? state.decisions.map((entry) => `
    <article class="item">
      <h4>${entry.allowed ? 'ALLOW' : 'BLOCK'} · ${escapeHtml(entry.action || entry.type)}</h4>
      <div class="meta">
        <span class="badge ${entry.allowed ? 'green' : 'red'}">${entry.subject || entry.type}</span>
        <span class="badge gold">${escapeHtml(entry.zoneId || 'NA')}</span>
        <span>${formatDate(entry.createdAt)}</span>
      </div>
      <p class="muted">${escapeHtml(entry.objectName || entry.notes || '')}</p>
      <p>${escapeHtml(entry.reason || '')}</p>
    </article>`).join('') : '<p class="muted">No decisions logged yet.</p>';

  const capsuleHistory = state.capsules.map((capsule) => ({ type: 'capsule', title: capsule.manifest.name, time: capsule.createdAt, text: `${capsule.manifest.objectCount} objects · ${capsule.manifest.zoneId}` }));
  const seals = state.seals.map((seal) => ({ type: 'seal', title: seal.manifest.target, time: seal.createdAt, text: `${seal.manifest.included.length} included · ${seal.manifest.blocked.length} blocked` }));
  const entries = [...capsuleHistory, ...seals].sort((a, b) => new Date(b.time) - new Date(a.time));
  $('capsuleSealLedger').innerHTML = entries.length ? entries.map((entry) => `
    <article class="item">
      <h4>${escapeHtml(entry.type.toUpperCase())} · ${escapeHtml(entry.title)}</h4>
      <div class="meta"><span>${formatDate(entry.time)}</span></div>
      <p>${escapeHtml(entry.text)}</p>
    </article>`).join('') : '<p class="muted">No capsule or seal events yet.</p>';
}

function renderSigningStatus() {
  const host = $('signingStatus');
  if (!state.keys?.publicJwk) {
    host.innerHTML = '<p>No signing keypair generated yet.</p>';
    return;
  }
  host.innerHTML = `<p>Local ECDSA P-256 keypair ready.</p><p class="muted">Created ${formatDate(state.keys.createdAt)}</p>`;
}

function renderAll() {
  renderStats();
  renderZones();
  renderObjects();
  renderCapabilityMatrix();
  renderLedger();
  renderSigningStatus();
}

function clearZoneForm() {
  $('zoneEditId').value = '';
  $('zoneId').value = '';
  $('zoneId').disabled = false;
  $('zoneLabel').value = '';
  $('zoneDescription').value = '';
  const map = {
    ruleAiRead: false, ruleAiSummarize: false, ruleAiRewrite: false, ruleAiDelete: false,
    ruleExport: false, rulePublish: false, ruleRelease: false, ruleDeploy: false, ruleBackup: true, ruleShare: false, ruleHumanEdit: true
  };
  Object.entries(map).forEach(([id, value]) => ($(id).checked = value));
}

function fillZoneForm(zone) {
  $('zoneEditId').value = zone.id;
  $('zoneId').value = zone.id;
  $('zoneId').disabled = true;
  $('zoneLabel').value = zone.label;
  $('zoneDescription').value = zone.description || '';
  $('ruleAiRead').checked = !!zone.rules.ai_read;
  $('ruleAiSummarize').checked = !!zone.rules.ai_summarize;
  $('ruleAiRewrite').checked = !!zone.rules.ai_rewrite;
  $('ruleAiDelete').checked = !!zone.rules.ai_delete;
  $('ruleExport').checked = !!zone.rules.export;
  $('rulePublish').checked = !!zone.rules.publish;
  $('ruleRelease').checked = !!zone.rules.release;
  $('ruleDeploy').checked = !!zone.rules.deploy;
  $('ruleBackup').checked = !!zone.rules.backup;
  $('ruleShare').checked = !!zone.rules.share;
  $('ruleHumanEdit').checked = !!zone.rules.human_edit;
}

function getSelectedCheckboxValues(containerId) {
  return [...$(containerId).querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
}

async function exportSingleObjectAsCapsule(obj) {
  const passphrase = prompt(`Enter passphrase for ${obj.name}`);
  if (!passphrase) return;
  const payload = {
    objects: [{ ...obj }],
    exportedAt: new Date().toISOString(),
    mode: 'single-object'
  };
  const envelope = await encryptJson(payload, passphrase);
  const manifest = {
    version: VERSION,
    name: `${obj.name}-object-export`,
    capsuleId: crypto.randomUUID(),
    objectCount: 1,
    zoneId: obj.zoneId,
    createdAt: new Date().toISOString(),
    hash: await sha256Object({ payload, zoneId: obj.zoneId, name: obj.name })
  };
  downloadJson(`${obj.name.replace(/\s+/g, '-').toLowerCase()}.skye-object.json`, { manifest, envelope });
}

async function handleFileImport(files, zoneId) {
  const imported = [];
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const isText = file.type.startsWith('text/') || /\.(txt|md|json|html|css|js|ts|tsx|csv)$/i.test(file.name);
    imported.push({
      id: crypto.randomUUID(),
      name: file.name,
      type: 'file',
      zoneId,
      mime: file.type || 'application/octet-stream',
      binary: !isText,
      textContent: isText ? new TextDecoder().decode(arrayBuffer) : '',
      binaryBase64: !isText ? bufferToBase64(arrayBuffer) : null,
      createdAt: new Date().toISOString()
    });
  }
  state.objects.unshift(...imported);
  saveState();
  renderAll();
}

function initTabs() {
  $('#tabs').addEventListener('click', (event) => {
    const tab = event.target.closest('.tab');
    if (!tab) return;
    const panel = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach((node) => node.classList.toggle('active', node === tab));
    document.querySelectorAll('.panel').forEach((node) => node.classList.toggle('active', node.dataset.panel === panel));
  });
}

function initZoneForm() {
  $('zoneForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const id = $('zoneEditId').value || $('zoneId').value.trim().toUpperCase();
    const zone = {
      id,
      label: $('zoneLabel').value.trim(),
      description: $('zoneDescription').value.trim(),
      rules: {
        ai_read: $('ruleAiRead').checked,
        ai_summarize: $('ruleAiSummarize').checked,
        ai_rewrite: $('ruleAiRewrite').checked,
        ai_delete: $('ruleAiDelete').checked,
        export: $('ruleExport').checked,
        publish: $('rulePublish').checked,
        release: $('ruleRelease').checked,
        deploy: $('ruleDeploy').checked,
        backup: $('ruleBackup').checked,
        share: $('ruleShare').checked,
        human_edit: $('ruleHumanEdit').checked
      }
    };
    const idx = state.zones.findIndex((entry) => entry.id === id);
    if (idx >= 0) state.zones[idx] = zone;
    else state.zones.push(zone);
    saveState();
    clearZoneForm();
    renderAll();
  });

  $('cancelZoneEditBtn').addEventListener('click', clearZoneForm);

  $('zoneList').addEventListener('click', (event) => {
    const editId = event.target.dataset.zoneEdit;
    const deleteId = event.target.dataset.zoneDelete;
    if (editId) fillZoneForm(zoneById(editId));
    if (deleteId) {
      state.zones = state.zones.filter((zone) => zone.id !== deleteId);
      state.objects = state.objects.map((obj) => obj.zoneId === deleteId ? { ...obj, zoneId: 'RESTRICTED' } : obj);
      saveState();
      renderAll();
    }
  });
}

function initObjectForm() {
  $('objectForm').addEventListener('submit', (event) => {
    event.preventDefault();
    state.objects.unshift({
      id: crypto.randomUUID(),
      name: $('objectName').value.trim(),
      type: $('objectType').value.trim(),
      zoneId: $('objectZone').value,
      mime: 'text/plain',
      binary: false,
      textContent: $('objectContent').value,
      createdAt: new Date().toISOString()
    });
    saveState();
    event.target.reset();
    renderAll();
  });

  $('objectFileInput').addEventListener('change', async (event) => {
    if (!event.target.files?.length) return;
    await handleFileImport([...event.target.files], $('importZone').value);
    event.target.value = '';
  });

  $('objectList').addEventListener('click', async (event) => {
    const deleteId = event.target.dataset.objectDelete;
    const exportId = event.target.dataset.objectExport;
    if (deleteId) {
      state.objects = state.objects.filter((obj) => obj.id !== deleteId);
      saveState();
      renderAll();
    }
    if (exportId) {
      const obj = objectById(exportId);
      if (obj) await exportSingleObjectAsCapsule(obj);
    }
  });
}

function initGuardrails() {
  $('guardrailForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const obj = objectById($('guardrailObject').value);
    const subject = $('guardrailSubject').value;
    const action = $('guardrailAction').value;
    const notes = $('guardrailEvidence').value.trim();
    const result = evaluateAction(subject, action, obj, notes);
    $('guardrailResult').innerHTML = `
      <p><strong>${result.allowed ? 'ALLOWED' : 'BLOCKED'}</strong></p>
      <p>Object: <strong>${escapeHtml(obj.name)}</strong></p>
      <p>Zone: <strong>${escapeHtml(result.zone.id)}</strong></p>
      <p>${escapeHtml(result.reason)}</p>
    `;
  });
}

function initCapsules() {
  $('capsuleForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const ids = getSelectedCheckboxValues('capsuleObjectChecklist');
    if (!ids.length) {
      alert('Select at least one object for the capsule.');
      return;
    }
    const passphrase = $('capsulePassphrase').value;
    const confirm = $('capsulePassphraseConfirm').value;
    if (passphrase !== confirm) {
      alert('Passphrases do not match.');
      return;
    }
    const objects = ids.map(objectById);
    const manifest = {
      version: VERSION,
      capsuleId: crypto.randomUUID(),
      name: $('capsuleName').value.trim(),
      zoneId: $('capsuleZone').value,
      objectCount: objects.length,
      objectIds: ids,
      createdAt: new Date().toISOString()
    };
    const payload = { objects, exportedAt: new Date().toISOString(), manifest };
    manifest.hash = await sha256Object(payload);
    const envelope = await encryptJson(payload, passphrase);
    const capsule = { manifest, envelope, createdAt: new Date().toISOString() };
    state.capsules.unshift(capsule);
    saveState();
    downloadJson(`${manifest.name.replace(/\s+/g, '-').toLowerCase()}.skycap.json`, capsule);
    renderAll();
    event.target.reset();
  });

  $('capsuleImportInput').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    importedCapsulePayload = JSON.parse(text);
    $('capsuleImportResult').innerHTML = `<p>Loaded capsule <strong>${escapeHtml(importedCapsulePayload.manifest?.name || file.name)}</strong>. Ready to decrypt.</p>`;
    $('capsuleImportObjectsBtn').disabled = true;
  });

  $('capsuleDecryptBtn').addEventListener('click', async () => {
    if (!importedCapsulePayload) {
      alert('Load a capsule file first.');
      return;
    }
    try {
      const payload = await decryptJson(importedCapsulePayload.envelope, $('capsuleImportPassphrase').value);
      importedCapsulePayload.decryptedPayload = payload;
      $('capsuleImportObjectsBtn').disabled = false;
      $('capsuleImportResult').innerHTML = `
        <p><strong>Decryption successful.</strong></p>
        <p>Objects inside: ${payload.objects.length}</p>
        <pre>${escapeHtml(JSON.stringify(payload.manifest || importedCapsulePayload.manifest, null, 2))}</pre>`;
    } catch (error) {
      $('capsuleImportResult').innerHTML = `<p><strong>Decryption failed.</strong></p><p>${escapeHtml(error.message)}</p>`;
      $('capsuleImportObjectsBtn').disabled = true;
    }
  });

  $('capsuleImportObjectsBtn').addEventListener('click', () => {
    if (!importedCapsulePayload?.decryptedPayload?.objects) return;
    const imported = importedCapsulePayload.decryptedPayload.objects.map((obj) => ({ ...obj, id: crypto.randomUUID(), importedAt: new Date().toISOString() }));
    state.objects.unshift(...imported);
    saveState();
    renderAll();
    $('capsuleImportResult').innerHTML += '<p><strong>Objects imported into local registry.</strong></p>';
  });
}

function initSignSeal() {
  $('generateKeypairBtn').addEventListener('click', async () => {
    await generateSigningKeys();
    renderSigningStatus();
  });

  $('exportPublicKeyBtn').addEventListener('click', () => {
    if (!state.keys?.publicJwk) {
      alert('Generate a keypair first.');
      return;
    }
    downloadJson('skye-public-key.json', { createdAt: state.keys.createdAt, publicJwk: state.keys.publicJwk });
  });

  $('sealForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!state.keys?.privateJwk) {
      alert('Generate a signing keypair first.');
      return;
    }
    const ids = getSelectedCheckboxValues('sealObjectChecklist');
    if (!ids.length) {
      alert('Select objects to seal.');
      return;
    }
    const target = $('sealTarget').value;
    const included = [];
    const blocked = [];
    for (const id of ids) {
      const obj = objectById(id);
      const result = evaluateAction('deploy_worker', target === 'public_release' ? 'release' : (target === 'netlify_deploy' ? 'deploy' : 'export'), obj, `seal-preview:${target}`);
      if (result.allowed) included.push({ id: obj.id, name: obj.name, zoneId: obj.zoneId });
      else blocked.push({ id: obj.id, name: obj.name, zoneId: obj.zoneId, reason: result.reason });
    }
    const manifest = {
      sealId: crypto.randomUUID(),
      target,
      operator: $('sealOperator').value.trim() || 'operator',
      operatorApproved: $('sealOperatorApproved').checked,
      included,
      blocked,
      createdAt: new Date().toISOString(),
      policyResult: blocked.length ? 'approved_with_blocks' : 'approved'
    };
    manifest.hash = await sha256Object(manifest);
    const signature = await signManifest(manifest);
    const seal = { manifest, signature, publicJwk: state.keys.publicJwk, createdAt: new Date().toISOString() };
    state.seals.unshift(seal);
    saveState();
    renderAll();
    $('sealResult').innerHTML = `
      <p><strong>Release seal signed.</strong></p>
      <p>Target: ${escapeHtml(target)}</p>
      <p>Included: ${included.length}</p>
      <p>Blocked: ${blocked.length}</p>
      <pre>${escapeHtml(JSON.stringify(seal, null, 2))}</pre>`;
    downloadJson(`release-seal-${target}.json`, seal);
  });

  $('verifyLatestSealBtn').addEventListener('click', async () => {
    const seal = state.seals[0];
    if (!seal) {
      alert('No seal available.');
      return;
    }
    const ok = await verifyManifest(seal.manifest, seal.signature, seal.publicJwk);
    $('sealResult').innerHTML += `<p><strong>${ok ? 'Verification passed.' : 'Verification failed.'}</strong></p>`;
  });
}

function initStateTools() {
  $('seedDefaultsBtn').addEventListener('click', () => {
    if (!confirm('Reset the console to seeded defaults?')) return;
    state = seedDefaults();
    saveState();
    importedCapsulePayload = null;
    clearZoneForm();
    renderAll();
  });

  $('exportStateBtn').addEventListener('click', () => {
    downloadJson('sovereign-primitives-state.json', state);
  });

  $('importStateInput').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const parsed = JSON.parse(await file.text());
    state = {
      zones: parsed.zones || structuredClone(defaultZones),
      objects: parsed.objects || [],
      decisions: parsed.decisions || [],
      capsules: parsed.capsules || [],
      seals: parsed.seals || [],
      keys: parsed.keys || null
    };
    saveState();
    renderAll();
  });
}

function init() {
  initTabs();
  initZoneForm();
  initObjectForm();
  initGuardrails();
  initCapsules();
  initSignSeal();
  initStateTools();
  clearZoneForm();
  renderAll();
}

init();
