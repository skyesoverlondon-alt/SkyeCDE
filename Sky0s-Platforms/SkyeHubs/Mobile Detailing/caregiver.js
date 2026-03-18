import { authLogin, authLogout, authMe, listJobMessages, listJobUpdates, listJobs, postJobMessage, postJobUpdate, filesToPayload } from './hub-api.js';

const $ = (id) => document.getElementById(id);
const authCard = $('authCard');
const mainCard = $('mainCard');
const authStatus = $('authStatus');
const updateStatus = $('updateStatus');
const msgStatus = $('msgStatus');

function toast(el, msg, kind = '') {
  el.textContent = msg || '';
  el.className = 'status' + (kind ? ' ' + kind : '');
}

let currentUser = null;
let currentJobId = null;

async function loadJobs() {
  const list = $('bookingList');
  const details = $('bookingDetails');
  list.textContent = 'Loading…';
  details.textContent = 'Select a job.';

  const data = await listJobs();
  const rows = data.jobs || [];
  list.innerHTML = '';
  if (!rows.length) {
    list.textContent = 'No jobs assigned yet.';
    return;
  }

  rows.forEach((row) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn';
    button.style.width = '100%';
    button.style.textAlign = 'left';
    button.style.marginBottom = '10px';
    button.innerHTML = `<b>${row.vehicle_type || 'Vehicle'}</b><div style="color:rgba(255,255,255,.65); font-size:12px; margin-top:4px">${row.preferred_date || ''} • ${row.service_level || ''}</div>`;
    button.addEventListener('click', () => selectJob(row.id, row));
    list.appendChild(button);
  });
}

function renderDetails(row) {
  const el = $('bookingDetails');
  el.innerHTML = '';
  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify({
    jobId: row.id,
    vehicleType: row.vehicle_type,
    vehicleCount: row.vehicle_count,
    preferredDate: row.preferred_date,
    timeWindow: row.time_window,
    clientName: row.client_name || '',
    clientEmail: row.client_email || '',
    notes: row.notes || '',
  }, null, 2);
  el.appendChild(pre);
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function wireUpdates() {
  const box = $('updates');
  if (!currentJobId) {
    box.textContent = 'Select a job.';
    return;
  }

  box.textContent = 'Loading updates…';
  const data = await listJobUpdates(currentJobId);
  const rows = data.updates || [];
  box.innerHTML = '';
  if (!rows.length) {
    box.textContent = 'No updates yet.';
    return;
  }

  rows.forEach((update) => {
    const div = document.createElement('div');
    div.style.padding = '10px';
    div.style.border = '1px solid rgba(255,255,255,0.12)';
    div.style.borderRadius = '14px';
    div.style.background = 'rgba(0,0,0,0.18)';
    div.style.marginBottom = '10px';
    const timestamp = update.created_at ? new Date(update.created_at).toLocaleString() : '';
    div.innerHTML = `<b>${timestamp}</b><div style="color:rgba(255,255,255,.82); margin-top:6px; white-space:pre-wrap">${escapeHtml(update.note || '')}</div>`;

    const photos = Array.isArray(update.photos) ? update.photos : [];
    if (photos.length) {
      const grid = document.createElement('div');
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = 'repeat(2, minmax(0,1fr))';
      grid.style.gap = '8px';
      grid.style.marginTop = '10px';
      photos.forEach((photo) => {
        const link = document.createElement('a');
        link.href = photo.dataUrl || '#';
        link.target = '_blank';
        link.rel = 'noreferrer';
        const img = document.createElement('img');
        img.src = photo.dataUrl || '#';
        img.alt = 'Update photo';
        img.style.width = '100%';
        img.style.borderRadius = '12px';
        img.style.border = '1px solid rgba(255,255,255,0.12)';
        link.appendChild(img);
        grid.appendChild(link);
      });
      div.appendChild(grid);
    }
    box.appendChild(div);
  });
}

async function wireMessages() {
  const box = $('messages');
  if (!currentJobId) {
    box.textContent = 'Select a job.';
    return;
  }

  box.textContent = 'Loading messages…';
  const data = await listJobMessages(currentJobId);
  const rows = data.messages || [];
  box.innerHTML = '';
  if (!rows.length) {
    box.textContent = 'No messages yet.';
    return;
  }

  rows.forEach((message) => {
    const div = document.createElement('div');
    div.style.padding = '10px';
    div.style.borderBottom = '1px solid rgba(255,255,255,0.10)';
    const timestamp = message.created_at ? new Date(message.created_at).toLocaleString() : '';
    div.innerHTML = `<b>${escapeHtml(message.from_role || 'user')}</b> <span style="color:rgba(255,255,255,.55); font-size:12px">${timestamp}</span><div style="margin-top:6px; white-space:pre-wrap">${escapeHtml(message.text || '')}</div>`;
    box.appendChild(div);
  });
  box.scrollTop = box.scrollHeight;
}

function selectJob(id, row) {
  currentJobId = id;
  renderDetails({ id, ...row });
  wireUpdates().catch((error) => toast(updateStatus, 'Update load failed: ' + (error.message || error), 'bad'));
  wireMessages().catch((error) => toast(msgStatus, 'Message load failed: ' + (error.message || error), 'bad'));
}

$('signInBtn').addEventListener('click', async () => {
  const email = $('email').value.trim();
  const password = $('pass').value;
  if (!email || !password) {
    toast(authStatus, 'Enter email + password.', 'bad');
    return;
  }
  try {
    const data = await authLogin(email, password);
    currentUser = data.user || null;
    toast(authStatus, 'Signed in', 'ok');
    await syncAuthUI();
  } catch (error) {
    toast(authStatus, 'Sign-in failed: ' + (error.message || error), 'bad');
  }
});

$('signUpBtn').addEventListener('click', () => {
  toast(authStatus, 'Detailer accounts are provisioned after approval. Contact ops if your access is missing.', 'bad');
});

$('postUpdateBtn').addEventListener('click', async () => {
  toast(updateStatus, '', '');
  const note = $('updateNote').value.trim();
  if (!currentJobId) {
    toast(updateStatus, 'Select a job first.', 'bad');
    return;
  }
  if (!note) {
    toast(updateStatus, 'Write an update note.', 'bad');
    return;
  }

  const files = Array.from($('updatePhotos').files || []);
  try {
    toast(updateStatus, 'Uploading…');
    const photos = files.length ? await filesToPayload(files) : [];
    await postJobUpdate(currentJobId, note, photos);
    $('updateNote').value = '';
    $('updatePhotos').value = '';
    toast(updateStatus, 'Posted', 'ok');
    await wireUpdates();
  } catch (error) {
    console.error(error);
    toast(updateStatus, 'Post failed: ' + (error.message || error), 'bad');
  }
});

$('sendMsgBtn').addEventListener('click', async () => {
  toast(msgStatus, '', '');
  const text = $('msgText').value.trim();
  if (!text) {
    toast(msgStatus, 'Type a message.', 'bad');
    return;
  }
  if (!currentJobId) {
    toast(msgStatus, 'Select a job first.', 'bad');
    return;
  }
  try {
    await postJobMessage(currentJobId, text);
    $('msgText').value = '';
    toast(msgStatus, 'Sent', 'ok');
    await wireMessages();
  } catch (error) {
    toast(msgStatus, 'Send failed: ' + (error.message || error), 'bad');
  }
});

$('signOutBtn').addEventListener('click', async () => {
  await authLogout().catch(() => {});
  currentUser = null;
  await syncAuthUI();
});

async function syncAuthUI() {
  if (!currentUser) {
    authCard.style.display = 'block';
    mainCard.style.display = 'none';
    currentJobId = null;
    return;
  }
  if (currentUser.role !== 'detailer') {
    toast(authStatus, 'This account is not approved as a detailer yet. Contact ops.', 'bad');
    await authLogout().catch(() => {});
    currentUser = null;
    authCard.style.display = 'block';
    mainCard.style.display = 'none';
    return;
  }
  authCard.style.display = 'none';
  mainCard.style.display = 'block';
  await loadJobs();
}

authMe().then((data) => {
  currentUser = data.user || null;
  return syncAuthUI();
}).catch(() => {
  currentUser = null;
  return syncAuthUI();
});
