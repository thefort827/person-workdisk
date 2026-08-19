'use strict';

/**
 * /api/chat —— AI 财务助手
 *
 * POST /api/chat   body: { messages: [{ role, content }, ...] }
 *  - 鉴权：与其它接口一致（APP_TOKEN）
 *  - 自动读取工作台业务数据，生成「数据摘要」注入上下文（仅摘要，不落库）
 *
 * 双模式：
 *  1) 在线模式（配置了 MIMO_API_KEY）：SSE 流式转发小米 MiMo 响应，前端打字机展示
 *  2) 离线模式（未配置密钥）：基于工作台数据的规则引擎，返回 JSON 分析报告（无需任何密钥）
 *
 * 环境变量（Vercel / .env）：
 *   MIMO_API_KEY    必填其一，MiMo 平台密钥（sk-xxxxx）
 *   MIMO_API_BASE   可选，默认 https://api.xiaomimimo.com/v1
 *   MIMO_MODEL      可选，默认 mimo-v2.5
 *   MIMO_MAX_TOKENS 可选，默认 1600
 */

const { listTable } = require('./_lib/supabase');
const { sendJson, sendError, checkAuth, readBody } = require('./_lib/respond');

const MIMO_API_KEY = (process.env.MIMO_API_KEY || '').trim();
const MIMO_API_BASE = (process.env.MIMO_API_BASE || 'https://api.xiaomimimo.com/v1').replace(/\/+$/, '');
const MIMO_MODEL = (process.env.MIMO_MODEL || 'mimo-v2.5').trim();
const MIMO_MAX_TOKENS = Number(process.env.MIMO_MAX_TOKENS || 1600);

const SYSTEM_PROMPT = `你是「财务工程师个人工作台」内置的 AI 财务助手，一位专业、严谨、亲切的中文财务顾问。
你的服务对象是一名财务工程师（会计/财务人员），他常问：会计分录、税务申报（增值税/个税/企业所得税）、发票认证抵扣、月末结账流程、往来账龄与坏账处理、Excel 技巧、CPA/中级备考，以及"我本周有什么到期/逾期/待办"这类基于工作台数据的问题。

规则：
1. 使用简洁清晰的中文，善用 Markdown（标题、列表、表格、加粗、行内代码）。
2. 金额保留到分，日期统一用 YYYY-MM-DD 格式。
3. 系统消息中的【工作台数据摘要】是实时从用户数据库读取的；凡涉及"我的数据/待办/票据/应收应付/税务"等问题，请优先引用摘要中的真实数据作答。数据缺失或过时请如实说明，不要编造数字。
4. 涉及税法政策时注明"仅供参考，以最新法规为准"，重要事项提醒用户咨询当地税务师。
5. 不编造摘要以外的个人数据，不做与财务无关的闲聊（保持简洁）。`;

function todayStr() {
  const d = new Date();
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function daysFrom(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

function dueText(dateStr) {
  const days = daysFrom(dateStr);
  if (days === null) return '';
  if (days < 0) return `【已逾期 ${-days} 天】`;
  if (days === 0) return '【今天到期】';
  return `【还剩 ${days} 天】`;
}

function fmtMoney(v) { return Number(v || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const TASK_STATUS = { pending: '待处理', processing: '处理中', review: '待复核', done: '已完成' };
const TASK_CAT = { tax: '税务', receivable: '应收', payable: '应付', cost: '成本', close: '结账' };
const INV_TYPE = { input: '进项发票', output: '销项发票', expense: '费用报销', accept: '承兑汇票' };
const INV_STATUS = { wait: '待收票', auth: '已认证', entry: '已入账', archive: '已归档' };
const CLOSE_STATUS = { pending: '未开始', processing: '结账进行中', review: '复核中', done: '已完成' };

/** 并行拉取多表（单表失败不阻断整体） */
async function loadMany(specs) {
  const results = await Promise.all(
    specs.map(async (s) => {
      try {
        return await listTable(s.entity, { order: s.order || 'created_at.desc', limit: s.limit || 20 });
      } catch {
        return [];
      }
    })
  );
  return results;
}

/**
 * 汇总工作台数据为一段紧凑摘要（用于给模型作为上下文）。
 */
async function buildDigest() {
  const today = todayStr();
  const sections = [];

  const [fintodo, funds, invoices, taxes, knowledge, studies] = await loadMany([
    { entity: 'fintodo', limit: 20 },
    { entity: 'fund', limit: 20 },
    { entity: 'invoice', limit: 20 },
    { entity: 'tax', limit: 20 },
    { entity: 'knowledge', limit: 15 },
    { entity: 'study', limit: 8 },
  ]);

  const openTasks = fintodo.filter((r) => r.status !== 'done').slice(0, 12);
  if (openTasks.length) {
    sections.push(`■ 财务待办（未完成 ${openTasks.length} 项）：\n` + openTasks.map((r) =>
      `- ${r.name}｜截止：${r.deadline || '无'}${dueText(r.deadline)}｜${TASK_CAT[r.category] || r.category}｜${TASK_STATUS[r.status] || r.status}`
    ).join('\n'));
  }

  const openFunds = funds.filter((r) => r.status !== 'cleared').slice(0, 15);
  if (openFunds.length) {
    const sum = (t) => openFunds.filter((r) => r.fund_type === t).reduce((a, r) => a + (Number(r.amount) || 0), 0);
    sections.push(`■ 往来资金（未清 ${openFunds.length} 项，应收合计 ¥${fmtMoney(sum('receivable'))}，应付合计 ¥${fmtMoney(sum('payable'))}）：\n` +
      openFunds.map((r) =>
        `- ${r.fund_type === 'receivable' ? '应收' : '应付'}｜${r.party || '未知'}｜¥${fmtMoney(r.amount)}｜到期：${r.deadline || '无'}${dueText(r.deadline)}`
      ).join('\n'));
  }

  const openInvoices = invoices.filter((r) => r.status !== 'archive').slice(0, 12);
  if (openInvoices.length) {
    sections.push(`■ 票据（未归档 ${openInvoices.length} 张）：\n` + openInvoices.map((r) =>
      `- ${INV_TYPE[r.inv_type] || r.inv_type}｜${r.counterparty || '无对方'}｜¥${fmtMoney(r.amount)}｜到期：${r.expire || '无'}${dueText(r.expire)}｜${INV_STATUS[r.status] || r.status}`
    ).join('\n'));
  }

  const openTaxes = taxes.filter((r) => r.status !== 'done').slice(0, 12);
  if (openTaxes.length) {
    sections.push(`■ 税务事项（未完成 ${openTaxes.length} 项）：\n` + openTaxes.map((r) =>
      `- ${r.title || '无标题'}｜截止：${r.deadline || '无'}${dueText(r.deadline)}`
    ).join('\n'));
  }

  if (knowledge.length) {
    sections.push(`■ 知识库（最近 ${knowledge.length} 条）：\n` + knowledge.map((r) =>
      `- 《${r.title || '无标题'}》：${String(r.body || '').slice(0, 120)}`
    ).join('\n'));
  }

  if (studies.length) {
    sections.push(`■ 备考记录（最近 ${studies.length} 条）：\n` + studies.map((r) =>
      `- ${r.chapter || '未填章节'}｜${r.minutes ? r.minutes + ' 分钟' : '时长未知'}`
    ).join('\n'));
  }

  const body = sections.length ? sections.join('\n\n') : '（当前工作台暂无业务数据，或数据库尚未初始化）';
  return `【工作台数据摘要 · 更新于 ${today}】\n${body}\n（注意：以上为最近部分数据，金额与日期请以实际业务为准）`;
}

/* ================= 离线模式：规则引擎分析 ================= */

/** 读取结构化统计（离线模式用） */
async function buildStats() {
  const [fintodo, funds, invoices, taxes, checkins, studies, closes, todos, knowledge] = await loadMany([
    { entity: 'fintodo', limit: 200 },
    { entity: 'fund', limit: 200 },
    { entity: 'invoice', limit: 200 },
    { entity: 'tax', limit: 100 },
    { entity: 'checkin', limit: 500 },
    { entity: 'study', limit: 100 },
    { entity: 'monthclose', limit: 50 },
    { entity: 'todo', limit: 200 },
    { entity: 'knowledge', limit: 30 },
  ]);

  const openFunds = funds.filter((f) => f.status !== 'cleared');
  const overdueFunds = openFunds.filter((f) => (daysFrom(f.deadline) ?? 999) < 0);
  const overdueTasks = fintodo.filter((t) => t.status !== 'done' && (daysFrom(t.deadline) ?? 999) < 0);
  const dueInvoices = invoices.filter((i) => i.status !== 'archive' && (daysFrom(i.expire) ?? 999) <= 7);
  const overdueInvoices = dueInvoices.filter((i) => (daysFrom(i.expire) ?? 999) < 0);
  const pendingTax = taxes.filter((t) => t.status !== 'done');

  const checkinSet = new Set(checkins.map((c) => c.date));
  let streak = 0;
  for (let i = 0; i < 3650; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (checkinSet.has(ds)) streak++;
    else break;
  }

  const now = new Date();
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const closeRec = closes.find((c) => c.month === curMonth);

  return {
    tasks: {
      total: fintodo.length,
      done: fintodo.filter((t) => t.status === 'done').length,
      overdue: overdueTasks.map((t) => ({ name: t.name, days: -daysFrom(t.deadline) })),
    },
    funds: {
      receivable: openFunds.filter((f) => f.fund_type === 'receivable').reduce((a, f) => a + (Number(f.amount) || 0), 0),
      payable: openFunds.filter((f) => f.fund_type === 'payable').reduce((a, f) => a + (Number(f.amount) || 0), 0),
      overdueRec: overdueFunds.filter((f) => f.fund_type === 'receivable').map((f) => ({ party: f.party, amount: f.amount, days: -daysFrom(f.deadline) })),
      overduePay: overdueFunds.filter((f) => f.fund_type === 'payable').map((f) => ({ party: f.party, amount: f.amount, days: -daysFrom(f.deadline) })),
    },
    invoices: { due: dueInvoices, overdueCount: overdueInvoices.length },
    taxes: { pending: pendingTax.map((t) => ({ title: t.title, deadline: t.deadline })) },
    close: { status: closeRec ? (CLOSE_STATUS[closeRec.status] || closeRec.status) : '未开始' },
    checkin: { streak, total: checkins.length },
    study: { minutes: studies.reduce((a, s) => a + (Number(s.minutes) || 0), 0), count: studies.length },
    todo: { total: todos.length, undone: todos.filter((t) => !t.done).length },
    knowledgeCount: knowledge.length,
  };
}

/** 生成离线分析报告 */
function ruleAnalysis(st) {
  const lines = [];
  lines.push('🤖 智能财务分析（离线模式 · 基于工作台实时数据）\n');
  lines.push(`📅 数据日期：${todayStr()}\n`);

  if (st.funds.receivable > 0 || st.funds.payable > 0) {
    lines.push('💰 资金概览');
    lines.push(`- 未清应收合计：¥${fmtMoney(st.funds.receivable)}`);
    lines.push(`- 未清应付合计：¥${fmtMoney(st.funds.payable)}`);
    if (st.funds.overdueRec.length) {
      lines.push(`- ⚠️ 逾期应收 ${st.funds.overdueRec.length} 笔：${st.funds.overdueRec.slice(0, 4).map((f) => `${f.party}（¥${fmtMoney(f.amount)}，逾期${f.days}天）`).join('；')}`);
    }
    if (st.funds.overduePay.length) {
      lines.push(`- ⚠️ 逾期应付 ${st.funds.overduePay.length} 笔：${st.funds.overduePay.slice(0, 4).map((f) => `${f.party}（¥${fmtMoney(f.amount)}，逾期${f.days}天）`).join('；')}`);
    }
    lines.push('');
  }

  if (st.invoices.due.length) {
    lines.push('🧾 票据到期提醒（7 天内）');
    st.invoices.due.slice(0, 6).forEach((i) => {
      const d = daysFrom(i.expire);
      lines.push(`- ${INV_TYPE[i.inv_type] || i.inv_type}｜${i.counterparty || '无对方'}｜¥${fmtMoney(i.amount)}${d === null ? '' : d < 0 ? `｜已过期 ${-d} 天` : d === 0 ? '｜今天到期' : `｜还剩 ${d} 天`}`);
    });
    lines.push('');
  }

  lines.push('📋 任务状态');
  const rate = st.tasks.total ? Math.round((st.tasks.done / st.tasks.total) * 100) : 0;
  lines.push(`- 财务任务共 ${st.tasks.total} 项，已完成 ${st.tasks.done} 项（完成率 ${rate}%）`);
  if (st.tasks.overdue.length) {
    lines.push(`- ⚠️ 逾期任务 ${st.tasks.overdue.length} 项：${st.tasks.overdue.slice(0, 4).map((t) => `${t.name}（逾期${t.days}天）`).join('；')}`);
  }
  lines.push(`- 日常待办：${st.todo.total} 项，未完成 ${st.todo.undone} 项`);
  lines.push('');

  if (st.taxes.pending.length) {
    lines.push('📑 税务待办');
    st.taxes.pending.slice(0, 5).forEach((t) => {
      const d = daysFrom(t.deadline);
      lines.push(`- ${t.title}（截止 ${t.deadline || '未设置'}${d === null ? '' : d < 0 ? `，已逾期 ${-d} 天！` : d === 0 ? '，今天截止！' : `，还有 ${d} 天`}）`);
    });
    lines.push('');
  }

  lines.push(`📆 月末结账：${st.close.status}`);
  lines.push(`🔥 连续打卡 ${st.checkin.streak} 天（累计 ${st.checkin.total} 天）｜📖 备考累计 ${st.study.minutes} 分钟（${st.study.count} 条）｜📚 知识库 ${st.knowledgeCount} 条`);
  lines.push('');

  lines.push('💡 建议');
  const tips = [];
  if (st.funds.overdueRec.length) tips.push(`优先催收逾期应收（${st.funds.overdueRec.length} 笔，合计 ¥${fmtMoney(st.funds.overdueRec.reduce((a, f) => a + (Number(f.amount) || 0), 0))}）`);
  if (st.funds.overduePay.length) tips.push('与逾期应付方沟通展期或安排付款计划');
  if (st.invoices.overdueCount) tips.push(`处理 ${st.invoices.overdueCount} 张已过期票据（可能影响认证抵扣）`);
  if (st.tasks.overdue.length) tips.push(`处理 ${st.tasks.overdue.length} 项逾期任务，更新状态与截止时间`);
  if (st.taxes.pending.length) tips.push(`尽快完成 ${st.taxes.pending.length} 项税务申报`);
  if (st.close.status === '未开始' && new Date().getDate() >= 20) tips.push('临近月末，建议启动结账流程');
  if (st.todo.undone) tips.push(`今日待办还剩 ${st.todo.undone} 项，安排处理`);
  if (!tips.length) tips.push('当前各项数据健康，继续保持节奏！');
  tips.forEach((t) => lines.push(`- ${t}`));

  lines.push('');
  lines.push('💡 提示：在 Vercel 配置 MIMO_API_KEY 后，可解锁 AI 对话问答（会计分录、税务政策、数据分析解读等）。');
  return lines.join('\n');
}

/** 校验并裁剪用户消息（防超长） */
function cleanMessages(messages) {
  if (!Array.isArray(messages)) throw Object.assign(new Error('缺少 messages'), { status: 400 });
  const max = 30;
  const out = [];
  for (const m of messages.slice(-max)) {
    if (!m || typeof m.content !== 'string' || !m.content.trim()) continue;
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    out.push({ role: m.role, content: m.content.slice(0, 6000) });
  }
  return out;
}

module.exports = async function handler(req, res) {
  let started = false;
  try {
    if (!checkAuth(req)) return sendJson(res, 401, { ok: false, error: '访问口令不正确', code: 'AUTH' });

    const body = await readBody(req);
    const messages = cleanMessages(body.messages);
    if (!messages.length) return sendJson(res, 400, { ok: false, error: '消息不能为空', code: 'BAD_REQ' });
    const question = messages[messages.length - 1].content;

    // ---------- 离线模式：规则引擎（无需密钥） ----------
    if (!MIMO_API_KEY) {
      const st = await buildStats();
      return sendJson(res, 200, {
        ok: true,
        mode: 'rule',
        reply: ruleAnalysis(st),
        tip: '离线分析模式',
      });
    }

    // ---------- 在线模式：MiMo 流式 ----------
    let digest = '';
    try { digest = await buildDigest(); } catch { digest = ''; }

    const upstreamBody = {
      model: MIMO_MODEL,
      stream: true,
      temperature: 0.7,
      max_tokens: MIMO_MAX_TOKENS,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...(digest ? [{ role: 'system', content: digest }] : []),
        ...messages,
      ],
    };

    const upstream = await fetch(`${MIMO_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MIMO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(upstreamBody),
    });

    if (!upstream.ok) {
      const txt = await upstream.text().catch(() => '');
      let msg = txt;
      try { const j = JSON.parse(txt); msg = (j && j.error && j.error.message) || txt; } catch { /* 非 JSON */ }
      return sendJson(res, upstream.status, { ok: false, error: `MiMo 接口错误（${upstream.status}）：${msg}`, code: 'MIMO' });
    }

    // SSE 流式转发
    started = true;
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');

    const reader = upstream.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (err) {
    // 已开始流式输出时无法再改响应头，直接断开
    if (started) { try { res.end(); } catch { /* ignore */ } return; }
    return sendError(res, err);
  }
};
