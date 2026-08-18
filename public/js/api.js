/**
 * API 封装层：统一请求、口令注入、错误处理
 */

const TOKEN_KEY = 'fwb_token';

export class ApiError extends Error {
  constructor(message, code = 'HTTP') {
    super(message);
    this.code = code;
  }
}

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
export function setToken(t) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

async function request(path, { method = 'GET', body, params } = {}) {
  let url = '/api' + path;
  if (params) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === '') continue;
      qs.set(k, v);
    }
    const s = qs.toString();
    if (s) url += (url.includes('?') ? '&' : '?') + s;
  }

  const headers = {};
  const token = getToken();
  if (token) headers['X-App-Token'] = token;

  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('网络连接失败，请检查后端服务是否可用', 'NETWORK');
  }

  let data = null;
  try { data = await res.json(); } catch { /* 非 JSON 响应 */ }

  if (!res.ok) {
    if (res.status === 401 && data && data.code === 'AUTH') {
      setToken('');
      window.dispatchEvent(new CustomEvent('fwb:auth-failed'));
    }
    throw new ApiError((data && data.error) || `请求失败（${res.status}）`, (data && data.code) || 'HTTP');
  }
  return data;
}

export const api = {
  health: () => request('/health'),
  list: (entity, params) => request('/data', { params: { entity, ...(params || {}) } }),
  create: (entity, row) => request('/data', { method: 'POST', params: { entity }, body: row }),
  update: (entity, id, patch) => request('/data', { method: 'PATCH', params: { entity, id }, body: patch }),
  remove: (entity, id) => request('/data', { method: 'DELETE', params: { entity, id } }),
  dashboard: () => request('/dashboard'),
  report: (from, to) => request('/report', { params: { from, to } }),
  importRows: (entity, rows) => request('/import', { method: 'POST', params: { entity }, body: { rows } }),
};
