/**
 * UI 工具库：DOM 构建、格式化、Toast、弹窗、数字滚动等
 */

/* ---------- DOM ---------- */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ---------- 格式化 ---------- */
export function fmtMoney(n, digits = 2) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0.00';
  return v.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtNumber(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  return v.toLocaleString('zh-CN');
}

export function fmtMoneyShort(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  const abs = Math.abs(v);
  if (abs >= 100000000) return (v / 100000000).toFixed(2) + ' 亿';
  if (abs >= 10000) return (v / 10000).toFixed(1) + ' 万';
  return fmtMoney(v, 0);
}

export function todayStr() {
  return dayStr(new Date());
}
export function dayStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
export function monthKeyOf(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 距今天数：负数=已过期 */
export function daysFromToday(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

export function dayOffset(base, off) {
  const d = base ? new Date(base) : new Date();
  d.setDate(d.getDate() + off);
  return d;
}

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ---------- Toast ---------- */
export function toast(msg, type = 'info', duration = 2800) {
  const wrap = document.getElementById('toastWrap');
  if (!wrap) return;
  const icons = { success: '✅', error: '⛔', warn: '⚠️', info: '💡' };
  const box = el('div', { class: `toast ${type}` }, [
    el('span', { class: 'toast-ic', text: icons[type] || '💡' }),
    el('span', { text: msg }),
  ]);
  wrap.appendChild(box);
  setTimeout(() => {
    box.classList.add('out');
    setTimeout(() => box.remove(), 320);
  }, duration);
}

/* ---------- 弹窗 ---------- */
export function openModal({ title, bodyHtml, footHtml, onMount, maxWidth }) {
  const mask = document.getElementById('modalMask');
  const box = document.getElementById('modalBox');
  box.style.maxWidth = maxWidth || '';
  box.innerHTML = `
    <div class="modal-head">
      <h3>${esc(title)}</h3>
      <button class="icon-btn" id="modalClose">✕</button>
    </div>
    <div class="modal-body">${bodyHtml || ''}</div>
    ${footHtml ? `<div class="modal-foot">${footHtml}</div>` : ''}`;
  mask.classList.add('show');
  const close = () => mask.classList.remove('show');
  box.querySelector('#modalClose').onclick = close;
  mask.onclick = (e) => { if (e.target === mask) close(); };
  if (onMount) onMount(box, close);
  return { box, close };
}

/** 确认对话框 */
export function confirmDialog({ title = '确认操作', message, okText = '确认', danger = false, onOk }) {
  openModal({
    title,
    bodyHtml: `<p style="font-size:13.5px;color:var(--text-secondary);line-height:1.7;">${esc(message)}</p>`,
    footHtml: `
      <button class="btn btn-outline" id="cf-cancel">取消</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="cf-ok">${esc(okText)}</button>`,
    onMount(box, close) {
      box.querySelector('#cf-cancel').onclick = close;
      box.querySelector('#cf-ok').onclick = () => { close(); if (onOk) onOk(); };
    },
  });
}

/* ---------- 数字滚动 ---------- */
export function countUp(target, end, { duration = 900, decimals = 0, suffix = '' } = {}) {
  const node = typeof target === 'string' ? document.getElementById(target) : target;
  if (!node) return;
  const start = 0;
  const t0 = performance.now();
  function step(t) {
    const p = Math.min((t - t0) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const val = start + (end - start) * eased;
    node.textContent = val.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + suffix;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

/* ---------- 空状态 ---------- */
export function emptyState(msg = '暂无数据', ic = '🗂️') {
  return `<div class="empty-state"><div class="empty-ic">${ic}</div><div>${esc(msg)}</div></div>`;
}

/* ---------- 骨架屏 ---------- */
export function skeletonCards(n = 4, tall = false) {
  return `<div class="skeleton-page">${'<div class="skeleton-card' + (tall ? ' tall' : '') + '"></div>'.repeat(n)}</div>`;
}

/* ---------- CSV 导出 ---------- */
export function downloadCSV(filename, headers, rows) {
  const escapeCell = (v) => {
    const s = String(v === null || v === undefined ? '' : v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(escapeCell).join(',')];
  for (const r of rows) lines.push(r.map(escapeCell).join(','));
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

/* ---------- 日期范围 ---------- */
export function rangePreset(key) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (key) {
    case 'thisMonth': return { from: `${y}-${String(m + 1).padStart(2, '0')}-01`, to: todayStr() };
    case 'lastMonth': {
      const d = new Date(y, m - 1, 1);
      const lastDay = new Date(y, m, 0).getDate();
      return { from: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, to: `${y}-${String(m).padStart(2, '0')}-${lastDay}` };
    }
    case 'last30': return { from: dayStr(dayOffset(now, -29)), to: todayStr() };
    case 'last90': return { from: dayStr(dayOffset(now, -89)), to: todayStr() };
    case 'thisYear': return { from: `${y}-01-01`, to: todayStr() };
    default: return { from: dayStr(dayOffset(now, -29)), to: todayStr() };
  }
}
