const {
  appendDeferredRelease,
  appendReleaseHistory,
  clearDeferredReleases,
  createId,
  evaluateSknore,
  firstEnv,
  getIntegrations,
  getWorkspace,
  handleCors,
  json,
  methodNotAllowed,
  nowIso,
  readJsonBody,
  readStoredSecret,
  requireSession, requireAuth,
  sanitizeFiles,
  updateState,
} = require('./_lib/runtime');

const crypto = require('crypto');

function gitBlobShaFromBuffer(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`);
  return crypto.createHash('sha1').update(header).update(buffer).digest('hex');
}

function normalizeWorkspaceFileContent(rawContent) {
  const bytes = Buffer.from(String(rawContent ?? ''), 'utf8');
  return {
    sha: gitBlobShaFromBuffer(bytes),
    githubBase64: bytes.toString('base64'),
  };
}

async function githubFetch(token, method, pathname, body) {
  const response = await fetch(`https://api.github.com${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'SkyDexia-2.6',
    },
    body: body ? JSON.stringify(body) : null,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.message || `GitHub ${response.status}`);
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

async function resolveHeadRef({ token, owner, repo, branch }) {
  const encodedBranch = encodeURIComponent(branch);
  try {
    const targetRef = await githubFetch(token, 'GET', `/repos/${owner}/${repo}/git/ref/heads/${encodedBranch}`);
    return { branchExists: true, baseCommitSha: targetRef.object.sha, baseBranch: branch };
  } catch (error) {
    if (error?.statusCode !== 404 && error?.statusCode !== 409) throw error;
  }

  const repoData = await githubFetch(token, 'GET', `/repos/${owner}/${repo}`);
  const defaultBranch = String(repoData.default_branch || 'main').trim() || 'main';
  try {
    const fallbackRef = await githubFetch(token, 'GET', `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(defaultBranch)}`);
    return { branchExists: false, baseCommitSha: fallbackRef.object.sha, baseBranch: defaultBranch };
  } catch (error) {
    if (error?.statusCode !== 404 && error?.statusCode !== 409) throw error;
  }
  return { branchExists: false, baseCommitSha: null, baseBranch: defaultBranch };
}

exports.handler = async (event) => {
  const cors = handleCors(event, ['POST', 'OPTIONS']);
  if (cors) return cors;
  if (event.httpMethod !== 'POST') return methodNotAllowed(['POST', 'OPTIONS']);

  const session = await requireAuth(event);
  if (!session) return json(401, { ok: false, error: 'Founder session or signed bearer token required.' });

  const body = await readJsonBody(event);
  if (!body.ok) return body.response;
  const workspaceId = String(body.value?.ws_id || 'default').trim() || 'default';

  const state = await updateState((current) => {
    getIntegrations(current, workspaceId);
    getWorkspace(current, workspaceId);
    return current;
  });

  const integrations = getIntegrations(state, workspaceId);
  const workspace = getWorkspace(state, workspaceId);
  const repoRef = String(integrations.github?.repo || '').trim();
  if (!repoRef || !/^[^/\s]+\/[^/\s]+$/.test(repoRef)) {
    return json(400, { ok: false, error: 'GitHub repo is not configured. Connect a repo first.' });
  }
  const token = readStoredSecret(integrations.github, 'token_cipher', 'token') || firstEnv('SKYDEXIA_GITHUB_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN');

  const files = sanitizeFiles(workspace.files);
  const sknore = evaluateSknore(files);
  const releasableFiles = files.filter((file) => !sknore.blocked_paths.includes(file.path));
  const [owner, repo] = repoRef.split('/');
  const branch = String(integrations.github?.branch || 'main').trim() || 'main';
  const stamp = nowIso();
  if (!token) {
    let deferredRelease = null;
    const reason = 'GitHub push was deferred because no release token is currently available in the package lane.';
    await updateState((current) => {
      clearDeferredReleases(current, (record) => String(record?.ws_id || '') === workspaceId && record?.channel === 'GitHub');
      deferredRelease = appendDeferredRelease(current, {
        id: createId('release'),
        channel: 'GitHub',
        ws_id: workspaceId,
        repo: repoRef,
        branch,
        created_at: stamp,
        updated_at: stamp,
        actor: session.sub,
        source: 'server-storage',
        included_count: sknore.included_count,
        blocked_count: sknore.blocked_count,
        message: String(body.value?.message || '').trim(),
        reason_code: 'missing-token',
        reason,
      });
      return current;
    });
    return json(202, {
      ok: true,
      deferred: true,
      release: deferredRelease,
      repo: repoRef,
      branch,
      included_count: sknore.included_count,
      blocked_count: sknore.blocked_count,
      sknore,
      warning: reason,
      source: 'server-storage',
    });
  }

  try {
    const { branchExists, baseCommitSha, baseBranch } = await resolveHeadRef({ token, owner, repo, branch });
  let remoteTree = {};
  let baseTreeSha = null;
  if (baseCommitSha) {
    const treeData = await githubFetch(token, 'GET', `/repos/${owner}/${repo}/git/trees/${baseCommitSha}?recursive=1`);
    baseTreeSha = treeData.sha;
    remoteTree = Object.fromEntries((treeData.tree || [])
      .filter((item) => item.type === 'blob' && item.path)
      .map((item) => [item.path, item.sha]));
  }

  const localShas = {};
  const toUpload = [];
  for (const file of releasableFiles) {
    const normalized = normalizeWorkspaceFileContent(file.content);
    localShas[file.path] = normalized.sha;
    if (remoteTree[file.path] !== normalized.sha) {
      toUpload.push({ path: file.path, githubBase64: normalized.githubBase64 });
    }
  }
  const deletedPaths = Object.keys(remoteTree).filter((remotePath) => !Object.prototype.hasOwnProperty.call(localShas, remotePath));

  if (!toUpload.length && !deletedPaths.length) {
    return json(200, {
      ok: true,
      repo: repoRef,
      branch,
      commit_sha: baseCommitSha,
      included_count: sknore.included_count,
      blocked_count: sknore.blocked_count,
      sknore,
      source: 'server-storage',
      status: 'up-to-date',
    });
  }

  const uploadedBlobs = {};
  const batchSize = 20;
  for (let index = 0; index < toUpload.length; index += batchSize) {
    const batch = toUpload.slice(index, index + batchSize);
    const results = await Promise.all(batch.map(async (entry) => {
      const blob = await githubFetch(token, 'POST', `/repos/${owner}/${repo}/git/blobs`, {
        content: entry.githubBase64,
        encoding: 'base64',
      });
      return { path: entry.path, sha: blob.sha };
    }));
    results.forEach((result) => {
      uploadedBlobs[result.path] = result.sha;
    });
  }

  const treeEntries = [
    ...Object.entries(uploadedBlobs).map(([path, sha]) => ({ path, mode: '100644', type: 'blob', sha })),
    ...deletedPaths.map((path) => ({ path, mode: '100644', type: 'blob', sha: null })),
  ];

  const newTreeBody = { tree: treeEntries };
  if (baseTreeSha) newTreeBody.base_tree = baseTreeSha;
  const newTree = await githubFetch(token, 'POST', `/repos/${owner}/${repo}/git/trees`, newTreeBody);
  const commitBody = {
    message: String(body.value?.message || '').trim() || `SkyDexia 2.6 push — ${new Date().toUTCString()}`,
    tree: newTree.sha,
  };
  if (baseCommitSha) commitBody.parents = [baseCommitSha];
  const newCommit = await githubFetch(token, 'POST', `/repos/${owner}/${repo}/git/commits`, commitBody);

  if (branchExists) {
    await githubFetch(token, 'PATCH', `/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, { sha: newCommit.sha, force: false });
  } else {
    await githubFetch(token, 'POST', `/repos/${owner}/${repo}/git/refs`, { ref: `refs/heads/${branch}`, sha: newCommit.sha });
  }

    const commitSha = newCommit.sha;

    await updateState((current) => {
      clearDeferredReleases(current, (record) => String(record?.ws_id || '') === workspaceId && record?.channel === 'GitHub');
      appendReleaseHistory(current, {
        id: createId('release'),
        channel: 'GitHub',
        ws_id: workspaceId,
        repo: repoRef,
        branch,
        commit_sha: commitSha,
        created_at: stamp,
        updated_at: stamp,
        actor: session.sub,
        source: 'server-storage',
        included_count: sknore.included_count,
        blocked_count: sknore.blocked_count,
        message: String(body.value?.message || '').trim(),
        files_uploaded: toUpload.length,
        files_deleted: deletedPaths.length,
      });
      return current;
    });

    return json(200, {
      ok: true,
      repo: repoRef,
      branch,
      commit_sha: commitSha,
      included_count: sknore.included_count,
      blocked_count: sknore.blocked_count,
      files_uploaded: toUpload.length,
      files_deleted: deletedPaths.length,
      base_branch: baseBranch,
      sknore,
      source: 'server-storage',
    });
  } catch (error) {
    let deferredRelease = null;
    await updateState((current) => {
      clearDeferredReleases(current, (record) => String(record?.ws_id || '') === workspaceId && record?.channel === 'GitHub');
      deferredRelease = appendDeferredRelease(current, {
        id: createId('release'),
        channel: 'GitHub',
        ws_id: workspaceId,
        repo: repoRef,
        branch,
        created_at: stamp,
        updated_at: stamp,
        actor: session.sub,
        source: 'server-storage',
        included_count: sknore.included_count,
        blocked_count: sknore.blocked_count,
        message: String(body.value?.message || '').trim(),
        reason_code: 'adapter-unavailable',
        reason: error?.message || 'GitHub push failed before a remote commit could be created.',
      });
      return current;
    });
    return json(202, {
      ok: true,
      deferred: true,
      release: deferredRelease,
      repo: repoRef,
      branch,
      included_count: sknore.included_count,
      blocked_count: sknore.blocked_count,
      sknore,
      warning: deferredRelease.reason,
      source: 'server-storage',
    });
  }
};