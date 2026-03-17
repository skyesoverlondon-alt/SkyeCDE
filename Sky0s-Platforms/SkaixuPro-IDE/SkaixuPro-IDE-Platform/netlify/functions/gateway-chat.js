// gateway-chat.js — Server-side proxy to omegaskyegate
// Bypasses CORS for all client origins (codespace, dev, production).
// Reachable at /.netlify/functions/gateway-chat in both netlify dev and deployed.

const UPSTREAM = (process.env.OMEGA_GATE_URL || 'https://0megaskyegate.skyesoverlondon.workers.dev') + '/.netlify/functions/gateway-chat';

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

    const text = await resp.text();

    return {
      statusCode: resp.status,
      headers: {
        ...CORS,
        'Content-Type': resp.headers.get('content-type') || 'application/json'
      },
      body: text
    };
  } catch (err) {
    return {
      statusCode: 502,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Upstream gateway unreachable', detail: err.message })
    };
  }
};
