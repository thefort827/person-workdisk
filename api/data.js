'use strict';

/**
 * /api/data —— 通用数据 CRUD
 *
 * GET    /api/data?entity=fintodo&order=created_at.desc&limit=100
 * POST   /api/data?entity=fintodo          body: { name:'...', deadline:'...' }
 * PATCH  /api/data?entity=fintodo&id=xxx   body: { status:'done' }
 * DELETE /api/data?entity=fintodo&id=xxx
 */

const { listTable, insertRow, updateRow, deleteRow, getEntity } = require('./_lib/supabase');
const { sendJson, sendError, checkAuth, readBody, parseQuery, buildFilters } = require('./_lib/respond');

module.exports = async function handler(req, res) {
  try {
    if (!checkAuth(req)) return sendJson(res, 401, { ok: false, error: '访问口令不正确', code: 'AUTH' });

    const query = parseQuery(req.url.split('?')[1]);
    const entity = query.entity;
    const id = query.id;
    getEntity(entity || ''); // 校验实体

    const method = (req.method || 'GET').toUpperCase();

    // ---------- 查询列表 ----------
    if (method === 'GET') {
      const filters = buildFilters(query);
      const data = await listTable(entity, {
        filters,
        order: query.order || 'created_at.desc',
        limit: query.limit ? Number(query.limit) : undefined,
        offset: query.offset ? Number(query.offset) : undefined,
      });
      return sendJson(res, 200, { ok: true, data, count: data.length });
    }

    // ---------- 新增 ----------
    if (method === 'POST') {
      const body = await readBody(req);
      const row = await insertRow(entity, body);
      return sendJson(res, 201, { ok: true, data: row });
    }

    // ---------- 更新 ----------
    if (method === 'PATCH') {
      if (!id) return sendJson(res, 400, { ok: false, error: '缺少 id 参数', code: 'BAD_REQ' });
      const body = await readBody(req);
      const row = await updateRow(entity, id, body);
      return sendJson(res, 200, { ok: true, data: row });
    }

    // ---------- 删除 ----------
    if (method === 'DELETE') {
      if (!id) return sendJson(res, 400, { ok: false, error: '缺少 id 参数', code: 'BAD_REQ' });
      await deleteRow(entity, id);
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 405, { ok: false, error: '不支持的方法', code: 'METHOD' });
  } catch (err) {
    return sendError(res, err);
  }
};
