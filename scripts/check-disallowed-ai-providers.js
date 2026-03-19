#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

const filesToCheck = [
    'applications/browser/package.json',
    'applications/electron/package.json',
    'applications/electron-next/package.json',
    'applications/browser/src-gen/frontend/index.js',
    'applications/browser/src-gen/backend/server.js',
    'applications/browser/src-gen/backend/main.js',
    'applications/electron/src-gen/frontend/index.js',
    'applications/electron/src-gen/backend/server.js',
    'applications/electron/src-gen/backend/main.js',
    'applications/electron-next/src-gen/frontend/index.js',
    'applications/electron-next/src-gen/backend/server.js',
    'applications/electron-next/src-gen/backend/main.js',
    'Sky0s-Platforms/SuperIDE/apps/skye-ide/vendor/theia-ide/applications/browser/package.json',
    'Sky0s-Platforms/SuperIDE/apps/skye-ide/vendor/theia-ide/applications/electron/package.json',
    'Sky0s-Platforms/SuperIDE/apps/skye-ide/vendor/theia-ide/applications/electron-next/package.json'
];

const disallowedSignatures = [
    '@theia/ai-anthropic',
    '@theia/ai-openai',
    '@theia/ai-google',
    '@theia/ai-huggingface',
    '@theia/ai-ollama',
    '@theia/ai-vercel-ai',
    '@theia/ai-copilot',
    '@theia/ai-claude-code',
    '@theia/ai-codex'
];

function classifyLeakSource(relativePath) {
    if (relativePath.includes('/vendor/theia-ide/')) {
        return 'vendor-mirror';
    }
    if (relativePath.endsWith('package.json')) {
        return 'app-manifest';
    }
    if (relativePath.includes('/src-gen/')) {
        return 'generated-startup';
    }
    return 'other';
}

const violations = [];

for (const relativePath of filesToCheck) {
    const absolutePath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
        continue;
    }

    const content = fs.readFileSync(absolutePath, 'utf8');
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const signature of disallowedSignatures) {
            if (line.includes(signature)) {
                violations.push({
                    file: relativePath,
                    line: i + 1,
                    source: classifyLeakSource(relativePath),
                    signature,
                    content: line.trim()
                });
            }
        }
    }
}

if (violations.length > 0) {
    console.error('Disallowed AI provider signatures found:');
    const summary = new Map();

    for (const violation of violations) {
        const summaryKey = `${violation.source}:${violation.signature}`;
        summary.set(summaryKey, (summary.get(summaryKey) || 0) + 1);

        console.error(`- ${violation.file}:${violation.line} [${violation.source}] (${violation.signature})`);
        console.error(`  ${violation.content}`);

        // Emit GitHub Actions annotations so PR checks show clickable leak locations.
        console.error(
            `::error file=${violation.file},line=${violation.line},title=Disallowed provider signature::${violation.source} leak for ${violation.signature}`
        );
    }

    console.error('Leak summary:');
    for (const [key, count] of summary.entries()) {
        console.error(`- ${key} => ${count}`);
    }

    process.exit(1);
}

console.log('Policy check passed: no disallowed AI provider signatures found in guarded files.');
