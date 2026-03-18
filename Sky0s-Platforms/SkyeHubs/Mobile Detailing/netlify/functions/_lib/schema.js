const { query } = require('./db');

let schemaReady;

async function ensureSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    await query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

    await query(`
      CREATE TABLE IF NOT EXISTS service_requests (
        id TEXT PRIMARY KEY,
        client_uid TEXT NOT NULL,
        client_email TEXT,
        request_type TEXT NOT NULL DEFAULT 'one_time',
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        quote JSONB NOT NULL DEFAULT '{}'::jsonb,
        status TEXT NOT NULL DEFAULT 'created_unpaid',
        source TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        paid_at TIMESTAMPTZ,
        job_id TEXT,
        detailer_uid TEXT,
        detailer_name TEXT,
        subscription_id TEXT,
        stripe_session_id TEXT,
        stripe_amount_total INTEGER,
        stripe_currency TEXT
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS detailers (
        uid TEXT PRIMARY KEY,
        email TEXT,
        name TEXT,
        city TEXT,
        zip TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        max_vehicles INTEGER,
        water_access TEXT,
        tools TEXT,
        source TEXT,
        submission_id TEXT,
        approved_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        client_uid TEXT NOT NULL,
        client_name TEXT,
        client_email TEXT,
        detailer_uid TEXT,
        detailer_name TEXT,
        address TEXT,
        zip TEXT,
        preferred_date TEXT,
        time_window TEXT,
        vehicle_count INTEGER,
        vehicle_type TEXT,
        service_level TEXT,
        interior TEXT,
        heavy_soil TEXT,
        addons JSONB,
        request_type TEXT,
        plan TEXT,
        notes TEXT,
        quote JSONB,
        status TEXT NOT NULL DEFAULT 'active',
        source_request_id TEXT,
        subscription_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        client_uid TEXT NOT NULL,
        client_email TEXT,
        plan TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        latest_job_id TEXT,
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS hub_users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'client',
        name TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        approved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS hub_sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS detailer_intake (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        city TEXT,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        uploads JSONB NOT NULL DEFAULT '{}'::jsonb,
        status TEXT NOT NULL DEFAULT 'submitted',
        source TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        approved_at TIMESTAMPTZ,
        approved_user_id TEXT
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS job_updates (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        note TEXT NOT NULL,
        photos JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_by_user_id TEXT,
        created_by_role TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS job_messages (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        text TEXT NOT NULL,
        from_user_id TEXT,
        from_role TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await query('CREATE INDEX IF NOT EXISTS idx_service_requests_client_uid ON service_requests(client_uid)');
    await query('CREATE INDEX IF NOT EXISTS idx_jobs_detailer_uid ON jobs(detailer_uid)');
    await query('CREATE INDEX IF NOT EXISTS idx_hub_sessions_user_id ON hub_sessions(user_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_detailer_intake_email ON detailer_intake(email)');
    await query('CREATE INDEX IF NOT EXISTS idx_job_updates_job_id ON job_updates(job_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_job_messages_job_id ON job_messages(job_id)');
  })();
  return schemaReady;
}

module.exports = { ensureSchema };