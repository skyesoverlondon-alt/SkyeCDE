const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const host = process.env.SKYDEXIA_VERIFY_HOST || '127.0.0.1';
const port = Number(process.env.SKYDEXIA_VERIFY_PORT || 4296);
const baseUrl = `http://${host}:${port}`;
const founderKey = process.env.SKYDEXIA_VERIFY_FOUNDER_KEY || 'verify-founder-key';
const sessionSecret = process.env.SKYDEXIA_VERIFY_SESSION_SECRET || 'verify-session-secret';
const workspaceId = `verify-${Date.now().toString(36)}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchJson(targetPath, options = {}) {
  const url = `${baseUrl}${targetPath}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 15000);
  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
      body: options.body,
      signal: controller.signal,
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    return { response, payload };
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForServer() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15000) {
    try {
      const response = await fetch(`${baseUrl}/`, { method: 'GET' });
      if (response.ok) return;
    } catch {
      // keep polling
    }
    await sleep(250);
  }
  throw new Error('SkyDexia package server did not become ready in time.');
}

async function main() {
  let runtimeId = '';
  const server = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      HOST: host,
      PORT: String(port),
      FOUNDERS_GATEWAY_KEY: founderKey,
      SKYDEXIA_SESSION_SECRET: sessionSecret,
      SKYDEXIA_GITHUB_TOKEN: '',
      GITHUB_TOKEN: '',
      GH_TOKEN: '',
      SKYDEXIA_NETLIFY_TOKEN: '',
      NETLIFY_AUTH_TOKEN: '',
      NETLIFY_TOKEN: '',
      SKYDEXIA_ALLOWED_ORIGIN: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let serverStdout = '';
  let serverStderr = '';
  server.stdout.on('data', (chunk) => {
    serverStdout += chunk.toString();
  });
  server.stderr.on('data', (chunk) => {
    serverStderr += chunk.toString();
  });

  try {
    await waitForServer();

    const auth = await fetchJson('/api/auth-founder-gateway', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: founderKey }),
    });
    assert(auth.response.status === 200, `Founder auth returned ${auth.response.status}.`);
    assert(auth.response.headers.get('access-control-allow-origin') !== '*', 'Privileged auth route still exposes wildcard CORS.');
    const token = String(auth.payload?.kaixu_token?.token || '').trim();
    assert(token, 'Founder auth did not return a signed runtime token.');

    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    const files = [
      {
        path: 'index.html',
        content: '<!DOCTYPE html><html><body><h1>verify smoke marker</h1></body></html>',
      },
      {
        path: 'README.md',
        content: '# Verify Smoke\n\nThis workspace proves runtime ownership and deferred release behavior.\n',
      },
      {
        path: '.skydexia/workbench.json',
        content: JSON.stringify({
          schema: 'skydexia-2.6-workbench',
          runtimePresetId: 'static-preview',
          runtime: {
            command: 'python3',
            args: ['-m', 'http.server', '4317', '--bind', '127.0.0.1'],
            cwd_relative: '.',
            port: 4317,
            launch_url: 'http://127.0.0.1:4317/',
            probe_path: '/',
            probe_contains_text: 'verify smoke marker',
          },
          tasks: [
            {
              id: 'verify-echo',
              label: 'Emit verify task marker',
              command: 'python3',
              args: ['-c', 'print("verify task marker")'],
              cwd_relative: '.',
            },
          ],
        }, null, 2),
      },
    ];

    const githubConnect = await fetchJson('/api/github-app-connect', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ ws_id: workspaceId, repo: 'example/repo', branch: 'main' }),
    });
    assert(githubConnect.response.status === 200, `GitHub connect returned ${githubConnect.response.status}.`);

    const netlifyConnect = await fetchJson('/api/netlify-connect', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ ws_id: workspaceId, site_id: 'local-test-site' }),
    });
    assert(netlifyConnect.response.status === 200, `Netlify connect returned ${netlifyConnect.response.status}.`);

    const save = await fetchJson('/api/ws-save', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ ws_id: workspaceId, workspace_name: 'SkyDexia Verify Workspace', files }),
    });
    assert(save.response.status === 200, `Workspace save returned ${save.response.status}.`);

    const materialize = await fetchJson('/api/runtime/materialize', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ ws_id: workspaceId }),
    });
    assert(materialize.response.status === 200, `Runtime materialize returned ${materialize.response.status}.`);

    const start = await fetchJson('/api/runtime/start', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ ws_id: workspaceId, probe_expected_status: 200 }),
    });
    assert(start.response.status === 200, `Runtime start returned ${start.response.status}.`);
    runtimeId = String(start.payload?.runtime?.id || '').trim();
    assert(runtimeId, 'Runtime start did not return a runtime id.');

    let probe;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      probe = await fetchJson('/api/runtime/probe', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ id: runtimeId, expected_status: 200, contains_text: 'verify smoke marker' }),
      });
      if (probe.response.status === 200 && probe.payload?.probe?.ok) break;
      await sleep(500);
    }
    assert(probe && probe.response.status === 200 && probe.payload?.probe?.ok, 'Runtime probe never returned ok=true.');

    const taskStart = await fetchJson('/api/runtime/task-start', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ ws_id: workspaceId, preset_id: 'verify-echo' }),
    });
    assert(taskStart.response.status === 200, `Task start returned ${taskStart.response.status}.`);
    const taskId = String(taskStart.payload?.task?.id || '').trim();
    assert(taskId, 'Task start did not return a task id.');

    let taskLogs;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      taskLogs = await fetchJson(`/api/runtime/task-logs?id=${encodeURIComponent(taskId)}&ws_id=${encodeURIComponent(workspaceId)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (taskLogs.response.status === 200 && String(taskLogs.payload?.stdout || '').includes('verify task marker')) break;
      await sleep(250);
    }
    assert(taskLogs && taskLogs.response.status === 200, 'Task logs did not return 200.');
    assert(String(taskLogs.payload?.stdout || '').includes('verify task marker'), 'Task logs did not include the verify marker.');

    const logs = await fetchJson(`/api/runtime/logs?id=${encodeURIComponent(runtimeId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(logs.response.status === 200, `Runtime logs returned ${logs.response.status}.`);

    const githubPush = await fetchJson('/api/github-push', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ ws_id: workspaceId, message: 'Verify deferred GitHub release' }),
    });
    assert(githubPush.response.status === 202, `GitHub push returned ${githubPush.response.status}, expected 202.`);
    assert(githubPush.payload?.deferred === true, 'GitHub push did not report deferred=true.');

    const netlifyDeploy = await fetchJson('/api/netlify-deploy', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ ws_id: workspaceId, title: 'Verify deferred Netlify deploy' }),
    });
    assert(netlifyDeploy.response.status === 202, `Netlify deploy returned ${netlifyDeploy.response.status}, expected 202.`);
    assert(netlifyDeploy.payload?.deferred === true, 'Netlify deploy did not report deferred=true.');

    const integrations = await fetchJson(`/api/integrations-status?ws_id=${encodeURIComponent(workspaceId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    assert(integrations.response.status === 200, `Integrations status returned ${integrations.response.status}.`);
    assert(integrations.payload?.storage_backend === 'file', `Expected default storage backend file, received ${String(integrations.payload?.storage_backend || '') || 'missing'}.`);
    assert(Array.isArray(integrations.payload?.deferred_releases), 'Integrations status did not return deferred_releases.');
    assert(integrations.payload.deferred_releases.length === 2, `Expected 2 deferred releases, received ${integrations.payload.deferred_releases.length}.`);

    const replay = await fetchJson('/api/release-replay', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ ws_id: workspaceId, release_id: integrations.payload.deferred_releases[0]?.id }),
    });
    assert(replay.response.status === 202, `Release replay returned ${replay.response.status}, expected 202 while adapters are unavailable.`);
    assert(String(replay.payload?.replayed_release_id || '').trim(), 'Release replay did not report the replayed deferred release id.');

    const stop = await fetchJson('/api/runtime/stop', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ id: runtimeId }),
    });
    assert(stop.response.status === 200, `Runtime stop returned ${stop.response.status}.`);
    assert(stop.payload?.runtime?.status === 'stopped', 'Runtime stop did not report stopped status.');

    console.log(`authStatus=${auth.response.status}`);
    console.log(`runtimeStartStatus=${start.response.status}`);
    console.log(`taskStartStatus=${taskStart.response.status}`);
    console.log(`probeOk=${String(Boolean(probe.payload?.probe?.ok))}`);
    console.log(`githubDeferred=${String(Boolean(githubPush.payload?.deferred))}`);
    console.log(`netlifyDeferred=${String(Boolean(netlifyDeploy.payload?.deferred))}`);
    console.log(`storageBackend=${String(integrations.payload.storage_backend || '')}`);
    console.log(`deferredCount=${String(integrations.payload.deferred_releases.length)}`);
    console.log(`replayDeferred=${String(Boolean(replay.payload?.deferred))}`);
    console.log('verify=passed');
  } finally {
    if (runtimeId) {
      try {
        await fetchJson('/api/runtime/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: runtimeId }),
        });
      } catch {
        // ignore cleanup failures
      }
    }
    if (!server.killed) {
      server.kill('SIGTERM');
      await Promise.race([
        new Promise((resolve) => server.once('close', resolve)),
        sleep(3000),
      ]);
      if (!server.killed) server.kill('SIGKILL');
    }
    if (server.exitCode && server.exitCode !== 0) {
      process.stderr.write(serverStdout);
      process.stderr.write(serverStderr);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});