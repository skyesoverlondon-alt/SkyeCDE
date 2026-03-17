# skAIxuIDEpro — Build Directive / Auth-Gate Normalization Memo

Prepared from deep scan of: `skAIxuIDEpro (8) (1).zip`

## 1) What this build actually is

This archive is a **multi-app operator workspace bundle** built around a root launcher plus a primary IDE (`/skAIxuide/`), with several adjacent tools and a mixed local/Netlify runtime pattern.

Core runtime surfaces discovered:
- `package.json` — Node local runner + Netlify dev helper
- `server.js` — local static server + `/api/*` proxy + `/.netlify/functions/*` proxy
- `netlify/functions/gateway-chat.js` — upstream chat proxy
- `netlify/functions/gateway-stream.js` — upstream stream proxy
- `skAIxuide/server.py` — local Python admin/login + local API proxy
- multiple HTML apps that directly reference the Kaixu gateway or `/api/kaixu-key`

This is **not one unified runtime** yet. It is a functioning ecosystem bundle with overlapping gateway assumptions.

---

## 2) Current auth / gate verdict

### Current AI gate in use
The repo is routed against:

`https://kaixugateway13.netlify.app`

Observed in:
- `server.js`
- `netlify/functions/gateway-chat.js`
- `netlify/functions/gateway-stream.js`
- `skAIxuide/server.py`
- `skAIxuide/index.html`
- `skAIxuide/SmartIDE.html`
- `skAIxuide/SourceCode`
- `skyehawk.js`
- `GodCode/*`
- `KaiPrompt/index.html`
- `PlanItPro/PlanItPro.html`
- `skyeportal/index.html`
- `AI-Directives/kAIxuGateway13_integrationDirective.txt`

### Current auth model
There are **two different auth layers** in play:

1. **AI gateway auth**
   - credential: `KAIXU_VIRTUAL_KEY`
   - transport: `Authorization: Bearer <KAIXU_VIRTUAL_KEY>`
   - gate target: `kaixugateway13.netlify.app`

2. **Local admin auth**
   - file: `skAIxuide/server.py`
   - credential: `ADMIN_PASSWORD`
   - session cookie: `sk_admin_session`
   - intended use: local admin/login flow only

### Is the AI gate self-contained in this repo?
**No.**

This repo contains **proxies and callers**, but not the actual Gateway13 implementation itself. The current build is therefore **gateway-dependent**, not self-contained.

### Is the local login gate self-contained?
**Partly.**

The Python local login flow is packaged in this repo, but it is only a lightweight local-server auth layer. It is not a full production auth system.

---

## 3) Critical findings you should treat as hard truth

1. The build is **not self-contained** for AI routing.
2. The build uses **hard-coded gateway URLs** in many files.
3. The build exposes a local helper endpoint `/api/kaixu-key` that returns the Kaixu key in local/dev contexts.
4. The Python login layer contains a **default password fallback**:
   - `ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'DemonLordAtreyuxh')`
5. The repo currently mixes:
   - direct external gateway calls
   - local `/api` proxy calls
   - Netlify function proxy calls
   - Python local proxy behavior
6. This means the system works more like a **federated operator bundle** than a single normalized product.

---

## 4) Build directive — mandatory normalization path

This is the directive to apply if you want the codebase to become coherent, safer, and easier to maintain.

### Directive A — choose one truth for AI routing
You need a single source of truth for gateway routing.

Use these environment variables only:
- `KAIXU_GATEWAY_BASE`
- `KAIXU_GATEWAY_CHAT_URL`
- `KAIXU_GATEWAY_STREAM_URL`
- `KAIXU_AUTH_MODE`

Recommended values:
- `KAIXU_GATEWAY_BASE=/api`
- `KAIXU_GATEWAY_CHAT_URL=/api/.netlify/functions/gateway-chat` **or** `/api/.netlify/functions/gateway-chat` only if your redirect layer expects that exact shape
- `KAIXU_GATEWAY_STREAM_URL=/api/.netlify/functions/gateway-stream`
- `KAIXU_AUTH_MODE=kaixu-key`

If you keep Netlify proxying, then all browser-side code should hit **only local relative URLs**. Do not let browser code hardcode `https://kaixugateway13.netlify.app`.

### Directive B — eliminate hard-coded external gateway strings from UI files
Search and replace every browser-facing hard-coded occurrence of:

`https://kaixugateway13.netlify.app`

with a runtime-configured local-relative base.

Priority files:
- `skAIxuide/index.html`
- `skAIxuide/SmartIDE.html`
- `skAIxuide/SourceCode`
- `skAIxuide/diagnostics.html`
- `skyehawk.js`
- `GodCode/index.html`
- `GodCode/GodCode.html`
- `KaiPrompt/index.html`
- `PlanItPro/PlanItPro.html`
- `skyeportal/index.html`

### Directive C — pick one server/runtime pattern
Right now the repo has both:
- Node local server (`server.js`)
- Python local server (`skAIxuide/server.py`)
- Netlify serverless proxy functions

That is too much kitchen wizardry in one cauldron.

Pick one local-dev runtime:

#### Option 1 — Node-first
Keep:
- `server.js`
- `netlify/functions/*`

Deprecate or remove:
- `skAIxuide/server.py`
- `skAIxuide/login.html`
- `skAIxuide/admin_panel.html`

#### Option 2 — Python-first
Keep:
- `skAIxuide/server.py`

Then remove duplicated Node proxy behavior and make Netlify deployment mirror the same auth model.

### Directive D — remove default password fallback
This line must be changed:

`ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'DemonLordAtreyuxh')`

Required behavior:
- if `ADMIN_PASSWORD` is missing, fail closed
- do not boot admin auth with a fallback secret

### Directive E — `/api/kaixu-key` must be local-dev only
Current behavior returns key material from local env.

That endpoint is acceptable only for local operator development.
For any deployed environment:
- either remove it entirely
- or lock it behind authenticated operator-only access
- or return metadata only, not the key itself

### Directive F — unify credential storage policy
Current bundle uses `localStorage` in multiple tools for `KAIXU_VIRTUAL_KEY`.

That is convenient, but sloppy for a serious operator surface.

Minimum improvement path:
- keep `KAIXU_VIRTUAL_KEY` as the only AI credential
- do not store provider keys anywhere
- centralize key read/write into one shared helper module
- avoid every HTML file implementing its own key boot logic

### Directive G — if you want the gate to be self-contained, vendor the gate into the repo
Right now this repo is not self-contained because the actual gate lives elsewhere.

To make it self-contained, you must include the actual gateway implementation in this repo or in the same deploy boundary.

That means adding and wiring:
- the gateway request handlers themselves
- the token verification layer
- the provider routing layer
- the models endpoint
- the health endpoint
- the generate/chat endpoint
- the SSE stream endpoint
- any audit/logging/usage meter layer

Without that, the repo is **not** a self-contained gateway build.

---

## 5) Exact patch order

Apply patches in this order so you do not create a haunted spaghetti cave.

### Phase 1 — inventory and freeze
1. Search repo for:
   - `kaixugateway13.netlify.app`
   - `KAIXU_VIRTUAL_KEY`
   - `/api/kaixu-key`
   - `ADMIN_PASSWORD`
   - `sk_admin_session`
2. Freeze a snapshot branch before changing auth/gateway logic.

### Phase 2 — centralize config
Create one shared config module or one shared inline config block used everywhere:
- `window.__KAIXU_CONFIG__` for static HTML builds
- or `src/lib/kaixu-config.js` if you convert to a module architecture

Required fields:
- `gatewayBase`
- `chatPath`
- `streamPath`
- `isLocal`
- `allowKeyBootstrap`

### Phase 3 — centralize gateway client
Create one gateway client helper and force every app/tool to use it.

Required functions:
- `getKaixuGatewayBase()`
- `getKaixuKey()`
- `setKaixuKey()`
- `kaixuChat()`
- `kaixuStreamChat()`

### Phase 4 — remove browser hardcoding
Replace per-app gateway constants with shared config/helper calls.

### Phase 5 — lock down auth
- remove default admin password fallback
- fail closed when missing secrets
- stop exposing raw Kaixu key in production

### Phase 6 — decide self-contained vs external dependency
Choose one:

#### External-gate mode
Keep Gateway13 external, but make the repo explicit about it.
- document it clearly
- use env-configured base URLs only
- stop pretending the repo is self-contained

#### Self-contained mode
Import the actual gateway stack into this codebase or this deployment boundary.
- add full gateway handlers
- make `/api/*` resolve locally
- remove external dependency on `kaixugateway13.netlify.app`

---

## 6) Files that most urgently need adjustment

### Highest-priority auth/gateway files
- `server.js`
- `netlify/functions/gateway-chat.js`
- `netlify/functions/gateway-stream.js`
- `skAIxuide/server.py`
- `skAIxuide/index.html`
- `skAIxuide/SmartIDE.html`
- `skAIxuide/diagnostics.html`
- `skAIxuide/SourceCode`

### Secondary but still important
- `skyehawk.js`
- `GodCode/index.html`
- `GodCode/GodCode.html`
- `KaiPrompt/index.html`
- `PlanItPro/PlanItPro.html`
- `skyeportal/index.html`
- `DevProof Lab/netlify.toml`
- `DevProof Lab/_redirects`

---

## 7) Build configuration observed

### package manifest
Current root `package.json`:
- `type: module`
- `start: node server.js`
- `dev: node server.js`
- `netlify: netlify dev`
- dependency on `@neondatabase/serverless`
- dev dependency on `netlify-cli`

### Node local dev
Current local Node dev runs:
- `node server.js`
- serves static files
- proxies `/api/*`
- proxies `/.netlify/functions/*`
- exposes `/api/kaixu-key`

### Python local dev
Current local Python dev runs:
- `cd skAIxuide && python server.py`
- provides local login/admin gate
- proxies upstream gateway requests
- can inject bearer auth from `.env`

### Netlify functions
Observed root function files:
- `netlify/functions/gateway-chat.js`
- `netlify/functions/gateway-stream.js`
- `netlify/functions/logs.js`
- `netlify/functions/logs-setup.js`

Root-level `netlify.toml` was **not** visible in the scanned archive listing, so if the production deploy depends on root redirects/functions behavior, verify whether:
- root `netlify.toml` is missing from the ZIP
- or deploy config is being managed elsewhere

That little gremlin matters.

---

## 8) Final verdict for codebase adjustment

### Current state
- **AI gate used:** `kAIxuGateway13`
- **AI gate self-contained in repo:** **No**
- **Local admin auth self-contained:** **Partly**
- **Build style:** multi-app static/operator bundle with mixed proxy strategies

### What you should do next
If your goal is a cleaner codebase, the correct move is:
1. normalize all AI routing behind one local-relative gateway client
2. remove hard-coded external gateway URLs from browser code
3. remove the fallback admin password
4. decide whether this repo is meant to be:
   - an external-gate client bundle, or
   - a true self-contained gate-enabled product

Do not leave it in the current in-between state longer than necessary. That is how software grows extra eyeballs and starts whispering in the vents.

