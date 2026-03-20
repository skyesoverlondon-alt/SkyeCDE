import { json, noContent } from './_lib/http.js';

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return noContent();
  return json(200, {
    ok: true,
    name: 'Demon Lead Forge',
    runtime: 'netlify-functions',
    gateConfigured: Boolean(process.env.OMEGA_GATE_SERVICE_KEY),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    bemonConfigured: Boolean(process.env.BEMON_KEY)
  });
};
