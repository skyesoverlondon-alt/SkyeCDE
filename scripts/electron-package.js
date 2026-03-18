#!/usr/bin/env node

const childProcess = require('child_process');

function mergedNodeOptions(current) {
    const options = new Set(String(current || '').split(/\s+/).filter(Boolean));
    options.add('--max-old-space-size=4096');
    options.add('--no-deprecation');
    return Array.from(options).join(' ');
}

function run(command, args, cwd, env) {
    const result = childProcess.spawnSync(command, args, {
        cwd,
        env,
        stdio: 'inherit'
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
}

const mode = process.argv[2] || 'preview';
const appRoot = process.cwd();
const env = {
    ...process.env,
    NODE_NO_WARNINGS: '1',
    NODE_OPTIONS: mergedNodeOptions(process.env.NODE_OPTIONS)
};

const builderArgs = ['exec', '--', 'electron-builder', '-c.mac.identity=null'];
if (mode === 'deploy') {
    builderArgs.push('--publish', 'always');
} else if (mode === 'package') {
    builderArgs.push('--publish', 'never');
} else {
    builderArgs.push('--dir');
}

run('npm', ['run', 'icons:generate', '--silent'], appRoot, env);
run('npm', ['run', 'clean:dist', '--silent'], appRoot, env);
run('npm', ['run', 'build:prod', '--silent'], appRoot, env);
run('npm', builderArgs, appRoot, env);