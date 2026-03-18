# RETIRED — KaixuSI Cloudflare Worker

This worker (`kaixusi`) has been retired and replaced by **0megaSkyeGate**.

## What this was

The KaixuSI worker was the internal AI intelligence layer for KaixuSuper-IDE.
It made direct calls to OpenAI / Anthropic / Gemini using platform API keys.

## Why it was retired

All AI calls are now routed through the sovereign 0megaSkyeGate:
```
https://0megaskyegate.skyesoverlondon.workers.dev
```

0megaSkyeGate is the single authorized intelligence layer across all Skye0s platforms.

## What replaced it

The Netlify functions in `../netlify/functions/` now forward to 0megaSkyeGate:
- `gateway-chat.js`    — chat calls (non-streaming)
- `gateway-stream.js`  — streaming SSE calls
- `ai-edit.js`         — synchronous AI code edits
- `ai-edit-run-background.js` — async AI code edits

Authentication is via `KAIXU_APP_TOKEN` (issue from 0megaSkyeGate admin API).

## Do NOT deploy this worker

Do not run `wrangler deploy` from this directory. The `wrangler.toml` is kept
for historical reference only.

If the Cloudflare dashboard still shows a live `kaixusi` worker:
1. Go to Cloudflare Workers → kaixusi → Settings
2. Disable it or delete it

Migration completed: 2026-03-17
