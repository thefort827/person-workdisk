'use strict';

/**
 * 本地开发/预览服务器（零依赖）
 *  - 静态资源：public/ 目录
 *  - API：/api/* 路由到 api/ 下同名处理器（与 Vercel Serverless 完全一致）
 *  - 环境变量：读取根目录 .env（可选）
 *
 * 启动：npm start   →   http://localhost:3000
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

/* ---------- 轻量 .env 加载（无依赖） ---------- */
(function loadEnv() {
  try {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) return;
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch { /* 忽略 */ }
})();

const PUBLIC = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

const ROUTES = {
  '/api/data': require('./api/data'),
  '/api/dashboard': require('./api/dashboard'),
  '/api/health': require('./api/health'),
  '/api/report': require('./api/report'),
  '/api/import': require('./api/import'),
  '/api/chat': require('./api/chat'),
};

function serveStatic(res, filePath) {
  fs.readFile(filePath, (err, buf) => {
    if (err) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.setHeader('Cache-Control', ext === '.html' ? 'no-cache' : 'public, max-age=3600');
    res.end(buf);
  });
}

const server = http.createServer((req, res) => {
  const url = req.url || '/';
  const pathname = url.split('?')[0];

  // ---------- API 路由 ----------
  if (pathname.startsWith('/api/')) {
    const handler = ROUTES[pathname];
    if (!handler) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: 'API 不存在' }));
      return;
    }
    try {
      Promise.resolve(handler(req, res)).catch((err) => {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ok: false, error: err.message || '服务器错误' }));
      });
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: err.message || '服务器错误' }));
    }
    return;
  }

  // ---------- 静态资源 ----------
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(PUBLIC, rel);
  if (!filePath.startsWith(PUBLIC)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      // SPA 回退到首页（hash 路由本身不需要，防御性保留）
      serveStatic(res, path.join(PUBLIC, 'index.html'));
      return;
    }
    serveStatic(res, filePath);
  });
});

const PORT = Number(process.env.PORT || 3000);
server.listen(PORT, () => {
  console.log('══════════════════════════════════════════════');
  console.log('  财务工程师个人工作台 · 本地服务器已启动');
  console.log(`  访问地址: http://localhost:${PORT}`);
  console.log('  数据库: ', process.env.SUPABASE_URL || '(未配置 .env，将使用默认 Supabase 项目)');
  console.log('  访问口令: ', process.env.APP_TOKEN ? '已启用' : '未启用（开放访问）');
  console.log('══════════════════════════════════════════════');
});
