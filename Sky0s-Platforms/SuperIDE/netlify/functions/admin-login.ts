import { contractorErrorResponse, contractorHealthProbe, contractorJson, signContractorAdminJwt } from "./_shared/contractor-admin";

function readBearer(request: Request): string {
  const header = String(request.headers.get('authorization') || '').trim();
  if (!header.toLowerCase().startsWith('bearer ')) {
    return '';
  }
  return header.slice(7).trim();
}

async function verifyGateSession(request: Request): Promise<any> {
  const token = readBearer(request);
  if (!token) {
    throw Object.assign(new Error('Missing gate session token.'), { statusCode: 401 });
  }
  const gateBase = String(process.env.OMEGA_GATE_URL || 'https://0megaskyegate.skyesoverlondon.workers.dev').trim().replace(/\/+$/, '');
  const response = await fetch(`${gateBase}/v1/auth/me`, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.ok || !payload?.session) {
    throw Object.assign(new Error('Invalid or expired gate session.'), { statusCode: 401 });
  }
  return payload.session;
}

export default async (request: Request) => {
  try {
    if (request.method !== "POST") {
      return contractorJson(405, { error: "Method not allowed." });
    }

    const body = await request.json().catch(() => ({}));
    const password = String((body as any)?.password || "");
    const expected = String(process.env.ADMIN_PASSWORD || "").trim();
    const secret = String(process.env.ADMIN_JWT_SECRET || "").trim();

    if (!expected) throw Object.assign(new Error("ADMIN_PASSWORD not set."), { statusCode: 500 });
    if (!secret) throw Object.assign(new Error("ADMIN_JWT_SECRET not set."), { statusCode: 500 });
    if (!password || password !== expected) {
      throw Object.assign(new Error("Invalid password."), { statusCode: 401 });
    }

    const gateSession = await verifyGateSession(request);
    if (gateSession.auth_mode !== 'founder-gateway') {
      throw Object.assign(new Error('Founder gateway session required for admin login.'), { statusCode: 403 });
    }

    await contractorHealthProbe();
    const token = await signContractorAdminJwt({ role: "admin", sub: "contractor-admin", mode: "password+gate" }, secret);
    return contractorJson(200, { ok: true, token });
  } catch (error) {
    return contractorErrorResponse(error, "Login failed.");
  }
};
