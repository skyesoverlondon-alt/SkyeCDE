#!/usr/bin/env node
// @ts-check

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const workspaceRoot = path.resolve(__dirname, '..');
const browserRoot = path.join(workspaceRoot, 'applications', 'browser');
const productRoot = path.join(workspaceRoot, 'theia-extensions', 'product');

const requiredArtifacts = {
    productFrontend: path.join(productRoot, 'lib', 'browser', 'theia-ide-frontend-module.js'),
    backendMain: path.join(browserRoot, 'src-gen', 'backend', 'main.js'),
    backendServer: path.join(browserRoot, 'src-gen', 'backend', 'server.js'),
    frontendIndex: path.join(browserRoot, 'src-gen', 'frontend', 'index.js')
};

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

run('node', [path.join(workspaceRoot, 'scripts', 'prepare-browser-runtime.js')], workspaceRoot);

if (!fs.existsSync(requiredArtifacts.productFrontend)) {
    run('yarn', ['build'], productRoot);
}

if (!fs.existsSync(requiredArtifacts.backendMain)
    || !fs.existsSync(requiredArtifacts.backendServer)
    || !fs.existsSync(requiredArtifacts.frontendIndex)) {
    run('yarn', ['build'], browserRoot);
}

