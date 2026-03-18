const DEFAULT_HEADERS = { 'content-type': 'application/json' };

async function readJson(response) {
  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch (_) {
    data = raw ? { error: raw } : {};
  }
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `request_failed_${response.status}`);
  }
  return data;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body ? DEFAULT_HEADERS : {}),
      ...(options.headers || {}),
    },
  });
  return readJson(response);
}

export function authMe() {
  return api('/.netlify/functions/auth-me', { method: 'GET' });
}

export function authLogin(email, password) {
  return api('/.netlify/functions/auth-login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function authSignup(email, password, name, requestedRole = 'host') {
  return api('/.netlify/functions/auth-signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, name, requestedRole }),
  });
}

export function authLogout() {
  return api('/.netlify/functions/auth-logout', { method: 'POST' });
}

export function submitIntake(payload, uploads, submissionId) {
  return api('/.netlify/functions/intake-submit', {
    method: 'POST',
    body: JSON.stringify({ payload, uploads, submissionId }),
  });
}

export function listAdminIntakes() {
  return api('/.netlify/functions/admin-intakes', { method: 'GET' });
}

export function approveCohost(submissionId) {
  return api('/.netlify/functions/approve-cohost', {
    method: 'POST',
    body: JSON.stringify({ submissionId }),
  });
}

export function createStay(payload) {
  return api('/.netlify/functions/create-stay', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function setRole(payload) {
  return api('/.netlify/functions/set-role', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listStays() {
  return api('/.netlify/functions/stays', { method: 'GET' });
}

export function listStayUpdates(stayId) {
  return api(`/.netlify/functions/stay-updates?stayId=${encodeURIComponent(stayId)}`, { method: 'GET' });
}

export function postStayUpdate(stayId, note, photos) {
  return api('/.netlify/functions/stay-updates', {
    method: 'POST',
    body: JSON.stringify({ stayId, note, photos }),
  });
}

export function listStayMessages(stayId) {
  return api(`/.netlify/functions/stay-messages?stayId=${encodeURIComponent(stayId)}`, { method: 'GET' });
}

export function postStayMessage(stayId, text) {
  return api('/.netlify/functions/stay-messages', {
    method: 'POST',
    body: JSON.stringify({ stayId, text }),
  });
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('file_read_failed'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

export async function filesToPayload(files) {
  const out = [];
  for (const file of Array.from(files || [])) {
    out.push({
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      dataUrl: await fileToDataUrl(file),
    });
  }
  return out;
}