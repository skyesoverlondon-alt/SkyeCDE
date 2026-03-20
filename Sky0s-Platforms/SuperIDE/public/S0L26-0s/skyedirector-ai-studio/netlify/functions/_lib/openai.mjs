const API_ROOT = String(process.env.OMEGA_GATE_URL || 'https://0megaskyegate.skyesoverlondon.workers.dev').trim().replace(/\/+$/, '');
const DEFAULT_ALIAS = String(process.env.KAIXU_GATE_ALIAS || 'kaixu/deep').trim() || 'kaixu/deep';

function apiKey() {
  const key = process.env.OMEGA_GATE_SERVICE_KEY || process.env.KAIXU_APP_TOKEN;
  if (!key) throw new Error('Gate token missing. Set OMEGA_GATE_SERVICE_KEY (or KAIXU_APP_TOKEN) in Netlify Functions env vars.');
  return key;
}

async function call(path, init = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(init.headers || {})
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `OpenAI call failed: ${response.status}`);
  }
  return response;
}

export async function createResponse({ system, prompt, temperature = 0.8, responseFormat }) {
  const response = await call('/v1/chat', {
    method: 'POST',
    body: JSON.stringify({
      alias: process.env.OPENAI_TEXT_MODEL || DEFAULT_ALIAS,
      temperature,
      metadata: responseFormat ? { responseFormat } : undefined,
      messages: [
        { role: 'system', content: String(system || '') },
        { role: 'user', content: String(prompt || '') }
      ]
    })
  });
  const payload = await response.json();
  return {
    output_text: payload?.output?.text || '',
    usage: payload?.usage || null,
    raw: payload
  };
}

export async function speech({ input, voice = 'coral', instructions = '', format = 'mp3' }) {
  const modelAlias = process.env.OPENAI_TTS_MODEL || 'kaixu/voice';
  const response = await call('/v1/audio/speech', {
    method: 'POST',
    body: JSON.stringify({ alias: modelAlias, input, voice, instructions, format })
  });
  const payload = await response.json();
  const dataUrl = String(payload?.asset?.data_url || '');
  const marker = ';base64,';
  const idx = dataUrl.indexOf(marker);
  if (idx === -1) throw new Error('Invalid speech payload from 0megaSkyeGate.');
  return dataUrl.slice(idx + marker.length);
}

export async function transcribe(formData) {
  const file = formData?.get?.('file');
  if (!file) throw new Error('Missing file for transcription.');
  const name = file.name || 'upload.bin';
  const mime = file.type || 'audio/webm';
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString('base64');
  const language = formData?.get?.('language');

  const response = await call('/v1/audio/transcriptions', {
    method: 'POST',
    body: JSON.stringify({
      alias: process.env.OPENAI_TRANSCRIBE_MODEL || 'kaixu/transcribe',
      file_name: name,
      mime_type: mime,
      file_base64: base64,
      language: language ? String(language) : undefined
    })
  });
  const payload = await response.json();
  return { text: payload?.text || '', segments: payload?.segments || [] };
}

export async function generateImage({ prompt, size = '1024x1024', quality = 'medium', output_format = 'png' }) {
  const modelAlias = process.env.OPENAI_IMAGE_MODEL || 'kaixu/image';
  const response = await call('/v1/images', {
    method: 'POST',
    body: JSON.stringify({ alias: modelAlias, prompt, size, quality, output_format })
  });
  const payload = await response.json();
  const asset = payload?.assets?.[0];
  const dataUrl = String(asset?.data_url || '');
  const marker = ';base64,';
  const idx = dataUrl.indexOf(marker);
  if (idx === -1) throw new Error('No base64 image returned from 0megaSkyeGate.');
  return {
    data: [{ b64_json: dataUrl.slice(idx + marker.length) }],
    raw: payload
  };
}
