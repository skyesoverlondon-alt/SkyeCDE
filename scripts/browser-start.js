#!/usr/bin/env node
// @ts-check

const path = require('path');
const childProcess = require('child_process');

const workspaceRoot = path.resolve(__dirname, '..');
const browserRoot = path.join(workspaceRoot, 'applications', 'browser');
const theiaCli = path.join(workspaceRoot, 'node_modules', '.bin', 'theia');

function run(command, args, cwd) {
    const result = childProcess.spawnSync(command, args, {
        cwd,
        stdio: 'inherit',
        env: {
            ...process.env,
            NODE_NO_WARNINGS: '1',
            NODE_OPTIONS: '--max-old-space-size=4096 --no-deprecation'
        }
    });

    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
}

run('node', [path.join(workspaceRoot, 'scripts', 'ensure-browser-start.js')], workspaceRoot);
run(theiaCli, ['start', '--plugins=local-dir:../../plugins', '--log-level=error'], browserRoot);
