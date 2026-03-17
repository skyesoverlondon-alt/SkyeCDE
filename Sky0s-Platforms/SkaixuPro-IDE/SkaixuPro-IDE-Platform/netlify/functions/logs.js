// logs.js — Ingest (POST) and retrieve (GET) kaixu diagnostic logs via Neon
// Set NEON_DATABASE_URL in Netlify env vars
import { neon } from '@neondatabase/serverless';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  const dbUrl = process.env.NEON_DATABASE_URL;
  if (!dbUrl) return { statusCode: 500, headers, body: JSON.stringify({ error: 'NEON_DATABASE_URL not configured' }) };

  const sql = neon(dbUrl);

  // --- POST: Ingest logs (single or batch) ---
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const logs = Array.isArray(body) ? body : (body.logs || [body]);

      if (logs.length === 0) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'No logs provided' }) };
      }

      // Cap batch size to prevent abuse
      const batch = logs.slice(0, 100);
      let inserted = 0;

      for (const log of batch) {
        const source = (log.source || 'unknown').slice(0, 64);
        const type = (log.type || 'info').slice(0, 16);
        const message = (log.message || '').slice(0, 4000);
        const sessionId = (log.session_id || log.sessionId || null)?.slice(0, 64);
        const userAgent = (log.user_agent || log.userAgent || null)?.slice(0, 512);
        const hostname = (log.hostname || null)?.slice(0, 255);

        if (!message) continue;

        await sql`
          INSERT INTO kaixu_logs (source, type, message, session_id, user_agent, hostname)
          VALUES (${source}, ${type}, ${message}, ${sessionId}, ${userAgent}, ${hostname})
        `;
        inserted++;
      }

      return {
        statusCode: 201,
        headers,
        body: JSON.stringify({ success: true, inserted })
      };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Ingest failed', detail: e.message }) };
    }
  }

  // --- GET: Retrieve logs (with filters) ---
  if (event.httpMethod === 'GET') {
    try {
      const params = event.queryStringParameters || {};
      const limit = Math.min(parseInt(params.limit) || 200, 1000);
      const source = params.source || null;
      const type = params.type || null;
      const since = params.since || null; // ISO timestamp
      const search = params.search || null;

      let rows;

      if (source && type && since) {
        rows = await sql`SELECT * FROM kaixu_logs WHERE source = ${source} AND type = ${type} AND ts >= ${since} ORDER BY ts DESC LIMIT ${limit}`;
      } else if (source && since) {
        rows = await sql`SELECT * FROM kaixu_logs WHERE source = ${source} AND ts >= ${since} ORDER BY ts DESC LIMIT ${limit}`;
      } else if (type && since) {
        rows = await sql`SELECT * FROM kaixu_logs WHERE type = ${type} AND ts >= ${since} ORDER BY ts DESC LIMIT ${limit}`;
      } else if (source) {
        rows = await sql`SELECT * FROM kaixu_logs WHERE source = ${source} ORDER BY ts DESC LIMIT ${limit}`;
      } else if (type) {
        rows = await sql`SELECT * FROM kaixu_logs WHERE type = ${type} ORDER BY ts DESC LIMIT ${limit}`;
      } else if (since) {
        rows = await sql`SELECT * FROM kaixu_logs WHERE ts >= ${since} ORDER BY ts DESC LIMIT ${limit}`;
      } else if (search) {
        rows = await sql`SELECT * FROM kaixu_logs WHERE message ILIKE ${'%' + search + '%'} ORDER BY ts DESC LIMIT ${limit}`;
      } else {
        rows = await sql`SELECT * FROM kaixu_logs ORDER BY ts DESC LIMIT ${limit}`;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ logs: rows, count: rows.length })
      };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Query failed', detail: e.message }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
