'use strict';

/** 统一的响应工具：JSON 输出、错误处理、访问口令校验 */

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function sendOk(res, data) {
  sendJson(res, 200, { ok: true, ...data });
}

function sendError(res, err) {
  const status = err.status || 500;
  sendJson(res, status, {
    ok: false,
    error: err.message || '服务器内部错误',
    code: err.code || 'INTERNAL',
  });
}

/**
 * 访问口令校验：仅当配置了 APP_TOKEN 时生效。
 * 前端需在 localStorage 保存口令并在请求头携带 X-App-Token。
 */
function checkAuth(req) {
  const token = (process.env.APP_TOKEN || '').trim();
  if (!token) return true;
  const given = (req.headers['x-app-token'] || '').trim();
  return given === token;
}

/** 从 req 解析 JSON body（含大小限制） */
function readBody(req, maxBytes = 1024 * 1024 * 8) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) {
        const err = new Error('请求体过大');
        err.status = 413;
        reject(err);
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        const err = new Error('请求体不是合法 JSON');
        err.status = 400;
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

/** 解析 query string（Node 原生，无依赖） */
function parseQuery(search) {
  const out = {};
  if (!search) return out;
  const qs = search.startsWith('?') ? search.slice(1) : search;
  for (const pair of qs.split('&')) {
    if (!pair) continue;
    const [k, v] = pair.split('=');
    const key = decodeURIComponent(k);
    const val = decodeURIComponent((v || '').replace(/\+/g, ' '));
    if (key in out) {
      out[key] = Array.isArray(out[key]) ? [...out[key], val] : [out[key], val];
    } else {
      out[key] = val;
    }
  }
  return out;
}

/**
 * 过滤参数透传：把 URL 上形如 status=eq.done、deadline=lte.2025-12-31 的参数
 * 原样转成 PostgREST 过滤条件（保留参数之外的都视为过滤）。
 */
function buildFilters(query, reserved = new Set(['entity', 'id', 'order', 'limit', 'offset', 'from', 'to'])) {
  const filters = {};
  for (const [k, v] of Object.entries(query)) {
    if (reserved.has(k) || Array.isArray(v)) continue;
    if (v === '') continue;
    filters[k] = v;
  }
  return filters;
}

module.exports = { sendJson, sendOk, sendError, checkAuth, readBody, parseQuery, buildFilters };
