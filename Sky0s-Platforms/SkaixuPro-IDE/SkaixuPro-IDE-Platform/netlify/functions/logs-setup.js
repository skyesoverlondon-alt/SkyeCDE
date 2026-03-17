// logs-setup.js — Auto-creates the kaixu_logs table in Neon on first call
// Set NEON_DATABASE_URL in Netlify env vars (never hardcode)
import { neon } from '@neondatabase/serverless';

export const handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  const dbUrl = process.env.NEON_DATABASE_URL;
  if (!dbUrl) return { statusCode: 500, headers, body: JSON.stringify({ error: 'NEON_DATABASE_URL not configured' }) };

  try {
    const sql = neon(dbUrl);

    // Create table + indexes
    await sql`
      CREATE TABLE IF NOT EXISTS kaixu_logs (
        id BIGSERIAL PRIMARY KEY,
        ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        source VARCHAR(64) NOT NULL DEFAULT 'unknown',
        type VARCHAR(16) NOT NULL DEFAULT 'info',
        message TEXT NOT NULL,
        session_id VARCHAR(64),
        user_agent TEXT,
        hostname VARCHAR(255)
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_logs_ts ON kaixu_logs (ts DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_logs_source ON kaixu_logs (source)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_logs_type ON kaixu_logs (type)`;

    // Verify
    const check = await sql`SELECT COUNT(*) as count FROM kaixu_logs`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'kaixu_logs table ready',
        existing_rows: check[0].count
      })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Setup failed', detail: e.message })
    };
  }
};
