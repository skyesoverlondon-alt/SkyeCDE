-- Skye Mail Vault schema (Neon Postgres) — Procurement Tier v1.2
-- Includes: multi-key rotation, secure reply threads, encrypted attachments, IP-based rate events,
-- email verification, password reset.

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  handle text unique not null,
  email text unique not null,
  password_hash text not null,

  org_id uuid,

  is_active boolean not null default true,

  email_verified boolean not null default false,
  email_verified_at timestamptz,

  email_verify_token_hash text,
  email_verify_expires_at timestamptz,

  password_reset_token_hash text,
  password_reset_expires_at timestamptz,

  recovery_enabled boolean not null default false,
  recovery_blob_json text,

  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

-- Backward-compatible alters (safe to run multiple times)
alter table users add column if not exists email_verified boolean not null default false;
alter table users add column if not exists email_verified_at timestamptz;
alter table users add column if not exists email_verify_token_hash text;
alter table users add column if not exists email_verify_expires_at timestamptz;
alter table users add column if not exists password_reset_token_hash text;
alter table users add column if not exists password_reset_expires_at timestamptz;
alter table users add column if not exists last_login_at timestamptz;
alter table users add column if not exists org_id uuid;
alter table users add column if not exists is_active boolean not null default true;

create table if not exists user_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  version integer not null,
  is_active boolean not null default false,

  rsa_public_key_pem text not null,
  vault_wrap_json text not null,

  created_at timestamptz not null default now(),
  unique(user_id, version)
);

create index if not exists idx_user_keys_user_active on user_keys(user_id, is_active);
create index if not exists idx_user_keys_user_version on user_keys(user_id, version);

create table if not exists threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token text unique not null,
  from_name text,
  from_email text,
  created_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);

create index if not exists idx_threads_user_created on threads(user_id, created_at desc);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  thread_id uuid references threads(id) on delete set null,

  from_name text,
  from_email text,

  key_version integer not null,

  encrypted_key_b64 text not null,
  iv_b64 text not null,
  ciphertext_b64 text not null,

  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_messages_user_created on messages(user_id, created_at desc);
create index if not exists idx_messages_thread_created on messages(thread_id, created_at desc);

create table if not exists attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,

  filename text not null,
  mime_type text not null,
  size_bytes integer not null,

  encrypted_key_b64 text not null,
  iv_b64 text not null,
  ciphertext bytea not null,

  created_at timestamptz not null default now()
);

create index if not exists idx_attachments_message on attachments(message_id);

-- IP-based rate events (hash your IP before writing it here)
create table if not exists rate_events (
  id bigserial primary key,
  bucket text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_rate_events_bucket_created on rate_events(bucket, created_at desc);

-- Organizations + RBAC (minimal enterprise)
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_at timestamptz not null default now()
);


-- Backward-compatible alters for org slug
alter table organizations add column if not exists slug text;
create unique index if not exists idx_organizations_slug on organizations(slug);

create table if not exists org_members (
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null check (role in ('owner','admin','viewer')),
  created_at timestamptz not null default now(),
  primary key(org_id, user_id)
);

create index if not exists idx_org_members_user on org_members(user_id);

create table if not exists org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','viewer')),
  token_hash text not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_org_invites_org on org_invites(org_id, created_at desc);

-- Add FK safely (Postgres doesn't support IF NOT EXISTS for constraints)
do $$
begin
  alter table users
    add constraint users_org_id_fkey
    foreign key (org_id) references organizations(id) on delete set null;
exception when duplicate_object then null;
end $$;

-- Audit log (enterprise)
create table if not exists audit_events (
  id bigserial primary key,
  org_id uuid references organizations(id) on delete set null,
  actor_user_id uuid references users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  ip_hash text,
  user_agent text,
  meta_json text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_events_org_created on audit_events(org_id, created_at desc);
create index if not exists idx_audit_events_actor_created on audit_events(actor_user_id, created_at desc);



-- SAML SSO (SP-initiated) configuration per organization
create table if not exists saml_configs (
  org_id uuid primary key references organizations(id) on delete cascade,
  enabled boolean not null default false,
  idp_entity_id text not null,
  idp_sso_url text not null,
  sp_entity_id text not null,
  idp_x509_cert_pem text,
  want_assertions_signed boolean not null default true,
  want_response_signed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists saml_requests (
  id bigserial primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  request_id text not null,
  relay_state text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  unique(org_id, request_id)
);

create index if not exists idx_saml_requests_org_created on saml_requests(org_id, created_at desc);
-- ============================
-- Procurement Additions v1.3
-- SCIM / SIEM / DLP / Legal Hold / eDiscovery / KMS
-- ============================

-- Org key management mode
alter table organizations add column if not exists key_management_mode text not null default 'passphrase' check (key_management_mode in ('passphrase','kms'));
alter table organizations add column if not exists kms_key_id text;

-- KMS-wrapped private keys (no passphrase)
alter table user_keys add column if not exists kms_wrapped_private_key_b64 text;

-- Soft delete + legal hold flags
alter table messages add column if not exists deleted_at timestamptz;
alter table messages add column if not exists legal_hold boolean not null default false;
create index if not exists idx_messages_user_not_deleted on messages(user_id, created_at desc) where deleted_at is null;

-- Retention policies + immutable audit events
create table if not exists retention_policies (
  org_id uuid primary key references organizations(id) on delete cascade,
  audit_retain_days integer not null default 365,
  message_retain_days integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table audit_events add column if not exists retain_until timestamptz;

-- Set retain_until on insert
create or replace function set_audit_retain_until()
returns trigger language plpgsql as $$
declare days int;
begin
  select audit_retain_days into days from retention_policies where org_id = new.org_id;
  if days is null then days := 365; end if;
  new.retain_until := now() + (days || ' days')::interval;
  return new;
end $$;

drop trigger if exists trg_audit_set_retain on audit_events;
create trigger trg_audit_set_retain before insert on audit_events
for each row execute function set_audit_retain_until();

-- Prevent updates; prevent deletes before retain_until
create or replace function audit_immutable_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    raise exception 'audit_events are immutable';
  end if;
  if tg_op = 'DELETE' then
    if old.retain_until is not null and old.retain_until > now() then
      raise exception 'audit_events retention lock (retain_until=%)', old.retain_until;
    end if;
  end if;
  return old;
end $$;

drop trigger if exists trg_audit_immutable on audit_events;
create trigger trg_audit_immutable before update or delete on audit_events
for each row execute function audit_immutable_guard();

-- DLP policies + events
create table if not exists dlp_policies (
  org_id uuid primary key references organizations(id) on delete cascade,
  action text not null default 'warn' check (action in ('off','warn','block')),
  patterns_json text not null default '[]',
  updated_at timestamptz not null default now()
);

create table if not exists dlp_events (
  id bigserial primary key,
  org_id uuid references organizations(id) on delete set null,
  actor_user_id uuid references users(id) on delete set null,
  source text,
  decision text,
  matches_json text,
  created_at timestamptz not null default now()
);
create index if not exists idx_dlp_events_org_created on dlp_events(org_id, created_at desc);

-- Legal holds
create table if not exists legal_holds (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  scope text not null check (scope in ('org','user','thread','message')),
  scope_id text,
  reason text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  released_at timestamptz
);
create index if not exists idx_legal_holds_org_created on legal_holds(org_id, created_at desc);

-- SCIM
create table if not exists scim_tokens (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  token_hash text not null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists idx_scim_tokens_org on scim_tokens(org_id, created_at desc);

create table if not exists scim_groups (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  display_name text not null,
  external_id text,
  created_at timestamptz not null default now(),
  unique(org_id, display_name)
);
create index if not exists idx_scim_groups_org on scim_groups(org_id, created_at desc);

create table if not exists scim_group_members (
  group_id uuid not null references scim_groups(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(group_id, user_id)
);

-- SIEM configs + outbox
create table if not exists siem_configs (
  org_id uuid primary key references organizations(id) on delete cascade,
  enabled boolean not null default false,
  provider text not null default 'splunk' check (provider in ('splunk','datadog')),
  endpoint text not null default '',
  token_enc text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists siem_outbox (
  id bigserial primary key,
  org_id uuid references organizations(id) on delete set null,
  provider text not null,
  endpoint text not null,
  token_enc text not null,
  payload_json text not null,
  tries integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now()
);
create index if not exists idx_siem_outbox_next on siem_outbox(next_attempt_at asc);

-- SAML signature validation material
alter table saml_configs add column if not exists idp_x509_cert_pem text;
alter table saml_configs add column if not exists want_assertions_signed boolean not null default true;
alter table saml_configs add column if not exists want_response_signed boolean not null default false;


-- --- Fortune-500 session management / revocation ---
alter table users add column if not exists disabled_at timestamptz;
alter table users add column if not exists disabled_reason text;

alter table organizations add column if not exists require_sso boolean not null default false;
alter table organizations add column if not exists session_idle_minutes integer not null default 120;
alter table organizations add column if not exists session_max_days integer not null default 14;

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  jti text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoke_reason text,
  ip_hash text,
  user_agent text
);

create index if not exists idx_sessions_user on sessions(user_id, created_at desc);
create index if not exists idx_sessions_jti on sessions(jti);
create index if not exists idx_sessions_revoked on sessions(revoked_at);


-- === Fortune-500+ Procurement Extensions v1.5.0 ===
-- OIDC SSO config + transient state (PKCE)
create table if not exists oidc_configs (
  org_id uuid primary key references organizations(id) on delete cascade,
  enabled boolean not null default false,
  issuer text not null,
  client_id text not null,
  client_secret_enc text not null,
  scopes text not null default 'openid email profile',
  allowed_domains_csv text,
  allowed_tenants_csv text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


alter table oidc_configs add column if not exists allowed_tenants_csv text;
create table if not exists oidc_states (
  id bigserial primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  state_hash text not null,
  code_verifier text not null,
  nonce text not null,
  redirect_uri text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_oidc_states_state_hash on oidc_states(state_hash);
create index if not exists idx_oidc_states_expires on oidc_states(expires_at);

alter table organizations add column if not exists sso_preferred text default 'saml';

-- SIEM runs + alerting
create table if not exists siem_runs (
  id bigserial primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  ran_at timestamptz not null default now(),
  sent integer not null default 0,
  failed integer not null default 0,
  duration_ms integer not null default 0,
  notes text
);
create index if not exists idx_siem_runs_org_time on siem_runs(org_id, ran_at desc);

create table if not exists siem_alert_configs (
  org_id uuid primary key references organizations(id) on delete cascade,
  enabled boolean not null default false,
  webhook_kind text default 'generic',
  webhook_url_enc text,
  email_to text,
  threshold_failed integer not null default 5,
  threshold_backlog integer not null default 200,
  threshold_oldest_minutes integer not null default 30,
  cooldown_minutes integer not null default 60,
  notify_on_recovery boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists siem_alert_events (
  id bigserial primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  alert_type text not null,
  payload_json text not null,
  sent_at timestamptz not null default now(),
  status text not null default 'sent',
  last_error text
);
create index if not exists idx_siem_alert_events_org_time on siem_alert_events(org_id, sent_at desc);
create index if not exists idx_siem_alert_events_type_time on siem_alert_events(alert_type, sent_at desc);
