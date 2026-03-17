const { json, jsonCookies, parseJson, requireEnv, issueAuthCookies, clearAuthCookies, parseCookies, cookie, getClientIp, hashIp, randomToken, enforceRateLimit, verifyTurnstile, verifyAuthSession, revokeSessionByJti, revokeAllSessionsForUser, requireCsrf, requireMethod} = require("./_utils");
/*
  Public (non-secret) inbound email config.

  Env:
    - INBOUND_DOMAIN (example: mail.yourdomain.com)
    - INBOUND_PROVIDER (default: "postmark")
*/
exports.handler = async () => {
  const domain = process.env.INBOUND_DOMAIN ? String(process.env.INBOUND_DOMAIN).trim() : "";
  const provider = process.env.INBOUND_PROVIDER ? String(process.env.INBOUND_PROVIDER).trim() : "postmark";
  if(!domain) return json(200, { enabled:false, inbound_domain:null, provider:null });
  return json(200, { enabled:true, inbound_domain:domain, provider });
};
