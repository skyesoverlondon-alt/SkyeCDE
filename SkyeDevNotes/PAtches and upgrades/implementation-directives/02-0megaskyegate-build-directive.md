# Implementation Directive 02 — Build 0megaSkyeGate-The-Actual-Gate

## Target Directory
```
Sky0s-Platforms/0megaSkyeGate/0megaSkyeGate-The-Actual-Gate/
```
This folder becomes the single deployed source of truth. All frontends, brains, and hubs point here.

Canonical truth note: this directory is the source-of-truth gate implementation for the 0s and the full project. Any deployed `OMEGA_GATE_URL` values used elsewhere are runtime addresses for this gate, not separate gate authorities.

Pre-deploy note: client and function integrations in the rest of the repo may already be wired to this gate before this gate is deployed. In that state, failed calls are expected. The correct goal is to finish the integration wiring now so final deployment is just publishing this gate and filling the required env vars.

---

## Source Inventory (what we composite from)

| Source | Path | What It Contributes |
|--------|------|---------------------|
| **sky-currency-additive-pack** | `0megaSkyeGate/GatewayUpgrades/sky-currency-additive-pack/` | Core engine: multimodal routing (chat/stream/images/video/audio/realtime/embeddings), SkyFuel wallet/ledger, D1 DB, provider abstraction (OpenAI/Gemini/Anthropic), alias system, Bearer token auth, admin traces/jobs |
| **kAIxU-Brain** | `SkyErrors/kAIxU-Brain/` | SkyeErrors lane (D1 + R2 error ingest/list/admin), smoke audit (KV), brain resolver, multi-brain registry, SkyeErrors SDK |
| **KaixuSuper-IDE** | `KaixuSuper-IDE-(Internal Gate)/` | Key issuance / revoke / list patterns and functions |

---

## Build Steps — File by File

### Step 1 — Scaffold Base Engine
Copy entire `sky-currency-additive-pack/` verbatim into `0megaSkyeGate-The-Actual-Gate/` as the starting point.

```
src/index.ts              → keep, expand router imports
src/router.ts             → keep, add 11 new route registrations (step 2)
src/env.ts                → keep, expand with 6 new bindings (step 8)
src/types.ts              → keep, expand with error + token types
src/cloudflare.d.ts       → verbatim
src/auth/                 → verbatim (3 files)
src/ledger/               → verbatim (5 files)
src/providers/            → verbatim (5 files)
src/adapters/             → verbatim (7 files)
src/routing/              → verbatim (5 files)
src/db/schema.sql         → expand with errors tables (step 3)
src/db/queries.ts         → expand
src/db/migrations/0001_init.sql             → verbatim
src/db/migrations/0002_multimodal.sql       → verbatim
src/routes/health.ts      → verbatim
src/routes/models.ts      → verbatim
src/routes/chat.ts        → verbatim
src/routes/stream.ts      → verbatim
src/routes/images.ts      → verbatim
src/routes/videos.ts      → verbatim
src/routes/audio-speech.ts          → verbatim
src/routes/audio-transcriptions.ts  → verbatim
src/routes/realtime-session.ts      → verbatim
src/routes/embeddings.ts            → verbatim (NOW WIRED in step 2)
src/routes/usage.ts                 → verbatim
src/routes/wallet-balance.ts        → verbatim (NOW WIRED in step 2)
src/routes/jobs.ts                  → verbatim
src/routes/admin-traces.ts          → verbatim (NOW WIRED in step 2)
src/routes/admin-wallets.ts         → verbatim (NOW WIRED in step 2)
src/routes/admin-providers.ts       → verbatim (NOW WIRED in step 2)
src/routes/admin-aliases.ts         → verbatim (NOW WIRED in step 2)
src/routes/admin-routing.ts         → verbatim (NOW WIRED in step 2)
src/routes/admin-jobs.ts            → verbatim
src/routes/admin-job-actions.ts     → verbatim
src/routes/admin-upstream.ts        → verbatim
src/utils/                          → verbatim (10 files)
wrangler.jsonc                      → rename to wrangler.toml, expand (step 7)
package.json                        → keep, update name to "0megaskyegate"
tsconfig.json                       → verbatim
.dev.vars.example                   → expand with all vars (step 10)
```

---

### Step 2 — Wire 6 Unwired Routes in `src/router.ts`
These route files exist in sky-currency but are not imported/registered in the router. Add registrations for:
- `GET /v1/embeddings` — `src/routes/embeddings.ts`
- `GET /v1/wallet` — `src/routes/wallet-balance.ts`
- `GET /admin/providers` — `src/routes/admin-providers.ts`
- `GET /admin/aliases` — `src/routes/admin-aliases.ts`
- `GET /admin/wallets` — `src/routes/admin-wallets.ts`
- `GET /admin/routing` — `src/routes/admin-routing.ts`

---

### Step 3 — Port SkyeErrors Lane (source: `kAIxU-Brain/src/index.js`)
Create new TypeScript files:

**`src/routes/errors-ingest.ts`** — `POST /v1/errors/event`
- Writes event metadata to `SKYE_ERRORS_DB` (D1)
- Writes raw payload to `SKYE_ERRORS_RAW` (R2)
- Auth: app Bearer token (tenant scoped)

**`src/routes/errors-list.ts`** — `GET /v1/errors/events`, `GET /v1/errors/events/:id`
- Reads from `SKYE_ERRORS_DB`
- `:id` also fetches raw body from `SKYE_ERRORS_RAW`

**`src/routes/errors-admin.ts`** — `GET /admin/errors/events`, `POST /admin/errors/cleanup`
- Admin Bearer token required
- Cleanup purges rows older than `SKYE_ERRORS_RETENTION_DAYS`

**Migrations:**
- Create `src/db/migrations/0003_errors_tokens.sql`
- Source schema: `kAIxU-Brain/skye-errors/schema.sql`
```sql
CREATE TABLE skye_errors_events (
  event_id TEXT PRIMARY KEY,
  tenant_key TEXT NOT NULL,
  tenant_label TEXT,
  ts_ms INTEGER NOT NULL,
  level TEXT,
  name TEXT,
  message TEXT,
  fingerprint TEXT,
  request_method TEXT,
  request_url TEXT,
  cf_ray TEXT,
  release TEXT,
  environment TEXT,
  app TEXT,
  raw_r2_key TEXT NOT NULL
);
CREATE INDEX idx_skye_errors_tenant_ts ON skye_errors_events(tenant_key, ts_ms DESC);
CREATE INDEX idx_skye_errors_ts ON skye_errors_events(ts_ms DESC);
CREATE INDEX idx_skye_errors_fingerprint ON skye_errors_events(tenant_key, fingerprint);
```

**Copy verbatim:**
- `kAIxU-Brain/skye-errors/sdk/skye-errors-sdk.mjs` → `skye-errors/sdk/skye-errors-sdk.mjs`

---

### Step 4 — Port Smoke/Audit Lane (source: `kAIxU-Brain/src/index.js`)
Create:

**`src/routes/smoke.ts`**
- `GET /admin/smoke/audit` — configuration audit from KV
- `GET /admin/smoke/log` — smoke run history from KV
- `POST /admin/smoke/run` — trigger manual smoke test
- `GET /admin/smoke/endpoints` — list all endpoints
- `GET /smokehouse` — admin smoke HTML UI
- `POST /smokehouse` — execute smoke from UI

Uses `KAIXU_SMOKE_KV` binding.

---

### Step 5 — Port Brain Resolver (source: `kAIxU-Brain/src/index.js`)
Create:

**`src/routes/brains.ts`**
- `GET /admin/brains` — list registered brains (omega, flow32, etc.)
- `POST /admin/brains/resolve` — resolve target brain URL by ID string

New env vars to add to env.ts:
- `OMEGA_GATE_URL` — this gate's own deployed URL (self-reference for brain registry)
- `KAIXU_BRAIN_BASE_FLOW32` — Flow 3.2 brain endpoint

---

### Step 6 — Port Key Management (source: `KaixuSuper-IDE-(Internal Gate)/netlify/functions/`)
Source functions: `kaixu-keys-issue.js`, `kaixu-keys-list.js`, `kaixu-keys-revoke.js`

Create TypeScript ports:

**`src/routes/keys-issue.ts`** — `POST /admin/keys/issue`
- Generates token, hashes with SHA-256
- Inserts into existing `app_tokens` table in `DB` (sky_currency D1)
- Returns: `{ token, tokenId, appId, orgId, walletId, allowedAliases }`

**`src/routes/keys-list.ts`** — `GET /admin/keys/list`
- Reads `app_tokens` table (returns non-sensitive fields only, never raw token)

**`src/routes/keys-revoke.ts`** — `POST /admin/keys/revoke`
- Deletes or marks revoked in `app_tokens` by tokenId

No new tables needed — `app_tokens` already exists in `sky-currency` schema.

---

### Step 7 — Expand `wrangler.toml`
Merge all bindings from the three sources:

```toml
name = "0megaskyegate"
main = "src/index.ts"
compatibility_date = "2026-03-17"
compatibility_flags = ["nodejs_compat"]

[observability]
enabled = true

[vars]
APP_NAME = "Skyes Over London • 0megaSkyeGate"
APP_ENV = "production"
DEFAULT_CURRENCY = "SKYFUEL"
ENABLE_FALLBACKS = "true"
DEFAULT_MAX_SKYFUEL_PER_CALL = "60"
KAIXU_BRAIN_NAME = "0megaSkyeGate"
KAIXU_DEFAULT_MODEL = "kaixu/flash"
SKYE_ERRORS_ENABLED = "1"
SKYE_ERRORS_RETENTION_DAYS = "30"
SKYE_ERRORS_MAX_BODY_BYTES = "1048576"
KAIXU_SMOKE_AUTORUN = "1"

[[d1_databases]]
binding = "DB"
database_name = "sky_currency"
database_id = "REPLACE_AFTER_CREATE"

[[d1_databases]]
binding = "SKYE_ERRORS_DB"
database_name = "skye_errors_db"
database_id = "REPLACE_AFTER_CREATE"

[[kv_namespaces]]
binding = "KAIXU_SMOKE_KV"
id = "REPLACE_AFTER_CREATE"

[[r2_buckets]]
binding = "SKYE_ERRORS_RAW"
bucket_name = "skye-errors-raw"
```

---

### Step 8 — Expand `src/env.ts`
Add to the Env interface:
```typescript
SKYE_ERRORS_DB: D1Database
KAIXU_SMOKE_KV: KVNamespace
SKYE_ERRORS_RAW: R2Bucket
OMEGA_GATE_URL: string
KAIXU_BRAIN_BASE_FLOW32: string
SKYE_ERRORS_ADMIN_SECRET: string
SKYE_ERRORS_ENABLED: string
SKYE_ERRORS_RETENTION_DAYS: string
SKYE_ERRORS_MAX_BODY_BYTES: string
KAIXU_SMOKE_AUTORUN: string
```

---

### Step 9 — Create `omega-gate.config.js` at gate root
```js
// Runtime gate URL injection — include this script tag in any frontend HTML page
window.OMEGA_GATE_URL = window.OMEGA_GATE_URL
  || localStorage.getItem('OMEGA_GATE_URL')
  || 'https://0megaskyegate.skyesoverlondon.workers.dev';
```

---

### Step 10 — Expand `.dev.vars.example`
All environment variables merged from all three gates, grouped:

```
# === API KEYS (secrets — set via wrangler secret put) ===
OPENAI_API_KEY=
OPENAI_TEXT_KEY=
OPENAI_IMAGES_KEY=
OPENAI_VIDEOS_KEY=
OPENAI_AUDIO_KEY=
OPENAI_REALTIME_KEY=
OPENAI_PROJECT_ID=
GEMINI_API_KEY=
ANTHROPIC_API_KEY=

# === ADMIN AUTH ===
KAIXU_ADMIN_TOKEN=
ADMIN_MASTER_TOKEN=
SKYE_ERRORS_ADMIN_SECRET=

# === APP TOKENS (fallback, comma-separated) ===
KAIXU_APP_TOKENS=
KAIXU_APP_TOKENS_SHA256=

# === TOKEN AUTHORITY ===
KAIXU_TOKEN_VERIFY_URL=
KAIXU_NETLIFY_URLS=
KAIXU_SERVICE_SECRET=
KAIXU_VERIFY_TIMEOUT_MS=3500

# === MODEL OVERRIDES ===
OPENAI_TEXT_MODEL=gpt-5.4-mini
OPENAI_DEEP_MODEL=gpt-5.4
OPENAI_CODE_MODEL=gpt-5.4
OPENAI_VISION_MODEL=gpt-5.4
OPENAI_IMAGE_MODEL=gpt-image-1
OPENAI_VIDEO_MODEL=sora-2
OPENAI_SPEECH_MODEL=gpt-4o-mini-tts
OPENAI_TRANSCRIBE_MODEL=gpt-4o-transcribe
OPENAI_REALTIME_MODEL=gpt-realtime

# === BRANDING ===
KAIXU_PUBLIC_BRAND=Skyes Over London
KAIXU_GATE_NAME=0megaSkyeGate
APP_NAME=Skyes Over London • 0megaSkyeGate
APP_ENV=dev

# === BRAIN REGISTRY ===
OMEGA_GATE_URL=https://0megaskyegate.skyesoverlondon.workers.dev
KAIXU_BRAIN_BASE_FLOW32=

# === SKYE ERRORS ===
SKYE_ERRORS_ENABLED=1
SKYE_ERRORS_RETENTION_DAYS=30
SKYE_ERRORS_MAX_BODY_BYTES=1048576

# === SMOKE ===
KAIXU_SMOKE_AUTORUN=1
KAIXU_SMOKE_AUTORUN_GENERATE=1

# === FEATURE FLAGS ===
ENABLE_CHAT=true
ENABLE_STREAM=true
ENABLE_IMAGES=true
ENABLE_VIDEOS=true
ENABLE_AUDIO_SPEECH=true
ENABLE_AUDIO_TRANSCRIPTIONS=true
ENABLE_REALTIME=true
ENABLE_FALLBACKS=true
DEFAULT_MAX_SKYFUEL_PER_CALL=60
```

---

## Deploy Commands (Phase 2)

```bash
cd Sky0s-Platforms/0megaSkyeGate/0megaSkyeGate-The-Actual-Gate

npm install

# 1. Create Cloudflare resources
wrangler d1 create sky_currency
# → copy the database_id into wrangler.toml [[d1_databases]] binding = "DB"

wrangler d1 create skye_errors_db
# → copy the database_id into wrangler.toml [[d1_databases]] binding = "SKYE_ERRORS_DB"

wrangler kv:namespace create KAIXU_SMOKE_KV
# → copy the id into wrangler.toml [[kv_namespaces]]

wrangler r2 bucket create skye-errors-raw

# 2. Run migrations
wrangler d1 execute sky_currency --file=src/db/migrations/0001_init.sql
wrangler d1 execute sky_currency --file=src/db/migrations/0002_multimodal.sql
wrangler d1 execute skye_errors_db --file=src/db/migrations/0003_errors_tokens.sql

# 3. Set secrets
wrangler secret put OPENAI_API_KEY
wrangler secret put GEMINI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put KAIXU_ADMIN_TOKEN
wrangler secret put SKYE_ERRORS_ADMIN_SECRET

# 4. Deploy
wrangler deploy
# → outputs your real URL e.g. https://0megaskyegate.YOURACCOUNTNAME.workers.dev
```

---

## Phase 3 — Hot-Swap Placeholder URL → Real Deployed URL

After `wrangler deploy` outputs your real URL, run this one command:

```bash
REAL_URL="https://0megaskyegate.YOURACCOUNTNAME.workers.dev"

find /workspaces/SkyeCDE/Skye0s-s0l26 -type f \
  \( -name "*.js" -o -name "*.ts" -o -name "*.html" \
     -o -name "*.json" -o -name "*.md" \
     -o -name "*.toml" -o -name "*.yml" \) \
  ! -path "*/node_modules/*" ! -path "*/.git/*" \
  -exec sed -i "s|https://0megaskyegate.skyesoverlondon.workers.dev|$REAL_URL|g" {} +

git add .
git commit -m "chore: hot-swap gate URL to $REAL_URL"
git push origin main
```

Also update `OMEGA_GATE_URL` env var in any Netlify sites that point to this gate.

---

## Complete API Surface After Build

| Category | Endpoints |
|----------|-----------|
| **AI Inference** | `POST /v1/chat` `POST /v1/stream` `POST /v1/embeddings` `POST /v1/images` `POST /v1/videos` `POST /v1/audio/speech` `POST /v1/audio/transcriptions` `POST /v1/realtime/session` |
| **Jobs** | `GET /v1/images/:id` `GET /v1/videos/:id` `GET /v1/jobs/:id` |
| **Wallet** | `GET /v1/wallet` `GET /v1/usage` |
| **Discovery** | `GET /v1/health` `GET /v1/models` |
| **Error Reporting** | `POST /v1/errors/event` `GET /v1/errors/events` `GET /v1/errors/events/:id` |
| **Admin — Keys** | `POST /admin/keys/issue` `GET /admin/keys/list` `POST /admin/keys/revoke` |
| **Admin — Brains** | `GET /admin/brains` `POST /admin/brains/resolve` |
| **Admin — Infra** | `GET /admin/traces/:id` `GET /admin/upstream/:id` `GET /admin/jobs/:id` `POST /admin/retry/:id` `POST /admin/cancel/:id` |
| **Admin — Data** | `GET /admin/wallets` `GET /admin/providers` `GET /admin/aliases` `GET /admin/routing` |
| **Admin — Errors** | `GET /admin/errors/events` `POST /admin/errors/cleanup` |
| **Admin — Smoke** | `GET /admin/smoke/audit` `GET /admin/smoke/log` `POST /admin/smoke/run` `GET /smokehouse` `POST /smokehouse` |
