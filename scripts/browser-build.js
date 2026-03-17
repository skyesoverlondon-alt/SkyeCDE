#!/usr/bin/env node
// @ts-check

const path = require('path');
const childProcess = require('child_process');

const workspaceRoot = path.resolve(__dirname, '..');
const browserRoot = path.join(workspaceRoot, 'applications', 'browser');
const webpackCli = path.join(workspaceRoot, 'node_modules', '.bin', 'webpack');
const mode = process.argv[2] === 'production' ? 'production' : 'development';

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

run(webpackCli, ['--config', 'webpack.config.js', '--config-name', 'browser-main', '--mode', mode], browserRoot);
run(webpackCli, ['--config', 'webpack.config.js', '--config-name', 'browser-secondary-window', '--mode', mode], browserRoot);
