const { query } = require('./db');

let schemaReady;

async function ensureSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    await query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

    await query(`
      CREATE TABLE IF NOT EXISTS booking_requests (
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
        booking_id TEXT,
        caregiver_uid TEXT,
        caregiver_name TEXT,
        stripe_session_id TEXT,
        stripe_amount_total INTEGER,
        stripe_currency TEXT
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS caregivers (
        uid TEXT PRIMARY KEY,
        email TEXT,
        name TEXT,
        city TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        cats_ok BOOLEAN,
        meds_ok TEXT,
        max_pets INTEGER,
        source TEXT,
        submission_id TEXT,
        approved_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        client_uid TEXT NOT NULL,
        client_name TEXT,
        client_email TEXT,
        caregiver_uid TEXT,
        caregiver_name TEXT,
        pet_name TEXT,
        pet_type TEXT,
        start_date TEXT,
        end_date TEXT,
        notes TEXT,
        city TEXT,
        zip TEXT,
        service TEXT,
        quote JSONB,
        status TEXT NOT NULL DEFAULT 'active',
        source_request_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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
      CREATE TABLE IF NOT EXISTS caregiver_intake (
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
      CREATE TABLE IF NOT EXISTS booking_updates (
        id TEXT PRIMARY KEY,
        booking_id TEXT NOT NULL,
        note TEXT NOT NULL,
        photos JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_by_user_id TEXT,
        created_by_role TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS booking_messages (
        id TEXT PRIMARY KEY,
        booking_id TEXT NOT NULL,
        text TEXT NOT NULL,
        from_user_id TEXT,
        from_role TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await query('CREATE INDEX IF NOT EXISTS idx_booking_requests_client_uid ON booking_requests(client_uid)');
    await query('CREATE INDEX IF NOT EXISTS idx_bookings_caregiver_uid ON bookings(caregiver_uid)');
    await query('CREATE INDEX IF NOT EXISTS idx_hub_sessions_user_id ON hub_sessions(user_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_caregiver_intake_email ON caregiver_intake(email)');
    await query('CREATE INDEX IF NOT EXISTS idx_booking_updates_booking_id ON booking_updates(booking_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_booking_messages_booking_id ON booking_messages(booking_id)');
  })();
  return schemaReady;
}

module.exports = { ensureSchema };