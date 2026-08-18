'use strict';

/**
 * /api/dashboard —— 智能首页 / BI 看板聚合数据（服务端计算）
 */

const { listAll } = require('./_lib/supabase');
const { sendJson, sendError, checkAuth } = require('./_lib/respond');

/* ---------- 日期工具 ---------- */
const DAY = 24 * 3600 * 1000;

function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function dayStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function parseDay(s) {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function daysFromToday(s) {
  const d = parseDay(s);
  if (!d) return null;
  return Math.round((d.getTime() - today().getTime()) / DAY);
}
function isDone(t) {
  return t.status === 'done';
}
function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/* ---------- 主入口 ---------- */
module.exports = async function handler(req, res) {
  try {
    if (!checkAuth(req)) return sendJson(res, 401, { ok: false, error: '访问口令不正确', code: 'AUTH' });

    // 并行拉取全部所需数据
    const [tasks, invoices, funds, taxRecords, checkins, studies, closes, todos, knowledge] = await Promise.all([
      listAll('fintodo'),
      listAll('invoice'),
      listAll('fund'),
      listAll('tax'),
      listAll('checkin'),
      listAll('study'),
      listAll('monthclose'),
      listAll('todo'),
      listAll('knowledge'),
    ]);

    const now = today();
    const curMonth = monthKey(now);

    /* ============ 财务专项任务 ============ */
    const taskTotal = tasks.length;
    const taskDone = tasks.filter(isDone).length;
    const taskRate = taskTotal ? Math.round((taskDone / taskTotal) * 100) : 0;

    const taskByStatus = ['pending', 'processing', 'review', 'done'].map((s) => ({
      status: s,
      count: tasks.filter((t) => t.status === s).length,
    }));
    const taskByCategory = ['tax', 'receivable', 'payable', 'cost', 'close'].map((c) => ({
      category: c,
      count: tasks.filter((t) => t.category === c).length,
    }));

    // 近 12 个月任务趋势（按月创建 / 按月完成）
    const taskTrend = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mk = monthKey(d);
      const created = tasks.filter((t) => monthKey(parseDay(t.created_at) || d) === mk).length;
      const done = tasks.filter((t) => {
        if (!isDone(t)) return false;
        const dt = parseDay(t.done_at) || parseDay(t.updated_at) || parseDay(t.created_at);
        return dt && monthKey(dt) === mk;
      }).length;
      taskTrend.push({ month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, created, done });
    }

    /* ============ 票据 ============ */
    const invAmount = (list) => list.reduce((s, i) => s + toNum(i.amount), 0);
    const invoiceByType = ['input', 'output', 'expense', 'accept'].map((t) => {
      const list = invoices.filter((i) => i.inv_type === t);
      return { type: t, amount: Math.round(invAmount(list) * 100) / 100, count: list.length };
    });

    const invoiceTrend = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mk = monthKey(d);
      const list = invoices.filter((i) => {
        const dd = parseDay(i.inv_date);
        return dd && monthKey(dd) === mk;
      });
      invoiceTrend.push({ month: mk, amount: Math.round(invAmount(list) * 100) / 100, count: list.length });
    }

    /* ============ 往来资金 / 账龄 ============ */
    const openFunds = funds.filter((f) => f.status !== 'cleared');
    const receivableTotal = Math.round(invAmount(openFunds.filter((f) => f.fund_type === 'receivable')) * 100) / 100;
    const payableTotal = Math.round(invAmount(openFunds.filter((f) => f.fund_type === 'payable')) * 100) / 100;

    function agingBucket(days) {
      if (days === null) return 'noDate';
      if (days < 0) return 'overdue';
      if (days <= 30) return 'd030';
      if (days <= 60) return 'd3160';
      if (days <= 90) return 'd6190';
      return 'd90';
    }
    const fundAging = [];
    const buckets = [
      { key: 'overdue', label: '已逾期' },
      { key: 'd030', label: '30天内' },
      { key: 'd3160', label: '31-60天' },
      { key: 'd6190', label: '61-90天' },
      { key: 'd90', label: '90天以上' },
      { key: 'noDate', label: '未设置到期日' },
    ];
    for (const b of buckets) {
      const list = openFunds.filter((f) => agingBucket(daysFromToday(f.deadline)) === b.key);
      fundAging.push({
        bucket: b.key,
        label: b.label,
        receivable: Math.round(invAmount(list.filter((f) => f.fund_type === 'receivable')) * 100) / 100,
        payable: Math.round(invAmount(list.filter((f) => f.fund_type === 'payable')) * 100) / 100,
        count: list.length,
      });
    }

    /* ============ 税务 ============ */
    const taxPending = taxRecords.filter((t) => t.status !== 'done').length;
    const overdueTax = taxRecords.filter((t) => {
      const days = daysFromToday(t.deadline);
      return t.status !== 'done' && days !== null && days < 0;
    }).length;
    // 下个报税日：默认每月 15 号（可被设置覆盖：setting.tax_deadline_day）
    let taxDay = 15;
    const nextTax = new Date(now.getFullYear(), now.getMonth(), taxDay);
    if (nextTax <= now) nextTax.setMonth(nextTax.getMonth() + 1);
    const taxCountdown = Math.round((nextTax.getTime() - now.getTime()) / DAY);

    /* ============ 打卡 ============ */
    const checkinSet = new Set(checkins.map((c) => c.date));
    let streak = 0;
    for (let i = 0; i < 3650; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      if (checkinSet.has(dayStr(d))) streak++;
      else break;
    }
    // 最近 26 周热力图
    const gridStart = new Date(now);
    gridStart.setDate(gridStart.getDate() - 25 * 7 - now.getDay()); // 对齐到周
    const checkinGrid = [];
    for (let w = 0; w < 26; w++) {
      const week = [];
      for (let k = 0; k < 7; k++) {
        const d = new Date(gridStart);
        d.setDate(d.getDate() + w * 7 + k);
        const ds = dayStr(d);
        week.push({ date: ds, checked: checkinSet.has(ds), future: d > now });
      }
      checkinGrid.push(week);
    }

    /* ============ 备考 ============ */
    const studyMinutes = studies.reduce((s, x) => s + toNum(x.minutes), 0);
    const chapterMap = new Map();
    for (const s of studies) {
      const k = (s.chapter || '未分类').trim();
      chapterMap.set(k, (chapterMap.get(k) || 0) + toNum(s.minutes));
    }
    const studyByChapter = [...chapterMap.entries()].map(([chapter, minutes]) => ({ chapter, minutes }))
      .sort((a, b) => b.minutes - a.minutes).slice(0, 8);

    /* ============ 月度结账 ============ */
    const closeRec = closes.find((c) => c.month === curMonth);
    const monthCloseStatus = closeRec ? closeRec.status : 'pending';

    /* ============ 待办 / 知识库 ============ */
    const todoTotal = todos.length;
    const todoDone = todos.filter((t) => t.done).length;
    const knowledgeTotal = knowledge.length;

    /* ============ 风险事件（今日事务中心） ============ */
    const events = [];
    for (const t of tasks) {
      if (isDone(t)) continue;
      const days = daysFromToday(t.deadline);
      if (days === null) continue;
      const level = days < 0 ? 'danger' : days === 0 ? 'orange' : days <= 7 ? 'yellow' : null;
      if (level) events.push({ level, src: '财务专项待办', title: t.name, date: t.deadline, days });
    }
    for (const i of invoices) {
      if (i.status === 'archive') continue;
      const days = daysFromToday(i.expire);
      if (days === null) continue;
      const level = days < 0 ? 'danger' : days === 0 ? 'orange' : days <= 7 ? 'yellow' : null;
      if (level) events.push({ level, src: '票据台账', title: `${i.inv_type} ${i.inv_no || ''} ${i.counterparty || ''}`.trim() || '票据', date: i.expire, days });
    }
    for (const f of openFunds) {
      const days = daysFromToday(f.deadline);
      if (days === null) continue;
      const level = days < 0 ? 'danger' : days === 0 ? 'orange' : days <= 7 ? 'yellow' : null;
      if (level) events.push({ level, src: '往来资金', title: `${f.fund_type === 'receivable' ? '应收' : '应付'}｜${f.party}`, date: f.deadline, days });
    }
    events.sort((a, b) => {
      const lv = { danger: 0, orange: 1, yellow: 2 };
      return lv[a.level] - lv[b.level] || a.days - b.days;
    });

    const dangerCount = events.filter((e) => e.level === 'danger').length;
    const nearCount = events.filter((e) => e.level !== 'danger').length;

    return sendJson(res, 200, {
      ok: true,
      generatedAt: new Date().toISOString(),
      kpis: {
        taskTotal, taskDone, taskRate,
        receivableTotal, payableTotal,
        taxPending, overdueTax, taxCountdown,
        checkinTotal: checkins.length, checkinStreak: streak,
        studyMinutes, studyCount: studies.length,
        monthCloseStatus,
        todoTotal, todoDone, knowledgeTotal,
        dangerCount, nearCount, eventTotal: events.length,
      },
      series: {
        taskTrend, taskByStatus, taskByCategory,
        invoiceTrend, invoiceByType,
        fundAging, studyByChapter,
        checkinGrid, checkinTotal: checkins.length,
      },
      lists: { events, recentCount: 8 },
    });
  } catch (err) {
    return sendError(res, err);
  }
};
