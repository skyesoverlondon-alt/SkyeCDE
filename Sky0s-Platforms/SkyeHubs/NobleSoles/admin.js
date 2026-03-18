import {
  approveCaregiver,
  authLogin,
  authMe,
  authSignup,
  createBooking,
  listAdminIntakes,
  setRole,
} from './hub-api.js';

const $ = (id) => document.getElementById(id);

function setStatus(id, message, kind = '') {
  const element = $(id);
  element.textContent = message || '';
  element.className = 'status' + (kind ? ' ' + kind : '');
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
        const image = document.createElement('img');
        image.src = file.dataUrl;
        image.alt = file.name || 'upload';
        image.style.width = '100%';
        image.style.marginTop = '6px';
        image.style.borderRadius = '12px';
        item.appendChild(image);
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
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn';
    button.style.width = '100%';
    button.style.textAlign = 'left';
    button.style.marginBottom = '10px';
    button.innerHTML = `<b>${row.first_name || ''} ${row.last_name || ''}</b><div style="color:rgba(255,255,255,.65); font-size:12px; margin-top:4px">${row.city || ''} • ${row.created_at || ''}</div>`;
    button.addEventListener('click', () => {
      selectedSubmissionId = row.id;
      renderDetails(row);
    });
    list.appendChild(button);
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
      setStatus('adminStatus', `Signed in as ${data.user.email}`, 'ok');
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
    setStatus('adminStatus', `Signed in as ${data.user.email}`, 'ok');
    await refresh();
  } catch (error) {
    setStatus('adminStatus', 'Sign-in failed: ' + (error.message || error), 'bad');
  }
});

$('adminSignup')?.addEventListener('click', async () => {
  try {
    const data = await authSignup($('adminEmail').value.trim(), $('adminPass').value, 'Noble Soul Admin', 'admin');
    setStatus('adminStatus', `Admin account created for ${data.user.email}`, 'ok');
    await refresh();
  } catch (error) {
    setStatus('adminStatus', 'Create failed: ' + (error.message || error), 'bad');
  }
});

$('refreshBtn').addEventListener('click', () => refresh().catch((error) => setStatus('adminStatus', 'Refresh failed: ' + (error.message || error), 'bad')));

$('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(cache, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'noble-soul-intake-export.json';
  link.click();
  URL.revokeObjectURL(link.href);
});

$('approveCaregiverBtn').addEventListener('click', async () => {
  if (!selectedSubmissionId) {
    setStatus('approveStatus', 'Select a submission first.', 'bad');
    return;
  }
  try {
    setStatus('approveStatus', 'Approving…');
    const data = await approveCaregiver(selectedSubmissionId);
    setStatus('approveStatus', data.tempPassword ? `Approved. UID: ${data.uid}. Temporary password: ${data.tempPassword}` : `Approved. UID: ${data.uid}. Existing account kept.`, 'ok');
    await refresh();
  } catch (error) {
    setStatus('approveStatus', 'Approve failed: ' + (error.message || error), 'bad');
  }
});

$('createBookingBtn').addEventListener('click', async () => {
  try {
    setStatus('createBookingStatus', 'Creating…');
    const data = await createBooking({
      clientUid: $('bkClientUid').value.trim(),
      clientEmail: $('bkClientEmail').value.trim(),
      clientName: $('bkClientName').value.trim(),
      caregiverUid: $('bkCaregiverUid').value.trim(),
      caregiverEmail: $('bkCaregiverEmail').value.trim(),
      caregiverName: $('bkCaregiverName').value.trim(),
      petName: $('bkPetName').value.trim(),
      petType: $('bkPetType').value.trim(),
      startDate: $('bkStart').value,
      endDate: $('bkEnd').value,
      notes: $('bkNotes').value.trim(),
    });
    setStatus('createBookingStatus', `Booking created: ${data.bookingId}`, 'ok');
  } catch (error) {
    setStatus('createBookingStatus', 'Create failed: ' + (error.message || error), 'bad');
  }
});

$('setRoleBtn').addEventListener('click', async () => {
  try {
    setStatus('setRoleStatus', 'Saving…');
    const data = await setRole({ userId: $('roleUid').value.trim(), role: $('roleVal').value });
    setStatus('setRoleStatus', `Role saved for ${data.user.email}`, 'ok');
  } catch (error) {
    setStatus('setRoleStatus', 'Save failed: ' + (error.message || error), 'bad');
  }
});

bootstrap();