export default async (req) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  if (req.method === 'OPTIONS') return new Response('', { status: 204, headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  const gateToken = String(process.env.OMEGA_GATE_SERVICE_KEY || process.env.KAIXU_APP_TOKEN || '').trim();
  if (!gateToken) {
    return new Response(JSON.stringify({ error: 'Gate token missing. Set OMEGA_GATE_SERVICE_KEY (or KAIXU_APP_TOKEN) on the server.' }), { status: 500, headers });
  }

  const gateUrl = String(process.env.OMEGA_GATE_URL || 'https://0megaskyegate.skyesoverlondon.workers.dev').trim().replace(/\/+$/, '');
  const alias = String(process.env.KAIXU_GATE_ALIAS || 'kaixu/deep').trim() || 'kaixu/deep';
  const { prompt = '', system = 'You are kAIxU, the creative engineering assistant for SkyeCloud.' } = await req.json().catch(() => ({}));

  if (!String(prompt).trim()) {
    return new Response(JSON.stringify({ error: 'Prompt is required.' }), { status: 400, headers });
  }

  const upstream = await fetch(`${gateUrl}/v1/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${gateToken}`
    },
    body: JSON.stringify({
      alias,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ],
      temperature: 0.6
    })
  });

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return new Response(JSON.stringify({ error: data?.error?.message || 'Upstream AI error.' }), { status: upstream.status, headers });
  }

  const output = data?.output?.text || data.output_text || data.output?.map(item => item?.content?.map(c => c.text).join('')).join('\n') || '';
  return new Response(JSON.stringify({ ok: true, output, alias, ai: 'kAIxU', provider: '0megaSkyeGate' }), { headers });
};
