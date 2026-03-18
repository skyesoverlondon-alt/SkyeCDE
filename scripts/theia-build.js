#!/usr/bin/env node

const childProcess = require('child_process');

function mergedNodeOptions(current) {
    const options = new Set(String(current || '').split(/\s+/).filter(Boolean));
    options.add('--max-old-space-size=4096');
    options.add('--no-deprecation');
    return Array.from(options).join(' ');
}

const mode = process.argv[2] === 'development' ? 'development' : 'production';
const result = childProcess.spawnSync('npm', ['exec', '--', 'theia', 'build', '--mode', mode], {
    cwd: process.cwd(),
    env: {
        ...process.env,
        NODE_NO_WARNINGS: '1',
        NODE_OPTIONS: mergedNodeOptions(process.env.NODE_OPTIONS)
    },
    stdio: 'inherit'
});

if (result.error) {
    throw result.error;
}

process.exit(result.status ?? 1);