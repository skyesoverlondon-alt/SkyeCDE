const { query } = require('./db');

let schemaReady;

async function ensureSchema() {
  if (schemaReady) return schemaReady;

  schemaReady = (async () => {
    await query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

    await query(`
      CREATE TABLE IF NOT EXISTS host_requests (
        id TEXT PRIMARY KEY,
        host_uid TEXT NOT NULL,
        host_email TEXT,
        request_type TEXT NOT NULL DEFAULT 'one_time',
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        quote JSONB NOT NULL DEFAULT '{}'::jsonb,
        status TEXT NOT NULL DEFAULT 'created_unpaid',
        source TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        paid_at TIMESTAMPTZ,
        stay_id TEXT,
        cohost_uid TEXT,
        cohost_name TEXT,
        stripe_session_id TEXT,
        stripe_amount_total INTEGER,
        stripe_currency TEXT,
        subscription_id TEXT
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS cohosts (
        uid TEXT PRIMARY KEY,
        email TEXT,
        name TEXT,
        city TEXT,
        zip TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        max_turns_per_day INTEGER,
        supplies TEXT,
        linen_access TEXT,
        source TEXT,
        submission_id TEXT,
        approved_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS stays (
        id TEXT PRIMARY KEY,
        host_uid TEXT NOT NULL,
        host_name TEXT,
        host_email TEXT,
        cohost_uid TEXT,
        cohost_name TEXT,
        listing_name TEXT,
        address TEXT,
        city TEXT,
        zip TEXT,
        start_date TEXT,
        end_date TEXT,
        turnover_date TEXT,
        service_type TEXT,
        add_ons JSONB NOT NULL DEFAULT '{}'::jsonb,
        guest_comms TEXT,
        notes TEXT,
        request_type TEXT,
        plan TEXT,
        quote JSONB,
        status TEXT NOT NULL DEFAULT 'scheduled',
        source_request_id TEXT,
        subscription_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        host_uid TEXT NOT NULL,
        host_email TEXT,
        plan TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        latest_stay_id TEXT
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS hub_users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'host',
        name TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        approved_at TIMESTAMPTZ,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
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
      CREATE TABLE IF NOT EXISTS cohost_intake (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        city TEXT,
        zip TEXT,
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
      CREATE TABLE IF NOT EXISTS stay_updates (
        id TEXT PRIMARY KEY,
        stay_id TEXT NOT NULL,
        note TEXT NOT NULL,
        photos JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_by_user_id TEXT,
        created_by_role TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS stay_messages (
        id TEXT PRIMARY KEY,
        stay_id TEXT NOT NULL,
        text TEXT NOT NULL,
        from_user_id TEXT,
        from_role TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await query('CREATE INDEX IF NOT EXISTS idx_host_requests_host_uid ON host_requests(host_uid)');
    await query('CREATE INDEX IF NOT EXISTS idx_host_requests_status ON host_requests(status)');
    await query('CREATE INDEX IF NOT EXISTS idx_stays_cohost_uid ON stays(cohost_uid)');
    await query('CREATE INDEX IF NOT EXISTS idx_hub_sessions_user_id ON hub_sessions(user_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_cohost_intake_email ON cohost_intake(email)');
    await query('CREATE INDEX IF NOT EXISTS idx_stay_updates_stay_id ON stay_updates(stay_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_stay_messages_stay_id ON stay_messages(stay_id)');
  })();

  return schemaReady;
}

module.exports = { ensureSchema };