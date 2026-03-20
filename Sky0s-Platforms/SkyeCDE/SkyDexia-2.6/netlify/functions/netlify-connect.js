const { firstEnv, getIntegrations, handleCors, json, methodNotAllowed, nowIso, readJsonBody, requireSession, requireAuth, sanitizeIntegrations, sealSecret, updateState } = require('./_lib/runtime');

async function netlifyFetch(token, pathname) {
  const response = await fetch(`https://api.netlify.com/api/v1${pathname}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || `Netlify ${response.status}`);
  return payload;
}

exports.handler = async (event) => {
  const cors = handleCors(event, ['POST', 'OPTIONS']);
  if (cors) return cors;
  if (event.httpMethod !== 'POST') return methodNotAllowed(['POST', 'OPTIONS']);

  if (!requireSession(event)) return json(401, { ok: false, error: 'Founder session or signed bearer token required.' });

  const body = await readJsonBody(event);
  if (!body.ok) return body.response;
  const workspaceId = String(body.value?.ws_id || 'default').trim() || 'default';
  const siteId = String(body.value?.site_id || '').trim();
  const siteName = String(body.value?.site_name || '').trim();
  const providedToken = String(body.value?.token || '').trim();
  const token = providedToken || firstEnv('SKYDEXIA_NETLIFY_TOKEN', 'NETLIFY_AUTH_TOKEN', 'NETLIFY_TOKEN');
  const tokenCipher = providedToken ? sealSecret(providedToken) : null;
  if (!siteId && !siteName) return json(400, { ok: false, error: 'Netlify site id or site name is required.' });

  let resolvedSiteId = siteId || null;
  let resolvedSiteName = siteName || null;
  if (token) {
    if (siteId) {
      const site = await netlifyFetch(token, `/sites/${encodeURIComponent(siteId)}`);
      resolvedSiteId = String(site?.id || siteId).trim() || null;
      resolvedSiteName = String(site?.name || siteName).trim() || null;
    } else {
      const sites = await netlifyFetch(token, '/sites');
      const matchedSite = Array.isArray(sites)
        ? sites.find((site) => String(site?.name || '').trim() === siteName)
        : null;
      if (!matchedSite) return json(404, { ok: false, error: 'Netlify site name was not found for the provided token.' });
      resolvedSiteId = String(matchedSite.id || '').trim() || null;
      resolvedSiteName = String(matchedSite.name || siteName).trim() || null;
    }
  }

  const state = await updateState((current) => {
    const integrations = getIntegrations(current, workspaceId);
    integrations.netlify = {
      connected: true,
      site_id: resolvedSiteId,
      site_name: resolvedSiteName,
      token_cipher: tokenCipher || integrations.netlify?.token_cipher || null,
      token_present: Boolean(token),
      mode: 'server-storage',
      updated_at: nowIso(),
    };
    return current;
  });

  return json(200, { ok: true, netlify: sanitizeIntegrations(getIntegrations(state, workspaceId)).netlify, source: 'server-storage' });
};