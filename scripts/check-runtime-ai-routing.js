#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');

const DIRECT_PROVIDER_PATTERNS = [
  /https?:\/\/api\.openai\.com/i,
  /https?:\/\/api\.anthropic\.com/i,
  /https?:\/\/generativelanguage\.googleapis\.com/i,
  /https?:\/\/openrouter\.ai/i,
  /https?:\/\/api\.xai\.com/i,
  /https?:\/\/api\.cohere\.ai/i,
];

const ALLOWED_PATH_FRAGMENTS = [
  `${path.sep}Sky0s-Platforms${path.sep}0megaSkyeGate${path.sep}`,
  `${path.sep}Sky0s-Platforms${path.sep}KaixuSuper-IDE-(Internal Gate)${path.sep}xnthgateway${path.sep}`,
];

const SKIP_PATH_FRAGMENTS = [
  `${path.sep}node_modules${path.sep}`,
  `${path.sep}.git${path.sep}`,
  `${path.sep}vendor${path.sep}`,
  `${path.sep}lib${path.sep}`,
  `${path.sep}dist${path.sep}`,
  `${path.sep}build${path.sep}`,
  `${path.sep}src-gen${path.sep}`,
  `${path.sep}artifacts${path.sep}`,
  `${path.sep}archive${path.sep}`,
  `${path.sep}docs${path.sep}`,
  `${path.sep}AI-Directives${path.sep}`,
  `${path.sep}DEV ONLY NO GIT${path.sep}`,
  `${path.sep}DEVV ONLY NO GIT${path.sep}`,
  `${path.sep}due_diligence_room${path.sep}`,
];

const TARGET_EXTENSIONS = new Set(['.js', '.mjs', '.ts', '.tsx', '.html']);

function shouldSkipDirectory(absolutePath) {
  return SKIP_PATH_FRAGMENTS.some(fragment => absolutePath.includes(fragment));
}

function collectFiles(startDir) {
  const pending = [startDir];
  const files = [];

  while (pending.length) {
    const current = pending.pop();
    if (!current || shouldSkipDirectory(current)) {
      continue;
    }

    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const absolutePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (!TARGET_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        continue;
      }
      files.push(absolutePath);
    }
  }

  return files;
}

function isAllowlistedPath(absolutePath) {
  return ALLOWED_PATH_FRAGMENTS.some(fragment => absolutePath.includes(fragment));
}

function scanFile(absolutePath) {
  let content = '';
  try {
    content = fs.readFileSync(absolutePath, 'utf8');
  } catch {
    return [];
  }

  const lines = content.split(/\r?\n/);
  const hits = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    for (const pattern of DIRECT_PROVIDER_PATTERNS) {
      if (pattern.test(line)) {
        hits.push({
          line: index + 1,
          pattern: String(pattern),
          content: line.trim(),
        });
      }
    }
  }
  return hits;
}

function run() {
  const roots = [
    path.join(repoRoot, 'Sky0s-Platforms'),
    path.join(repoRoot, 'theia-extensions'),
    path.join(repoRoot, 'applications'),
    path.join(repoRoot, 'scripts'),
    path.join(repoRoot, 'src'),
  ].filter(root => fs.existsSync(root));

  const violations = [];

  for (const root of roots) {
    const files = collectFiles(root);
    for (const absolutePath of files) {
      if (isAllowlistedPath(absolutePath)) {
        continue;
      }
      const hits = scanFile(absolutePath);
      for (const hit of hits) {
        const relativePath = path.relative(repoRoot, absolutePath);
        violations.push({ ...hit, file: relativePath });
      }
    }
  }

  if (!violations.length) {
    console.log('Policy check passed: runtime AI routing is gate-normalized.');
    process.exit(0);
  }

  console.error('Runtime AI routing policy violation(s) found. Direct provider endpoints are not allowed outside gate projects.');
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line}`);
    console.error(`  ${violation.content}`);
    console.error(`::error file=${violation.file},line=${violation.line},title=Direct provider endpoint detected::Use OMEGA_GATE_URL and a gate token instead of direct provider URLs.`);
  }

  process.exit(1);
}

run();
