// gateway-stream.js — Server-side streaming proxy to omegaskyegate
// Collects the upstream SSE stream and returns it through, bypassing CORS.
// Works in both netlify dev and Netlify deployment.

const UPSTREAM = (process.env.OMEGA_GATE_URL || 'https://0megaskyegate.skyesoverlondon.workers.dev') + '/.netlify/functions/gateway-stream';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';

  try {
    const resp = await fetch(UPSTREAM, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: event.body
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      return {
        statusCode: resp.status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: errText || JSON.stringify({ error: 'Upstream stream error', status: resp.status })
      };
    }

    // Collect SSE stream body (Netlify v1 cannot true-stream, so we buffer)
    const raw = await resp.text();

    return {
      statusCode: 200,
      headers: {
        ...CORS,
        'Content-Type': 'text/event-stream'
      },
      body: raw
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Upstream gateway unreachable', detail: err.message })
    };
  }
};
