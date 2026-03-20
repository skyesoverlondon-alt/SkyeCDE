const { firstEnv, getIntegrations, handleCors, json, methodNotAllowed, nowIso, readJsonBody, requireSession, requireAuth, sanitizeIntegrations, sealSecret, updateState } = require('./_lib/runtime');

async function githubFetch(token, pathname) {
  const response = await fetch(`https://api.github.com${pathname}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'SkyDexia-2.6',
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.message || `GitHub ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }
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
  const repo = String(body.value?.repo || '').trim();
  const branch = String(body.value?.branch || 'main').trim() || 'main';
  const installationId = String(body.value?.installation_id || '').trim();
  const providedToken = String(body.value?.token || '').trim();
  if (!repo) return json(400, { ok: false, error: 'GitHub repo is required.' });
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) return json(400, { ok: false, error: 'GitHub repo must use owner/repo format.' });
  const token = providedToken || firstEnv('SKYDEXIA_GITHUB_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN');
  const tokenPresent = Boolean(token);
  const tokenCipher = providedToken ? sealSecret(providedToken) : null;
  let resolvedRepo = repo;
  let resolvedBranch = branch;

  if (tokenPresent) {
    try {
      const repoData = await githubFetch(token, `/repos/${repo}`);
      resolvedRepo = String(repoData?.full_name || repo).trim() || repo;
      if (!branch) resolvedBranch = String(repoData?.default_branch || 'main').trim() || 'main';
    } catch (error) {
      return json(error?.statusCode || 500, { ok: false, error: error?.message || 'GitHub repo validation failed.' });
    }
  }

  const state = await updateState((current) => {
    const integrations = getIntegrations(current, workspaceId);
    integrations.github = {
      connected: true,
      repo: resolvedRepo,
      branch: resolvedBranch,
      installation_id: installationId,
      token_cipher: tokenCipher || integrations.github?.token_cipher || null,
      token_present: tokenPresent,
      mode: 'server-storage',
      updated_at: nowIso(),
    };
    return current;
  });

  return json(200, { ok: true, github: sanitizeIntegrations(getIntegrations(state, workspaceId)).github, source: 'server-storage' });
};