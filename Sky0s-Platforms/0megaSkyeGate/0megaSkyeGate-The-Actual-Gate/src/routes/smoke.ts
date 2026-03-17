import type { Env } from '../types'
import { json } from '../utils/json'
import { verifyAdminToken } from '../auth/verifyAdminToken'
import { nowIso } from '../utils/clock'
import { generateId } from '../utils/ids'

const SMOKE_LOG_KEY = 'smoke:log'
const SMOKE_AUDIT_KEY = 'smoke:audit'

const ALL_ENDPOINTS = [
  'GET /v1/health', 'GET /v1/models', 'GET /v1/wallet', 'GET /v1/usage',
  'POST /v1/chat', 'POST /v1/stream', 'POST /v1/embeddings',
  'POST /v1/images', 'POST /v1/videos',
  'POST /v1/audio/speech', 'POST /v1/audio/transcriptions',
  'POST /v1/realtime/session',
  'GET /v1/errors/events',
  'POST /v1/errors/event',
  'GET /admin/brains', 'POST /admin/brains/resolve',
  'POST /admin/keys/issue', 'GET /admin/keys/list', 'POST /admin/keys/revoke',
  'GET /admin/wallets', 'GET /admin/providers', 'GET /admin/aliases', 'GET /admin/routing',
  'GET /admin/errors/events', 'POST /admin/errors/cleanup',
  'GET /admin/smoke/audit', 'GET /admin/smoke/log', 'POST /admin/smoke/run',
]

export async function handleSmokeEndpoints(_request: Request, env: Env): Promise<Response> {
  verifyAdminToken(_request, env)
  return json({ ok: true, endpoints: ALL_ENDPOINTS, count: ALL_ENDPOINTS.length })
}

export async function handleSmokeAudit(request: Request, env: Env): Promise<Response> {
  verifyAdminToken(request, env)
  const raw = env.KAIXU_SMOKE_KV ? await env.KAIXU_SMOKE_KV.get(SMOKE_AUDIT_KEY) : null
  const audit = raw ? JSON.parse(raw) : { checked_at: null, issues: [] }
  return json({ ok: true, audit })
}

export async function handleSmokeLog(request: Request, env: Env): Promise<Response> {
  verifyAdminToken(request, env)
  const raw = env.KAIXU_SMOKE_KV ? await env.KAIXU_SMOKE_KV.get(SMOKE_LOG_KEY) : null
  const log: unknown[] = raw ? JSON.parse(raw) : []
  return json({ ok: true, log })
}

export async function handleSmokeRun(request: Request, env: Env): Promise<Response> {
  verifyAdminToken(request, env)

  const runId = generateId('smoke')
  const ts = nowIso()
  const results: { endpoint: string; status: 'ok' | 'skip' | 'error'; note?: string }[] = []

  // Health check — only safe GET we can self-call without auth
  try {
    const healthUrl = new URL('/v1/health', 'https://0megaskyegate.skyesoverlondon.workers.dev')
    const r = await fetch(healthUrl.toString(), { method: 'GET' })
    results.push({ endpoint: 'GET /v1/health', status: r.ok ? 'ok' : 'error', note: `${r.status}` })
  } catch (e) {
    results.push({ endpoint: 'GET /v1/health', status: 'error', note: String(e) })
  }

  // All other endpoints: mark skip (require live tokens/bodies — manual test only)
  for (const ep of ALL_ENDPOINTS.slice(1)) {
    results.push({ endpoint: ep, status: 'skip', note: 'Requires auth token or request body — run via test client' })
  }

  const entry = { run_id: runId, ts, results }

  if (env.KAIXU_SMOKE_KV) {
    const raw = await env.KAIXU_SMOKE_KV.get(SMOKE_LOG_KEY)
    const log: unknown[] = raw ? JSON.parse(raw) : []
    log.unshift(entry)
    await env.KAIXU_SMOKE_KV.put(SMOKE_LOG_KEY, JSON.stringify(log.slice(0, 50)))
    await env.KAIXU_SMOKE_KV.put(SMOKE_AUDIT_KEY, JSON.stringify({ checked_at: ts, run_id: runId, issues: results.filter(r => r.status === 'error') }))
  }

  return json({ ok: true, run_id: runId, ts, results })
}

export async function handleSmokehouse(request: Request, env: Env): Promise<Response> {
  verifyAdminToken(request, env)
  if (request.method === 'GET') {
    const html = `<!DOCTYPE html><html><head><title>0megaSkyeGate Smokehouse</title>
<style>body{font:14px monospace;background:#07060d;color:#c9b8ff;padding:2rem}
button{background:#4a1fd8;color:#fff;border:none;padding:.5rem 1.5rem;cursor:pointer;border-radius:4px;margin-top:1rem}
pre{background:#0d0b1a;padding:1rem;overflow:auto;border-radius:4px;margin-top:1rem}</style></head>
<body><h2>0megaSkyeGate Smokehouse</h2>
<button onclick="run()">Run Smoke Test</button>
<pre id="out">Ready.</pre>
<script>
async function run(){
  document.getElementById('out').textContent='Running...';
  const r=await fetch('/admin/smoke/run',{method:'POST',headers:{'Authorization':'Bearer '+prompt('Admin token:')}});
  const d=await r.json();
  document.getElementById('out').textContent=JSON.stringify(d,null,2);
}
</script></body></html>`
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
  // POST — return log
  const raw = env.KAIXU_SMOKE_KV ? await env.KAIXU_SMOKE_KV.get(SMOKE_LOG_KEY) : null
  return json({ ok: true, log: raw ? JSON.parse(raw) : [] })
}
