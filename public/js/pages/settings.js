import { esc, toast, openModal, confirmDialog } from '../ui.js';
import { api } from '../api.js';
import { exportAllData, importAllData, buildDemoData, invalidate } from '../store.js';
import { setToken, getToken } from '../api.js';

export const settingsPage = {
  id: 'settings',
  title: '设置 · 备份',
  subtitle: '系统状态 · 数据安全',
  icon: '⚙️',
  render: async (container) => {
    container.innerHTML = `
      <div class="grid-2">
        <div class="glass-card fade-in">
          <div class="card-head"><div class="card-title"><span class="bar"></span>🔌 系统连接状态</div></div>
          <div id="set-health"></div>
        </div>
        <div class="glass-card fade-in">
          <div class="card-head"><div class="card-title"><span class="bar"></span>🗄 数据管理</div></div>
          <div class="action-bar" style="margin-bottom:12px;">
            <button class="btn btn-primary" id="set-export">⬇ 导出全部数据（JSON）</button>
            <button class="btn btn-outline" id="set-import">⬆ 导入恢复</button>
            <input type="file" id="set-import-file" accept=".json" style="display:none;">
          </div>
          <div class="action-bar">
            <button class="btn btn-success" id="set-demo">✨ 导入演示数据（体验看板）</button>
          </div>
          <p class="tip-warning mt-12">⚠️ 仅供个人备忘使用，请勿录入企业涉密真实财务数据</p>
        </div>
      </div>

      <div class="glass-card fade-in">
        <div class="card-head"><div class="card-title"><span class="bar"></span>🔐 访问口令</div></div>
        <p class="text-secondary" style="font-size:12.5px;">若后端配置了 APP_TOKEN，浏览器访问时需要口令；口令保存在本地浏览器。</p>
        <div class="action-bar mt-12">
          <button class="btn btn-outline" id="set-lock">🔒 立即锁定</button>
          <span class="count-pill" id="set-token-status"></span>
        </div>
      </div>

      <div class="glass-card fade-in">
        <div class="card-head"><div class="card-title"><span class="bar"></span>ℹ️ 关于</div></div>
        <div class="flex" style="gap:14px;align-items:flex-start;">
          <div class="logo-mark" style="width:46px;height:46px;">
            <svg viewBox="0 0 48 48" style="width:32px;height:32px;"><circle cx="40" cy="8" r="1.8" fill="rgba(255,255,255,0.85)"/><path d="M12 32 L21 24 L28 27 L37 16" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="37" cy="16" r="3.4" fill="#fff"/></svg>
          </div>
          <div>
            <div style="font-weight:700;font-size:15px;">财务工程师个人工作台 v1.0.0</div>
            <div class="text-secondary" style="font-size:12.5px;margin-top:4px;">
              BI 风格财务管理工作平台 · Supabase 数据库 + Vercel Serverless 后端<br>
              模块：BI 看板 / 报表中心 / 财务待办 / 票据台账 / 资金预警 / 月末结账 / 税务 / 知识库 / 备考 / 打卡 / 复盘
            </div>
          </div>
        </div>
      </div>`;

    // ---- 导出 ----
    container.querySelector('#set-export').onclick = async () => {
      try {
        toast('正在打包数据…', 'info');
        const data = await exportAllData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `财务工作台备份_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 3000);
        toast('✅ 备份已导出', 'success');
      } catch (err) { toast(err.message, 'error'); }
    };

    // ---- 导入 ----
    container.querySelector('#set-import').onclick = () => container.querySelector('#set-import-file').click();
    container.querySelector('#set-import-file').onchange = async (e) => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      try {
        const text = await f.text();
        const payload = JSON.parse(text);
        const hasData = payload && (payload.data || payload.fintodo || payload.invoices);
        if (!hasData) throw new Error('文件格式不正确');
        confirmDialog({
          title: '导入确认',
          message: `将导入备份文件中的全部数据（按 id 覆盖已存在记录）。确定继续吗？`,
          okText: '开始导入',
          onOk: async () => {
            try {
              toast('正在导入…', 'info');
              const stats = await importAllData(payload);
              invalidate();
              toast(`✅ 导入完成：${stats.join('；') || '无数据'}`, 'success');
            } catch (err) { toast('导入失败：' + err.message, 'error'); }
          },
        });
      } catch (err) { toast('文件解析失败：' + err.message, 'error'); }
    };

    // ---- 演示数据 ----
    container.querySelector('#set-demo').onclick = () => {
      confirmDialog({
        title: '导入演示数据',
        message: '将导入一批演示数据（任务/票据/资金/打卡等），用于快速体验 BI 看板与报表功能。可通过「导入恢复」随时覆盖。确定导入吗？',
        okText: '导入',
        onOk: async () => {
          try {
            toast('正在导入演示数据…', 'info');
            const demo = buildDemoData();
            const stats = [];
            for (const [ent, rows] of Object.entries(demo)) {
              const res = await api.importRows(ent, rows);
              stats.push(`${ent} ${res.inserted}`);
            }
            invalidate();
            toast('✅ 演示数据已导入', 'success');
          } catch (err) { toast(err.message, 'error'); }
        },
      });
    };

    // ---- 锁定 ----
    container.querySelector('#set-lock').onclick = () => {
      confirmDialog({
        title: '锁定工作台',
        message: '锁定后需要重新输入访问口令才能继续使用。确定锁定吗？',
        okText: '锁定',
        onOk: () => {
          setToken('');
          window.dispatchEvent(new CustomEvent('fwb:auth-failed'));
        },
      });
    };
    const ts = container.querySelector('#set-token-status');
    ts.textContent = getToken() ? '本地已保存口令' : '本地未保存口令';

    // ---- 健康状态（异步加载，置于绑定之后避免慢网络下切换页面崩溃） ----
    const healthBox = container.querySelector('#set-health');
    try {
      const h = await api.health();
      const tblRows = (h.tables || []).map((t) => `
        <div class="flex-between" style="padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:12.5px;">
          <span class="num-mono">${esc(t.name)}</span>
          <span style="color:${t.ok ? 'var(--success)' : 'var(--danger)'};">${t.ok ? '✓ 就绪' : '✗ 缺失'}</span>
        </div>`).join('');
      if (healthBox) {
        healthBox.innerHTML = `
          <div class="list-item" style="animation:none;">
            <div class="flex-between"><span>后端服务</span><span class="tag tag-done">运行中 v${esc(h.version)}</span></div>
            <div class="flex-between mt-8"><span>数据库连接</span><span class="tag ${h.dbReady ? 'tag-done' : 'tag-overdue'}">${h.dbReady ? '已连接' : '未初始化'}</span></div>
            <div class="flex-between mt-8"><span>访问口令</span><span class="tag ${h.needToken ? 'tag-mid' : 'tag-low'}">${h.needToken ? (h.authed ? '已通过验证' : '未验证') : '未启用（开放）'}</span></div>
            <div class="mt-8" style="font-size:11.5px;color:var(--text-faint);word-break:break-all;">Supabase：${esc(h.supabaseUrl)}</div>
          </div>
          ${h.dbReady ? `<div class="mt-12"><div class="text-secondary mb-8" style="font-size:12px;">数据表状态</div>${tblRows}</div>` : `
            <div class="mt-12"><a class="btn btn-primary btn-sm" href="#dashboard">返回首页查看初始化引导</a></div>`}`;
      }
    } catch (err) {
      if (healthBox) healthBox.innerHTML = `<div class="empty-state"><div class="empty-ic">⚠️</div><div>${esc(err.message)}</div></div>`;
    }
  },
};
