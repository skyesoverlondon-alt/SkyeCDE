import { json, safeJsonParse, isString, getAuthBearer } from "./_lib/utils.js";
import { signHS256 } from "./_lib/jwt.js";

const GATE_URL = process.env.OMEGA_GATE_URL || "https://0megaskyegate.skyesoverlondon.workers.dev";

async function verifyGateSession(token) {
  try {
    const res = await fetch(`${GATE_URL}/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const body = await res.json().catch(() => ({}));
    return body.ok ? body.session : null;
  } catch {
    return null;
  }
}

export const handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return json(405, { error: "method_not_allowed" });

    // Authenticate via 0megaSkyeGate session
    const bearerToken = getAuthBearer(event);
    if (!bearerToken) return json(401, { error: "missing_bearer_token" });

    const gateSession = await verifyGateSession(bearerToken);
    if (!gateSession) return json(401, { error: "invalid_or_expired_gate_session" });

    const body = safeJsonParse(event.body || "{}", {});
    const scopes = Array.isArray(body.scopes) ? body.scopes : [];

    const signing = process.env.VAULT_SIGNING_SECRET;
    if (!isString(signing)) return json(500, { error: "missing_VAULT_SIGNING_SECRET" });

    const ttl = Number(process.env.VAULT_TOKEN_TTL_SECONDS || "300");
    const { token, exp } = signHS256(
      { sub: gateSession.app_id, org: gateSession.org_id, scopes },
      signing,
      ttl,
    );

    const now = Math.floor(Date.now() / 1000);
    return json(200, { token, expires_in: exp - now });
  } catch (e) {
    return json(500, { error: "mint_error", message: e.message });
  }
};

