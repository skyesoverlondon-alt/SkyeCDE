const { Pool } = require('pg');

let pool;

function getConnectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NETLIFY_DATABASE_URL ||
    process.env.PG_CONNECTION_STRING ||
    process.env.PGCONNSTRING ||
    ''
  ).trim();
}

function getPool() {
  if (pool) return pool;

  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error('Missing database connection string. Add DATABASE_URL in Netlify site configuration.');
  }

  pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
    ssl: { rejectUnauthorized: false }
  });

  return pool;
}

async function query(text, params = []) {
  return getPool().query(text, params);
}

module.exports = { query, getPool };