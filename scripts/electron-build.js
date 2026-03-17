#!/usr/bin/env node
// @ts-check

const path = require('path');
const childProcess = require('child_process');

const workspaceRoot = path.resolve(__dirname, '..');
const appRoot = process.cwd();
const webpackCli = path.join(workspaceRoot, 'node_modules', '.bin', 'webpack');
const mode = process.argv[2] === 'production' ? 'production' : 'development';

const result = childProcess.spawnSync(webpackCli, ['--config', 'webpack.config.js', '--mode', mode, '--progress'], {
    cwd: appRoot,
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