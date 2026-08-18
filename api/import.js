'use strict';

/**
 * /api/import —— 批量导入恢复
 * body: { entity: 'fintodo', rows: [...] }  （rows 内可含 id，存在则覆盖）
 */

const { bulkUpsert, getEntity } = require('./_lib/supabase');
const { sendJson, sendError, checkAuth, readBody, parseQuery } = require('./_lib/respond');

module.exports = async function handler(req, res) {
  try {
    if (!checkAuth(req)) return sendJson(res, 401, { ok: false, error: '访问口令不正确', code: 'AUTH' });
    if ((req.method || 'GET').toUpperCase() !== 'POST') {
      return sendJson(res, 405, { ok: false, error: '仅支持 POST', code: 'METHOD' });
    }

    const q = parseQuery(req.url.split('?')[1]);
    const entity = q.entity;
    getEntity(entity || '');
    const body = await readBody(req);
    const rows = Array.isArray(body.rows) ? body.rows : body.data || [];

    if (!rows.length) return sendJson(res, 200, { ok: true, inserted: 0 });

    // 行数保护：单次最多 2000 行
    if (rows.length > 2000) return sendJson(res, 400, { ok: false, error: '单次导入最多 2000 行', code: 'BAD_REQ' });

    const result = await bulkUpsert(entity, rows);
    return sendJson(res, 200, { ok: true, ...result });
  } catch (err) {
    return sendError(res, err);
  }
};
