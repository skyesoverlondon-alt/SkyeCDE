#!/usr/bin/env node
// @ts-check

const fs = require('fs');
const os = require('os');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '..');
const configRoot = path.join(os.homedir(), '.skye-creative-workspace');

const requiredDirectories = [
    path.join(workspaceRoot, 'plugins'),
    path.join(configRoot, 'plugins'),
    path.join(configRoot, 'deployedPlugins')
];

for (const dirPath of requiredDirectories) {
    fs.mkdirSync(dirPath, { recursive: true });
}

console.log('Browser runtime directories are ready.');