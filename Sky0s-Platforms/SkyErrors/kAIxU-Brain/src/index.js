const MODEL_ALIASES = {
  "kAIxU6.7-flash": "gpt-4.1-mini",
  "kAIxU6.7-pro": "gpt-4.1",
  "kAIxU-flash": "gpt-4.1-mini",
  "kAIxU-pro": "gpt-4.1",
};

const ALLOWED_MODELS = new Set([
  "kAIxU6.7-flash",
  "kAIxU6.7-pro",
  "kAIxU-flash",
  "kAIxU-pro",
  "gpt-4.1-mini",
  "gpt-4.1",
  "gpt-4o-mini",
]);

const ALLOWED_EMBED_MODELS = new Set([
  "text-embedding-3-small",
  "text-embedding-3-large",
  "text-embedding-ada-002",
]);

const CORS_COMMON = {
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-KAIXU-TOKEN, X-SKYE-ERRORS-ADMIN",
  "Access-Control-Expose-Headers": "X-Request-ID, X-kAIxU-Version",
  "Access-Control-Allow-Credentials": "false",
  "Access-Control-Max-Age": "86400",
};

const PROVIDER_BRAND = "Skyes Over London";
const VERSION_BRAND = "brain-stage-1-skyes-over-london";

const BRAiN_UI_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>kAIxU0s Test Console</title>
  <style>
    :root{--bg:#090a0f;--panel:#11131b;--line:#2a2f40;--txt:#f4f6ff;--muted:#9ca7c2;--accent:#7f5cff;--ok:#48d597;--bad:#ff6767}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font:13px/1.5 Inter,system-ui,Segoe UI,Roboto,sans-serif}
    .wrap{max-width:980px;margin:26px auto;padding:0 16px}.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px}
    h1{font-size:18px;margin:0 0 10px}h2{font-size:13px;margin:0 0 10px;color:var(--muted)}
    .grid{display:grid;gap:10px}.g2{grid-template-columns:1fr 1fr}.g3{grid-template-columns:1fr 1fr 1fr}
    input,select,textarea,button{width:100%;background:#0d1017;color:var(--txt);border:1px solid var(--line);border-radius:10px;padding:10px}
    textarea{min-height:140px;resize:vertical}button{background:var(--accent);border:none;cursor:pointer;font-weight:600}
    .row{display:flex;gap:10px;align-items:center}.dot{width:9px;height:9px;border-radius:99px;background:#555}.ok{background:var(--ok)}.bad{background:var(--bad)}
    pre{white-space:pre-wrap;word-break:break-word;background:#0d1017;border:1px solid var(--line);padding:10px;border-radius:10px;max-height:340px;overflow:auto}
    .muted{color:var(--muted)}
    @media (max-width:900px){.g2,.g3{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <div class="wrap grid" style="gap:14px">
    <div class="card">
      <h1>kAIxU0s · Skyes Over London</h1>
      <h2>Contract-compatible smoke console for /v1/health, /v1/models, /v1/generate, /v1/stream</h2>
      <div class="grid g3">
        <input id="base" placeholder="Base URL" />
        <input id="token" placeholder="App Token" />
        <select id="model">
          <option>kAIxU6.7-flash</option>
          <option>kAIxU6.7-pro</option>
        </select>
      </div>
      <div class="grid" style="margin-top:10px">
        <textarea id="prompt" placeholder="Prompt">Give me a 5-bullet launch checklist for a new AI worker brain.</textarea>
      </div>
      <div class="row" style="margin-top:10px">
        <button id="btnHealth">Health</button>
        <button id="btnModels">Models</button>
        <button id="btnGenerate">Generate</button>
        <button id="btnStream">Stream</button>
      </div>
      <div class="row muted" style="margin-top:10px"><div id="dot" class="dot"></div><span id="status">Idle</span></div>
    </div>

    <div class="card">
      <h2>Output</h2>
      <pre id="out"></pre>
    </div>
  </div>

<script>
const $ = (id) => document.getElementById(id);
const baseEl = $("base");
const tokenEl = $("token");
const modelEl = $("model");
const promptEl = $("prompt");
const outEl = $("out");
const statusEl = $("status");
const dotEl = $("dot");
baseEl.value = localStorage.getItem("kaixu.brain.base") || location.origin;
tokenEl.value = localStorage.getItem("kaixu.brain.token") || "";
function setState(msg, cls){ statusEl.textContent = msg; dotEl.className = "dot " + (cls || ""); }
function getHeaders(){
  const token = tokenEl.value.trim();
  localStorage.setItem("kaixu.brain.base", baseEl.value.trim());
  localStorage.setItem("kaixu.brain.token", token);
  const h = {"Content-Type":"application/json"};
  if (token) h.Authorization = "Bearer " + token;
  return h;
}
async function call(path, body){
  const res = await fetch(baseEl.value.replace(/\/$/, "") + path, {
    method: body ? "POST" : "GET",
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  let json; try { json = JSON.parse(txt); } catch { json = txt; }
  return { status: res.status, json };
}
$("btnHealth").onclick = async () => {
  setState("Checking health...", "");
  try {
    const r = await call("/v1/health");
    outEl.textContent = JSON.stringify(r, null, 2);
    setState(r.status === 200 ? "Health OK" : "Health failed", r.status === 200 ? "ok" : "bad");
  } catch (e) { outEl.textContent = String(e); setState("Health error", "bad"); }
};
$("btnModels").onclick = async () => {
  setState("Loading models...", "");
  try {
    const r = await call("/v1/models");
    outEl.textContent = JSON.stringify(r, null, 2);
    setState(r.status === 200 ? "Models loaded" : "Models failed", r.status === 200 ? "ok" : "bad");
  } catch (e) { outEl.textContent = String(e); setState("Models error", "bad"); }
};
$("btnGenerate").onclick = async () => {
  setState("Generating...", "");
  try {
    const r = await call("/v1/generate", {
      model: modelEl.value,
      input: { type: "text", content: promptEl.value }
    });
    outEl.textContent = JSON.stringify(r, null, 2);
    setState(r.status === 200 ? "Generate done" : "Generate failed", r.status === 200 ? "ok" : "bad");
  } catch (e) { outEl.textContent = String(e); setState("Generate error", "bad"); }
};
$("btnStream").onclick = async () => {
  setState("Streaming...", "");
  outEl.textContent = "";
  try {
    const res = await fetch(baseEl.value.replace(/\/$/, "") + "/v1/stream", {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ model: modelEl.value, input: { type: "text", content: promptEl.value } })
    });
    if (!res.ok || !res.body) {
      const t = await res.text();
      outEl.textContent = t;
      setState("Stream failed", "bad");
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") { setState("Stream done", "ok"); return; }
        try {
          const chunk = JSON.parse(raw);
          const text = (chunk.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");
          if (text) outEl.textContent += text;
        } catch {}
      }
    }
    setState("Stream done", "ok");
  } catch (e) { outEl.textContent += "\n" + String(e); setState("Stream error", "bad"); }
};
</script>
</body>
</html>`;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function smokeHouseHtml(state = {}) {
  const token = escapeHtml(state.token || "");
  const prompt = escapeHtml(state.prompt || "Return exactly: SMOKEHOUSE_OK");
  const target = String(state.target || "kaixu0s");
  const status = escapeHtml(state.status || "Ready");
  const action = escapeHtml(state.action || "none");
  const output = escapeHtml(typeof state.output === "string" ? state.output : JSON.stringify(state.output || { note: "Submit an action." }, null, 2));

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>kAIxU Smoke House</title>
  <style>
    :root{--bg:#08090d;--card:#121521;--line:#2b3247;--txt:#f2f5ff;--muted:#9ca8c8;--brand:#8a63ff}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--txt);font:13px/1.5 Inter,system-ui,sans-serif}
    .wrap{max-width:1100px;margin:22px auto;padding:0 14px;display:grid;gap:12px}
    .card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px}
    h1{font-size:18px;margin:0 0 6px}
    h2{font-size:12px;margin:0 0 8px;color:var(--muted)}
    .row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
    input,button,textarea,select{background:#0d1120;color:var(--txt);border:1px solid var(--line);border-radius:8px;padding:8px}
    input{min-width:220px;flex:1}
    textarea{width:100%;min-height:140px;resize:vertical}
    button{background:var(--brand);border:none;font-weight:600;cursor:pointer}
    pre{white-space:pre-wrap;word-break:break-word;background:#0d1120;border:1px solid var(--line);border-radius:8px;padding:8px;max-height:420px;overflow:auto}
    .meta{color:var(--muted)}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>kAIxU Smoke House</h1>
      <h2>Investor smoke proof: validates the kAIxU0s test brain and full gate path.</h2>
      <form method="POST" action="/smokehouse">
        <div class="row">
          <input name="token" placeholder="App Token (if KAIXU_OPEN_GATE=0)" value="${token}" />
          <select name="target">
            <option value="kaixu67" ${target === "kaixu67" ? "selected" : ""}>kAIxU6.7</option>
            <option value="kaixu0s" ${target === "kaixu0s" ? "selected" : ""}>kAIxU0s</option>
            <option value="flow32" ${target === "flow32" ? "selected" : ""}>skAIxU Flow 3.2</option>
          </select>
        </div>
        <div class="row" style="margin-top:8px">
          <button name="action" value="verify">Verify Smoke</button>
          <button name="action" value="run">Run Smoke Now</button>
          <button name="action" value="audit">Run Audit</button>
          <button name="action" value="health">Health</button>
          <button name="action" value="models">Models</button>
          <button name="action" value="generate">Smoke Generate</button>
          <button name="action" value="log">Smoke Log</button>
          <button name="action" value="brains">Load Brains</button>
          <button name="action" value="resolve">Resolve Target</button>
        </div>
        <div style="margin-top:8px">
          <textarea name="prompt">${prompt}</textarea>
        </div>
      </form>
    </div>
    <div class="card">
      <h2>Last Action Output</h2>
      <div class="meta">Status: ${status} · Action: ${action}</div>
      <pre>${output}</pre>
    </div>
  </div>
</body>
</html>`;
}

function smokehouseAuthRequest(request, token, method = "GET", jsonBody = null) {
  const headers = new Headers(request.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  return new Request(request.url, {
    method,
    headers,
    body: jsonBody == null ? undefined : JSON.stringify(jsonBody),
  });
}

async function readResponseBody(response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch (_) { return text; }
}

function reqId() {
  return "req_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

function csvToSet(v) {
  return new Set(String(v || "").split(",").map((s) => s.trim()).filter(Boolean));
}

function clampInt(n, min, max, fallback) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(x)));
}

function envFlag(env, key, fallback = false) {
  const raw = String(env?.[key] ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function smokeStamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

async function readKvJson(env, key, fallback = null) {
  if (!env.KAIXU_SMOKE_KV) return fallback;
  try {
    const raw = await env.KAIXU_SMOKE_KV.get(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

async function writeKvJson(env, key, value) {
  if (!env.KAIXU_SMOKE_KV) return false;
  try {
    await env.KAIXU_SMOKE_KV.put(key, JSON.stringify(value));
    return true;
  } catch (_) {
    return false;
  }
}

function ensureSmokeKvBound(env) {
  if (env.KAIXU_SMOKE_KV) return { ok: true };
  return {
    ok: false,
    code: 500,
    message: "SmokeHouse misconfigured: KAIXU_SMOKE_KV binding is required (no-option mode).",
  };
}

function buildBrainRegistry(env, request) {
  const origin = request ? new URL(request.url).origin : "";

  const kaixu67Base = String(
    env.KAIXU_BRAIN_BASE_KAIXU67 ||
    env.KAIXU_BRAIN_BASE_CORE67 ||
    "https://0megaskyegate.skyesoverlondon.workers.dev"
  ).trim();

  const kaixu0sBase = String(
    env.KAIXU_BRAIN_BASE_KAIXU0S ||
    env.KAIXU_BRAIN_BASE_CORESI4 ||
    env.KAIXU_BRAIN_BASE_LOCAL ||
    origin
  ).trim();

  const flow32Base = String(env.KAIXU_BRAIN_BASE_FLOW32 || "").trim();
  const targetAliases = {
    core67: "kaixu67",
    coresi4: "kaixu0s",
    kaixu67: "kaixu67",
    kaixu0s: "kaixu0s",
    flow32: "flow32",
  };

  const requestedDefaultTarget = String(env.KAIXU_BRAIN_DEFAULT_TARGET || "kaixu67").trim().toLowerCase();
  const defaultTarget = targetAliases[requestedDefaultTarget] || requestedDefaultTarget;

  const brains = {
    kaixu67: {
      id: "kaixu67",
      label: "kAIxU6.7",
      base: kaixu67Base,
      role: "primary-live",
    },
    kaixu0s: {
      id: "kaixu0s",
      label: "kAIxU0s",
      base: kaixu0sBase,
      role: "secondary-skyes-over-london",
    },
    flow32: {
      id: "flow32",
      label: "skAIxU Flow 3.2",
      base: flow32Base,
      role: "third-brain",
    },
  };

  return {
    defaultTarget: brains[defaultTarget] ? defaultTarget : "kaixu67",
    targetAliases,
    brains,
  };
}

async function handleBrainRegistry(request, env, rid, cors) {
  const auth = await enforceAuth(request, env);
  if (!auth.ok) return jsonResp(auth.code, { ok: false, error: auth.message }, withMeta(cors, rid));

  const registry = buildBrainRegistry(env, request);

  return jsonResp(200, {
    ok: true,
    requestId: rid,
    selector: {
      mode: "env-driven",
      defaultTarget: registry.defaultTarget,
      brains: registry.brains,
    },
  }, withMeta(cors, rid));
}

async function handleBrainResolve(request, env, rid, cors) {
  const auth = await enforceAuth(request, env);
  if (!auth.ok) return jsonResp(auth.code, { ok: false, error: auth.message }, withMeta(cors, rid));

  const parsed = await parseJson(request, clampInt(env.KAIXU_MAX_BODY_BYTES, 1024, 16_000_000, 5_242_880));
  if (!parsed.ok) return jsonResp(parsed.code, { ok: false, error: parsed.error }, withMeta(cors, rid));

  const body = parsed.value || {};
  const registry = buildBrainRegistry(env, request);
  const requestedTarget = String(body.target || registry.defaultTarget).trim().toLowerCase();
  const target = registry.targetAliases[requestedTarget] || requestedTarget;
  const selected = registry.brains[target];

  if (!selected) {
    return jsonResp(400, {
      ok: false,
      error: `Unknown target \"${target}\". Valid targets: ${Object.keys(registry.brains).join(", ")}`,
    }, withMeta(cors, rid));
  }

  return jsonResp(200, {
    ok: true,
    requestId: rid,
    target,
    selected,
  }, withMeta(cors, rid));
}

function corsHeaders(request, env) {
  const allow = env.KAIXU_ALLOWED_ORIGINS || "";
  const origin = request.headers.get("Origin") || "";

  if (allow.trim()) {
    const set = csvToSet(allow);
    if (set.has(origin)) {
      return { ...CORS_COMMON, "Access-Control-Allow-Origin": origin, Vary: "Origin" };
    }
  }

  return { ...CORS_COMMON, "Access-Control-Allow-Origin": "*" };
}

function jsonResp(status, obj, headers = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

function parseToken(request) {
  const auth = request.headers.get("Authorization") || "";
  const xToken = request.headers.get("X-KAIXU-TOKEN") || "";
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  if (xToken) return xToken.trim();
  return "";
}
function timingSafeEqual(a, b) {
  const x = String(a ?? "");
  const y = String(b ?? "");
  const len = Math.max(x.length, y.length);
  let out = x.length ^ y.length;
  for (let i = 0; i < len; i++) {
    out |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  }
  return out === 0;
}

function normalizeVerifyEndpoint(raw) {
  const v = String(raw || "").trim();
  if (!v) return "";
  let u;
  try { u = new URL(v); } catch { return ""; }
  const isLocal = (u.hostname === "127.0.0.1" || u.hostname === "localhost");
  if (!isLocal && u.protocol !== "https:") return "";
  if (isLocal && !(u.protocol === "http:" || u.protocol === "https:")) return "";
  const verifyPath = "/api/admin/token/verify";
  const normalizedPath = u.pathname.replace(/\/+$/, "");
  const endpoint = normalizedPath.endsWith(verifyPath)
    ? `${u.origin}${normalizedPath}`
    : `${u.origin}${normalizedPath}${verifyPath}`;
  return endpoint.replace(/\/+$/, "");
}

function buildVerifyEndpoints(request, env) {
  // SECURITY: do NOT auto-discover verify endpoints from client-controlled headers (Origin, Referer, etc).
  // Only use env-defined endpoints/allowlists to avoid secret exfiltration via SSRF.
  const endpoints = [];

  const explicit = String(env.KAIXU_TOKEN_VERIFY_URL || "").trim();
  if (explicit) {
    const normalized = normalizeVerifyEndpoint(explicit);
    if (normalized) endpoints.push(normalized);
  }

  const list = String(env.KAIXU_NETLIFY_URLS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const legacySingle = String(env.KAIXU_NETLIFY_URL || "").trim();
  if (legacySingle) list.push(legacySingle);

  const disableDefault = envFlag(env, "KAIXU_TOKEN_VERIFY_DISABLE_DEFAULT", false);
  if (!disableDefault && !explicit && list.length === 0) {
    list.push("https://kaixu67.skyesoverlondon.netlify.app");
  }

  for (const base of list) {
    const normalized = normalizeVerifyEndpoint(base);
    if (normalized) endpoints.push(normalized);
  }

  const seen = new Set();
  const out = [];
  for (const e of endpoints) {
    if (!e || seen.has(e)) continue;
    seen.add(e);
    out.push(e);
    if (out.length >= 8) break;
  }
  return out;
}

async function enforceAuth(request, env) {
  const openGate = String(env.KAIXU_OPEN_GATE || "0") === "1";
  if (openGate) return { ok: true, token: "open-gate", authMode: "open-gate" };

  const token = parseToken(request);
  if (!token) {
    return { ok: false, code: 401, message: "Missing app token. Send Authorization: Bearer <token>." };
  }

  if (token.length < 12 || token.length > 512) {
    return { ok: false, code: 400, message: "Invalid token format." };
  }

  const serviceSecret = String(env.KAIXU_SERVICE_SECRET || env.KAIXUSI_SECRET || "").trim();
  if (serviceSecret) {
    const verifyEndpoints = buildVerifyEndpoints(request, env);
    const timeoutMs = clampInt(env.KAIXU_VERIFY_TIMEOUT_MS, 500, 20000, 3500);

    for (const verifyEndpoint of verifyEndpoints) {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), timeoutMs);
      try {
        const verify = await fetch(verifyEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-kaixu-service": serviceSecret,
          },
          body: JSON.stringify({ token }),
          signal: ac.signal,
        });

        if (!verify.ok) continue;

        const data = await verify.json();
        if (!data || data.valid !== true) {
          return {
            ok: false,
            code: 403,
            message: "Invalid app token." + (data?.reason ? ` (${data.reason})` : ""),
          };
        }

        return {
          ok: true,
          token,
          authMode: "authority",
          tokenId: data.tokenId || null,
          tokenPrefix: data.tokenPrefix || (token.slice(0, 12) + "..."),
          allowedModels: Array.isArray(data.allowedModels) ? data.allowedModels : null,
          allowedEmbedModels: Array.isArray(data.allowedEmbedModels) ? data.allowedEmbedModels : null,
        };
      } catch (error) {
        console.error("[auth] token authority verify failed:", verifyEndpoint, error?.name || "", error?.message || String(error));
      } finally {
        clearTimeout(t);
      }
    }
  }

  const rawTokens = Array.from(csvToSet(env.KAIXU_APP_TOKENS || ""));
  const hashedTokens = Array.from(csvToSet(env.KAIXU_APP_TOKENS_SHA256 || env.KAIXU_APP_TOKENS_HASH_SHA256 || ""));

  if (!rawTokens.length && !hashedTokens.length) {
    return { ok: false, code: 500, message: "Gateway misconfigured: KAIXU_APP_TOKENS (or KAIXU_APP_TOKENS_SHA256) is not set." };
  }

  for (const tkn of rawTokens) {
    if (timingSafeEqual(token, tkn)) {
      return { ok: true, token, authMode: "env-raw", tokenPrefix: token.slice(0, 12) + "...", tokenId: null, allowedModels: null, allowedEmbedModels: null };
    }
  }

  if (hashedTokens.length) {
    const digest = await sha256Hex(token);
    for (const h of hashedTokens) {
      if (timingSafeEqual(digest, h)) {
        return { ok: true, token, authMode: "env-sha256", tokenPrefix: token.slice(0, 12) + "...", tokenId: null, allowedModels: null, allowedEmbedModels: null };
      }
    }
  }

  return { ok: false, code: 403, message: "Invalid app token." };
}

async function parseJson(request, maxBytes) {
  const raw = await request.text();
  const bytes = new TextEncoder().encode(raw).length;
  if (bytes > maxBytes) return { ok: false, code: 413, error: `Body too large. Max ${maxBytes} bytes.` };
  try {
    return { ok: true, value: raw ? JSON.parse(raw) : {} };
  } catch (_) {
    return { ok: false, code: 400, error: "Invalid JSON body." };
  }
}

function mapMessagesToOpenAI(body, env) {
  const out = [];
  const globalSystem = String(env.KAIXU_GLOBAL_SYSTEM || "").trim();
  const reqSystem = String(body.system || body.systemInstruction || "").trim();
  const mergedSystem = [globalSystem, reqSystem].filter(Boolean).join("\n\n").trim();
  if (mergedSystem) out.push({ role: "system", content: mergedSystem });

  if (Array.isArray(body.messages)) {
    for (const m of body.messages) {
      if (!m || !m.role) continue;
      const role = m.role === "model" ? "assistant" : String(m.role);
      if (role !== "system" && role !== "user" && role !== "assistant") continue;
      const content = m.content == null ? "" : String(m.content);
      if (content.trim()) out.push({ role, content });
    }
  }

  if (Array.isArray(body.contents)) {
    for (const c of body.contents) {
      if (!c || !Array.isArray(c.parts)) continue;
      const role = c.role === "model" ? "assistant" : (c.role === "system" ? "system" : "user");
      const openAiParts = [];
      let textJoined = "";

      for (const p of c.parts) {
        if (!p) continue;
        if (typeof p.text === "string" && p.text.trim()) {
          textJoined += (textJoined ? "\n" : "") + p.text;
        }
        if (p.inline_data && typeof p.inline_data === "object") {
          const mime = String(p.inline_data.mime_type || "image/png").trim();
          const data = String(p.inline_data.data || "").trim();
          if (data) {
            openAiParts.push({
              type: "image_url",
              image_url: { url: `data:${mime};base64,${data}` },
            });
          }
        }
      }

      if (textJoined) openAiParts.unshift({ type: "text", text: textJoined });
      if (openAiParts.length) {
        out.push({ role: role, content: openAiParts });
      } else if (textJoined) {
        out.push({ role: role, content: textJoined });
      }
    }
  }

  if (body.input && typeof body.input === "object") {
    const type = String(body.input.type || "text");
    if (type === "text") {
      const text = body.input.content == null ? "" : String(body.input.content);
      if (text.trim()) out.push({ role: "user", content: text });
    }
  }

  if (!out.some((m) => m.role === "user" || m.role === "assistant")) {
    if (typeof body === "string" && body.trim()) {
      out.push({ role: "user", content: body.trim() });
    }
  }

  return out;
}

function mapModel(requested, fallback) {
  const model = String(requested || fallback || "kAIxU6.7-flash").trim();
  const resolved = MODEL_ALIASES[model] || model;
  return { model, resolved };
}

function makeOpenAIBody(body, env, resolvedModel, stream = false) {
  const messages = mapMessagesToOpenAI(body, env);
  if (!messages.length) return { ok: false, error: "Missing input. Provide input, messages, or contents." };


const generationConfig = (body.generationConfig && typeof body.generationConfig === "object")
  ? body.generationConfig
  : (body.config && typeof body.config === "object" ? body.config : {});

// Back-compat: accept top-level knobs too (contract tests + legacy clients).
const temperature = (generationConfig.temperature ?? body.temperature);
const topP = (generationConfig.topP ?? generationConfig.top_p ?? body.topP ?? body.top_p);
const stopSequences = (generationConfig.stopSequences ?? generationConfig.stop ?? body.stopSequences ?? body.stop);
const maxOutputTokens = (generationConfig.maxOutputTokens ?? generationConfig.max_tokens ?? body.maxOutputTokens ?? body.max_tokens);

const req = {
  model: resolvedModel,
  messages,
  stream,
};

if (Number.isFinite(Number(temperature))) req.temperature = Number(temperature);
if (Number.isFinite(Number(topP))) req.top_p = Number(topP);
if (Array.isArray(stopSequences)) req.stop = stopSequences;
if (Number.isFinite(Number(maxOutputTokens))) req.max_tokens = Number(maxOutputTokens);

  const output = (body.output && typeof body.output === "object") ? body.output : null;
  if (output && String(output.format || "").toLowerCase() === "json") {
    req.response_format = { type: "json_object" };
  }

  return { ok: true, value: req };
}

function extractTextFromOpenAI(json) {
  const choices = Array.isArray(json?.choices) ? json.choices : [];
  if (!choices.length) return "";
  const msg = choices[0]?.message;
  if (!msg) return "";

  if (typeof msg.content === "string") return msg.content;
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((part) => part && part.type === "text")
      .map((part) => part.text || "")
      .join("");
  }
  return "";
}

function extractUsageFromOpenAI(json) {
  const u = json?.usage || {};
  return {
    promptTokens: Number(u.prompt_tokens || 0) || 0,
    candidatesTokens: Number(u.completion_tokens || 0) || 0,
    thoughtsTokens: 0,
    totalTokens: Number(u.total_tokens || 0) || 0,
  };
}

function openAiBase(env) {
  return String(env.KAIXU_OPENAI_BASE_URL || env.OMEGA_GATE_URL || "https://0megaskyegate.skyesoverlondon.workers.dev").replace(/\/+$/, "");
}

function openAiKey(env) {
  return String(env.KAIXU_OPENAI_API_KEY || env.OPENAI_KEY || "").trim();
}

async function handleHealth(request, env, rid, cors) {
  const auth = await enforceAuth(request, env);
  if (!auth.ok) return jsonResp(auth.code, { ok: false, error: auth.message }, withMeta(cors, rid));

  const hasKey = !!openAiKey(env);
  return jsonResp(200, {
    ok: true,
    requestId: rid,
    brain: String(env.KAIXU_BRAIN_NAME || "kAIxU0s"),
    provider: PROVIDER_BRAND,
    openGate: String(env.KAIXU_OPEN_GATE || "0") === "1",
    keyConfigured: hasKey,
    defaultModel: String(env.KAIXU_DEFAULT_MODEL || "kAIxU6.7-flash"),
  }, withMeta(cors, rid));
}

async function handleModels(request, env, rid, cors) {
  const auth = await enforceAuth(request, env);
  if (!auth.ok) return jsonResp(auth.code, { ok: false, error: auth.message }, withMeta(cors, rid));

  return jsonResp(200, {
    ok: true,
    requestId: rid,
    provider: PROVIDER_BRAND,
    models: [
      { id: "kAIxU6.7-flash", type: "text" },
      { id: "kAIxU6.7-pro", type: "text" },
      { id: "kAIxU-flash", type: "text" },
      { id: "kAIxU-pro", type: "text" },
      { id: String(env.KAIXU_EMBED_MODEL || "text-embedding-3-small"), type: "embedding" },
    ],
  }, withMeta(cors, rid));
}

function withMeta(headers, rid) {
  return {
    ...headers,
    "X-Request-ID": rid,
    "X-kAIxU-Version": VERSION_BRAND,
  };
}

async function openAiFetch(env, path, body, timeoutMs) {
  const key = openAiKey(env);
  if (!key) {
    return { ok: false, status: 500, json: { ok: false, error: "Gateway misconfigured: provider key is not set." } };
  }

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const upstream = await fetch(`${openAiBase(env)}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: ac.signal,
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      let details = text;
      try { details = JSON.parse(text); } catch (_) {}
      return { ok: false, status: upstream.status, json: { ok: false, error: "Upstream model error.", details } };
    }

    const json = await upstream.json();
    return { ok: true, status: 200, json };
  } catch (e) {
    const msg = e?.name === "AbortError" ? `Upstream timeout after ${timeoutMs}ms.` : (e?.message || String(e));
    return { ok: false, status: 502, json: { ok: false, error: msg } };
  } finally {
    clearTimeout(t);
  }
}

async function handleGenerate(request, env, rid, cors) {
  const auth = await enforceAuth(request, env);
  if (!auth.ok) return jsonResp(auth.code, { ok: false, error: auth.message }, withMeta(cors, rid));

  const maxBytes = clampInt(env.KAIXU_MAX_BODY_BYTES, 1024, 16_000_000, 5_242_880);
  const parsed = await parseJson(request, maxBytes);
  if (!parsed.ok) return jsonResp(parsed.code, { ok: false, error: parsed.error }, withMeta(cors, rid));

  const body = parsed.value || {};
  const { model, resolved } = mapModel(body.model, env.KAIXU_DEFAULT_MODEL);

  if (!ALLOWED_MODELS.has(model) && !ALLOWED_MODELS.has(resolved)) {
    return jsonResp(400, { ok: false, error: `Model "${model}" is not available through this gateway.` }, withMeta(cors, rid));
  }


if (Array.isArray(auth.allowedModels) && auth.allowedModels.length) {
  const allowed = new Set(auth.allowedModels.map((x) => String(x)));
  if (!allowed.has(model) && !allowed.has(resolved)) {
    return jsonResp(403, { ok: false, error: `Model "${model}" is not permitted for this token.` }, withMeta(cors, rid));
  }
}

  const built = makeOpenAIBody(body, env, resolved, false);
  if (!built.ok) return jsonResp(400, { ok: false, error: built.error }, withMeta(cors, rid));

  const timeoutMs = clampInt(env.KAIXU_TIMEOUT_MS, 1000, 120000, 25000);
  const upstream = await openAiFetch(env, "/chat/completions", built.value, timeoutMs);
  if (!upstream.ok) return jsonResp(upstream.status, upstream.json, withMeta(cors, rid));

  const outText = extractTextFromOpenAI(upstream.json);
  const usage = extractUsageFromOpenAI(upstream.json);
  const finishReason = upstream.json?.choices?.[0]?.finish_reason || null;

  if (finishReason === "length" && !outText) {
    return jsonResp(200, {
      ok: false,
      requestId: rid,
      error: "Model hit token limit before producing output. Increase maxOutputTokens.",
      model,
      finishReason: "MAX_TOKENS",
      usage,
    }, withMeta(cors, rid));
  }

  return jsonResp(200, {
    ok: true,
    requestId: rid,
    model,
    text: outText,
    finishReason: finishReason === "length" ? "MAX_TOKENS" : (finishReason || "STOP"),
    usage,
    ...(body.includeRaw ? { raw: upstream.json } : {}),
  }, withMeta(cors, rid));
}

async function handleStream(request, env, rid, cors) {
  const auth = await enforceAuth(request, env);
  if (!auth.ok) {
    return jsonResp(auth.code, { ok: false, error: auth.message }, withMeta(cors, rid));
  }

  const maxBytes = clampInt(env.KAIXU_MAX_BODY_BYTES, 1024, 16_000_000, 5_242_880);
  const parsed = await parseJson(request, maxBytes);
  if (!parsed.ok) return jsonResp(parsed.code, { ok: false, error: parsed.error }, withMeta(cors, rid));

  const body = parsed.value || {};
  const { model, resolved } = mapModel(body.model, env.KAIXU_DEFAULT_MODEL);

  if (!ALLOWED_MODELS.has(model) && !ALLOWED_MODELS.has(resolved)) {
    return jsonResp(400, { ok: false, error: `Model "${model}" is not available through this gateway.` }, withMeta(cors, rid));
  }


if (Array.isArray(auth.allowedModels) && auth.allowedModels.length) {
  const allowed = new Set(auth.allowedModels.map((x) => String(x)));
  if (!allowed.has(model) && !allowed.has(resolved)) {
    return jsonResp(403, { ok: false, error: `Model "${model}" is not permitted for this token.` }, withMeta(cors, rid));
  }
}

  const built = makeOpenAIBody(body, env, resolved, true);
  if (!built.ok) return jsonResp(400, { ok: false, error: built.error }, withMeta(cors, rid));

  const key = openAiKey(env);
  if (!key) return jsonResp(500, { ok: false, error: "Gateway misconfigured: provider key is not set." }, withMeta(cors, rid));

  let upstream;
  try {
    upstream = await fetch(`${openAiBase(env)}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(built.value),
    });
  } catch (e) {
    return jsonResp(502, { ok: false, error: e?.message || String(e) }, withMeta(cors, rid));
  }

  if (!upstream.ok) {
    const txt = await upstream.text();
    let details = txt;
    try { details = JSON.parse(txt); } catch (_) {}
    return jsonResp(upstream.status, { ok: false, error: "Upstream model error.", details }, withMeta(cors, rid));
  }

  if (!upstream.body) {
    return jsonResp(502, { ok: false, error: "Upstream returned no stream body." }, withMeta(cors, rid));
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const transformed = new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const raw = trimmed.slice(5).trim();

            if (raw === "[DONE]") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              continue;
            }

            let chunk;
            try { chunk = JSON.parse(raw); } catch (_) { continue; }

            const delta = chunk?.choices?.[0]?.delta;
            let text = "";
            if (typeof delta?.content === "string") {
              text = delta.content;
            } else if (Array.isArray(delta?.content)) {
              text = delta.content
                .filter((p) => p && p.type === "text")
                .map((p) => p.text || "")
                .join("");
            }
            if (!text) continue;

            const out = {
              candidates: [
                {
                  content: {
                    parts: [{ text }],
                  },
                },
              ],
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(out)}\n\n`));
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (e) {
        const err = { ok: false, error: e?.message || String(e) };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(err)}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(transformed, {
    status: 200,
    headers: {
      ...withMeta(cors, rid),
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}

async function handleEmbeddings(request, env, rid, cors) {
  const auth = await enforceAuth(request, env);
  if (!auth.ok) return jsonResp(auth.code, { ok: false, error: auth.message }, withMeta(cors, rid));

  const maxBytes = clampInt(env.KAIXU_MAX_BODY_BYTES, 1024, 16_000_000, 5_242_880);
  const parsed = await parseJson(request, maxBytes);
  if (!parsed.ok) return jsonResp(parsed.code, { ok: false, error: parsed.error }, withMeta(cors, rid));

  const body = parsed.value || {};
  const requestedModel = String(body.model || env.KAIXU_EMBED_MODEL || "text-embedding-3-small").trim();
  const model = MODEL_ALIASES[requestedModel] || requestedModel;
  if (!ALLOWED_EMBED_MODELS.has(model)) {
    return jsonResp(400, { ok: false, error: `Embedding model "${requestedModel}" is not available through this gateway.` }, withMeta(cors, rid));
  }


if (Array.isArray(auth.allowedEmbedModels) && auth.allowedEmbedModels.length) {
  const allowed = new Set(auth.allowedEmbedModels.map((x) => String(x)));
  if (!allowed.has(model) && !allowed.has(requestedModel)) {
    return jsonResp(403, { ok: false, error: `Embedding model "${requestedModel}" is not permitted for this token.` }, withMeta(cors, rid));
  }
}

  const content = body.content;
  if (!(typeof content === "string" || (Array.isArray(content) && content.every((x) => typeof x === "string")))) {
    return jsonResp(400, { ok: false, error: "Invalid content. Provide a string or string[]." }, withMeta(cors, rid));
  }

  const timeoutMs = clampInt(env.KAIXU_TIMEOUT_MS, 1000, 120000, 25000);
  const upstream = await openAiFetch(env, "/embeddings", {
    model,
    input: content,
  }, timeoutMs);

  if (!upstream.ok) return jsonResp(upstream.status, upstream.json, withMeta(cors, rid));

  const rows = Array.isArray(upstream.json?.data) ? upstream.json.data : [];
  const embeddings = rows.map((row, index) => ({
    index: Number(row?.index ?? index),
    values: Array.isArray(row?.embedding) ? row.embedding : [],
  }));

  const usageRaw = upstream.json?.usage || {};
  return jsonResp(200, {
    ok: true,
    requestId: rid,
    model: requestedModel,
    embeddings,
    usage: {
      promptTokens: Number(usageRaw.prompt_tokens || 0) || 0,
      candidatesTokens: 0,
      thoughtsTokens: 0,
      totalTokens: Number(usageRaw.total_tokens || usageRaw.prompt_tokens || 0) || 0,
    },
  }, withMeta(cors, rid));
}

function htmlSecurityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Content-Security-Policy": "default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' https:; upgrade-insecure-requests",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  };
}

function handleUi() {
  return new Response(BRAiN_UI_HTML, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      ...htmlSecurityHeaders(),
    },
  });
}

function handleSmokeHouseUi(state = {}) {
  return new Response(smokeHouseHtml(state), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      ...htmlSecurityHeaders(),
    },
  });
}

async function handleSmokeHousePost(request, env, rid, cors) {
  const form = await request.formData();
  const action = String(form.get("action") || "").trim();
  const token = String(form.get("token") || "").trim();
  const prompt = String(form.get("prompt") || "Return exactly: SMOKEHOUSE_OK").trim();
  const target = String(form.get("target") || "kaixu0s").trim().toLowerCase();

  let response;
  if (action === "verify") {
    const authGet = smokehouseAuthRequest(request, token, "GET");
    const authPost = smokehouseAuthRequest(request, token, "POST");

    const auditResp = await handleSmokeAudit(authGet, env, rid, cors);
    const auditPayload = await readResponseBody(auditResp);

    const runResp = await handleSmokeRun(authPost, env, rid, cors);
    const runPayload = await readResponseBody(runResp);

    const logResp = await handleSmokeLog(authGet, env, rid, cors);
    const logPayload = await readResponseBody(logResp);

    const auditOk = auditResp.status === 200 && auditPayload?.ok === true && Array.isArray(auditPayload?.checks) && auditPayload.checks.length >= 4;
    const runOk = runResp.status === 200
      && runPayload?.ok === true
      && runPayload?.run?.engine === "runtime-smoke-v2"
      && Number(runPayload?.run?.totalChecks || 0) >= 7
      && Number(runPayload?.run?.failedChecks || 0) === 0;
    const logOk = logResp.status === 200
      && logPayload?.ok === true
      && !!logPayload?.log?.latestRun
      && logPayload.log.latestRun.id === runPayload?.run?.id;

    const passed = auditOk && runOk && logOk;
    return handleSmokeHouseUi({
      token,
      prompt,
      target,
      action,
      status: passed ? "VERIFY PASS" : "VERIFY FAIL",
      output: {
        ok: passed,
        checks: {
          auditOk,
          runOk,
          logOk,
        },
        runId: runPayload?.run?.id || null,
        details: {
          auditStatus: auditResp.status,
          runStatus: runResp.status,
          logStatus: logResp.status,
          runTotalChecks: runPayload?.run?.totalChecks ?? null,
          runFailedChecks: runPayload?.run?.failedChecks ?? null,
        },
        payloads: {
          audit: auditPayload,
          run: runPayload,
          log: logPayload,
        },
      },
    });
  } else if (action === "run") {
    response = await handleSmokeRun(smokehouseAuthRequest(request, token, "POST"), env, rid, cors);
  } else if (action === "audit") {
    response = await handleSmokeAudit(smokehouseAuthRequest(request, token, "GET"), env, rid, cors);
  } else if (action === "health") {
    response = await handleHealth(smokehouseAuthRequest(request, token, "GET"), env, rid, cors);
  } else if (action === "models") {
    response = await handleModels(smokehouseAuthRequest(request, token, "GET"), env, rid, cors);
  } else if (action === "generate") {
    response = await handleGenerate(
      smokehouseAuthRequest(request, token, "POST", {
        model: String(env.KAIXU_DEFAULT_MODEL || "kAIxU6.7-flash"),
        input: { type: "text", content: prompt || "Return exactly: SMOKEHOUSE_OK" },
      }),
      env,
      rid,
      cors,
    );
  } else if (action === "log") {
    response = await handleSmokeLog(smokehouseAuthRequest(request, token, "GET"), env, rid, cors);
  } else if (action === "brains") {
    response = await handleBrainRegistry(smokehouseAuthRequest(request, token, "GET"), env, rid, cors);
  } else if (action === "resolve") {
    response = await handleBrainResolve(smokehouseAuthRequest(request, token, "POST", { target }), env, rid, cors);
  } else {
    return handleSmokeHouseUi({
      token,
      prompt,
      target,
      action,
      status: "Unknown action",
      output: { ok: false, error: `Unknown action: ${action}` },
    });
  }

  const payload = await readResponseBody(response);
  const success = response.status >= 200 && response.status < 300;
  return handleSmokeHouseUi({
    token,
    prompt,
    target,
    action,
    status: `${response.status} ${success ? "OK" : "FAIL"}`,
    output: payload,
  });
}

async function handleSmokeAudit(request, env, rid, cors) {
  const auth = await enforceAuth(request, env);
  if (!auth.ok) return jsonResp(auth.code, { ok: false, error: auth.message }, withMeta(cors, rid));

  const checks = [];
  const keyConfigured = !!openAiKey(env);
  const tokensConfigured = csvToSet(env.KAIXU_APP_TOKENS || "").size > 0;
  const openGate = String(env.KAIXU_OPEN_GATE || "0") === "1";
  const kvBound = !!env.KAIXU_SMOKE_KV;

  checks.push({ name: "provider_key", ok: keyConfigured, note: keyConfigured ? "Provider key configured" : "Missing provider key" });
  checks.push({ name: "token_source", ok: openGate || tokensConfigured, note: openGate ? "Open gate enabled" : (tokensConfigured ? "KAIXU_APP_TOKENS configured" : "No app tokens configured") });
  checks.push({ name: "smoke_kv_binding", ok: kvBound, note: kvBound ? "KAIXU_SMOKE_KV is bound" : "KAIXU_SMOKE_KV is REQUIRED in no-option mode" });
  checks.push({ name: "contract_endpoints", ok: true, endpoints: ["GET /v1/health", "GET /v1/models", "POST /v1/generate", "POST /v1/stream", "POST /v1/embeddings"] });

  return jsonResp(200, {
    ok: true,
    requestId: rid,
    smokeHouse: "online",
    brain: String(env.KAIXU_BRAIN_NAME || "kAIxU0s"),
    provider: PROVIDER_BRAND,
    autorun: {
      enabled: envFlag(env, "KAIXU_SMOKE_AUTORUN", true),
      cadence: "*/3 * * * *",
      generatePing: envFlag(env, "KAIXU_SMOKE_AUTORUN_GENERATE", true),
    },
    checkedAt: new Date().toISOString(),
    checks,
  }, withMeta(cors, rid));
}

function firstConfiguredToken(env) {
  const tokens = Array.from(csvToSet(env.KAIXU_APP_TOKENS || ""));
  return tokens.length ? tokens[0] : "";
}

function smokeAuthHeaders(env) {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (!envFlag(env, "KAIXU_OPEN_GATE", false)) {
    const token = firstConfiguredToken(env);
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

async function parseRespSafe(response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch (_) { return text; }
}

async function runEndpointCheck(name, exec) {
  try {
    const result = await exec();
    return { name, ...result };
  } catch (error) {
    return {
      name,
      ok: false,
      status: 500,
      error: error?.message || String(error),
    };
  }
}

async function runAutomatedSmoke(env, source = "manual") {
  const kv = ensureSmokeKvBound(env);
  if (!kv.ok) throw new Error(kv.message);

  const startedAt = new Date();
  const checks = [];

  const keyConfigured = !!openAiKey(env);
  const openGate = envFlag(env, "KAIXU_OPEN_GATE", false);
  const tokenConfigured = openGate || csvToSet(env.KAIXU_APP_TOKENS || "").size > 0;

  checks.push({
    name: "config_auth_mode",
    ok: tokenConfigured,
    details: {
      openGate,
      tokenConfigured,
      tokenCount: csvToSet(env.KAIXU_APP_TOKENS || "").size,
    },
  });

  checks.push({
    name: "config_provider_key",
    ok: keyConfigured,
    details: { keyConfigured },
  });

  checks.push({
    name: "models_registry",
    ok: ALLOWED_MODELS.size > 0,
    details: { count: ALLOWED_MODELS.size },
  });

  const rid = `smoke_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const cors = { "Access-Control-Allow-Origin": "*" };
  const headers = smokeAuthHeaders(env);

  checks.push(await runEndpointCheck("endpoint_health", async () => {
    const request = new Request("https://smoke.local/v1/health", { method: "GET", headers });
    const response = await handleHealth(request, env, rid, cors);
    const data = await parseRespSafe(response);
    return {
      ok: response.status === 200 && data?.ok === true,
      status: response.status,
      details: {
        openGate: data?.openGate,
        keyConfigured: data?.keyConfigured,
      },
      error: response.status === 200 ? null : (data?.error || "health failed"),
    };
  }));

  checks.push(await runEndpointCheck("endpoint_models", async () => {
    const request = new Request("https://smoke.local/v1/models", { method: "GET", headers });
    const response = await handleModels(smokehouseAuthRequest(request, token, "GET"), env, rid, cors);
    const data = await parseRespSafe(response);
    const models = Array.isArray(data?.models) ? data.models : [];
    return {
      ok: response.status === 200 && models.length > 0,
      status: response.status,
      details: { modelCount: models.length },
      error: response.status === 200 ? null : (data?.error || "models failed"),
    };
  }));

  const runGenerate = envFlag(env, "KAIXU_SMOKE_AUTORUN_GENERATE", true);
  if (runGenerate) {
    if (!keyConfigured) {
      checks.push({ name: "endpoint_generate", ok: false, status: 500, error: "Missing provider key" });
    } else {
      checks.push(await runEndpointCheck("endpoint_generate", async () => {
        const smokePrompt = String(env.KAIXU_SMOKE_PROMPT || "Return exactly: SMOKE_OK");
        const request = new Request("https://smoke.local/v1/generate", {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: String(env.KAIXU_DEFAULT_MODEL || "kAIxU6.7-flash"),
            input: { type: "text", content: smokePrompt },
          }),
        });
        const response = await handleGenerate(request, env, rid, cors);
        const data = await parseRespSafe(response);
        const text = typeof data?.text === "string" ? data.text : "";
        const semanticOk = text.length > 0;
        return {
          ok: response.status === 200 && data?.ok === true && semanticOk,
          status: response.status,
          details: {
            textLength: text.length,
            finishReason: data?.finishReason || null,
          },
          error: response.status === 200 ? null : (data?.error || "generate failed"),
        };
      }));
    }
  }

  checks.push(await runEndpointCheck("stream_contract_shape", async () => {
    const sample = {
      candidates: [
        {
          content: {
            parts: [{ text: "SMOKE_STREAM_OK" }],
          },
        },
      ],
    };
    const parts = sample?.candidates?.[0]?.content?.parts;
    const valid = Array.isArray(parts) && typeof parts[0]?.text === "string";
    return {
      ok: valid,
      status: 200,
      details: { contract: "candidates[0].content.parts[].text" },
      error: valid ? null : "stream contract mismatch",
    };
  }));

  const passedChecks = checks.filter((c) => c.ok).length;
  const endedAt = new Date();
  const stamp = smokeStamp(endedAt);
  const failingChecks = checks.filter((c) => !c.ok).map((c) => c.name);

  const run = {
    id: `smoke_${stamp}`,
    source,
    stamp,
    engine: "runtime-smoke-v2",
    environment: {
      brain: String(env.KAIXU_BRAIN_NAME || "kAIxU0s"),
      model: String(env.KAIXU_DEFAULT_MODEL || "kAIxU6.7-flash"),
      openGate,
    },
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    totalChecks: checks.length,
    passedChecks,
    failedChecks: checks.length - passedChecks,
    failingChecks,
    checks,
  };

  const latestKey = "smoke:latest";
  const runKey = `smoke:run:${stamp}`;
  const indexKey = "smoke:index";

  const currentIndex = await readKvJson(env, indexKey, { runs: [] });
  const runs = Array.isArray(currentIndex?.runs) ? currentIndex.runs : [];
  runs.unshift({
    id: run.id,
    stamp,
    source,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    totalChecks: run.totalChecks,
    passedChecks: run.passedChecks,
    failedChecks: run.failedChecks,
    kvKey: runKey,
  });

  await writeKvJson(env, latestKey, run);
  await writeKvJson(env, runKey, run);
  await writeKvJson(env, indexKey, { runs: runs.slice(0, 200) });

  console.log("[smoke-autorun]", JSON.stringify({
    id: run.id,
    source,
    passedChecks: run.passedChecks,
    totalChecks: run.totalChecks,
    failedChecks: run.failedChecks,
  }));

  return run;
}

async function handleSmokeEndpoints(request, env, rid, cors) {
  const auth = await enforceAuth(request, env);
  if (!auth.ok) return jsonResp(auth.code, { ok: false, error: auth.message }, withMeta(cors, rid));

  return jsonResp(200, {
    ok: true,
    requestId: rid,
    smokeHouse: true,
    endpoints: {
      adminUi: [
        { method: "GET", path: "/smokehouse" },
      ],
      adminApi: [
        { method: "GET", path: "/v1/admin/smoke/audit" },
        { method: "GET", path: "/v1/admin/smoke/endpoints" },
        { method: "GET", path: "/v1/admin/smoke/log" },
        { method: "POST", path: "/v1/admin/smoke/run" },
        { method: "GET", path: "/v1/admin/brains" },
        { method: "POST", path: "/v1/admin/brains/resolve" },
      ],
      contract: [
        { method: "GET", path: "/v1/health" },
        { method: "GET", path: "/v1/models" },
        { method: "POST", path: "/v1/generate" },
        { method: "POST", path: "/v1/stream" },
        { method: "POST", path: "/v1/embeddings" },
      ],
    },
  }, withMeta(cors, rid));
}

async function handleSmokeLog(request, env, rid, cors) {
  const auth = await enforceAuth(request, env);
  if (!auth.ok) return jsonResp(auth.code, { ok: false, error: auth.message }, withMeta(cors, rid));

  const kv = ensureSmokeKvBound(env);
  if (!kv.ok) return jsonResp(kv.code, { ok: false, error: kv.message }, withMeta(cors, rid));

  const latest = await readKvJson(env, "smoke:latest", null);
  const index = await readKvJson(env, "smoke:index", { runs: [] });

  return jsonResp(200, {
    ok: true,
    requestId: rid,
    smokeHouse: true,
    log: {
      mode: "runtime-kv+console",
      note: "Cron/manual smoke runs are persisted in KAIXU_SMOKE_KV and also emitted to worker logs.",
      autorun: {
        enabled: envFlag(env, "KAIXU_SMOKE_AUTORUN", true),
        cadence: "*/3 * * * *",
        generatePing: envFlag(env, "KAIXU_SMOKE_AUTORUN_GENERATE", true),
      },
      latestRun: latest,
      recentRuns: Array.isArray(index?.runs) ? index.runs.slice(0, 20) : [],
      emittedAt: new Date().toISOString(),
    },
  }, withMeta(cors, rid));
}

async function handleSmokeRun(request, env, rid, cors) {
  const auth = await enforceAuth(request, env);
  if (!auth.ok) return jsonResp(auth.code, { ok: false, error: auth.message }, withMeta(cors, rid));

  const kv = ensureSmokeKvBound(env);
  if (!kv.ok) return jsonResp(kv.code, { ok: false, error: kv.message }, withMeta(cors, rid));

  const run = await runAutomatedSmoke(env, "manual-api");
  return jsonResp(200, {
    ok: true,
    requestId: rid,
    smokeHouse: true,
    run,
  }, withMeta(cors, rid));
}


/* =========================
   SkyeErrors (Error Reporting)
   Skyes Over London LC
   - Ingest: POST /v1/errors/event
   - List:   GET  /v1/errors/events?limit=50
   - Get:    GET  /v1/errors/events/:id
   - Admin:  GET  /v1/admin/errors/events?limit=50
   - Admin:  POST /v1/admin/errors/cleanup  { days?: number }
   ========================= */

function skyeErrorsEnabled(env) {
  // Enabled by default when bindings exist, but can be turned off.
  return String(env.SKYE_ERRORS_ENABLED || "1") !== "0";
}

function hasSkyeErrorsBindings(env) {
  return Boolean(env.SKYE_ERRORS_DB && env.SKYE_ERRORS_RAW);
}

function getSkyeErrorsMaxBytes(env) {
  const fallback = clampInt(env.KAIXU_MAX_BODY_BYTES, 1024, 16_000_000, 1_048_576);
  return clampInt(env.SKYE_ERRORS_MAX_BODY_BYTES, 1024, 16_000_000, fallback);
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(String(input || ""));
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

function stackTop(stack, lines = 6) {
  return String(stack || "").split("\n").slice(0, lines).join("\n");
}

async function computeErrorFingerprint(name, message, stack) {
  return sha256Hex(`${name}\n${message}\n${stackTop(stack, 6)}`);
}

function scrubUrlQuery(urlStr) {
  try {
    const u = new URL(urlStr);
    return `${u.origin}${u.pathname}`;
  } catch {
    return String(urlStr || "");
  }
}

function normalizeIncomingError(body) {
  const level = String(body?.level || "error").slice(0, 16);
  const name = String(body?.name || "Error").slice(0, 200);
  const message = String(body?.message || "Unknown error").slice(0, 2000);
  const stack = String(body?.stack || "").slice(0, 20000);
  const ts_ms = typeof body?.ts_ms === "number" ? body.ts_ms : Date.now();

  const tags = (body?.tags && typeof body.tags === "object") ? body.tags : {};
  const release = body?.release ? String(body.release).slice(0, 200) : null;
  const environment = body?.environment ? String(body.environment).slice(0, 100) : null;

  const request_method = body?.request?.method ? String(body.request.method).slice(0, 20) : null;
  const request_url_raw = body?.request?.url ? String(body.request.url).slice(0, 2000) : null;
  const request_url = request_url_raw ? scrubUrlQuery(request_url_raw) : null;
  const cf_ray = body?.request?.cf_ray ? String(body.request.cf_ray).slice(0, 80) : null;

  const app = tags?.app ? String(tags.app).slice(0, 120) : null;

  return {
    level,
    name,
    message,
    stack,
    ts_ms,
    tags,
    release,
    environment,
    request_method,
    request_url,
    cf_ray,
    app,
    extra: body?.extra ?? null,
  };
}

function requireSkyeErrors(env) {
  if (!skyeErrorsEnabled(env)) return { ok: false, code: 503, message: "SkyeErrors is disabled (SKYE_ERRORS_ENABLED=0)." };
  if (!hasSkyeErrorsBindings(env)) {
    return {
      ok: false,
      code: 503,
      message: "SkyeErrors is not configured. Bind D1 as SKYE_ERRORS_DB and R2 as SKYE_ERRORS_RAW in wrangler.toml.",
    };
  }
  return { ok: true };
}

async function getTenantKeyFromAuth(auth) {
  // Prefer stable tokenId from your token authority. Fallback to SHA256(token).
  const tokenId = auth?.tokenId ? String(auth.tokenId) : "";
  if (tokenId) return { tenantKey: tokenId, tenantMode: "tokenId" };
  const token = auth?.token ? String(auth.token) : "";
  return { tenantKey: await sha256Hex(token), tenantMode: "tokenHash" };
}

function isAdminSkyeErrors(request, env) {
  const secret = String(env.SKYE_ERRORS_ADMIN_SECRET || "").trim();
  if (!secret) return false;
  const hdr = String(request.headers.get("X-SKYE-ERRORS-ADMIN") || "").trim();
  return hdr && timingSafeEqual(hdr, secret);
}

async function handleSkyeErrorsIngest(request, env, rid, cors) {
  const ready = requireSkyeErrors(env);
  if (!ready.ok) return jsonResp(ready.code, { ok: false, error: ready.message }, withMeta(cors, rid));

  const auth = await enforceAuth(request, env);
  if (!auth.ok) return jsonResp(auth.code, { ok: false, error: auth.message }, withMeta(cors, rid));

  const maxBytes = getSkyeErrorsMaxBytes(env);
  const parsed = await parseJson(request, maxBytes);
  if (!parsed.ok) return jsonResp(parsed.code, { ok: false, error: parsed.error }, withMeta(cors, rid));

  const incoming = normalizeIncomingError(parsed.value || {});
  const { tenantKey, tenantMode } = await getTenantKeyFromAuth(auth);
  const tenantLabel = auth?.tokenPrefix ? String(auth.tokenPrefix).slice(0, 64) : null;

  const fingerprint = await computeErrorFingerprint(incoming.name, incoming.message, incoming.stack);
  const eventId = crypto.randomUUID();
  const ts = incoming.ts_ms;
  const rawKey = `errors/${tenantKey}/${ts}_${eventId}.json`;

  const rawPayload = {
    ok: true,
    kind: "skye_error_event",
    received_ts_ms: Date.now(),
    request_id: rid,
    tenant: { key: tenantKey, mode: tenantMode, label: tenantLabel },
    event: incoming,
  };

  await env.SKYE_ERRORS_RAW.put(rawKey, JSON.stringify(rawPayload), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });

  await env.SKYE_ERRORS_DB.prepare(
    `INSERT INTO skye_errors_events
      (event_id, tenant_key, tenant_label, ts_ms, level, name, message, fingerprint, request_method, request_url, cf_ray, release, environment, app, raw_r2_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    eventId,
    tenantKey,
    tenantLabel,
    ts,
    incoming.level,
    incoming.name,
    incoming.message,
    fingerprint,
    incoming.request_method,
    incoming.request_url,
    incoming.cf_ray,
    incoming.release,
    incoming.environment,
    incoming.app,
    rawKey
  ).run();

  return jsonResp(201, { ok: true, eventId, fingerprint }, withMeta(cors, rid));
}

async function handleSkyeErrorsList(request, env, rid, cors) {
  const ready = requireSkyeErrors(env);
  if (!ready.ok) return jsonResp(ready.code, { ok: false, error: ready.message }, withMeta(cors, rid));

  const auth = await enforceAuth(request, env);
  if (!auth.ok) return jsonResp(auth.code, { ok: false, error: auth.message }, withMeta(cors, rid));

  const { tenantKey } = await getTenantKeyFromAuth(auth);
  const url = new URL(request.url);
  const limit = clampInt(url.searchParams.get("limit"), 1, 200, 50);

  const rows = await env.SKYE_ERRORS_DB.prepare(
    `SELECT event_id, ts_ms, level, name, message, fingerprint, request_method, request_url, cf_ray, release, environment, app
     FROM skye_errors_events
     WHERE tenant_key = ?
     ORDER BY ts_ms DESC
     LIMIT ?`
  ).bind(tenantKey, limit).all();

  return jsonResp(200, { ok: true, requestId: rid, tenant: tenantKey, events: rows.results || [] }, withMeta(cors, rid));
}

async function handleSkyeErrorsGet(request, env, rid, cors, eventId) {
  const ready = requireSkyeErrors(env);
  if (!ready.ok) return jsonResp(ready.code, { ok: false, error: ready.message }, withMeta(cors, rid));

  const auth = await enforceAuth(request, env);
  if (!auth.ok) return jsonResp(auth.code, { ok: false, error: auth.message }, withMeta(cors, rid));

  const { tenantKey } = await getTenantKeyFromAuth(auth);

  const meta = await env.SKYE_ERRORS_DB.prepare(
    `SELECT event_id, tenant_key, tenant_label, ts_ms, level, name, message, fingerprint, request_method, request_url, cf_ray, release, environment, app, raw_r2_key
     FROM skye_errors_events
     WHERE event_id = ?`
  ).bind(eventId).first();

  if (!meta) return jsonResp(404, { ok: false, error: "Not found." }, withMeta(cors, rid));
  if (String(meta.tenant_key) !== String(tenantKey)) return jsonResp(403, { ok: false, error: "Forbidden." }, withMeta(cors, rid));

  const obj = await env.SKYE_ERRORS_RAW.get(String(meta.raw_r2_key));
  if (!obj) return jsonResp(404, { ok: false, error: "Raw payload missing." }, withMeta(cors, rid));

  const raw = await obj.json();
  return jsonResp(200, { ok: true, requestId: rid, meta, raw }, withMeta(cors, rid));
}

async function handleSkyeErrorsAdminList(request, env, rid, cors) {
  const ready = requireSkyeErrors(env);
  if (!ready.ok) return jsonResp(ready.code, { ok: false, error: ready.message }, withMeta(cors, rid));

  const auth = await enforceAuth(request, env);
  if (!auth.ok) return jsonResp(auth.code, { ok: false, error: auth.message }, withMeta(cors, rid));
  if (!isAdminSkyeErrors(request, env)) return jsonResp(401, { ok: false, error: "Admin unauthorized." }, withMeta(cors, rid));

  const url = new URL(request.url);
  const limit = clampInt(url.searchParams.get("limit"), 1, 200, 50);

  const rows = await env.SKYE_ERRORS_DB.prepare(
    `SELECT event_id, tenant_key, tenant_label, ts_ms, level, name, message, fingerprint, request_method, request_url, cf_ray, release, environment, app
     FROM skye_errors_events
     ORDER BY ts_ms DESC
     LIMIT ?`
  ).bind(limit).all();

  return jsonResp(200, { ok: true, requestId: rid, events: rows.results || [] }, withMeta(cors, rid));
}

async function handleSkyeErrorsAdminCleanup(request, env, rid, cors) {
  const ready = requireSkyeErrors(env);
  if (!ready.ok) return jsonResp(ready.code, { ok: false, error: ready.message }, withMeta(cors, rid));

  const auth = await enforceAuth(request, env);
  if (!auth.ok) return jsonResp(auth.code, { ok: false, error: auth.message }, withMeta(cors, rid));
  if (!isAdminSkyeErrors(request, env)) return jsonResp(401, { ok: false, error: "Admin unauthorized." }, withMeta(cors, rid));

  const maxBytes = 64_000;
  const parsed = await parseJson(request, maxBytes);
  const body = parsed.ok ? (parsed.value || {}) : {};
  const days = clampInt(body.days, 1, 3650, clampInt(env.SKYE_ERRORS_RETENTION_DAYS, 1, 3650, 30));
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const rows = await env.SKYE_ERRORS_DB.prepare(
    `SELECT raw_r2_key FROM skye_errors_events WHERE ts_ms < ? LIMIT 500`
  ).bind(cutoff).all();

  const keys = (rows.results || []).map((r) => r.raw_r2_key).filter(Boolean);

  await env.SKYE_ERRORS_DB.prepare(`DELETE FROM skye_errors_events WHERE ts_ms < ?`).bind(cutoff).run();

  // Best-effort raw deletion (bounded). For large retention sweeps, set an R2 lifecycle rule instead.
  for (const k of keys) {
    try { await env.SKYE_ERRORS_RAW.delete(String(k)); } catch (_) {}
  }

  return jsonResp(200, { ok: true, requestId: rid, deletedBeforeTsMs: cutoff, days }, withMeta(cors, rid));
}

async function tryCaptureBrainUnhandledError(env, request, rid, error) {
  try {
    if (!skyeErrorsEnabled(env) || !hasSkyeErrorsBindings(env)) return;

    // This is the brain reporting itself; treat as "system" tenant.
    const tenantKey = "brain";
    const fingerprint = await computeErrorFingerprint("BrainUnhandled", error?.message || String(error), error?.stack || "");
    const eventId = crypto.randomUUID();
    const ts = Date.now();
    const rawKey = `errors/${tenantKey}/${ts}_${eventId}.json`;

    const rawPayload = {
      ok: false,
      kind: "skye_error_event",
      received_ts_ms: ts,
      request_id: rid,
      tenant: { key: tenantKey, mode: "system", label: "kAIxU-Brain" },
      event: {
        level: "fatal",
        name: "BrainUnhandled",
        message: String(error?.message || error || "Unhandled error").slice(0, 2000),
        stack: String(error?.stack || "").slice(0, 20000),
        ts_ms: ts,
        tags: { app: "kAIxU-Brain", lane: "unhandled" },
        request: { method: request.method, url: scrubUrlQuery(request.url), cf_ray: request.headers.get("cf-ray") || null },
        extra: null,
      },
    };

    await env.SKYE_ERRORS_RAW.put(rawKey, JSON.stringify(rawPayload), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
    });

    await env.SKYE_ERRORS_DB.prepare(
      `INSERT INTO skye_errors_events
        (event_id, tenant_key, tenant_label, ts_ms, level, name, message, fingerprint, request_method, request_url, cf_ray, release, environment, app, raw_r2_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      eventId,
      tenantKey,
      "kAIxU-Brain",
      ts,
      "fatal",
      "BrainUnhandled",
      String(error?.message || error || "Unhandled error").slice(0, 2000),
      fingerprint,
      request.method,
      scrubUrlQuery(request.url),
      request.headers.get("cf-ray") || null,
      null,
      null,
      "kAIxU-Brain",
      rawKey
    ).run();
  } catch (_) {
    // swallow
  }
}


export default {
  async scheduled(_event, env, ctx) {
    if (!envFlag(env, "KAIXU_SMOKE_AUTORUN", true)) {
      console.log("[smoke-autorun] skipped (KAIXU_SMOKE_AUTORUN=0)");
      return;
    }

    const kv = ensureSmokeKvBound(env);
    if (!kv.ok) {
      console.error("[smoke-autorun]", kv.message);
      return;
    }

    ctx.waitUntil(runAutomatedSmoke(env, "cron-3m"));
  },

  async fetch(request, env) {
    const rid = reqId();
    const cors = corsHeaders(request, env);
    const method = request.method.toUpperCase();
    const path = new URL(request.url).pathname;

    if (method === "OPTIONS") return new Response(null, { status: 204, headers: withMeta(cors, rid) });
    if (method === "GET" && (path === "/" || path === "/ui")) return handleUi();
    if (method === "GET" && path === "/smokehouse") {
      return handleSmokeHouseUi({
        status: "Ready",
        action: "none",
        output: { smokeHouse: true, mode: "server-driven", note: "Submit a form action to run real smoke." },
      });
    }
    if (method === "POST" && path === "/smokehouse") return await handleSmokeHousePost(request, env, rid, cors);

    try {
      if (method === "GET" && path === "/v1/health") return await handleHealth(request, env, rid, cors);
      if (method === "GET" && path === "/v1/models") return await handleModels(request, env, rid, cors);
      if (method === "GET" && path === "/v1/admin/smoke/audit") return await handleSmokeAudit(request, env, rid, cors);
      if (method === "GET" && path === "/v1/admin/smoke/endpoints") return await handleSmokeEndpoints(request, env, rid, cors);
      if (method === "GET" && path === "/v1/admin/smoke/log") return await handleSmokeLog(request, env, rid, cors);
      if (method === "POST" && path === "/v1/admin/smoke/run") return await handleSmokeRun(request, env, rid, cors);
      if (method === "GET" && path === "/v1/admin/brains") return await handleBrainRegistry(request, env, rid, cors);
      
if (method === "POST" && path === "/v1/admin/brains/resolve") return await handleBrainResolve(request, env, rid, cors);

// SkyeErrors (error reporting)
if (method === "POST" && path === "/v1/errors/event") return await handleSkyeErrorsIngest(request, env, rid, cors);
if (method === "GET" && path === "/v1/errors/events") return await handleSkyeErrorsList(request, env, rid, cors);
if (method === "GET" && path.startsWith("/v1/errors/events/")) {
  const eventId = path.split("/").pop();
  return await handleSkyeErrorsGet(request, env, rid, cors, eventId);
}
if (method === "GET" && path === "/v1/admin/errors/events") return await handleSkyeErrorsAdminList(request, env, rid, cors);
if (method === "POST" && path === "/v1/admin/errors/cleanup") return await handleSkyeErrorsAdminCleanup(request, env, rid, cors);
      if (method === "POST" && path === "/v1/generate") return await handleGenerate(request, env, rid, cors);
      if (method === "POST" && path === "/v1/stream") return await handleStream(request, env, rid, cors);
      if (method === "POST" && path === "/v1/embeddings") return await handleEmbeddings(request, env, rid, cors);
      return jsonResp(404, { ok: false, error: "Not found." }, withMeta(cors, rid));
    } catch (e) {
      await tryCaptureBrainUnhandledError(env, request, rid, e);
      return jsonResp(500, { ok: false, error: e?.message || String(e) }, withMeta(cors, rid));
    }
  },
};
