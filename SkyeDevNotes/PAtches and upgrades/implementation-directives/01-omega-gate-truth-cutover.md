# Implementation Directive 01 — 0megaGate Truth Cutover

## Command
```bash
cd /workspaces/SkyeCDE/Skye0s-s0l26
python3 "../PAtches and upgrades/omega_gate_truth_cutover.py" . https://0megaskyegate.skyesoverlondon.workers.dev
```

## What It Does
Scans all .html/.js/.ts/.json/.toml/.md/.yml files (excludes node_modules/.git).

---

## URL Replacements (~250 files)

| Old | New |
|-----|-----|
| https://kaixugateway13.netlify.app | https://0megaskyegate.skyesoverlondon.workers.dev |
| https://kaixu67.skyesoverlondon.workers.dev | https://0megaskyegate.skyesoverlondon.workers.dev |
| https://kaixu67.netlify.app | https://0megaskyegate.skyesoverlondon.workers.dev |
| https://kaixu0s.netlify.app | https://0megaskyegate.skyesoverlondon.workers.dev |
| https://kaixu0s.skyesoverlondon.workers.dev | https://0megaskyegate.skyesoverlondon.workers.dev |

---

## String Replacements (~250 files)

| Old | New |
|-----|-----|
| Kaixu Gate Xnth | 0megaSkyeGate |
| Gate Xnth | 0megaSkyeGate |
| Gateway13 | 0megaSkyeGate |
| kAIxuGateway13 | 0megaSkyeGate |
| kaixugateway13 | omegaskyegate |
| xnthgateway | omegaskyegate |
| XNTH POSTMORTEM | 0MEGASKYEGATE NORMALIZATION |

---

## Surgical File Patches (5 specific files)

### 1. `Sky0s-Platforms/SkaixuPro-IDE/SkaixuPro-IDE-Platform/netlify/functions/gateway-chat.js`
- BEFORE: `const UPSTREAM = 'https://kaixugateway13.netlify.app/.netlify/functions/gateway-chat';`
- AFTER:  `const UPSTREAM = (process.env.OMEGA_GATE_URL || 'https://0megaskyegate.skyesoverlondon.workers.dev') + '/.netlify/functions/gateway-chat';`

### 2. `Sky0s-Platforms/SkaixuPro-IDE/SkaixuPro-IDE-Platform/netlify/functions/gateway-stream.js`
- BEFORE: `const UPSTREAM = 'https://kaixugateway13.netlify.app/.netlify/functions/gateway-stream';`
- AFTER:  `const UPSTREAM = (process.env.OMEGA_GATE_URL || 'https://0megaskyegate.skyesoverlondon.workers.dev') + '/.netlify/functions/gateway-stream';`

### 3. `Sky0s-Platforms/SkyErrors/kAIxU-Brain/wrangler.toml`
- `KAIXU_BRAIN_DEFAULT_TARGET = "kaixu67"` → `"omega"`
- `KAIXU_BRAIN_BASE_KAIXU67 = "https://kaixu67.skyesoverlondon.workers.dev"` → placeholder URL

### 4. `Sky0s-Platforms/SkyErrors/kAIxU-Brain/README.md`
- `kaixu67|kaixu0s|flow32` → `omega|flow32`
- `` `kaixu67`, Delta Gate `` → `` `omega`, 0megaSkyeGate ``

### 5. `Sky0s-Platforms/Kaixu67/netlify.toml`
- Prepends: `; OMEGA_GATE_TRUTH: legacy Kaixu67 surface retained, upstream truth normalized externally`

---

## New Files Created by Script

- `omega-gate.config.js` (project root) — sets `window.OMEGA_GATE_URL` for all frontend pages
- `OMEGA_GATE_CUTOVER_REPORT.md` (project root) — full list of every file changed

---

## JS/TS Frontend Constant Upgrade

Any file containing:
```js
const GATE|API|API_BASE|GW|GW_URL|KAIXU_GATEWAY_FALLBACK|GATEWAY_DIRECT|KAIXU_GATEWAY_PRIMARY = 'https://0megaskyegate...'
```
Gets upgraded to:
```js
const GATE = (window.OMEGA_GATE_URL || localStorage.getItem('OMEGA_GATE_URL') || 'https://0megaskyegate...')
```
So the URL is runtime-configurable after deploy.

---

## Hotspot Directories (highest file count)

| Directory | Approx Files Touched |
|-----------|---------------------|
| `Sky0s-Platforms/Kaixu67/` | 60+ HTML files |
| `Sky0s-Platforms/SkaixuPro-IDE/SkaixuPro-IDE-Platform/` | 30+ files |
| `Sky0s-Platforms/KaixuSuper-IDE-(Internal Gate)/` | 15+ files |

---

## After Running — Commit and Push

```bash
cd /workspaces/SkyeCDE/Skye0s-s0l26
git add .
git commit -m "chore: omega gate truth cutover — normalize all legacy gate URLs and labels"
git push origin main
```
