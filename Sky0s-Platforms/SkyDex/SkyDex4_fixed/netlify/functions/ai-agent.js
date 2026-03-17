exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  if (!process.env.OPENAI_API_KEY) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'OPENAI_API_KEY is not configured on the server.' }) };
  }

  let input;
  try {
    input = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body.' }) };
  }

  const files = Array.isArray(input.files) ? input.files : [];
  const activePath = String(input.activePath || '').trim();
  const model = String(input.model || process.env.OPENAI_AGENT_MODEL || 'gpt-5.3-codex').trim();
  const prompt = String(input.prompt || '').trim();
  const mode = String(input.mode || 'plan').trim();
  const autonomy = String(input.autonomy || 'controlled').trim();
  const agentMemory = String(input.agentMemory || '').trim();
  const maxIterations = Math.max(1, Math.min(6, Number(input.max_iterations || 1) || 1));
  const contextDepth = String(input.contextDepth || 'balanced').trim();
  const operationBudget = Math.max(4, Math.min(96, Number(input.operationBudget || 32) || 32));
  const reasoningEffort = String(input.reasoningEffort || process.env.OPENAI_REASONING_EFFORT || 'high').trim().toLowerCase();
  const allowedReasoningEffort = ['medium', 'high', 'xhigh'].includes(reasoningEffort) ? reasoningEffort : 'high';

  if (!prompt) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Prompt is required.' }) };
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
    'You are SkyDex Agent, a bounded code-editing assistant for a browser IDE.',
    'Work ONLY from the provided workspace context.',
    'Return only complete-file operations. Never return patches or ellipses for file content.',
    'Keep edits minimal and coherent with the existing project style.',
    'If the request is ambiguous or you lack enough file context, keep operations empty and explain what is missing in reply and warnings.',
    'When mode is "plan", you may still stage operations but do not behave as if they were already applied.',
    'When mode is "execute", produce the exact full-file operations that should be applied next.',
    'Respect the operation budget and prefer focused changes over sprawling rewrites.',
    'Use the requested reasoning effort aggressively but stay grounded in the provided workspace context.',
    'Do not invent binary assets, secrets, API keys, or fake external success.',
  ].join(' ');

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
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        input: JSON.stringify(userPayload, null, 2),
        instructions,
        store: false,
        reasoning: { effort: allowedReasoningEffort },
        text: {
          format: {
            type: 'json_schema',
            name: 'skydex_agent_result',
            strict: true,
            schema,
          }
        }
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const providerMessage = response.status === 401
        ? 'OpenAI rejected the server key. Check OPENAI_API_KEY for an invalid, expired, wrong-project, or wrong-environment secret.'
        : (payload?.error?.message || 'OpenAI request failed.');
      return { statusCode: response.status || 500, headers, body: JSON.stringify({ error: providerMessage, provider_payload: payload, provider_status: response.status || 500, provider_endpoint: 'responses' }) };
    }

    let parsed;
    try {
      parsed = typeof payload.output_text === 'string' ? JSON.parse(payload.output_text) : null;
      if (parsed && parsed.report && !parsed.report.reasoningEffort) parsed.report.reasoningEffort = allowedReasoningEffort;
    } catch (error) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'OpenAI returned non-JSON output for the structured agent response.', raw_output: payload.output_text || null }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        provider: 'openai',
        provider_endpoint: 'responses',
        result: parsed,
        usage: payload.usage || null,
        response_id: payload.id || null,
      })
    };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error?.message || 'Unexpected ai-agent failure.' }) };
  }
};
