import {
  approveCohost,
  authLogin,
  authMe,
  authSignup,
  createStay,
  listAdminIntakes,
  setRole,
} from './hub-api.js';

const $ = (id) => document.getElementById(id);

function toast(msg, kind = '') {
  const el = $('adminStatus');
  el.textContent = msg || '';
  el.className = 'status' + (kind ? ' ' + kind : '');
}

function setStatus(id, msg, kind = '') {
  const el = $(id);
  el.textContent = msg || '';
  el.className = 'status' + (kind ? ' ' + kind : '');
}

let cache = [];
let selectedSubmissionId = null;

function renderDetails(row) {
  const details = $('details');
  details.innerHTML = '';
  const pre = document.createElement('pre');
  pre.textContent = JSON.stringify(row, null, 2);
  details.appendChild(pre);

  const uploads = row.uploads || {};
  const blocks = document.createElement('div');
  blocks.style.marginTop = '12px';
  blocks.style.display = 'grid';
  blocks.style.gap = '10px';

  Object.entries(uploads).forEach(([bucket, files]) => {
    const box = document.createElement('div');
    box.style.padding = '10px';
    box.style.border = '1px solid rgba(255,255,255,0.12)';
    box.style.borderRadius = '14px';
    box.style.background = 'rgba(0,0,0,0.20)';
    box.innerHTML = `<b>${bucket}</b>`;

    (files || []).forEach((file) => {
      const item = document.createElement('div');
      item.style.marginTop = '10px';
      item.innerHTML = `<div>${file.name || 'upload'}</div>`;
      if (String(file.type || '').startsWith('image/') && file.dataUrl) {
        const img = document.createElement('img');
        img.src = file.dataUrl;
        img.alt = file.name || 'upload';
        img.style.width = '100%';
        img.style.marginTop = '6px';
        img.style.borderRadius = '12px';
        item.appendChild(img);
      } else if (file.dataUrl) {
        const a = document.createElement('a');
        a.href = file.dataUrl;
        a.download = file.name || 'upload';
        a.textContent = 'Download file';
        a.style.display = 'inline-block';
        a.style.marginTop = '6px';
        item.appendChild(a);
      }
      box.appendChild(item);
    });

    blocks.appendChild(box);
  });

  details.appendChild(blocks);
}

function renderList() {
  const list = $('list');
  list.innerHTML = '';
  if (!cache.length) {
    list.textContent = 'No submissions found.';
    return;
  }

  cache.forEach((row) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn';
    btn.style.width = '100%';
    btn.style.textAlign = 'left';
    btn.style.marginBottom = '10px';
    btn.innerHTML = `<b>${row.first_name || ''} ${row.last_name || ''}</b><div style="color:rgba(255,255,255,.65); font-size:12px; margin-top:4px">${row.city || ''} • ${row.created_at || ''}</div>`;
    btn.addEventListener('click', () => {
      selectedSubmissionId = row.id;
      renderDetails(row);
    });
    list.appendChild(btn);
  });
}

async function refresh() {
  $('list').textContent = 'Loading…';
  const data = await listAdminIntakes();
  cache = data.submissions || [];
  renderList();
}

async function bootstrap() {
  try {
    const data = await authMe();
    if (data.user?.role === 'admin') {
      toast(`Signed in as ${data.user.email}`, 'ok');
      await refresh();
      return;
    }
  } catch (_) {}
  $('details').textContent = 'Sign in to view submissions.';
}

$('adminLogin').addEventListener('click', async () => {
  try {
    const data = await authLogin($('adminEmail').value.trim(), $('adminPass').value);
    if (data.user?.role !== 'admin') throw new Error('admin_required');
    toast(`Signed in as ${data.user.email}`, 'ok');
    await refresh();
  } catch (error) {
    toast('Sign-in failed: ' + (error.message || error), 'bad');
  }
});

$('adminSignup')?.addEventListener('click', async () => {
  try {
    const data = await authSignup($('adminEmail').value.trim(), $('adminPass').value, 'SkyeHubs Admin', 'admin');
    toast(`Admin account created for ${data.user.email}`, 'ok');
    await refresh();
  } catch (error) {
    toast('Create failed: ' + (error.message || error), 'bad');
  }
});

$('refreshBtn').addEventListener('click', () => refresh().catch((error) => toast('Refresh failed: ' + (error.message || error), 'bad')));

$('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(cache, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'skyehubs-intake-export.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

$('approveCo-HostBtn').addEventListener('click', async () => {
  if (!selectedSubmissionId) {
    setStatus('approveStatus', 'Select a submission first.', 'bad');
    return;
  }
  try {
    setStatus('approveStatus', 'Approving…');
    const data = await approveCohost(selectedSubmissionId);
    setStatus(
      'approveStatus',
      data.tempPassword
        ? `Approved. UID: ${data.uid}. Temporary password: ${data.tempPassword}`
        : `Approved. UID: ${data.uid}. Existing account kept.`,
      'ok'
    );
    await refresh();
  } catch (error) {
    setStatus('approveStatus', 'Approve failed: ' + (error.message || error), 'bad');
  }
});

$('createStayBtn').addEventListener('click', async () => {
  try {
    setStatus('createStayStatus', 'Creating…');
    const data = await createStay({
      hostUid: $('bkClientUid').value.trim(),
      hostEmail: $('bkClientEmail').value.trim(),
      hostName: $('bkClientName').value.trim(),
      cohostUid: $('bkCo-HostUid').value.trim(),
      cohostEmail: $('bkCo-HostEmail').value.trim(),
      cohostName: $('bkCo-HostName').value.trim(),
      guestName: $('bkGuestName').value.trim(),
      guestType: $('bkGuestType').value.trim(),
      startDate: $('bkStart').value,
      endDate: $('bkEnd').value,
      notes: $('bkNotes').value.trim(),
      listingName: $('bkGuestName').value.trim(),
    });
    setStatus('createStayStatus', `Stay created: ${data.stayId}`, 'ok');
  } catch (error) {
    setStatus('createStayStatus', 'Create failed: ' + (error.message || error), 'bad');
  }
});

$('setRoleBtn').addEventListener('click', async () => {
  try {
    setStatus('setRoleStatus', 'Saving…');
    const data = await setRole({
      userId: $('roleUid').value.trim(),
      role: $('roleVal').value,
    });
    setStatus('setRoleStatus', `Role saved for ${data.user.email}`, 'ok');
  } catch (error) {
    setStatus('setRoleStatus', 'Save failed: ' + (error.message || error), 'bad');
  }
});

bootstrap();