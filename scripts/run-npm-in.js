#!/usr/bin/env node

const childProcess = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const [targetDir, ...scriptArgs] = process.argv.slice(2);

if (!targetDir) {
    console.error('Usage: node scripts/run-npm-in.js <relative-dir> [script]');
    process.exit(1);
}

const cwd = path.resolve(rootDir, targetDir);
const args = scriptArgs.length ? ['run', ...scriptArgs] : ['run'];

const result = childProcess.spawnSync('npm', args, {
    cwd,
    env: process.env,
    stdio: 'inherit'
});

if (result.error) {
    throw result.error;
}

process.exit(result.status ?? 1);