const {
  handleCors,
  hasConfiguredSessionSecret,
  hasValidFounderGatewayKey,
  issueSessionToken,
  json,
  methodNotAllowed,
  readFounderGatewayEmail,
  readJsonBody,
  sessionCookie,
} = require('./_lib/runtime');

exports.handler = async (event) => {
  const cors = handleCors(event, ['POST', 'OPTIONS']);
  if (cors) return cors;
  if (event.httpMethod !== 'POST') return methodNotAllowed(['POST', 'OPTIONS']);

  if (!hasConfiguredSessionSecret()) {
    return json(500, { ok: false, error: 'SKYDEXIA_SESSION_SECRET or SESSION_SECRET must be configured before founder unlock can issue signed runtime sessions.' });
  }

  const body = await readJsonBody(event);
  if (!body.ok) return body.response;

  const key = String(body.value?.key || '').trim();
  if (!key) return json(400, { ok: false, error: 'Founder gateway key is required.' });
  if (!hasValidFounderGatewayKey(key)) return json(401, { ok: false, error: 'Invalid founder gateway key.' });

  const email = readFounderGatewayEmail();
  const session = issueSessionToken(email);

  return json(
    200,
    {
      ok: true,
      founder_gateway: true,
      kaixu_token: {
        token: session.token,
        label: `founder-gateway-${Date.now().toString(36)}`,
        locked_email: null,
        scopes: ['admin'],
        expires_at: session.expiresAt,
      },
      user: {
        email,
        recovery_email: email,
        org_id: 'skydexia-2.6',
        workspace_id: 'default',
        role: 'owner',
        has_pin: false,
      },
      workspace: {
        id: 'default',
        name: 'SkyDexia 2.6 Workspace',
      },
      org: {
        id: 'skydexia-2.6',
        seat_count: 1,
      },
      onboarding: {
        key_required: false,
        pin_configured: false,
        message: 'Founder gateway restored the packaged owner session and issued a signed SkyDexia 2.6 runtime token for this browser origin without retaining the raw founder key in browser storage.',
      },
    },
    { 'Set-Cookie': sessionCookie(session.token, session.expiresAt, event) }
  );
};