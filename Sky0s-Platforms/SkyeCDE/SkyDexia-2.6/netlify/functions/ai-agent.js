const { handleCors, json, methodNotAllowed, requireSession, requireAuth } = require('./_lib/runtime');

exports.handler = async (event) => {
  const cors = handleCors(event, ['POST', 'OPTIONS']);
  if (cors) return cors;
  if (event.httpMethod !== 'POST') return methodNotAllowed(['POST', 'OPTIONS']);

  const session = await requireAuth(event);
  if (!session) return json(401, { error: 'Founder session or signed bearer token required.' });

  const gateBaseUrl = String(process.env.OMEGA_GATE_URL || '').trim().replace(/\/+$/, '');
  const gateToken = String(process.env.KAIXU_APP_TOKEN || '').trim();
  if (!gateBaseUrl) {
    return json(500, { error: 'OMEGA_GATE_URL is not configured on the server. This is expected until the internal 0megaSkyeGate deployment has its env vars installed.' });
  }
  if (!gateToken) {
    return json(500, { error: 'KAIXU_APP_TOKEN is not configured on the server. This is expected until the internal 0megaSkyeGate deployment has its env vars installed.' });
  }

  let input;
  try {
    input = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const files = Array.isArray(input.files) ? input.files : [];
  const activePath = String(input.activePath || '').trim();
  const model = String(input.model || process.env.KAIXU_AGENT_MODEL || process.env.OPENAI_AGENT_MODEL || 'kaixu/deep').trim();
  const prompt = String(input.prompt || '').trim();
  const mode = String(input.mode || 'plan').trim();
  const autonomy = String(input.autonomy || 'controlled').trim();
  const agentMemory = String(input.agentMemory || '').trim();
  const maxIterations = Math.max(1, Math.min(6, Number(input.max_iterations || 1) || 1));
  const contextDepth = String(input.contextDepth || 'balanced').trim();
  const operationBudget = Math.max(4, Math.min(96, Number(input.operationBudget || 32) || 32));
  const reasoningEffort = String(input.reasoningEffort || process.env.KAIXU_REASONING_EFFORT || process.env.OPENAI_REASONING_EFFORT || 'high').trim().toLowerCase();
  const allowedReasoningEffort = ['medium', 'high', 'xhigh'].includes(reasoningEffort) ? reasoningEffort : 'high';

  if (!prompt) {
    return json(400, { error: 'Prompt is required.' });
  }

  function truncate(text, limit) {
    const value = String(text || '');
    return value.length > limit ? value.slice(0, limit) + '\n/* ...truncated for context budget... */' : value;
  }

  function selectWorkspaceContext(list, active) {
    const normalized = list
      .map((file) => ({ path: String(file?.path || '').replace(/^\/+/, '').trim(), content: typeof file?.content === 'string' ? file.content : '' }))
      .filter((file) => file.path);
    const inventory = normalized.map((file) => ({ path: file.path, bytes: Buffer.byteLength(file.content, 'utf8') }));
    const preferred = [];
    const activeFile = normalized.find((file) => file.path === active);
    if (activeFile) preferred.push(activeFile);
    preferred.push(...normalized.filter((file) => file.path !== active).sort((a, b) => a.path.localeCompare(b.path)));

    const selected = [];
    let budget = 120000;
    for (const file of preferred) {
      if (selected.length >= 18) break;
      const allowance = file.path === active ? 24000 : 10000;
      const content = truncate(file.content, allowance);
      const cost = Buffer.byteLength(content, 'utf8');
      if (selected.length && budget - cost < 0) continue;
      budget -= cost;
      selected.push({ path: file.path, content });
    }
    return { inventory, selected };
  }

  const workspace = selectWorkspaceContext(files, activePath);

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      summary: { type: 'string' },
      reply: { type: 'string' },
      warnings: { type: 'array', items: { type: 'string' } },
      operations: {
        type: 'array',
        items: {
          anyOf: [
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                type: { type: 'string', const: 'rename' },
                from: { type: 'string', minLength: 1 },
                to: { type: 'string', minLength: 1 }
              },
              required: ['type', 'from', 'to']
            },
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                type: { type: 'string', enum: ['create', 'update', 'delete'] },
                path: { type: 'string', minLength: 1 },
                content: { type: 'string' }
              },
              required: ['type', 'path', 'content']
            }
          ]
        }
      },
      report: {
        type: 'object',
        additionalProperties: false,
        properties: {
          model: { type: 'string' },
          autonomy: { type: 'string' },
          mode: { type: 'string' },
          contextDepth: { type: 'string' },
          maxIterations: { type: 'number' },
          operationBudget: { type: 'number' },
          reasoningEffort: { type: 'string' },
          filesConsidered: { type: 'number' }
        },
        required: ['model', 'autonomy', 'mode', 'contextDepth', 'maxIterations', 'operationBudget', 'reasoningEffort', 'filesConsidered']
      }
    },
    required: ['summary', 'reply', 'warnings', 'operations', 'report']
  };

  const instructions = [
    'You are SkyDexia 2.6 Agent, a bounded code-editing assistant for a browser IDE.',
    'Work ONLY from the provided workspace context.',
    'Return only complete-file operations. Never return patches or ellipses for file content.',
    'Keep edits minimal and coherent with the existing project style.',
    'If the request is ambiguous or you lack enough file context, keep operations empty and explain what is missing in reply and warnings.',
    'When mode is "plan", you may still stage operations but do not behave as if they were already applied.',
    'When mode is "execute", produce the exact full-file operations that should be applied next.',
    'Respect the operation budget and prefer focused changes over sprawling rewrites.',
    'Use the requested reasoning effort aggressively but stay grounded in the provided workspace context.',
    'Do not invent binary assets, secrets, API keys, or fake external success.',
    'Return ONLY valid JSON that matches the requested schema.',
  ].join(' ');

  function safeJsonParse(text) {
    const source = String(text || '').trim();
    if (!source) return null;
    try {
      return JSON.parse(source);
    } catch {
      const start = source.indexOf('{');
      const end = source.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(source.slice(start, end + 1));
        } catch {
          return null;
        }
      }
      return null;
    }
  }

  const userPayload = {
    prompt,
    agent_memory: agentMemory,
    autonomy,
    mode,
    context_depth: contextDepth,
    max_iterations: maxIterations,
    operation_budget: operationBudget,
    reasoning_effort: allowedReasoningEffort,
    active_path: activePath || null,
    file_inventory: workspace.inventory,
    selected_files: workspace.selected,
  };

  try {
    const response = await fetch(`${gateBaseUrl}/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gateToken}`,
      },
      body: JSON.stringify({
        provider: process.env.KAIXU_AGENT_PROVIDER || 'openai',
        model,
        messages: [
          {
            role: 'system',
            content: `${instructions}\n\nReturn only JSON matching this schema exactly:\n${JSON.stringify(schema, null, 2)}`,
          },
          {
            role: 'user',
            content: JSON.stringify(userPayload, null, 2),
          },
        ],
        max_tokens: 12000,
        temperature: 0,
        metadata: {
          app_id: 'skydexia-2-6-agent',
          actor: session.sub,
          mode,
          autonomy,
          context_depth: contextDepth,
          reasoning_effort: allowedReasoningEffort,
          files_considered: workspace.selected.length,
        },
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const providerMessage = response.status === 401
        ? '0megaSkyeGate rejected the configured app token. Check KAIXU_APP_TOKEN for an invalid or expired secret.'
        : (payload?.error?.message || payload?.error || '0megaSkyeGate request failed. If the internal gate is not deployed yet, this failure is expected until deployment and env setup are complete.');
      return json(response.status || 500, { error: providerMessage, provider_payload: payload, provider_status: response.status || 500, provider_endpoint: '/v1/chat' });
    }

    let parsed;
    try {
      parsed = safeJsonParse(payload?.output_text || payload?.output?.text || payload?.text || '');
      if (parsed && parsed.report && !parsed.report.reasoningEffort) parsed.report.reasoningEffort = allowedReasoningEffort;
    } catch (error) {
      return json(502, { error: '0megaSkyeGate returned non-JSON output for the structured agent response.', raw_output: payload?.output_text || payload?.output?.text || null });
    }

    if (!parsed) {
      return json(502, { error: '0megaSkyeGate returned an empty or non-JSON agent response.', raw_output: payload?.output_text || payload?.output?.text || null });
    }

    return json(200, {
      ok: true,
      provider: 'kaixu-gate',
      provider_endpoint: '/v1/chat',
      result: parsed,
      usage: payload.usage || null,
      response_id: payload.trace_id || payload.id || null,
    });
  } catch (error) {
    return json(500, { error: error?.message || 'Unexpected ai-agent failure.' });
  }
};
