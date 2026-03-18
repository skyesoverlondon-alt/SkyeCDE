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

export function authSignup(email, password, name, requestedRole = 'client') {
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

export function approveDetailer(submissionId) {
  return api('/.netlify/functions/approve-detailer', {
    method: 'POST',
    body: JSON.stringify({ submissionId }),
  });
}

export function createJob(payload) {
  return api('/.netlify/functions/create-job', {
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

export function createRequest(payload) {
  return api('/.netlify/functions/create-request', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function createCheckout(payload) {
  return api('/.netlify/functions/create-checkout', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listJobs() {
  return api('/.netlify/functions/jobs', { method: 'GET' });
}

export function listJobUpdates(jobId) {
  return api(`/.netlify/functions/job-updates?bookingId=${encodeURIComponent(jobId)}`, { method: 'GET' });
}

export function postJobUpdate(jobId, note, photos) {
  return api('/.netlify/functions/job-updates', {
    method: 'POST',
    body: JSON.stringify({ bookingId: jobId, note, photos }),
  });
}

export function listJobMessages(jobId) {
  return api(`/.netlify/functions/job-messages?bookingId=${encodeURIComponent(jobId)}`, { method: 'GET' });
}

export function postJobMessage(jobId, text) {
  return api('/.netlify/functions/job-messages', {
    method: 'POST',
    body: JSON.stringify({ bookingId: jobId, text }),
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