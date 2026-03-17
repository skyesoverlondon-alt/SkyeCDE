#!/usr/bin/env node
// server.js — Static file server + gateway proxy
// Proxies /api/* and /.netlify/functions/* to omegaskyegate.netlify.app
// Eliminates CORS issue on codespace/github.dev origins
// Run: node server.js

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;
const GATEWAY = 'https://0megaskyegate.skyesoverlondon.workers.dev';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff2':'font/woff2',
  '.woff': 'font/woff',
  '.ttf':  'font/ttf',
  '.mp4':  'video/mp4',
  '.webp': 'image/webp',
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function proxyToGateway(req, res, upstreamPath) {
  const url = new URL(GATEWAY + upstreamPath);

  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: req.method,
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'Content-Length': body.length,
        ...(req.headers['authorization'] ? { 'Authorization': req.headers['authorization'] } : {}),
      }
    };

    const proxy = https.request(options, (upRes) => {
      res.writeHead(upRes.statusCode, { ...CORS_HEADERS, 'Content-Type': upRes.headers['content-type'] || 'application/json' });
      upRes.pipe(res);
    });

    proxy.on('error', (err) => {
      console.error('[proxy error]', err.message);
      res.writeHead(502, CORS_HEADERS);
      res.end(JSON.stringify({ error: 'Gateway unreachable', detail: err.message }));
    });

    proxy.write(body);
    proxy.end();
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // ── /api/kaixu-key → return local dev key from env ──
  if (pathname === '/api/kaixu-key') {
    const key = process.env.KAIXU_VIRTUAL_KEY || '';
    res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ key }));
    return;
  }

  // ── /api/fs/projects → list top-level project directories in workspace ──
  if (pathname === '/api/fs/projects') {
    try {
      const entries = fs.readdirSync(__dirname, { withFileTypes: true });
      const dirs = entries
        .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
        .map(e => e.name);
      res.writeHead(200, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
      res.end(JSON.stringify(dirs));
    } catch (err) {
      res.writeHead(500, CORS_HEADERS);
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── /api/* → proxy to gateway (stripping /api prefix) ──
  if (pathname.startsWith('/api/')) {
    const upstreamPath = pathname.slice(4); // strip /api
    console.log(`[proxy] ${req.method} ${pathname} → ${GATEWAY}${upstreamPath}`);
    proxyToGateway(req, res, upstreamPath);
    return;
  }

  // ── /.netlify/functions/* → proxy to gateway ──
  if (pathname.startsWith('/.netlify/functions/')) {
    console.log(`[proxy] ${req.method} ${pathname} → ${GATEWAY}${pathname}`);
    proxyToGateway(req, res, pathname);
    return;
  }

  // ── Static file serving ──
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

  // Directory index fallback
  if (!path.extname(filePath)) {
    const tryIndex = path.join(filePath, 'index.html');
    const tryHtml = filePath + '.html';
    if (fs.existsSync(tryIndex)) filePath = tryIndex;
    else if (fs.existsSync(tryHtml)) filePath = tryHtml;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found: ' + pathname);
      } else {
        res.writeHead(500);
        res.end('500 Server Error');
      }
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', ...CORS_HEADERS });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n  SkAIxuide Server running on http://localhost:${PORT}`);
  console.log(`  Proxying /api/* and /.netlify/functions/* → ${GATEWAY}`);
  console.log(`  Press Ctrl+C to stop\n`);
});
