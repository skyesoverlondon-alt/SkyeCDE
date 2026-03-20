/********************************************************************************
 * Copyright (C) 2026 EclipseSource and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 *
 * SPDX-License-Identifier: MIT
 ********************************************************************************/

import { injectable } from '@theia/core/shared/inversify';
import { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';
import { Application, Request, Response, Router } from '@theia/core/shared/express';
import { json } from 'body-parser';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';

interface TerminalStartBody {
    id?: string;
    cwd?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    launchUrl?: string;
    healthCheck?: RuntimeHealthCheck;
}

interface RuntimeHealthCheck {
    name?: string;
    url?: string;
    path?: string;
    expectedStatus?: number;
    containsText?: string;
    timeoutMs?: number;
    headers?: Record<string, string>;
}

interface FileWriteBody {
    path?: string;
    content?: string;
}

interface FilePathBody {
    path?: string;
}

interface FileMoveBody {
    sourcePath?: string;
    targetPath?: string;
}

interface DirectoryCreateBody {
    path?: string;
}

interface RuntimeRestartBody {
    id?: string;
}

interface RuntimeLogsQuery {
    id?: string;
    stdoutOffset?: string;
    stderrOffset?: string;
    limit?: string;
}

interface RuntimeProbeBody extends RuntimeHealthCheck {
    id?: string;
}

interface GitHubConnectBody {
    repo?: string;
    branch?: string;
    token?: string;
    sourceRoot?: string;
    installationId?: string;
}

interface GitHubPushBody extends GitHubConnectBody {
    message?: string;
}

interface NetlifyConnectBody {
    siteId?: string;
    siteName?: string;
    token?: string;
    publishDir?: string;
    cwd?: string;
}

interface NetlifyDeployBody extends NetlifyConnectBody {
    title?: string;
    prod?: boolean;
}

interface CloudflareConnectBody {
    workerRoot?: string;
    apiToken?: string;
    accountId?: string;
    configPath?: string;
}

interface CloudflareDeployBody extends CloudflareConnectBody {
    environment?: string;
}

interface AutomationStateRecord {
    github?: {
        repo: string;
        branch: string;
        token?: string;
        sourceRoot: string;
        installationId?: string;
        connectedAt: string;
    };
    netlify?: {
        siteId?: string;
        siteName?: string;
        token?: string;
        publishDir: string;
        cwd: string;
        connectedAt: string;
    };
    cloudflare?: {
        workerRoot: string;
        apiToken?: string;
        accountId?: string;
        configPath?: string;
        connectedAt: string;
    };
    updatedAt?: string;
}

interface CommandExecutionResult {
    command: string;
    args: string[];
    cwd: string;
    stdout: string;
    stderr: string;
    exitCode: number;
}

interface RuntimeRecord {
    id: string;
    pid: number;
    cwd: string;
    command: string;
    args: string[];
    env: Record<string, string>;
    launchUrl: string | null;
    healthCheck: RuntimeHealthCheck | null;
    stdoutPath: string;
    stderrPath: string;
    startedAt: string;
}

@injectable()
export class SkyeCDEBridgeEndpoint implements BackendApplicationContribution {
    protected static PATH = '/launcher/skycde';
    protected readonly repoRoot = '/workspaces/SkyeCDE/Skye0s-s0l26';
    protected readonly runtimeDir = path.join(os.tmpdir(), 'skycde-runtime');
    protected readonly automationStatePath = path.join(this.runtimeDir, 'automation-state.json');
    protected readonly runtimes = new Map<string, RuntimeRecord>();

    configure(app: Application): void {
        const router = Router();
        router.get('/health', (_request, response) => this.health(response));
        router.get('/workspace', (request, response) => this.workspace(request, response));
        router.get('/file', (request, response) => this.readFile(request, response));
        router.put('/file', (request, response) => this.writeFile(request, response));
        router.post('/file/rename', (request, response) => this.renamePath(request, response));
        router.post('/file/move', (request, response) => this.movePath(request, response));
        router.post('/file/delete', (request, response) => this.deletePath(request, response));
        router.post('/directory', (request, response) => this.createDirectory(request, response));
        router.post('/terminal/start', (request, response) => this.startTerminal(request, response));
        router.get('/terminal/status', (request, response) => this.runtimeStatus(request, response));
        router.get('/terminal/logs', (request, response) => this.runtimeLogs(request, response));
        router.post('/terminal/restart', (request, response) => this.restartRuntime(request, response));
        router.post('/terminal/stop', (request, response) => this.stopRuntime(request, response));
        router.post('/terminal/probe', this.withErrorBoundary((request, response) => this.probeRuntime(request, response)));
        router.get('/automation/state', (request, response) => this.automationState(response));
        router.post('/automation/github/connect', this.withErrorBoundary((request, response) => this.githubConnect(request, response)));
        router.post('/automation/github/push', this.withErrorBoundary((request, response) => this.githubPush(request, response)));
        router.post('/automation/netlify/connect', this.withErrorBoundary((request, response) => this.netlifyConnect(request, response)));
        router.post('/automation/netlify/deploy', this.withErrorBoundary((request, response) => this.netlifyDeploy(request, response)));
        router.post('/automation/cloudflare/connect', this.withErrorBoundary((request, response) => this.cloudflareConnect(request, response)));
        router.post('/automation/cloudflare/deploy', this.withErrorBoundary((request, response) => this.cloudflareDeploy(request, response)));
        app.use(json());
        app.use(SkyeCDEBridgeEndpoint.PATH, router);
    }

    protected health(response: Response): void {
        response.json({
            ok: true,
            repoRoot: this.repoRoot,
            bridge: 'skycde',
            runtimeCount: this.listRuntimes().length,
            automation: this.sanitizeAutomationState(this.loadAutomationState())
        });
    }

    protected withErrorBoundary(handler: (request: Request, response: Response) => Promise<void>): (request: Request, response: Response) => void {
        return (request, response) => {
            void handler(request, response).catch(error => {
                if (response.headersSent) {
                    return;
                }
                response.status(500).json({ error: error instanceof Error ? error.message : 'Automation request failed.' });
            });
        };
    }

    protected workspace(request: Request, response: Response): void {
        const requestedRoot = typeof request.query.root === 'string' ? request.query.root : '.';
        const recursive = request.query.recursive === 'true';
        const rawLimit = typeof request.query.limit === 'string' ? Number.parseInt(request.query.limit, 10) : NaN;
        const limit = Number.isFinite(rawLimit)
            ? Math.max(1, Math.min(rawLimit, 2000))
            : recursive ? 500 : 200;
        const resolvedRoot = this.resolveRepoPath(requestedRoot);
        if (!resolvedRoot || !fs.existsSync(resolvedRoot) || !fs.statSync(resolvedRoot).isDirectory()) {
            response.status(400).json({ error: 'Workspace root is invalid.' });
            return;
        }

        const entries = recursive
            ? this.walkWorkspaceEntries(resolvedRoot, limit)
            : this.listWorkspaceEntries(resolvedRoot, limit);

        response.json({
            root: path.relative(this.repoRoot, resolvedRoot) || '.',
            absoluteRoot: resolvedRoot,
            recursive,
            limit,
            entries
        });
    }

    protected readFile(request: Request, response: Response): void {
        const requestedPath = typeof request.query.path === 'string' ? request.query.path : '';
        const resolvedPath = this.resolveRepoPath(requestedPath);
        if (!resolvedPath || !fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isFile()) {
            response.status(400).json({ error: 'File path is invalid.' });
            return;
        }

        const content = fs.readFileSync(resolvedPath, 'utf8');
        response.json({
            path: path.relative(this.repoRoot, resolvedPath),
            content
        });
    }

    protected writeFile(request: Request, response: Response): void {
        const body = request.body as FileWriteBody;
        if (typeof body?.path !== 'string') {
            response.status(400).json({ error: 'File path is required.' });
            return;
        }
        const resolvedPath = this.resolveRepoPath(body.path);
        if (!resolvedPath) {
            response.status(400).json({ error: 'File path is invalid.' });
            return;
        }

        fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
        fs.writeFileSync(resolvedPath, typeof body.content === 'string' ? body.content : '', 'utf8');
        response.json({
            ok: true,
            path: path.relative(this.repoRoot, resolvedPath)
        });
    }

    protected createDirectory(request: Request, response: Response): void {
        const body = request.body as DirectoryCreateBody;
        if (typeof body?.path !== 'string') {
            response.status(400).json({ error: 'Directory path is required.' });
            return;
        }
        const resolvedPath = this.resolveRepoPath(body.path);
        if (!resolvedPath) {
            response.status(400).json({ error: 'Directory path is invalid.' });
            return;
        }

        fs.mkdirSync(resolvedPath, { recursive: true });
        response.json({
            ok: true,
            path: path.relative(this.repoRoot, resolvedPath)
        });
    }

    protected renamePath(request: Request, response: Response): void {
        const body = request.body as FileMoveBody;
        this.relocatePath(body, response, 'rename');
    }

    protected movePath(request: Request, response: Response): void {
        const body = request.body as FileMoveBody;
        this.relocatePath(body, response, 'move');
    }

    protected deletePath(request: Request, response: Response): void {
        const body = request.body as FilePathBody;
        if (typeof body?.path !== 'string') {
            response.status(400).json({ error: 'Path is required.' });
            return;
        }

        const resolvedPath = this.resolveRepoPath(body.path);
        if (!resolvedPath || !fs.existsSync(resolvedPath) || resolvedPath === this.repoRoot) {
            response.status(400).json({ error: 'Path is invalid.' });
            return;
        }

        fs.rmSync(resolvedPath, { recursive: true, force: false });
        response.json({
            ok: true,
            path: path.relative(this.repoRoot, resolvedPath)
        });
    }

    protected startTerminal(request: Request, response: Response): void {
        const body = request.body as TerminalStartBody;
        if (!body?.command) {
            response.status(400).json({ error: 'Command is required.' });
            return;
        }

        const cwd = this.resolveRepoPath(body.cwd || '.');
        if (!cwd || !fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
            response.status(400).json({ error: 'Working directory is invalid.' });
            return;
        }

        const args = Array.isArray(body.args) ? body.args : [];
        const env = this.safeEnv(body.env || {});
        const runtimeId = body.id || crypto.randomUUID();
        const existingRuntime = this.runtimes.get(runtimeId);
        if (existingRuntime) {
            this.terminateRuntime(existingRuntime, false);
        }
        fs.mkdirSync(this.runtimeDir, { recursive: true });
        const stdoutPath = path.join(this.runtimeDir, `${runtimeId}.out.log`);
        const stderrPath = path.join(this.runtimeDir, `${runtimeId}.err.log`);
        fs.writeFileSync(stdoutPath, '', 'utf8');
        fs.writeFileSync(stderrPath, '', 'utf8');
        const stdoutFd = fs.openSync(stdoutPath, 'a');
        const stderrFd = fs.openSync(stderrPath, 'a');
        const child = spawn(body.command, args, {
            cwd,
            env: {
                ...process.env,
                ...env
            },
            detached: true,
            stdio: ['ignore', stdoutFd, stderrFd]
        });
        if (typeof child.pid !== 'number') {
            fs.closeSync(stdoutFd);
            fs.closeSync(stderrFd);
            response.status(500).json({ error: 'Runtime process did not return a pid.' });
            return;
        }
        child.unref();
        fs.closeSync(stdoutFd);
        fs.closeSync(stderrFd);

        const runtime: RuntimeRecord = {
            id: runtimeId,
            pid: child.pid,
            cwd: path.relative(this.repoRoot, cwd) || '.',
            command: body.command,
            args,
            env,
            launchUrl: body.launchUrl || null,
            healthCheck: body.healthCheck || null,
            stdoutPath,
            stderrPath,
            startedAt: new Date().toISOString()
        };
        this.runtimes.set(runtimeId, runtime);

        response.json({
            ok: true,
            runtime: this.serializeRuntime(runtime)
        });
    }

    protected runtimeStatus(request: Request, response: Response): void {
        const runtimeId = typeof request.query.id === 'string' ? request.query.id : undefined;
        if (runtimeId) {
            const runtime = this.runtimes.get(runtimeId);
            if (!runtime) {
                response.status(404).json({ error: 'Runtime not found.' });
                return;
            }
            response.json({ runtime: this.serializeRuntime(runtime) });
            return;
        }

        response.json({ runtimes: this.listRuntimes() });
    }

    protected runtimeLogs(request: Request, response: Response): void {
        const query = request.query as RuntimeLogsQuery;
        const runtimeId = typeof query.id === 'string' ? query.id : undefined;
        if (!runtimeId) {
            response.status(400).json({ error: 'Runtime id is required.' });
            return;
        }
        const runtime = this.runtimes.get(runtimeId);
        if (!runtime) {
            response.status(404).json({ error: 'Runtime not found.' });
            return;
        }

        const rawStdoutOffset = typeof query.stdoutOffset === 'string' ? Number.parseInt(query.stdoutOffset, 10) : NaN;
        const rawStderrOffset = typeof query.stderrOffset === 'string' ? Number.parseInt(query.stderrOffset, 10) : NaN;
        const rawLimit = typeof query.limit === 'string' ? Number.parseInt(query.limit, 10) : NaN;
        const stdoutOffset = Number.isFinite(rawStdoutOffset) ? Math.max(0, rawStdoutOffset) : 0;
        const stderrOffset = Number.isFinite(rawStderrOffset) ? Math.max(0, rawStderrOffset) : 0;
        const limit = Number.isFinite(rawLimit) ? Math.max(256, Math.min(rawLimit, 64000)) : 12000;
        const stdout = this.readLogChunk(runtime.stdoutPath, stdoutOffset, limit);
        const stderr = this.readLogChunk(runtime.stderrPath, stderrOffset, limit);

        response.json({
            runtime: this.serializeRuntime(runtime),
            stdout: stdout.content,
            stderr: stderr.content,
            stdoutOffset: stdout.nextOffset,
            stderrOffset: stderr.nextOffset,
            incremental: stdoutOffset > 0 || stderrOffset > 0
        });
    }

    protected restartRuntime(request: Request, response: Response): void {
        const body = request.body as RuntimeRestartBody;
        const runtimeId = typeof body?.id === 'string' ? body.id : undefined;
        if (!runtimeId) {
            response.status(400).json({ error: 'Runtime id is required.' });
            return;
        }
        const runtime = this.runtimes.get(runtimeId);
        if (!runtime) {
            response.status(404).json({ error: 'Runtime not found.' });
            return;
        }

        try {
            this.terminateRuntime(runtime, false);
        } catch {
            // ignore and attempt restart anyway
        }

        const restartBody: TerminalStartBody = {
            id: runtime.id,
            cwd: runtime.cwd,
            command: runtime.command,
            args: runtime.args,
            env: runtime.env,
            launchUrl: runtime.launchUrl || undefined,
            healthCheck: runtime.healthCheck || undefined
        };
        request.body = restartBody;
        this.startTerminal(request, response);
    }

    protected async probeRuntime(request: Request, response: Response): Promise<void> {
        const body = request.body as RuntimeProbeBody;
        const runtime = typeof body?.id === 'string' ? this.runtimes.get(body.id) : undefined;
        const configuredProbe = runtime?.healthCheck || {};
        const probe = this.normalizeProbeConfig({
            ...configuredProbe,
            ...body
        }, runtime);
        if (!probe.url) {
            response.status(400).json({ error: 'A runtime id with a launchUrl or an explicit probe url is required.' });
            return;
        }

        const startedAt = Date.now();
        const controller = new AbortController();
        const timeoutMs = probe.timeoutMs || 8000;
        const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const fetchResponse = await globalThis.fetch(probe.url, {
                headers: this.safeEnv(probe.headers || {}),
                signal: controller.signal
            });
            const bodyText = await fetchResponse.text();
            const expectedStatus = typeof probe.expectedStatus === 'number' ? probe.expectedStatus : undefined;
            const statusMatch = typeof expectedStatus === 'number' ? fetchResponse.status === expectedStatus : fetchResponse.ok;
            const containsTextMatch = probe.containsText ? bodyText.includes(probe.containsText) : true;
            const ok = statusMatch && containsTextMatch;
            response.json({
                ok,
                probe: {
                    runtimeId: runtime?.id || null,
                    name: probe.name || runtime?.id || 'runtime probe',
                    url: probe.url,
                    status: fetchResponse.status,
                    expectedStatus: expectedStatus || null,
                    containsText: probe.containsText || null,
                    containsTextMatched: containsTextMatch,
                    durationMs: Date.now() - startedAt,
                    timestamp: new Date().toISOString(),
                    excerpt: bodyText.slice(0, 800)
                }
            });
        } finally {
            clearTimeout(timeoutHandle);
        }
    }

    protected automationState(response: Response): void {
        response.json({
            ok: true,
            automation: this.sanitizeAutomationState(this.loadAutomationState())
        });
    }

    protected async githubConnect(request: Request, response: Response): Promise<void> {
        const body = request.body as GitHubConnectBody;
        const repo = this.normalizeGitHubRepo(body.repo);
        if (!repo) {
            response.status(400).json({ error: 'GitHub repo must be in owner/repo format.' });
            return;
        }
        const stored = this.loadAutomationState();
        const branch = this.normalizeBranch(body.branch || stored.github?.branch || 'main');
        const sourceRoot = this.resolveRepoDirectory(body.sourceRoot || stored.github?.sourceRoot || '.');
        const token = this.resolveSecret(body.token, stored.github?.token, process.env.GITHUB_TOKEN, process.env.GH_TOKEN);
        const remoteUrl = this.buildGitHubRemoteUrl(repo, token);
        const verification = await this.executeCommand('git', ['ls-remote', '--heads', remoteUrl], {
            cwd: sourceRoot,
            timeoutMs: 45000
        });
        const nextState = this.loadAutomationState();
        nextState.github = {
            repo,
            branch,
            token,
            sourceRoot: path.relative(this.repoRoot, sourceRoot) || '.',
            installationId: typeof body.installationId === 'string' ? body.installationId.trim() || undefined : undefined,
            connectedAt: new Date().toISOString()
        };
        nextState.updatedAt = new Date().toISOString();
        this.saveAutomationState(nextState);

        response.json({
            ok: true,
            github: this.sanitizeAutomationState(nextState).github,
            verification: {
                branch,
                remoteVisible: Boolean(verification.stdout.trim()),
                output: this.trimCommandOutput(verification)
            }
        });
    }

    protected async githubPush(request: Request, response: Response): Promise<void> {
        const body = request.body as GitHubPushBody;
        const stored = this.loadAutomationState();
        const repo = this.normalizeGitHubRepo(body.repo || stored.github?.repo);
        if (!repo) {
            response.status(400).json({ error: 'GitHub repo must be configured before pushing.' });
            return;
        }
        const branch = this.normalizeBranch(body.branch || stored.github?.branch || 'main');
        const sourceRoot = this.resolveRepoDirectory(body.sourceRoot || stored.github?.sourceRoot || '.');
        const gitRootResult = await this.executeCommand('git', ['rev-parse', '--show-toplevel'], {
            cwd: sourceRoot,
            timeoutMs: 30000
        });
        const gitRoot = path.resolve(gitRootResult.stdout.trim());
        if (!(gitRoot === this.repoRoot || gitRoot.startsWith(`${this.repoRoot}${path.sep}`))) {
            response.status(400).json({ error: 'Git root must stay inside the current workspace.' });
            return;
        }
        const statusResult = await this.executeCommand('git', ['status', '--short'], {
            cwd: gitRoot,
            timeoutMs: 30000
        });
        const token = this.resolveSecret(body.token, stored.github?.token, process.env.GITHUB_TOKEN, process.env.GH_TOKEN);
        const remoteUrl = this.buildGitHubRemoteUrl(repo, token);
        const message = typeof body.message === 'string' && body.message.trim()
            ? body.message.trim()
            : `SkyDexia promotion ${new Date().toISOString()}`;
        let commitResult: CommandExecutionResult | undefined;
        if (statusResult.stdout.trim()) {
            await this.executeCommand('git', ['add', '--all'], {
                cwd: gitRoot,
                timeoutMs: 30000
            });
            commitResult = await this.executeCommand('git', ['commit', '-m', message], {
                cwd: gitRoot,
                timeoutMs: 120000,
                allowNonZeroExit: true
            });
            if (commitResult.exitCode !== 0 && !/nothing to commit/i.test(`${commitResult.stdout}\n${commitResult.stderr}`)) {
                throw new Error(this.trimCommandOutput(commitResult));
            }
        }
        const headResult = await this.executeCommand('git', ['rev-parse', '--short', 'HEAD'], {
            cwd: gitRoot,
            timeoutMs: 30000
        });
        const pushResult = await this.executeCommand('git', ['push', remoteUrl, `HEAD:${branch}`], {
            cwd: gitRoot,
            timeoutMs: 180000
        });
        response.json({
            ok: true,
            github: this.sanitizeAutomationState(this.loadAutomationState()).github,
            promotion: {
                repo,
                branch,
                gitRoot: path.relative(this.repoRoot, gitRoot) || '.',
                committedChanges: Boolean(statusResult.stdout.trim()),
                head: headResult.stdout.trim(),
                commit: commitResult ? this.trimCommandOutput(commitResult) : 'No new commit was required.',
                push: this.trimCommandOutput(pushResult)
            }
        });
    }

    protected async netlifyConnect(request: Request, response: Response): Promise<void> {
        const body = request.body as NetlifyConnectBody;
        const stored = this.loadAutomationState();
        const cwd = this.resolveRepoDirectory(body.cwd || stored.netlify?.cwd || '.');
        const publishDir = this.resolveRepoDirectory(body.publishDir || stored.netlify?.publishDir || 'Sky0s-Platforms/SkyeCDE/SkyDexia');
        const token = this.resolveSecret(body.token, stored.netlify?.token, process.env.NETLIFY_AUTH_TOKEN);
        if (!token) {
            response.status(400).json({ error: 'Netlify token is required either in the form or NETLIFY_AUTH_TOKEN.' });
            return;
        }
        const command = this.resolveNetlifyCommand(cwd);
        const listResult = await this.executeCommand(command.command, [...command.prefixArgs, 'sites:list', '--json'], {
            cwd,
            env: { NETLIFY_AUTH_TOKEN: token },
            timeoutMs: 180000
        });
        const sites = this.extractJson(listResult.stdout) as Array<Record<string, unknown>> | undefined;
        const matchedSite = (sites || []).find(site => {
            const id = typeof site.id === 'string' ? site.id : undefined;
            const name = typeof site.name === 'string' ? site.name : undefined;
            return (body.siteId && id === body.siteId.trim()) || (body.siteName && name === body.siteName.trim());
        });
        const nextState = this.loadAutomationState();
        nextState.netlify = {
            siteId: matchedSite && typeof matchedSite.id === 'string' ? matchedSite.id : body.siteId?.trim() || undefined,
            siteName: matchedSite && typeof matchedSite.name === 'string' ? matchedSite.name : body.siteName?.trim() || undefined,
            token,
            publishDir: path.relative(this.repoRoot, publishDir) || '.',
            cwd: path.relative(this.repoRoot, cwd) || '.',
            connectedAt: new Date().toISOString()
        };
        nextState.updatedAt = new Date().toISOString();
        this.saveAutomationState(nextState);

        response.json({
            ok: true,
            netlify: this.sanitizeAutomationState(nextState).netlify,
            verification: {
                matchedSite: matchedSite || null,
                output: this.trimCommandOutput(listResult)
            }
        });
    }

    protected async netlifyDeploy(request: Request, response: Response): Promise<void> {
        const body = request.body as NetlifyDeployBody;
        const stored = this.loadAutomationState();
        const cwd = this.resolveRepoDirectory(body.cwd || stored.netlify?.cwd || '.');
        const publishDir = this.resolveRepoDirectory(body.publishDir || stored.netlify?.publishDir || 'Sky0s-Platforms/SkyeCDE/SkyDexia');
        const token = this.resolveSecret(body.token, stored.netlify?.token, process.env.NETLIFY_AUTH_TOKEN);
        const siteId = typeof body.siteId === 'string' && body.siteId.trim()
            ? body.siteId.trim()
            : stored.netlify?.siteId;
        const siteName = typeof body.siteName === 'string' && body.siteName.trim()
            ? body.siteName.trim()
            : stored.netlify?.siteName;
        if (!token) {
            response.status(400).json({ error: 'Netlify token is required either in the form or NETLIFY_AUTH_TOKEN.' });
            return;
        }
        const command = this.resolveNetlifyCommand(cwd);
        const args = [...command.prefixArgs, 'deploy', '--json', '--dir', publishDir, '--message', (body.title || `SkyDexia deploy ${new Date().toISOString()}`).trim()];
        if (body.prod !== false) {
            args.push('--prod');
        }
        if (siteId) {
            args.push('--site', siteId);
        } else if (siteName) {
            args.push('--site', siteName);
        }
        const deployResult = await this.executeCommand(command.command, args, {
            cwd,
            env: { NETLIFY_AUTH_TOKEN: token },
            timeoutMs: 300000
        });
        const deployPayload = this.extractJson(deployResult.stdout) as Record<string, unknown> | undefined;
        response.json({
            ok: true,
            netlify: this.sanitizeAutomationState(this.loadAutomationState()).netlify,
            deployment: {
                siteId,
                siteName,
                publishDir: path.relative(this.repoRoot, publishDir) || '.',
                deployUrl: typeof deployPayload?.deploy_url === 'string' ? deployPayload.deploy_url : null,
                siteUrl: typeof deployPayload?.site_url === 'string' ? deployPayload.site_url : null,
                output: this.trimCommandOutput(deployResult)
            }
        });
    }

    protected async cloudflareConnect(request: Request, response: Response): Promise<void> {
        const body = request.body as CloudflareConnectBody;
        const stored = this.loadAutomationState();
        const workerRoot = this.resolveRepoDirectory(body.workerRoot || stored.cloudflare?.workerRoot || 'Sky0s-Platforms/SuperIDE/worker');
        const apiToken = this.resolveSecret(body.apiToken, stored.cloudflare?.apiToken, process.env.CLOUDFLARE_API_TOKEN, process.env.CF_API_TOKEN);
        const accountId = this.resolveSecret(body.accountId, stored.cloudflare?.accountId, process.env.CLOUDFLARE_ACCOUNT_ID, process.env.CF_ACCOUNT_ID);
        if (!apiToken) {
            response.status(400).json({ error: 'Cloudflare API token is required either in the form or CLOUDFLARE_API_TOKEN.' });
            return;
        }
        const command = this.resolveWranglerCommand(workerRoot);
        const whoamiResult = await this.executeCommand(command.command, [...command.prefixArgs, 'whoami'], {
            cwd: workerRoot,
            env: this.safeEnv({
                CLOUDFLARE_API_TOKEN: apiToken,
                CLOUDFLARE_ACCOUNT_ID: accountId || ''
            }),
            timeoutMs: 180000
        });
        const nextState = this.loadAutomationState();
        nextState.cloudflare = {
            workerRoot: path.relative(this.repoRoot, workerRoot) || '.',
            apiToken,
            accountId,
            configPath: typeof body.configPath === 'string' && body.configPath.trim() ? body.configPath.trim() : stored.cloudflare?.configPath,
            connectedAt: new Date().toISOString()
        };
        nextState.updatedAt = new Date().toISOString();
        this.saveAutomationState(nextState);

        response.json({
            ok: true,
            cloudflare: this.sanitizeAutomationState(nextState).cloudflare,
            verification: {
                output: this.trimCommandOutput(whoamiResult)
            }
        });
    }

    protected async cloudflareDeploy(request: Request, response: Response): Promise<void> {
        const body = request.body as CloudflareDeployBody;
        const stored = this.loadAutomationState();
        const workerRoot = this.resolveRepoDirectory(body.workerRoot || stored.cloudflare?.workerRoot || 'Sky0s-Platforms/SuperIDE/worker');
        const apiToken = this.resolveSecret(body.apiToken, stored.cloudflare?.apiToken, process.env.CLOUDFLARE_API_TOKEN, process.env.CF_API_TOKEN);
        const accountId = this.resolveSecret(body.accountId, stored.cloudflare?.accountId, process.env.CLOUDFLARE_ACCOUNT_ID, process.env.CF_ACCOUNT_ID);
        if (!apiToken) {
            response.status(400).json({ error: 'Cloudflare API token is required either in the form or CLOUDFLARE_API_TOKEN.' });
            return;
        }
        const deployResult = this.hasPackageScript(workerRoot, 'deploy')
            ? await this.executeCommand('npm', ['run', 'deploy'], {
                cwd: workerRoot,
                env: this.safeEnv({
                    CLOUDFLARE_API_TOKEN: apiToken,
                    CLOUDFLARE_ACCOUNT_ID: accountId || ''
                }),
                timeoutMs: 300000
            })
            : await this.executeCloudflareDeploy(workerRoot, stored.cloudflare?.configPath || body.configPath, body.environment, apiToken, accountId);
        response.json({
            ok: true,
            cloudflare: this.sanitizeAutomationState(this.loadAutomationState()).cloudflare,
            deployment: {
                workerRoot: path.relative(this.repoRoot, workerRoot) || '.',
                environment: typeof body.environment === 'string' && body.environment.trim() ? body.environment.trim() : null,
                output: this.trimCommandOutput(deployResult),
                previewUrl: this.extractCloudflareUrl(deployResult.stdout)
            }
        });
    }

    protected stopRuntime(request: Request, response: Response): void {
        const runtimeId = typeof request.body?.id === 'string' ? request.body.id : undefined;
        if (!runtimeId) {
            response.status(400).json({ error: 'Runtime id is required.' });
            return;
        }
        const runtime = this.runtimes.get(runtimeId);
        if (!runtime) {
            response.status(404).json({ error: 'Runtime not found.' });
            return;
        }

        try {
            this.terminateRuntime(runtime);
        } catch (error) {
            response.status(400).json({ error: error instanceof Error ? error.message : 'Unable to stop runtime.' });
            return;
        }

        response.json({
            ok: true,
            runtime: this.serializeRuntime(runtime, 'stopped')
        });
    }

    protected listRuntimes(): object[] {
        return Array.from(this.runtimes.values()).map(runtime => this.serializeRuntime(runtime));
    }

    protected serializeRuntime(runtime: RuntimeRecord, statusOverride?: 'running' | 'stopped'): object {
        return {
            id: runtime.id,
            pid: runtime.pid,
            cwd: runtime.cwd,
            command: runtime.command,
            args: runtime.args,
            env: runtime.env,
            launchUrl: runtime.launchUrl,
            healthCheck: runtime.healthCheck,
            startedAt: runtime.startedAt,
            status: statusOverride || (this.isPidRunning(runtime.pid) ? 'running' : 'stopped')
        };
    }

    protected terminateRuntime(runtime: RuntimeRecord, deleteRecord = true): void {
        if (this.isPidRunning(runtime.pid)) {
            process.kill(runtime.pid, 'SIGTERM');
        }
        if (deleteRecord) {
            this.runtimes.delete(runtime.id);
        }
    }

    protected isPidRunning(pid: number): boolean {
        try {
            process.kill(pid, 0);
            return true;
        } catch {
            return false;
        }
    }

    protected readLog(logPath: string): string {
        if (!fs.existsSync(logPath)) {
            return '';
        }
        const content = fs.readFileSync(logPath, 'utf8');
        return content.slice(-12000);
    }

    protected readLogChunk(logPath: string, offset: number, limit: number): { content: string; nextOffset: number } {
        if (!fs.existsSync(logPath)) {
            return { content: '', nextOffset: 0 };
        }
        const stats = fs.statSync(logPath);
        const nextOffset = stats.size;
        if (offset >= stats.size) {
            return { content: '', nextOffset };
        }

        const start = Math.max(0, offset);
        const end = Math.min(stats.size, start + limit);
        const buffer = Buffer.alloc(end - start);
        const fd = fs.openSync(logPath, 'r');
        try {
            fs.readSync(fd, buffer, 0, end - start, start);
        } finally {
            fs.closeSync(fd);
        }

        return {
            content: buffer.toString('utf8'),
            nextOffset: end
        };
    }

    protected resolveRepoPath(target: string): string | undefined {
        const basePath = path.resolve(this.repoRoot);
        const resolved = path.resolve(basePath, target);
        if (resolved === basePath || resolved.startsWith(`${basePath}${path.sep}`)) {
            return resolved;
        }
        return undefined;
    }

    protected resolveRepoDirectory(target: string): string {
        const resolved = this.resolveRepoPath(target);
        if (!resolved || !fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
            throw new Error(`Directory is invalid: ${target}`);
        }
        return resolved;
    }

    protected safeEnv(env: Record<string, string>): Record<string, string> {
        return Object.fromEntries(
            Object.entries(env).filter(([, value]) => typeof value === 'string')
        );
    }

    protected loadAutomationState(): AutomationStateRecord {
        fs.mkdirSync(this.runtimeDir, { recursive: true });
        if (!fs.existsSync(this.automationStatePath)) {
            return {};
        }
        try {
            return JSON.parse(fs.readFileSync(this.automationStatePath, 'utf8')) as AutomationStateRecord;
        } catch {
            return {};
        }
    }

    protected saveAutomationState(state: AutomationStateRecord): void {
        fs.mkdirSync(this.runtimeDir, { recursive: true });
        fs.writeFileSync(this.automationStatePath, JSON.stringify(state, null, 2), { encoding: 'utf8', mode: 0o600 });
    }

    protected sanitizeAutomationState(state: AutomationStateRecord): Record<string, unknown> {
        return {
            github: state.github ? {
                repo: state.github.repo,
                branch: state.github.branch,
                sourceRoot: state.github.sourceRoot,
                installationId: state.github.installationId || null,
                tokenConfigured: Boolean(state.github.token),
                connectedAt: state.github.connectedAt
            } : null,
            netlify: state.netlify ? {
                siteId: state.netlify.siteId || null,
                siteName: state.netlify.siteName || null,
                publishDir: state.netlify.publishDir,
                cwd: state.netlify.cwd,
                tokenConfigured: Boolean(state.netlify.token),
                connectedAt: state.netlify.connectedAt
            } : null,
            cloudflare: state.cloudflare ? {
                workerRoot: state.cloudflare.workerRoot,
                accountId: state.cloudflare.accountId || null,
                configPath: state.cloudflare.configPath || null,
                tokenConfigured: Boolean(state.cloudflare.apiToken),
                connectedAt: state.cloudflare.connectedAt
            } : null,
            updatedAt: state.updatedAt || null
        };
    }

    protected normalizeGitHubRepo(repo: string | undefined): string | undefined {
        const normalized = typeof repo === 'string' ? repo.trim().replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '') : '';
        return /^[^/\s]+\/[^/\s]+$/.test(normalized) ? normalized : undefined;
    }

    protected normalizeBranch(branch: string): string {
        return branch.trim() || 'main';
    }

    protected resolveSecret(...values: Array<string | undefined>): string | undefined {
        for (const value of values) {
            if (typeof value === 'string' && value.trim()) {
                return value.trim();
            }
        }
        return undefined;
    }

    protected buildGitHubRemoteUrl(repo: string, token: string | undefined): string {
        return token
            ? `https://x-access-token:${encodeURIComponent(token)}@github.com/${repo}.git`
            : `https://github.com/${repo}.git`;
    }

    protected resolveNetlifyCommand(cwd: string): { command: string; prefixArgs: string[] } {
        const localBinary = this.findNodeBinary(cwd, 'netlify');
        if (localBinary) {
            return { command: localBinary, prefixArgs: [] };
        }
        return { command: 'npx', prefixArgs: ['--yes', 'netlify-cli'] };
    }

    protected resolveWranglerCommand(cwd: string): { command: string; prefixArgs: string[] } {
        const localBinary = this.findNodeBinary(cwd, 'wrangler');
        if (localBinary) {
            return { command: localBinary, prefixArgs: [] };
        }
        return { command: 'npx', prefixArgs: ['--yes', 'wrangler'] };
    }

    protected findNodeBinary(startDir: string, binaryName: string): string | undefined {
        let current = startDir;
        while (current === this.repoRoot || current.startsWith(`${this.repoRoot}${path.sep}`)) {
            const candidate = path.join(current, 'node_modules', '.bin', binaryName);
            if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
                return candidate;
            }
            if (current === this.repoRoot) {
                break;
            }
            const parent = path.dirname(current);
            if (parent === current) {
                break;
            }
            current = parent;
        }
        return undefined;
    }

    protected hasPackageScript(cwd: string, scriptName: string): boolean {
        const packageJsonPath = path.join(cwd, 'package.json');
        if (!fs.existsSync(packageJsonPath) || !fs.statSync(packageJsonPath).isFile()) {
            return false;
        }
        try {
            const payload = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { scripts?: Record<string, string> };
            return typeof payload.scripts?.[scriptName] === 'string';
        } catch {
            return false;
        }
    }

    protected async executeCloudflareDeploy(workerRoot: string, configPath: string | undefined, environment: string | undefined, apiToken: string, accountId: string | undefined): Promise<CommandExecutionResult> {
        const command = this.resolveWranglerCommand(workerRoot);
        const args = [...command.prefixArgs, 'deploy'];
        if (configPath) {
            args.push('--config', configPath);
        }
        if (typeof environment === 'string' && environment.trim()) {
            args.push('--env', environment.trim());
        }
        return this.executeCommand(command.command, args, {
            cwd: workerRoot,
            env: this.safeEnv({
                CLOUDFLARE_API_TOKEN: apiToken,
                CLOUDFLARE_ACCOUNT_ID: accountId || ''
            }),
            timeoutMs: 300000
        });
    }

    protected async executeCommand(command: string, args: string[], options: {
        cwd: string;
        env?: Record<string, string>;
        timeoutMs?: number;
        allowNonZeroExit?: boolean;
    }): Promise<CommandExecutionResult> {
        const timeoutMs = options.timeoutMs || 120000;
        return await new Promise<CommandExecutionResult>((resolve, reject) => {
            const child = spawn(command, args, {
                cwd: options.cwd,
                env: {
                    ...process.env,
                    ...(options.env || {})
                },
                stdio: ['ignore', 'pipe', 'pipe']
            });
            let stdout = '';
            let stderr = '';
            const timer = setTimeout(() => {
                child.kill('SIGTERM');
                reject(new Error(`Command timed out after ${timeoutMs}ms: ${command} ${args.join(' ')}`));
            }, timeoutMs);
            child.stdout?.on('data', chunk => {
                stdout += chunk.toString();
            });
            child.stderr?.on('data', chunk => {
                stderr += chunk.toString();
            });
            child.on('error', error => {
                clearTimeout(timer);
                reject(error);
            });
            child.on('close', code => {
                clearTimeout(timer);
                const result: CommandExecutionResult = {
                    command,
                    args,
                    cwd: options.cwd,
                    stdout,
                    stderr,
                    exitCode: typeof code === 'number' ? code : 1
                };
                if (result.exitCode !== 0 && !options.allowNonZeroExit) {
                    reject(new Error(this.trimCommandOutput(result)));
                    return;
                }
                resolve(result);
            });
        });
    }

    protected trimCommandOutput(result: CommandExecutionResult): string {
        const combined = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join('\n');
        if (!combined) {
            return `${result.command} ${result.args.join(' ')} exited with code ${result.exitCode}.`;
        }
        return combined.slice(0, 4000);
    }

    protected extractJson(raw: string): unknown {
        const trimmed = raw.trim();
        if (!trimmed) {
            return undefined;
        }
        try {
            return JSON.parse(trimmed);
        } catch {
            const arrayStart = trimmed.indexOf('[');
            const arrayEnd = trimmed.lastIndexOf(']');
            if (arrayStart >= 0 && arrayEnd > arrayStart) {
                try {
                    return JSON.parse(trimmed.slice(arrayStart, arrayEnd + 1));
                } catch {
                    // keep falling through
                }
            }
            const objectStart = trimmed.indexOf('{');
            const objectEnd = trimmed.lastIndexOf('}');
            if (objectStart >= 0 && objectEnd > objectStart) {
                try {
                    return JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
                } catch {
                    return undefined;
                }
            }
            return undefined;
        }
    }

    protected extractCloudflareUrl(output: string): string | null {
        const match = output.match(/https:\/\/[\w.-]+(?:\.workers\.dev|\.pages\.dev|\.cloudflare\.com)[^\s]*/i);
        return match ? match[0] : null;
    }

    protected normalizeProbeConfig(probe: RuntimeHealthCheck, runtime: RuntimeRecord | undefined): Required<Pick<RuntimeHealthCheck, 'timeoutMs'>> & RuntimeHealthCheck {
        const launchUrl = runtime?.launchUrl || undefined;
        const probePath = typeof probe.path === 'string' ? probe.path.trim() : '';
        const resolvedUrl = typeof probe.url === 'string' && probe.url.trim()
            ? probe.url.trim()
            : launchUrl
                ? new URL(probePath || '', launchUrl).toString()
                : undefined;
        return {
            ...probe,
            url: resolvedUrl,
            timeoutMs: typeof probe.timeoutMs === 'number' && Number.isFinite(probe.timeoutMs) ? probe.timeoutMs : 8000
        };
    }

    protected relocatePath(body: FileMoveBody, response: Response, operation: 'rename' | 'move'): void {
        if (typeof body?.sourcePath !== 'string' || typeof body?.targetPath !== 'string') {
            response.status(400).json({ error: 'Source and target paths are required.' });
            return;
        }

        const sourcePath = this.resolveRepoPath(body.sourcePath);
        const targetPath = this.resolveRepoPath(body.targetPath);
        if (!sourcePath || !targetPath || !fs.existsSync(sourcePath) || sourcePath === this.repoRoot) {
            response.status(400).json({ error: `${operation} source path is invalid.` });
            return;
        }
        if (targetPath === this.repoRoot) {
            response.status(400).json({ error: `${operation} target path is invalid.` });
            return;
        }

        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.renameSync(sourcePath, targetPath);
        response.json({
            ok: true,
            sourcePath: path.relative(this.repoRoot, sourcePath),
            targetPath: path.relative(this.repoRoot, targetPath)
        });
    }

    protected listWorkspaceEntries(resolvedRoot: string, limit: number): object[] {
        return fs.readdirSync(resolvedRoot, { withFileTypes: true })
            .filter(entry => !entry.name.startsWith('.'))
            .sort((left, right) => {
                if (left.isDirectory() && !right.isDirectory()) {
                    return -1;
                }
                if (!left.isDirectory() && right.isDirectory()) {
                    return 1;
                }
                return left.name.localeCompare(right.name);
            })
            .slice(0, limit)
            .map(entry => this.serializeEntry(path.join(resolvedRoot, entry.name), entry.isDirectory() ? 'directory' : 'file'));
    }

    protected walkWorkspaceEntries(resolvedRoot: string, limit: number): object[] {
        const entries: object[] = [];
        const stack = [resolvedRoot];
        while (stack.length > 0 && entries.length < limit) {
            const current = stack.pop() || resolvedRoot;
            const children = fs.readdirSync(current, { withFileTypes: true })
                .filter(entry => !entry.name.startsWith('.'))
                .sort((left, right) => {
                    if (left.isDirectory() && !right.isDirectory()) {
                        return -1;
                    }
                    if (!left.isDirectory() && right.isDirectory()) {
                        return 1;
                    }
                    return left.name.localeCompare(right.name);
                });

            for (const child of children) {
                const absolutePath = path.join(current, child.name);
                const kind = child.isDirectory() ? 'directory' : 'file';
                entries.push(this.serializeEntry(absolutePath, kind));
                if (child.isDirectory()) {
                    stack.push(absolutePath);
                }
                if (entries.length >= limit) {
                    break;
                }
            }
        }
        return entries;
    }

    protected serializeEntry(absolutePath: string, kind: string): object {
        return {
            name: path.basename(absolutePath),
            path: path.relative(this.repoRoot, absolutePath) || '.',
            kind
        };
    }
}