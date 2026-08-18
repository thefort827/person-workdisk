'use strict';

/**
 * /api/health —— 服务与数据库连通性检查（前端开机自检用）
 */

const { SUPABASE_URL, TABLE_NAMES, sbFetch } = require('./_lib/supabase');
const { sendJson, checkAuth } = require('./_lib/respond');

module.exports = async function handler(req, res) {
  try {
    const authed = checkAuth(req);
    const needToken = Boolean((process.env.APP_TOKEN || '').trim());

    // 探测数据库是否已初始化：拉取各表是否存在
    const tables = [];
    let dbReady = true;
    for (const t of TABLE_NAMES) {
      try {
        const col = t === 'app_settings' ? 'key' : 'id';
        await sbFetch(`/rest/v1/${t}?select=${col}&limit=1`);
        tables.push({ name: t, ok: true });
      } catch (err) {
        dbReady = false;
        tables.push({ name: t, ok: false, error: err.message });
      }
    }

    return sendJson(res, 200, {
      ok: true,
      service: 'finance-workbench-api',
      version: '1.0.0',
      time: new Date().toISOString(),
      supabaseUrl: SUPABASE_URL,
      needToken,
      authed,
      dbReady,
      tables,
    });
  } catch (err) {
    return sendJson(res, 500, { ok: false, error: err.message });
  }
};
