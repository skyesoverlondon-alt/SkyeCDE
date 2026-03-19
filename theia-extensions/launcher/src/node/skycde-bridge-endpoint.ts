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

interface RuntimeRecord {
    id: string;
    pid: number;
    cwd: string;
    command: string;
    args: string[];
    env: Record<string, string>;
    launchUrl: string | null;
    stdoutPath: string;
    stderrPath: string;
    startedAt: string;
}

@injectable()
export class SkyeCDEBridgeEndpoint implements BackendApplicationContribution {
    protected static PATH = '/launcher/skycde';
    protected readonly repoRoot = '/workspaces/SkyeCDE/Skye0s-s0l26';
    protected readonly runtimeDir = path.join(os.tmpdir(), 'skycde-runtime');
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
        app.use(json());
        app.use(SkyeCDEBridgeEndpoint.PATH, router);
    }

    protected health(response: Response): void {
        response.json({
            ok: true,
            repoRoot: this.repoRoot,
            bridge: 'skycde',
            runtimeCount: this.listRuntimes().length
        });
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
            launchUrl: runtime.launchUrl || undefined
        };
        request.body = restartBody;
        this.startTerminal(request, response);
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

    protected safeEnv(env: Record<string, string>): Record<string, string> {
        return Object.fromEntries(
            Object.entries(env).filter(([, value]) => typeof value === 'string')
        );
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