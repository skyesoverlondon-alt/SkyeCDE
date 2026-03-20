export const handler = async (event) => {
  const corsHeaders = {
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": "*"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders, body: "" };
  }

  const aliasRing = buildAliasRing(process.env);
  const purposes = Object.keys(aliasRing).sort((a, b) => a.localeCompare(b));
  const defaultPurpose = sanitizePurpose(process.env.SKYE_DEFAULT_PURPOSE || "default") || "default";
  const gateUrl = String(process.env.OMEGA_GATE_URL || "https://0megaskyegate.skyesoverlondon.workers.dev").trim().replace(/\/+$/, "");
  const gateToken = String(process.env.OMEGA_GATE_SERVICE_KEY || process.env.KAIXU_APP_TOKEN || "").trim();

  // GET meta (no secrets)
  if (event.httpMethod === "GET") {
    const url = new URL(event.rawUrl || "https://example.invalid/.netlify/functions/skye-portal");
    if (url.searchParams.get("meta") === "1") {
      return json(200, corsHeaders, {
        purposes: purposes.length ? purposes : ["default"],
        defaultPurpose: purposes.includes(defaultPurpose) ? defaultPurpose : (purposes[0] || "default")
      });
    }
    return json(200, corsHeaders, { ok: true });
  }

  if (event.httpMethod !== "POST") {
    return json(405, corsHeaders, { error: { message: "Use POST." } });
  }

  if (!gateToken) {
    return json(500, corsHeaders, {
      error: {
        message:
          "Gate token missing. Set OMEGA_GATE_SERVICE_KEY (or KAIXU_APP_TOKEN) so this function can call 0megaSkyeGate."
      }
    });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, corsHeaders, { error: { message: "Invalid JSON body." } });
  }

  const input = (body.input || "").toString().trim();
  if (!input) return json(400, corsHeaders, { error: { message: "Missing 'input'." } });

  const maxChars = Number(process.env.MAX_INPUT_CHARS || 8000);
  if (input.length > maxChars) {
    return json(413, corsHeaders, { error: { message: `Input too large. Max ${maxChars} chars.` } });
  }

  // Purpose routing (client can request a purpose; server maps it to a gate alias)
  const requestedPurpose = sanitizePurpose(body.purpose || "") || "";
  const purpose = pickPurpose(requestedPurpose, aliasRing, defaultPurpose);

  const alias = (body.alias || aliasRing[purpose] || process.env.KAIXU_GATE_ALIAS || "kaixu/deep").toString().trim();
  const system = (body.system || "You are Skye Portal's gate-routed AI lane.").toString().trim();
  const temperature = Number(body.temperature ?? process.env.KAIXU_TEMPERATURE ?? 0.6);

  const upstreamRes = await fetch(`${gateUrl}/v1/chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${gateToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      alias,
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: input }
      ]
    })
  });

  const upstreamJson = await upstreamRes.json().catch(() => ({}));

  if (!upstreamRes.ok) {
    const msg = upstreamJson?.error?.message || upstreamJson?.error?.code || `0megaSkyeGate request failed (${upstreamRes.status}).`;
    return json(upstreamRes.status, corsHeaders, {
      error: { message: msg, purposeUsed: purpose, aliasUsed: alias }
    });
  }

  const text = extractText(upstreamJson);

  return json(200, corsHeaders, {
    text,
    purposeUsed: purpose,
    aliasUsed: alias
  });
};

function json(statusCode, corsHeaders, obj) {
  return {
    statusCode,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(obj)
  };
}

function sanitizePurpose(p) {
  return (p || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "");
}

function buildAliasRing(env) {
  const ring = {};

  // Primary pattern: SKYE_ALIAS_<PURPOSE>
  for (const [k, v] of Object.entries(env || {})) {
    if (!k || typeof v !== "string") continue;
    if (!k.startsWith("SKYE_ALIAS_")) continue;

    const rawPurpose = k.slice("SKYE_ALIAS_".length);
    const purpose = sanitizePurpose(rawPurpose);
    const alias = v.trim();
    if (purpose && alias) ring[purpose] = alias;
  }

  // Fallback alias
  if (!ring.default) {
    ring.default = String(env.KAIXU_GATE_ALIAS || "kaixu/deep").trim() || "kaixu/deep";
  }

  return ring;
}

function pickPurpose(requested, ring, defaultPurpose) {
  if (requested && ring[requested]) return requested;
  if (ring[defaultPurpose]) return defaultPurpose;
  if (ring.default) return "default";
  // last resort: first available key
  return Object.keys(ring)[0];
}

function extractText(resp) {
  if (typeof resp?.output?.text === "string" && resp.output.text.trim()) return resp.output.text;
  if (typeof resp?.output_text === "string" && resp.output_text.trim()) return resp.output_text;

  const chunks = [];
  if (Array.isArray(resp?.output)) {
    for (const item of resp.output) {
      if (!item) continue;

      if (item.type === "output_text" && typeof item.text === "string") {
        chunks.push(item.text);
        continue;
      }

      if (Array.isArray(item.content)) {
        for (const part of item.content) {
          if (!part) continue;
          if ((part.type === "output_text" || part.type === "text") && typeof part.text === "string") {
            chunks.push(part.text);
          }
        }
      }
    }
  }
  const joined = chunks.join("\n").trim();
  return joined || "(No text found in model output.)";
}
