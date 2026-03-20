const { randomUUID } = require('crypto');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const founderKey = process.env.SKYDEXIA_VERIFY_FOUNDER_KEY || 'verify-founder-key';
const sessionSecret = process.env.SKYDEXIA_VERIFY_SESSION_SECRET || 'verify-session-secret';
const databaseUrlFromEnv = process.env.SKYDEXIA_VERIFY_HOSTED_DATABASE_URL || process.env.SKYDEXIA_DATABASE_URL || '';
const postgresPort = Number(process.env.SKYDEXIA_VERIFY_POSTGRES_PORT || 55432);
const postgresPassword = process.env.SKYDEXIA_VERIFY_POSTGRES_PASSWORD || 'skydexia-verify';
const postgresContainer = `skydexia-verify-${process.pid}-${Date.now().toString(36)}`;
const workspaceId = `verify-hosted-${Date.now().toString(36)}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function envForHosted(databaseUrl) {
  process.env.SKYDEXIA_DATABASE_URL = databaseUrl;
  process.env.SKYDEXIA_DATABASE_SSL = 'disable';
  process.env.SKYDEXIA_DATABASE_TABLE = `skydexia_verify_${Date.now().toString(36)}`;
  delete process.env.SKYDEXIA_RUNTIME_CONTROL_URL;
  delete process.env.SKYDEXIA_RUNTIME_CONTROL_BASE_URL;
  process.env.SKYDEXIA_HOSTED_NATIVE_RUNTIME = '1';
  process.env.SKYDEXIA_SESSION_SECRET = sessionSecret;
  process.env.FOUNDERS_GATEWAY_KEY = founderKey;
  process.env.SKYDEXIA_GITHUB_TOKEN = '';
  process.env.GITHUB_TOKEN = '';
  process.env.GH_TOKEN = '';
  process.env.SKYDEXIA_NETLIFY_TOKEN = '';
  process.env.NETLIFY_AUTH_TOKEN = '';
  process.env.NETLIFY_TOKEN = '';
}

function clearFunctionCaches(targetPath) {
  const runtimeLib = path.join(ROOT, 'netlify', 'functions', '_lib', 'runtime.js');
  const bridgeLib = path.join(ROOT, 'netlify', 'functions', '_lib', 'runtime-bridge.js');
  [targetPath, runtimeLib, bridgeLib].forEach((entry) => {
    try {
      delete require.cache[require.resolve(entry)];
    } catch {
      // ignore cache misses
    }
  });
}

async function invokeFunction(relativePath, options = {}) {
  const targetPath = path.join(ROOT, 'netlify', 'functions', relativePath);
  clearFunctionCaches(targetPath);
  const mod = require(targetPath);
  const query = options.query || '';
  const rawUrl = `https://hosted.skydexia.test/api/${relativePath.replace(/\.js$/, '')}${query ? `?${query}` : ''}`;
  const event = {
    httpMethod: options.method || 'GET',
    path: `/api/${relativePath.replace(/\.js$/, '')}`,
    rawUrl,
    rawQuery: query,
    headers: {
      host: 'hosted.skydexia.test',
      'x-forwarded-proto': 'https',
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : '',
  };
  const response = await mod.handler(event);
  const payload = response?.body ? JSON.parse(response.body) : {};
  return { response, payload };
}

async function startDockerPostgres() {
  const args = [
    'run', '--rm', '--name', postgresContainer,
    '-e', `POSTGRES_PASSWORD=${postgresPassword}`,
    '-e', 'POSTGRES_USER=postgres',
    '-e', 'POSTGRES_DB=skydexia',
    '-p', `${postgresPort}:5432`,
    '-d', 'postgres:16-alpine',
  ];
  await new Promise((resolve, reject) => {
    const child = spawn('docker', args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.once('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || 'docker run failed for hosted verify postgres container.'));
    });
  });
  const databaseUrl = `postgres://postgres:${postgresPassword}@127.0.0.1:${postgresPort}/skydexia`;
  const { Pool } = require('pg');
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15000) {
    const pool = new Pool({ connectionString: databaseUrl, max: 1 });
    try {
      await pool.query('SELECT 1');
      await pool.end();
      return databaseUrl;
    } catch {
      await pool.end().catch(() => null);
      await sleep(250);
    }
  }
  throw new Error('Hosted verify postgres container did not become ready in time.');
}

async function stopDockerPostgres() {
  await new Promise((resolve) => {
    const child = spawn('docker', ['rm', '-f', postgresContainer], { cwd: ROOT, stdio: 'ignore' });
    child.once('close', () => resolve());
    child.once('error', () => resolve());
  });
}

async function seedCompletedReleaseRecord() {
  const runtimeLibPath = path.join(ROOT, 'netlify', 'functions', '_lib', 'runtime.js');
  clearFunctionCaches(runtimeLibPath);
  const runtime = require(runtimeLibPath);
  await runtime.updateState((current) => {
    runtime.appendReleaseHistory(current, {
      id: `release_${randomUUID().slice(0, 8)}`,
      status: 'completed',
      channel: 'github',
      ws_id: workspaceId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      actor: 'verify@skydexia.test',
      source: 'hosted-verify',
      repo: 'example/repo',
      branch: 'main',
      commit_sha: 'verify',
      message: 'Hosted verify completion record',
      included_count: 2,
      blocked_count: 0,
      files_uploaded: 2,
      files_deleted: 0,
      title: 'Hosted verify',
    });
    return current;
  });
  await runtime.closeStorage?.();
}

async function main() {
  let databaseUrl = databaseUrlFromEnv;
  let runtimeId = '';
  if (!databaseUrl) databaseUrl = await startDockerPostgres();
  envForHosted(databaseUrl);

  try {
    const auth = await invokeFunction('auth-founder-gateway.js', {
      method: 'POST',
      body: { key: founderKey },
      headers: { 'content-type': 'application/json' },
    });
    assert(auth.response.statusCode === 200, `Hosted founder auth returned ${auth.response.statusCode}.`);
    const cookie = String(auth.response.headers?.['Set-Cookie'] || auth.response.headers?.['set-cookie'] || '').split(';').slice(0, 1).join(';');
    assert(cookie.includes('kx_session='), 'Hosted founder auth did not return a session cookie.');
    assert(String(auth.response.headers?.['Set-Cookie'] || auth.response.headers?.['set-cookie'] || '').includes('Secure'), 'Hosted founder cookie was not marked Secure.');

    const files = [
      { path: 'index.html', content: '<!DOCTYPE html><html><body><h1>hosted verify marker</h1></body></html>' },
      { path: 'README.md', content: '# Hosted Verify\n\nThis workspace proves hosted Postgres durability and the runtime bridge.\n' },
      { path: '.skydexia/workbench.json', content: JSON.stringify({
        schema: 'skydexia-2.6-workbench',
        runtimePresetId: 'static-preview',
        runtime: {
          command: 'python3',
          args: ['-m', 'http.server', '4318', '--bind', '127.0.0.1'],
          cwd_relative: '.',
          port: 4318,
          launch_url: 'http://127.0.0.1:4318/',
          probe_path: '/',
          probe_contains_text: 'hosted verify marker',
        },
        tasks: [
          {
            id: 'hosted-verify-echo',
            label: 'Emit hosted verify task marker',
            command: 'python3',
            args: ['-c', 'print("hosted verify task marker")'],
            cwd_relative: '.',
          },
        ],
      }, null, 2) },
    ];

    const githubConnect = await invokeFunction('github-app-connect.js', {
      method: 'POST',
      cookie,
      body: { ws_id: workspaceId, repo: 'example/repo', branch: 'main' },
      headers: { 'content-type': 'application/json' },
    });
    assert(githubConnect.response.statusCode === 200, `Hosted GitHub connect returned ${githubConnect.response.statusCode}.`);

    const netlifyConnect = await invokeFunction('netlify-connect.js', {
      method: 'POST',
      cookie,
      body: { ws_id: workspaceId, site_id: 'hosted-verify-site' },
      headers: { 'content-type': 'application/json' },
    });
    assert(netlifyConnect.response.statusCode === 200, `Hosted Netlify connect returned ${netlifyConnect.response.statusCode}.`);

    const save = await invokeFunction('ws-save.js', {
      method: 'POST',
      cookie,
      body: { ws_id: workspaceId, workspace_name: 'SkyDexia Hosted Verify Workspace', files },
      headers: { 'content-type': 'application/json' },
    });
    assert(save.response.statusCode === 200, `Hosted ws-save returned ${save.response.statusCode}.`);

    const start = await invokeFunction(path.join('runtime', 'start.js'), {
      method: 'POST',
      cookie,
      body: {
        ws_id: workspaceId,
        workspace_name: 'SkyDexia Hosted Verify Workspace',
        files,
        stop_recipe: {
          command: 'python3',
          args: ['-c', 'print("hosted stop recipe")'],
          cwd_relative: '.',
          wait_ms: 1000,
        },
      },
      headers: { 'content-type': 'application/json' },
    });
    assert(start.response.statusCode === 200, `Hosted runtime start returned ${start.response.statusCode}.`);
    assert(start.payload?.runtime_lane?.mode === 'hosted-native-runtime', 'Hosted runtime start did not report hosted-native-runtime mode.');
    runtimeId = String(start.payload?.runtime?.id || '').trim();
    assert(runtimeId, 'Hosted runtime start did not return a runtime id.');

    let probe;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      probe = await invokeFunction(path.join('runtime', 'probe.js'), {
        method: 'POST',
        cookie,
        body: { id: runtimeId, expected_status: 200, contains_text: 'hosted verify marker' },
        headers: { 'content-type': 'application/json' },
      });
      if (probe.response.statusCode === 200 && probe.payload?.probe?.ok) break;
      await sleep(500);
    }
    assert(probe && probe.payload?.probe?.ok, 'Hosted runtime probe never returned ok=true.');

    const taskStart = await invokeFunction(path.join('runtime', 'task-start.js'), {
      method: 'POST',
      cookie,
      body: { ws_id: workspaceId, workspace_name: 'SkyDexia Hosted Verify Workspace', files, preset_id: 'hosted-verify-echo' },
      headers: { 'content-type': 'application/json' },
    });
    assert(taskStart.response.statusCode === 200, `Hosted task start returned ${taskStart.response.statusCode}.`);
    const taskId = String(taskStart.payload?.task?.id || '').trim();
    assert(taskId, 'Hosted task start did not return a task id.');

    let taskLogs;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      taskLogs = await invokeFunction(path.join('runtime', 'task-logs.js'), {
        method: 'GET',
        cookie,
        query: `id=${encodeURIComponent(taskId)}&ws_id=${encodeURIComponent(workspaceId)}`,
      });
      if (taskLogs.response.statusCode === 200 && String(taskLogs.payload?.stdout || '').includes('hosted verify task marker')) break;
      await sleep(250);
    }
    assert(taskLogs && taskLogs.response.statusCode === 200, 'Hosted task logs did not return 200.');
    assert(String(taskLogs.payload?.stdout || '').includes('hosted verify task marker'), 'Hosted task logs did not include the hosted verify marker.');

    const githubPush = await invokeFunction('github-push.js', {
      method: 'POST',
      cookie,
      body: { ws_id: workspaceId, message: 'Hosted verify deferred GitHub release' },
      headers: { 'content-type': 'application/json' },
    });
    assert(githubPush.response.statusCode === 202, `Hosted GitHub push returned ${githubPush.response.statusCode}.`);

    const netlifyDeploy = await invokeFunction('netlify-deploy.js', {
      method: 'POST',
      cookie,
      body: { ws_id: workspaceId, title: 'Hosted verify deferred Netlify deploy' },
      headers: { 'content-type': 'application/json' },
    });
    assert(netlifyDeploy.response.statusCode === 202, `Hosted Netlify deploy returned ${netlifyDeploy.response.statusCode}.`);

    await seedCompletedReleaseRecord();

    const integrations = await invokeFunction('integrations-status.js', {
      method: 'GET',
      cookie,
      query: `ws_id=${encodeURIComponent(workspaceId)}`,
    });
    assert(integrations.response.statusCode === 200, `Hosted integrations returned ${integrations.response.statusCode}.`);
    assert(integrations.payload?.storage_backend === 'postgres', `Expected hosted storage backend postgres, received ${String(integrations.payload?.storage_backend || '') || 'missing'}.`);
    assert(Array.isArray(integrations.payload?.deferred_releases) && integrations.payload.deferred_releases.length === 2, 'Hosted deferred release queue did not persist correctly.');
    assert(Array.isArray(integrations.payload?.release_history) && integrations.payload.release_history.length >= 1, 'Hosted release history did not persist correctly.');

    const workspace = await invokeFunction('ws-get.js', {
      method: 'GET',
      cookie,
      query: `ws_id=${encodeURIComponent(workspaceId)}`,
    });
    assert(workspace.response.statusCode === 200, `Hosted ws-get returned ${workspace.response.statusCode}.`);
    assert(Array.isArray(workspace.payload?.files) && workspace.payload.files.length >= 3, 'Hosted workspace files were not persisted in Postgres.');
    assert(workspace.payload.files.some((file) => String(file?.path || '') === '.skydexia/workbench.json'), 'Hosted workspace did not persist the saved workbench profile.');

    const listAfterColdStart = await invokeFunction(path.join('runtime', 'list.js'), {
      method: 'GET',
      cookie,
      query: `ws_id=${encodeURIComponent(workspaceId)}`,
    });
    assert(listAfterColdStart.response.statusCode === 200, `Hosted runtime list returned ${listAfterColdStart.response.statusCode}.`);
    assert(listAfterColdStart.payload?.runtime_lane?.mode === 'hosted-native-runtime', 'Hosted runtime list did not keep hosted native mode after a cold start.');

    const stop = await invokeFunction(path.join('runtime', 'stop.js'), {
      method: 'POST',
      cookie,
      body: { id: runtimeId },
      headers: { 'content-type': 'application/json' },
    });
    assert(stop.response.statusCode === 200, `Hosted runtime stop returned ${stop.response.statusCode}.`);
    assert(stop.payload?.runtime?.stop_outcome?.result === 'graceful', 'Hosted runtime stop did not report a graceful stop outcome.');

    const logs = await invokeFunction(path.join('runtime', 'logs.js'), {
      method: 'GET',
      cookie,
      query: `ws_id=${encodeURIComponent(workspaceId)}`,
    });
    assert(logs.response.statusCode === 200, `Hosted runtime logs returned ${logs.response.statusCode}.`);

    console.log('hostedStorageBackend=postgres');
    console.log(`hostedDeferredCount=${String(integrations.payload.deferred_releases.length)}`);
    console.log(`hostedReleaseHistoryCount=${String(integrations.payload.release_history.length)}`);
    console.log(`hostedNativeRuntime=${String(start.payload?.runtime_lane?.mode === 'hosted-native-runtime')}`);
    console.log(`hostedNativeTask=${String(taskStart.payload?.runtime_lane?.mode === 'hosted-native-runtime')}`);
    console.log(`hostedStopOutcome=${String(stop.payload?.runtime?.stop_outcome?.result || '')}`);
    console.log('verifyHosted=passed');
  } finally {
    if (runtimeId) {
      await invokeFunction(path.join('runtime', 'stop.js'), {
        method: 'POST',
        cookie: '',
        body: { id: runtimeId },
        headers: { 'content-type': 'application/json', Authorization: `Bearer invalid` },
      }).catch(() => null);
    }
    try {
      clearFunctionCaches(path.join(ROOT, 'netlify', 'functions', '_lib', 'runtime.js'));
      const runtime = require(path.join(ROOT, 'netlify', 'functions', '_lib', 'runtime.js'));
      await runtime.closeStorage?.();
    } catch {
      // ignore teardown failures
    }
    if (!databaseUrlFromEnv) await stopDockerPostgres();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});