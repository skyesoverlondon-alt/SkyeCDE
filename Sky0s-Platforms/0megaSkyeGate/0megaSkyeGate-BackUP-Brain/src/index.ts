type Env = {
  APP_NAME?: string
  BACKUP_BRAIN_RUNNER_TOKEN?: string
  KAIXU_APP_TOKEN?: string
  KAIXU_BACKUP_ENDPOINT?: string
  KAIXU_BACKUP_MODEL?: string
  KAIXU_BACKUP_PROVIDER?: string
  KAIXU_BACKUP_TOKEN?: string
  KAIXU_BACKUP_UPSTREAM_TOKEN?: string
}

type BrainMessage = {
  role?: string
  content?: unknown
}

type BrainUsage = {
  prompt_tokens: number | null
  completion_tokens: number | null
  total_tokens: number | null
  exact: boolean
  source: 'provider' | 'estimated'
}

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...headers,
    },
  })
}

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('origin') || '*'
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'Origin',
  }
}

function normalizeEndpoint(raw: string): string {
  return String(raw || '').trim().replace(/\/+$/, '')
}

function normalizeModel(raw: string, env: Env): string {
  return String(raw || env.KAIXU_BACKUP_MODEL || 'kaixu/deep').trim() || 'kaixu/deep'
}

function normalizeProvider(raw: string, env: Env): string {
  return String(raw || env.KAIXU_BACKUP_PROVIDER || 'Skyes Over London Backup').trim() || 'Skyes Over London Backup'
}

function timingSafeEqual(left: string, right: string): boolean {
  const normalizedLeft = String(left || '')
  const normalizedRight = String(right || '')
  if (!normalizedLeft || !normalizedRight || normalizedLeft.length !== normalizedRight.length) {
    return false
  }

  let mismatch = 0
  for (let index = 0; index < normalizedLeft.length; index += 1) {
    mismatch |= normalizedLeft.charCodeAt(index) ^ normalizedRight.charCodeAt(index)
  }
  return mismatch === 0
}

function readBearerToken(request: Request): string {
  const header = request.headers.get('authorization') || request.headers.get('Authorization') || ''
  if (!header.startsWith('Bearer ')) {
    return ''
  }
  return header.slice('Bearer '.length).trim()
}

function getAllowedRunnerTokens(env: Env): string[] {
  return [
    env.BACKUP_BRAIN_RUNNER_TOKEN,
    env.KAIXU_BACKUP_TOKEN,
    env.KAIXU_APP_TOKEN,
  ].map((value) => String(value || '').trim()).filter(Boolean)
}

function verifyRunnerAuth(request: Request, env: Env): Response | null {
  const token = readBearerToken(request)
  const allowed = getAllowedRunnerTokens(env)
  if (token && allowed.some((candidate) => timingSafeEqual(token, candidate))) {
    return null
  }
  return json({ ok: false, error: 'Unauthorized backup brain caller.', brain: { route: 'backup', failed: true } }, 401, corsHeaders(request))
}

async function readBody(request: Request): Promise<{ text: string; body: any }> {
  const text = await request.text()
  try {
    return { text, body: text ? JSON.parse(text) : {} }
  } catch {
    return { text, body: {} }
  }
}

function compactError(data: any, text: string): string {
  const message = data?.error || data?.message || data?.raw || text || 'Backup brain request failed.'
  return String(message).replace(/\s+/g, ' ').trim().slice(0, 220)
}

function extractReply(data: any, text: string): string {
  return String(
    data?.text
      || data?.output?.text
      || data?.output
      || data?.choices?.[0]?.message?.content
      || text
      || '',
  ).trim()
}

function pickFirstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(0, Math.trunc(value))
    }
  }
  return null
}

function summarizeMessages(messages: BrainMessage[]): string {
  return messages
    .map((message) => {
      const content = typeof message?.content === 'string' ? message.content : JSON.stringify(message?.content ?? '')
      return `${String(message?.role || 'user')}: ${content}`.trim()
    })
    .filter(Boolean)
    .join('\n\n')
}

function estimateTokens(text: string): number | null {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return 0
  return Math.max(1, Math.ceil(normalized.length / 4))
}

function extractUsage(data: any, messages: BrainMessage[], reply: string): BrainUsage {
  const usage = data?.usage || data?.meta?.usage || data?.metrics?.usage || {}
  const promptTokens = pickFirstNumber(
    usage?.prompt_tokens,
    usage?.input_tokens,
    usage?.promptTokenCount,
    usage?.inputTokenCount,
    data?.prompt_tokens,
    data?.input_tokens,
  )
  const completionTokens = pickFirstNumber(
    usage?.completion_tokens,
    usage?.output_tokens,
    usage?.candidates_token_count,
    usage?.candidatesTokenCount,
    usage?.outputTokenCount,
    data?.completion_tokens,
    data?.output_tokens,
  )
  const totalTokens = pickFirstNumber(
    usage?.total_tokens,
    usage?.totalTokenCount,
    data?.total_tokens,
    promptTokens != null && completionTokens != null ? promptTokens + completionTokens : null,
  )

  if (promptTokens != null || completionTokens != null || totalTokens != null) {
    return {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens != null ? totalTokens : (promptTokens || 0) + (completionTokens || 0),
      exact: true,
      source: 'provider',
    }
  }

  const estimatedPrompt = estimateTokens(summarizeMessages(messages))
  const estimatedCompletion = estimateTokens(reply)
  return {
    prompt_tokens: estimatedPrompt,
    completion_tokens: estimatedCompletion,
    total_tokens: estimatedPrompt == null && estimatedCompletion == null ? null : (estimatedPrompt || 0) + (estimatedCompletion || 0),
    exact: false,
    source: 'estimated',
  }
}

function getUpstreamToken(env: Env): string {
  return String(env.KAIXU_BACKUP_UPSTREAM_TOKEN || env.KAIXU_BACKUP_TOKEN || env.KAIXU_APP_TOKEN || '').trim()
}

function buildUpstreamPayload(body: any, env: Env, stream: boolean) {
  return {
    provider: normalizeProvider(body?.provider, env),
    model: normalizeModel(body?.model || body?.engine || body?.alias, env),
    messages: Array.isArray(body?.messages) ? body.messages : [],
    metadata: {
      ...(body?.metadata || {}),
      brain_route: 'backup',
      backup_alias: String(body?.alias || body?.engine || '').trim() || null,
    },
    stream,
  }
}

async function handleGenerate(request: Request, env: Env): Promise<Response> {
  const unauthorized = verifyRunnerAuth(request, env)
  if (unauthorized) return unauthorized

  const { body } = await readBody(request)
  const messages = Array.isArray(body?.messages) ? body.messages as BrainMessage[] : []
  if (messages.length === 0) {
    return json({ ok: false, error: 'Missing messages.', brain: { route: 'backup', failed: true } }, 400, corsHeaders(request))
  }

  const endpoint = normalizeEndpoint(env.KAIXU_BACKUP_ENDPOINT || '')
  if (!endpoint) {
    return json({ ok: false, error: 'Backup brain not configured.', brain: { route: 'backup', failed: true } }, 503, corsHeaders(request))
  }

  const upstreamToken = getUpstreamToken(env)
  if (!upstreamToken) {
    return json({ ok: false, error: 'Backup brain token not configured.', brain: { route: 'backup', failed: true } }, 500, corsHeaders(request))
  }

  const provider = normalizeProvider(body?.provider, env)
  const model = normalizeModel(body?.model || body?.engine || body?.alias, env)

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${upstreamToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(buildUpstreamPayload(body, env, false)),
    })

    const upstreamText = await upstream.text()
    let data: any = null
    try {
      data = upstreamText ? JSON.parse(upstreamText) : null
    } catch {
      data = { raw: upstreamText }
    }

    const requestId = String(upstream.headers.get('x-kaixu-request-id') || data?.brain?.request_id || '').trim() || null
    const reply = extractReply(data, upstreamText)
    const usage = extractUsage(data, messages, reply)

    if (!upstream.ok || !reply) {
      return json({
        ok: false,
        error: `Backup brain failed (${upstream.status})${requestId ? ` [${requestId}]` : ''}: ${compactError(data, upstreamText)}`,
        brain: { route: 'backup', failed: true, provider, model, request_id: requestId },
      }, 502, corsHeaders(request))
    }

    return json({
      ok: true,
      text: reply,
      brain: { route: 'backup', provider, model, request_id: requestId },
      usage,
    }, 200, corsHeaders(request))
  } catch (error) {
    return json({
      ok: false,
      error: String(error instanceof Error ? error.message : error || 'Backup brain request failed.').replace(/\s+/g, ' ').trim().slice(0, 220),
      brain: { route: 'backup', failed: true, provider, model, request_id: null },
    }, 502, corsHeaders(request))
  }
}

async function handleGenerateStream(request: Request, env: Env): Promise<Response> {
  const unauthorized = verifyRunnerAuth(request, env)
  if (unauthorized) return unauthorized

  const { body } = await readBody(request)
  const messages = Array.isArray(body?.messages) ? body.messages as BrainMessage[] : []
  if (messages.length === 0) {
    return json({ ok: false, error: 'Missing messages.', brain: { route: 'backup', failed: true } }, 400, corsHeaders(request))
  }

  const endpoint = normalizeEndpoint(env.KAIXU_BACKUP_ENDPOINT || '')
  if (!endpoint) {
    return json({ ok: false, error: 'Backup brain not configured.', brain: { route: 'backup', failed: true } }, 503, corsHeaders(request))
  }

  const upstreamToken = getUpstreamToken(env)
  if (!upstreamToken) {
    return json({ ok: false, error: 'Backup brain token not configured.', brain: { route: 'backup', failed: true } }, 500, corsHeaders(request))
  }

  const provider = normalizeProvider(body?.provider, env)
  const model = normalizeModel(body?.model || body?.engine || body?.alias, env)

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        accept: 'text/event-stream',
        authorization: `Bearer ${upstreamToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(buildUpstreamPayload(body, env, true)),
    })

    const contentType = String(upstream.headers.get('content-type') || '').toLowerCase()
    if (!upstream.ok || !contentType.includes('text/event-stream') || !upstream.body) {
      const upstreamText = await upstream.text()
      let data: any = null
      try {
        data = upstreamText ? JSON.parse(upstreamText) : null
      } catch {
        data = { raw: upstreamText }
      }

      return json({
        ok: false,
        stream_supported: false,
        error: `Backup brain streaming unavailable (${upstream.status}): ${compactError(data, upstreamText)}`,
        brain: {
          route: 'backup',
          failed: true,
          provider,
          model,
          request_id: String(upstream.headers.get('x-kaixu-request-id') || '').trim() || null,
        },
      }, 409, corsHeaders(request))
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...corsHeaders(request),
        'cache-control': 'no-cache, no-transform',
        'content-type': 'text/event-stream; charset=utf-8',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      },
    })
  } catch (error) {
    return json({
      ok: false,
      error: String(error instanceof Error ? error.message : error || 'Backup brain request failed.').replace(/\s+/g, ' ').trim().slice(0, 220),
      brain: { route: 'backup', failed: true, provider, model, request_id: null },
    }, 502, corsHeaders(request))
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }

    if (request.method === 'GET' && path === '/health') {
      return json({ ok: true, name: env.APP_NAME || '0megaSkyeGate Backup Brain', route: 'backup' }, 200, corsHeaders(request))
    }

    if (request.method === 'GET' && path === '/') {
      return json({
        ok: true,
        name: env.APP_NAME || '0megaSkyeGate Backup Brain',
        endpoints: ['/health', '/v1/brain/backup/generate', '/v1/brain/backup/generate-stream'],
      }, 200, corsHeaders(request))
    }

    if (request.method === 'POST' && path === '/v1/brain/backup/generate') {
      return await handleGenerate(request, env)
    }

    if (request.method === 'POST' && path === '/v1/brain/backup/generate-stream') {
      return await handleGenerateStream(request, env)
    }

    return json({ ok: false, error: 'Not found.' }, 404, corsHeaders(request))
  },
}