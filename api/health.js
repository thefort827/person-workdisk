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

    // 探测数据库是否已初始化：并行拉取各表是否存在（串行会拖慢函数，逼近超时上限）
    const results = await Promise.all(
      TABLE_NAMES.map(async (t) => {
        try {
          const col = t === 'app_settings' ? 'key' : 'id';
          await sbFetch(`/rest/v1/${t}?select=${col}&limit=1`);
          return { name: t, ok: true };
        } catch (err) {
          return { name: t, ok: false, error: err.message };
        }
      })
    );
    const tables = results;
    const dbReady = results.every((r) => r.ok);

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
