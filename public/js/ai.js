/**
 * AI 财务助手 · 悬浮聊天组件
 *  - 右下角悬浮按钮，全局可用
 *  - SSE 流式输出 + 轻量 Markdown 渲染
 *  - 对话历史存 localStorage（不上传数据库）
 *  - 业务数据摘要由后端 /api/chat 自动注入
 */

import { getToken } from './api.js';
import { esc } from './ui.js';

const KEY_MSGS = 'fwb_ai_msgs';
const MAX_HISTORY = 40;

const QUICK_PROMPTS = [
  '📋 本周有哪些到期的财务任务和票据？',
  '🚨 有没有逾期的应收 / 应付？',
  '🗓 报税截止日期是几号？帮我排个时间表',
  '📚 我最近在学什么？帮我做个学习复盘',
  '💡 什么是进项税额转出？举个例子',
  '📊 帮我解读一下当前工作台的数据状况',
];

let msgs = [];
let busy = false;
let streamEl = null;
let root = null;

/* ---------------- 历史持久化 ---------------- */
function loadMsgs() {
  try {
    const raw = localStorage.getItem(KEY_MSGS);
    const arr = raw ? JSON.parse(raw) : [];
    msgs = Array.isArray(arr) ? arr.filter((m) => m && typeof m.content === 'string') : [];
  } catch { msgs = []; }
}
function saveMsgs() {
  try {
    localStorage.setItem(KEY_MSGS, JSON.stringify(msgs.slice(-MAX_HISTORY)));
  } catch { /* ignore */ }
}

/* ---------------- 轻量 Markdown 渲染 ---------------- */
function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code class="ai-md-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

function renderMd(src) {
  if (!src) return '';
  const lines = String(src).split(/\r?\n/);
  const out = [];
  let inCode = false;
  const codeBuf = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (/^\s*```/.test(line)) {
      if (inCode) {
        out.push(`<pre class="ai-md-pre"><code>${esc(codeBuf.join('\n'))}</code></pre>`);
        codeBuf.length = 0;
        inCode = false;
      } else inCode = true;
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }
    const t = line.trim();
    if (!t) continue;
    const h = t.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const lvl = Math.min(h[1].length + 2, 5);
      out.push(`<h${lvl} class="ai-md-h">${inline(h[2])}</h${lvl}>`);
      continue;
    }
    if (/^[-*]\s+/.test(t)) {
      out.push(`<p class="ai-md-li">• ${inline(t.replace(/^[-*]\s+/, ''))}</p>`);
      continue;
    }
    if (/^\d+[.)]\s+/.test(t)) {
      out.push(`<p class="ai-md-li"><span class="ai-md-num">${t.match(/^\d+/)[0]}.</span> ${inline(t.replace(/^\d+[.)]\s+/, ''))}</p>`);
      continue;
    }
    if (/^>\s?/.test(t)) {
      out.push(`<blockquote class="ai-md-quote">${inline(t.replace(/^>\s?/, ''))}</blockquote>`);
      continue;
    }
    out.push(`<p class="ai-md-p">${inline(t)}</p>`);
  }
  if (inCode) out.push(`<pre class="ai-md-pre"><code>${esc(codeBuf.join('\n'))}</code></pre>`);
  return out.join('');
}

/* ---------------- DOM ---------------- */
function buildWidget() {
  root = document.createElement('div');
  root.id = 'aiChat';
  root.innerHTML = `
    <button class="ai-fab" id="aiFab" title="AI 财务助手" aria-label="打开 AI 助手">
      <span class="ai-fab-ic">🤖</span>
    </button>
    <div class="ai-panel" id="aiPanel" role="dialog" aria-label="AI 财务助手">
      <div class="ai-head">
        <div class="ai-title"><span class="ai-logo">🤖</span><div><div class="ai-name">AI 财务助手</div><div class="ai-sub">MiMo · 实时读取工作台数据</div></div></div>
        <div class="ai-head-actions">
          <button class="ai-icon-btn" id="aiNew" title="新建对话">✎</button>
          <button class="ai-icon-btn" id="aiClose" title="收起">—</button>
        </div>
      </div>
      <div class="ai-msgs" id="aiMsgs"></div>
      <div class="ai-quick" id="aiQuick"></div>
      <div class="ai-foot">
        <textarea class="ai-input" id="aiInput" rows="1" placeholder="问财务问题，如：进项税额转出怎么做分录…"></textarea>
        <button class="ai-send" id="aiSend" title="发送">➤</button>
      </div>
    </div>`;
  document.body.appendChild(root);

  const fab = root.querySelector('#aiFab');
  const panel = root.querySelector('#aiPanel');
  const newBtn = root.querySelector('#aiNew');
  const closeBtn = root.querySelector('#aiClose');
  const input = root.querySelector('#aiInput');
  const sendBtn = root.querySelector('#aiSend');

  fab.onclick = () => {
    panel.classList.toggle('show');
    fab.classList.toggle('hide', panel.classList.contains('show'));
    if (panel.classList.contains('show')) { input.focus(); scrollBottom(); }
  };
  closeBtn.onclick = () => { panel.classList.remove('show'); fab.classList.remove('hide'); };
  newBtn.onclick = () => {
    msgs = [];
    saveMsgs();
    render();
    toastHint('已开启新对话');
    input.focus();
  };

  const autosize = () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 140) + 'px';
  };
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });
  sendBtn.onclick = send;

  // 快捷提问
  const quick = root.querySelector('#aiQuick');
  QUICK_PROMPTS.forEach((q) => {
    const chip = document.createElement('button');
    chip.className = 'ai-chip';
    chip.textContent = q;
    chip.onclick = () => {
      input.value = q;
      send();
    };
    quick.appendChild(chip);
  });
}

function toastHint(msg) {
  const box = document.createElement('div');
  box.className = 'ai-toast';
  box.textContent = msg;
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 1800);
}

function scrollBottom() {
  const wrap = root.querySelector('#aiMsgs');
  wrap.scrollTop = wrap.scrollHeight;
}

/* ---------------- 渲染 ---------------- */
function addBubble(role, content) {
  const wrap = root.querySelector('#aiMsgs');
  const div = document.createElement('div');
  div.className = 'ai-msg ' + (role === 'user' ? 'user' : 'assistant');
  div.innerHTML = role === 'user'
    ? `<div class="ai-bubble user">${esc(content)}</div>`
    : `<div class="ai-avatar">🤖</div><div class="ai-bubble assistant"><div class="ai-md">${content ? renderMd(content) : '<span class="ai-typing"><i></i><i></i><i></i></span>'}</div></div>`;
  wrap.appendChild(div);
  scrollBottom();
  return div;
}

function render() {
  const wrap = root.querySelector('#aiMsgs');
  wrap.innerHTML = '';
  if (!msgs.length) {
    wrap.innerHTML = `<div class="ai-welcome">
      <div class="ai-w-ic">🤖</div>
      <div class="ai-w-t">你好，我是你的 AI 财务助手</div>
      <div class="ai-w-s">可以问我会计分录、税务申报、结账流程、Excel 技巧，也可以问我工作台里的待办、票据、应收应付等数据情况。试试下面的快捷提问：</div>
    </div>`;
    return;
  }
  for (const m of msgs) addBubble(m.role, m.content);
}

/* ---------------- 发送 ---------------- */
async function send() {
  const input = root.querySelector('#aiInput');
  const text = input.value.trim();
  if (!text || busy) return;

  msgs.push({ role: 'user', content: text });
  input.value = '';
  input.style.height = 'auto';
  saveMsgs();
  render();

  const placeholder = { role: 'assistant', content: '' };
  msgs.push(placeholder);
  busy = true;
  setBusy(true);
  const el = addBubble('assistant', '');
  streamEl = el;

  let acc = '';
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(getToken() ? { 'X-App-Token': getToken() } : {}),
      },
      body: JSON.stringify({ messages: msgs.slice(-MAX_HISTORY) }),
    });
    if (!res.ok) {
      let data = null;
      try { data = await res.json(); } catch { /* ignore */ }
      throw new Error((data && data.error) || `请求失败（${res.status}）`);
    }

    const ctype = (res.headers.get('content-type') || '');
    if (ctype.includes('application/json')) {
      // 离线模式：后端返回 JSON 分析报告（非流式）
      const data = await res.json();
      acc = (data && data.reply) || '';
      if (data && data.tip) acc += `\n\n---\n💡 ${data.tip}`;
      placeholder.content = acc;
      const mdBox = el.querySelector('.ai-md');
      mdBox.innerHTML = renderMd(acc);
    } else {
      // 在线模式：SSE 流式
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n');
        buf = parts.pop();
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try {
            const j = JSON.parse(payload);
            const delta = j.choices && j.choices[0] && j.choices[0].delta ? (j.choices[0].delta.content || '') : '';
            if (delta) {
              acc += delta;
              const mdBox = el.querySelector('.ai-md');
              mdBox.innerHTML = renderMd(acc);
              scrollBottom();
            }
          } catch { /* 忽略残缺行 */ }
        }
      }
      placeholder.content = acc;
    }
  } catch (err) {
    const tail = acc ? `\n\n---\n⚠️ ${err.message}` : `⚠️ 出错了：${err.message}`;
    placeholder.content = (acc || '') + tail;
    const mdBox = el.querySelector('.ai-md');
    mdBox.innerHTML = renderMd(placeholder.content);
    toastHint(err.message);
  }

  busy = false;
  streamEl = null;
  setBusy(false);
  saveMsgs();
  scrollBottom();
}

function setBusy(b) {
  const sendBtn = root.querySelector('#aiSend');
  const input = root.querySelector('#aiInput');
  if (sendBtn) sendBtn.disabled = b;
  if (input) input.disabled = b;
}

/* ---------------- 初始化 ---------------- */
export function initAiChat() {
  if (document.getElementById('aiChat')) return;
  loadMsgs();
  buildWidget();
  render();
}