'use strict';

/**
 * Supabase 服务端客户端（仅供 Vercel Serverless 函数 / 本地 server.js 使用）
 * 使用服务端密钥（SECRET），浏览器永远接触不到。
 */

const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://cnurfjamlzxbnctkfezv.supabase.co').replace(/\/+$/, '');
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';

/**
 * 实体注册表：前端实体名 -> 数据库表 + 允许写入的字段（字段白名单，防注入无关列）
 */
const ENTITIES = {
  fintodo: { table: 'ft_tasks', cols: ['name', 'deadline', 'priority', 'category', 'status', 'note', 'done_at'] },
  invoice: { table: 'invoices', cols: ['inv_type', 'inv_no', 'counterparty', 'inv_date', 'expire', 'amount', 'status', 'note'] },
  fund: { table: 'funds', cols: ['fund_type', 'party', 'amount', 'deadline', 'status', 'note'] },
  monthclose: { table: 'month_closes', cols: ['month', 'status', 'note'] },
  tax: { table: 'tax_records', cols: ['title', 'deadline', 'status', 'note'] },
  knowledge: { table: 'knowledge', cols: ['title', 'body', 'tag'] },
  todo: { table: 'todos', cols: ['text', 'priority', 'done', 'done_at'] },
  checkin: { table: 'checkins', cols: ['date', 'note'] },
  study: { table: 'studies', cols: ['chapter', 'note', 'minutes'] },
  weekreview: { table: 'week_reviews', cols: ['content', 'week_label'] },
  monthreview: { table: 'month_reviews', cols: ['content', 'month_label'] },
  setting: { table: 'app_settings', cols: ['key', 'value'] },
};

const TABLE_NAMES = Object.values(ENTITIES).map((e) => e.table);

function getEntity(name) {
  const e = ENTITIES[name];
  if (!e) throw Object.assign(new Error(`未知实体：${name}`), { status: 400 });
  return e;
}

/**
 * 调用 Supabase REST（PostgREST）
 * @param {string} path 如 /rest/v1/ft_tasks?select=*
 * @param {object} options {method, body, headers}
 */
async function sbFetch(path, options = {}) {
  if (!SECRET_KEY) throw Object.assign(new Error('服务端未配置 SUPABASE_SECRET_KEY'), { status: 500 });
  const headers = {
    apikey: SECRET_KEY,
    Authorization: `Bearer ${SECRET_KEY}`,
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const res = await fetch(`${SUPABASE_URL}${path}`, { method: options.method || 'GET', headers, body: options.body });
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!res.ok) {
    const msg = data && data.message ? data.message : `Supabase ${res.status}`;
    // 表不存在等错误给出更友好的提示
    if (res.status === 404 || /relation .* does not exist/i.test(msg) || /Could not find the table/i.test(msg)) {
      throw Object.assign(new Error('数据库尚未初始化：请在 Supabase 控制台执行 supabase/schema.sql 建表脚本'), { status: 503, code: 'DB_NOT_INIT' });
    }
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return data;
}

/** 查询列表（支持过滤、排序、分页） */
async function listTable(entity, { filters = {}, order, limit, offset } = {}) {
  const e = getEntity(entity);
  const params = new URLSearchParams();
  params.set('select', '*');
  for (const [k, v] of Object.entries(filters || {})) {
    if (v === undefined || v === null || v === '') continue;
    params.set(k, v);
  }
  if (order) params.set('order', order);
  if (limit) params.set('limit', String(limit));
  if (offset) params.set('offset', String(offset));
  return sbFetch(`/rest/v1/${e.table}?${params.toString()}`);
}

/** 插入单行，返回新行 */
async function insertRow(entity, row) {
  const e = getEntity(entity);
  const clean = {};
  for (const c of e.cols) if (row[c] !== undefined) clean[c] = row[c];
  const res = await sbFetch(`/rest/v1/${e.table}`, {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(clean),
  });
  return Array.isArray(res) ? res[0] : res;
}

/** 更新单行（按 id），返回更新后的行 */
async function updateRow(entity, id, patch) {
  const e = getEntity(entity);
  const clean = {};
  for (const c of e.cols) if (patch[c] !== undefined) clean[c] = patch[c];
  if (!Object.keys(clean).length) return null;
  const res = await sbFetch(`/rest/v1/${e.table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(clean),
  });
  return Array.isArray(res) ? res[0] : res;
}

/** 删除单行（按 id） */
async function deleteRow(entity, id) {
  const e = getEntity(entity);
  await sbFetch(`/rest/v1/${e.table}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
  return { ok: true };
}

/** 批量写入（导入恢复用）：逐行 upsert */
async function bulkUpsert(entity, rows) {
  const e = getEntity(entity);
  const cleaned = rows.map((r) => {
    const c = {};
    for (const k of e.cols) if (r[k] !== undefined) c[k] = r[k];
    return c;
  });
  let inserted = 0;
  for (const row of cleaned) {
    await sbFetch(`/rest/v1/${e.table}?on_conflict=id`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(row),
    });
    inserted++;
  }
  return { inserted };
}

/** 读取全部行（大数据集分页拉取） */
async function listAll(entity, { filters = {}, order } = {}) {
  const e = getEntity(entity);
  const rows = [];
  let offset = 0;
  const pageSize = 1000;
  for (;;) {
    const page = await listTable(entity, { filters, order, limit: pageSize, offset });
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

module.exports = { SUPABASE_URL, ENTITIES, TABLE_NAMES, sbFetch, listTable, listAll, insertRow, updateRow, deleteRow, bulkUpsert, getEntity };
