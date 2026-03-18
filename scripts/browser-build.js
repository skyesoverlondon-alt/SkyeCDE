#!/usr/bin/env node
// @ts-check

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const workspaceRoot = path.resolve(__dirname, '..');
const browserRoot = path.join(workspaceRoot, 'applications', 'browser');
const webpackCli = path.join(workspaceRoot, 'node_modules', '.bin', 'webpack');
const mode = process.argv[2] === 'production' ? 'production' : 'development';
const generatedFrontendRoot = path.join(browserRoot, 'src-gen', 'frontend');
const builtFrontendRoot = path.join(browserRoot, 'lib', 'frontend');
const preloadAssets = ['SKYESOVERLONDONDIETYLOGO.png'];

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

function copyFrontendShell(fileName) {
    const source = path.join(generatedFrontendRoot, fileName);
    const target = path.join(builtFrontendRoot, fileName);

    if (!fs.existsSync(source)) {
        throw new Error(`Missing generated frontend shell: ${source}`);
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
}

function stagePreloadAssets(appRoot, frontendRoots) {
    const resourcesRoot = path.join(appRoot, 'resources');
    for (const assetName of preloadAssets) {
        const source = path.join(resourcesRoot, assetName);
        if (!fs.existsSync(source)) {
            continue;
        }

        for (const frontendRoot of frontendRoots) {
            fs.mkdirSync(frontendRoot, { recursive: true });
            fs.copyFileSync(source, path.join(frontendRoot, assetName));
        }
    }
}

run(webpackCli, ['--config', 'webpack.config.js', '--config-name', 'browser-main', '--mode', mode], browserRoot);
run(webpackCli, ['--config', 'webpack.config.js', '--config-name', 'browser-secondary-window', '--mode', mode], browserRoot);
stagePreloadAssets(browserRoot, [generatedFrontendRoot, builtFrontendRoot]);
copyFrontendShell('index.html');
