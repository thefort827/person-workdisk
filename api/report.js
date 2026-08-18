'use strict';

/**
 * /api/report?from=YYYY-MM-DD&to=YYYY-MM-DD —— 报表中心聚合数据
 */

const { listAll } = require('./_lib/supabase');
const { sendJson, sendError, checkAuth, parseQuery } = require('./_lib/respond');

const DAY = 24 * 3600 * 1000;

function parseDay(s) {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function round2(v) {
  return Math.round(v * 100) / 100;
}

module.exports = async function handler(req, res) {
  try {
    if (!checkAuth(req)) return sendJson(res, 401, { ok: false, error: '访问口令不正确', code: 'AUTH' });

    const q = parseQuery(req.url.split('?')[1]);
    const from = parseDay(q.from);
    const to = parseDay(q.to) || new Date();
    if (!from) return sendJson(res, 400, { ok: false, error: '缺少 from 参数（YYYY-MM-DD）', code: 'BAD_REQ' });
    if (to < from) return sendJson(res, 400, { ok: false, error: 'to 不能早于 from', code: 'BAD_REQ' });
    const inRange = (d) => d && d >= from && d <= to;

    const [tasks, invoices, funds, taxRecords] = await Promise.all([
      listAll('fintodo'),
      listAll('invoice'),
      listAll('fund'),
      listAll('tax'),
    ]);

    /* ---- 区间内统计 ---- */
    const invInRange = invoices.filter((i) => inRange(parseDay(i.inv_date)));
    const invAmountTotal = round2(invInRange.reduce((s, i) => s + toNum(i.amount), 0));
    const invByType = ['input', 'output', 'expense', 'accept'].map((t) => {
      const list = invInRange.filter((i) => i.inv_type === t);
      return { type: t, amount: round2(list.reduce((s, i) => s + toNum(i.amount), 0)), count: list.length };
    });

    const fundDueInRange = funds.filter((f) => f.status !== 'cleared' && inRange(parseDay(f.deadline)));
    const receivableDue = round2(fundDueInRange.filter((f) => f.fund_type === 'receivable').reduce((s, f) => s + toNum(f.amount), 0));
    const payableDue = round2(fundDueInRange.filter((f) => f.fund_type === 'payable').reduce((s, f) => s + toNum(f.amount), 0));

    const taskDoneInRange = tasks.filter((t) => {
      if (t.status !== 'done') return false;
      return inRange(parseDay(t.done_at) || parseDay(t.updated_at));
    });
    const taskCreatedInRange = tasks.filter((t) => inRange(parseDay(t.created_at)));

    // 按月度汇总（区间内）
    const monthMap = new Map();
    for (const i of invInRange) {
      const mk = monthKey(parseDay(i.inv_date));
      const e = monthMap.get(mk) || { month: mk, invAmount: 0, invCount: 0, doneCount: 0, receivable: 0, payable: 0 };
      e.invAmount = round2(e.invAmount + toNum(i.amount));
      e.invCount++;
      monthMap.set(mk, e);
    }
    for (const t of taskDoneInRange) {
      const mk = monthKey(parseDay(t.done_at) || parseDay(t.updated_at));
      const e = monthMap.get(mk) || { month: mk, invAmount: 0, invCount: 0, doneCount: 0, receivable: 0, payable: 0 };
      e.doneCount++;
      monthMap.set(mk, e);
    }
    for (const f of fundDueInRange) {
      const mk = monthKey(parseDay(f.deadline));
      const e = monthMap.get(mk) || { month: mk, invAmount: 0, invCount: 0, doneCount: 0, receivable: 0, payable: 0 };
      if (f.fund_type === 'receivable') e.receivable = round2(e.receivable + toNum(f.amount));
      else e.payable = round2(e.payable + toNum(f.amount));
      monthMap.set(mk, e);
    }
    const monthly = [...monthMap.values()].sort((a, b) => (a.month < b.month ? -1 : 1));

    // 应收 / 应付 对方 TOP（按金额）
    function topParties(list, n = 5) {
      const m = new Map();
      for (const f of list) {
        const k = (f.party || '未知').trim();
        m.set(k, (m.get(k) || 0) + toNum(f.amount));
      }
      return [...m.entries()].map(([party, amount]) => ({ party, amount: round2(amount) }))
        .sort((a, b) => b.amount - a.amount).slice(0, n);
    }
    const topReceivable = topParties(funds.filter((f) => f.fund_type === 'receivable' && f.status !== 'cleared'));
    const topPayable = topParties(funds.filter((f) => f.fund_type === 'payable' && f.status !== 'cleared'));

    return sendJson(res, 200, {
      ok: true,
      range: { from: q.from, to: dayStr2(to) },
      kpis: {
        invAmountTotal, invCount: invInRange.length,
        receivableDue, payableDue,
        taskDone: taskDoneInRange.length,
        taskCreated: taskCreatedInRange.length,
        taxDue: taxRecords.filter((t) => t.status !== 'done' && inRange(parseDay(t.deadline))).length,
      },
      monthly,
      invByType,
      topReceivable,
      topPayable,
    });
  } catch (err) {
    return sendError(res, err);
  }
};

function dayStr2(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
