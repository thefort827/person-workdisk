/**
 * 应用引导：时钟、导航、健康检查、锁屏/初始化流程、路由启动
 */

import { initChartDefaults } from './charts.js';
import { startRouter } from './router.js';
import { api, getToken, setToken } from './api.js';
import { toast, openModal, esc } from './ui.js';

const $ = (id) => document.getElementById(id);

/* ---------- 图表全局默认 ---------- */
initChartDefaults();

/* ---------- 时钟 ---------- */
function tickClock() {
  const now = new Date();
  const p = (x) => String(x).padStart(2, '0');
  const timeEl = $('clockTime');
  const dateEl = $('clockDate');
  if (timeEl) timeEl.textContent = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
  if (dateEl) {
    const week = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
    dateEl.textContent = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 星期${week}`;
  }
}
tickClock();
setInterval(tickClock, 1000);

/* ---------- 侧边导航 ---------- */
document.querySelectorAll('.nav-btn').forEach((b) => {
  b.onclick = () => { location.hash = '#' + b.dataset.page; };
});
$('mobMenuBtn').onclick = () => {
  $('sideBar').classList.toggle('open');
  $('drawerMask').classList.toggle('show');
};
$('drawerMask').onclick = () => {
  $('sideBar').classList.remove('open');
  $('drawerMask').classList.remove('show');
};

/* ---------- 快速新增 ---------- */
$('quickAddBtn').onclick = () => {
  const items = [
    { href: '#fintodo', ic: '📋', t: '财务专项任务' },
    { href: '#invoice', ic: '🧾', t: '票据记录' },
    { href: '#fund', ic: '💰', t: '往来资金' },
    { href: '#tax', ic: '📑', t: '税务事项' },
    { href: '#knowledge', ic: '📚', t: '知识条目' },
    { href: '#study', ic: '📖', t: '学习记录' },
    { href: '#todo', ic: '✅', t: '日常待办' },
    { href: '#checkin', ic: '🔥', t: '今日打卡' },
  ];
  openModal({
    title: '快速新增',
    bodyHtml: `<div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));">
      ${items.map((i) => `<a href="${i.href}" class="kpi-card hoverable" style="text-decoration:none;text-align:center;">
        <div style="font-size:22px;">${i.ic}</div><div class="kpi-label mt-8">${i.t}</div></a>`).join('')}
    </div>`,
  });
};

/* ---------- 连接状态指示 ---------- */
function setConn(state, text) {
  const dot = $('connDot');
  const txt = $('connText');
  const mobDot = $('mobConnDot');
  if (dot) {
    dot.className = 'conn-dot ' + state;
  }
  if (mobDot) mobDot.className = 'conn-dot ' + state;
  if (txt) txt.textContent = text;
}

/* ---------- 健康检查与开机流程 ---------- */
let booted = false;

function hideAllScreens() {
  $('lockScreen').classList.add('hidden');
  $('initScreen').classList.add('hidden');
  $('errScreen').classList.add('hidden');
}

function showLock() {
  hideAllScreens();
  $('lockScreen').classList.remove('hidden');
  $('lockInput').value = '';
  $('lockInput').focus();
}

function showInit() {
  hideAllScreens();
  $('initScreen').classList.remove('hidden');
}

function showErr(msg, detail) {
  hideAllScreens();
  $('errMsg').textContent = msg;
  $('errDetail').textContent = detail || '';
  $('errScreen').classList.remove('hidden');
}

async function checkHealth() {
  try {
    const h = await api.health();
    if (h.needToken && !h.authed) {
      setConn('warn', '已连接（等待口令验证）');
      showLock();
      return false;
    }
    if (!h.dbReady) {
      setConn('err', '数据库未初始化');
      showInit();
      return false;
    }
    setConn('ok', '服务运行中 · 数据库已连接');
    hideAllScreens();
    return true;
  } catch (err) {
    setConn('err', '后端不可用');
    showErr('后端服务不可用', err.message);
    return false;
  }
}

async function boot() {
  const ok = await checkHealth();
  if (!ok) return;
  if (!booted) {
    booted = true;
    await startRouter($('app'));
  } else {
    // 重新引导：直接刷新当前页
    location.reload();
  }
}

/* ---------- 锁屏交互 ---------- */
$('lockBtn').onclick = async () => {
  const v = $('lockInput').value.trim();
  if (!v) { $('lockErr').textContent = '请输入口令'; return; }
  $('lockBtn').disabled = true;
  setToken(v);
  try {
    const h = await api.health();
    if (h.needToken && !h.authed) {
      $('lockErr').textContent = '口令不正确，请重试';
      setToken('');
      $('lockBtn').disabled = false;
      return;
    }
    $('lockErr').textContent = '';
    await boot();
  } catch (err) {
    $('lockErr').textContent = err.message;
    setToken('');
    $('lockBtn').disabled = false;
  }
};
$('lockInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('lockBtn').click(); });

/* ---------- 初始化屏幕交互 ---------- */
$('copySqlBtn').onclick = async () => {
  try {
    const res = await fetch('/supabase/schema.sql');
    if (!res.ok) throw new Error('无法获取脚本');
    const sql = await res.text();
    await navigator.clipboard.writeText(sql);
    toast('✅ 建表脚本已复制，去 Supabase SQL Editor 粘贴执行即可', 'success');
  } catch {
    // 兼容不支持剪贴板的环境：提示手动复制
    window.open('/supabase/schema.sql', '_blank');
    toast('已在新窗口打开脚本，请全选复制', 'info');
  }
};
$('retryInitBtn').onclick = async () => {
  $('retryInitBtn').disabled = true;
  $('retryInitBtn').textContent = '⏳ 检测中…';
  await boot();
  $('retryInitBtn').disabled = false;
  $('retryInitBtn').textContent = '🔄 我已执行，重新检测';
};
$('retryErrBtn').onclick = async () => {
  $('retryErrBtn').disabled = true;
  $('retryErrBtn').textContent = '⏳ 重连中…';
  await boot();
  $('retryErrBtn').disabled = false;
  $('retryErrBtn').textContent = '🔄 重新连接';
};

/* ---------- 口令失效全局事件 ---------- */
window.addEventListener('fwb:auth-failed', () => {
  showLock();
  toast('口令已失效，请重新输入', 'warn');
});

/* ---------- 启动 ---------- */
boot();
