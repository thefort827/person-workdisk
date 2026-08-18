/**
 * 数据层：实体缓存、增删改查、看板/报表数据、备份导出导入
 */

import { api } from './api.js';
import { dayStr, dayOffset, monthKeyOf } from './ui.js';

export const ENTITIES = {
  fintodo: { label: '财务专项待办' },
  invoice: { label: '票据台账' },
  fund: { label: '往来资金' },
  monthclose: { label: '月末结账' },
  tax: { label: '税务管理' },
  knowledge: { label: '财务知识库' },
  todo: { label: '日常待办' },
  checkin: { label: '习惯打卡' },
  study: { label: '备考记录' },
  weekreview: { label: '周复盘' },
  monthreview: { label: '月复盘' },
  setting: { label: '系统设置' },
};

/** 所有可导出实体（按固定顺序） */
export const EXPORT_ENTITIES = ['fintodo', 'invoice', 'fund', 'monthclose', 'tax', 'knowledge', 'todo', 'checkin', 'study', 'weekreview', 'monthreview'];

/* ---------- 实体缓存 ---------- */
const cache = new Map(); // entity -> { rows, ts }

export function invalidate(entity) {
  if (entity) cache.delete(entity);
  else cache.clear();
}

export async function fetchEntity(entity, { force = false, order = 'created_at.desc' } = {}) {
  const hit = cache.get(entity);
  if (hit && !force && Date.now() - hit.ts < 30000) return hit.rows;
  const res = await api.list(entity, { order });
  const rows = res.data || [];
  cache.set(entity, { rows, ts: Date.now() });
  return rows;
}

export async function addRow(entity, row) {
  const res = await api.create(entity, row);
  invalidate(entity);
  return res.data;
}

export async function updateRow(entity, id, patch) {
  const res = await api.update(entity, id, patch);
  invalidate(entity);
  return res.data;
}

export async function removeRow(entity, id) {
  await api.remove(entity, id);
  invalidate(entity);
}

/* ---------- 看板 / 报表 ---------- */
export async function loadDashboard(force = false) {
  const res = await api.dashboard();
  return res;
}

export async function loadReport(from, to) {
  return api.report(from, to);
}

/* ---------- 备份：导出 / 导入 ---------- */
export async function exportAllData() {
  const out = { version: 1, exportedAt: new Date().toISOString(), data: {} };
  for (const ent of EXPORT_ENTITIES) {
    const rows = await fetchEntity(ent, { force: true, order: 'created_at.asc' });
    out.data[ent] = rows;
  }
  return out;
}

export async function importAllData(payload) {
  const stats = [];
  for (const ent of EXPORT_ENTITIES) {
    const rows = (payload.data && payload.data[ent]) || payload[ent] || [];
    if (!Array.isArray(rows) || !rows.length) continue;
    const res = await api.importRows(ent, rows);
    stats.push(`${ENTITIES[ent].label} ${res.inserted} 条`);
  }
  invalidate();
  return stats;
}

/** 生成演示数据（用于快速体验 BI 看板） */
export function buildDemoData() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = (offset, mm = m, yy = y) => `${yy}-${String(mm + 1).padStart(2, '0')}-${String(new Date(yy, mm, 1).getDate() + offset).padStart(2, '0')}`;
  const p = (x) => String(x).padStart(2, '0');

  const finTodo = [
    { name: '整理上月进项发票并认证', deadline: d(-2), priority: 'high', category: 'tax', status: 'done', note: '已完成勾选认证', done_at: new Date(y, m, 1).toISOString() },
    { name: '客户A应收款催收', deadline: d(2), priority: 'high', category: 'receivable', status: 'processing', note: '已发送催款函，等待回复' },
    { name: '应付账款对账（供应商B）', deadline: d(5), priority: 'mid', category: 'payable', status: 'pending', note: '' },
    { name: '月度成本分摊表编制', deadline: d(-1), priority: 'mid', category: 'cost', status: 'review', note: '等待部门经理确认' },
    { name: '月末结账前账务检查', deadline: d(8), priority: 'high', category: 'close', status: 'pending', note: '' },
    { name: '企业所得税申报资料整理', deadline: d(4), priority: 'mid', category: 'tax', status: 'pending', note: '' },
    { name: '固定资产折旧计提复核', deadline: d(-3), priority: 'low', category: 'cost', status: 'done', note: '', done_at: new Date(y, m, 2).toISOString() },
  ];
  const invoice = [
    { inv_type: 'input', inv_no: '0112-2201', counterparty: '供应商B', inv_date: d(-20), expire: d(10), amount: 120000, status: 'auth', note: '增值税专用发票' },
    { inv_type: 'input', inv_no: '0112-2202', counterparty: '供应商C', inv_date: d(-15), expire: d(15), amount: 58000, status: 'entry', note: '' },
    { inv_type: 'output', inv_no: '0211-3301', counterparty: '客户A', inv_date: d(-8), expire: d(6), amount: 260000, status: 'auth', note: '已开票' },
    { inv_type: 'expense', inv_no: '', counterparty: '差旅报销', inv_date: d(-3), expire: d(20), amount: 8600, status: 'wait', note: '机票+酒店' },
    { inv_type: 'accept', inv_no: 'BA-8812', counterparty: '客户D', inv_date: d(-30), expire: d(-1), amount: 150000, status: 'entry', note: '承兑汇票已过期提醒' },
    { inv_type: 'input', inv_no: '0112-2205', counterparty: '办公用品', inv_date: d(-2), expire: d(30), amount: 3200, status: 'wait', note: '' },
  ];
  const fund = [
    { fund_type: 'receivable', party: '客户A', amount: 260000, deadline: d(6), status: 'open', note: '合同尾款' },
    { fund_type: 'receivable', party: '客户D', amount: 150000, deadline: d(-1), status: 'open', note: '承兑到期未兑' },
    { fund_type: 'receivable', party: '客户E', amount: 88000, deadline: d(45), status: 'open', note: '' },
    { fund_type: 'payable', party: '供应商B', amount: 120000, deadline: d(10), status: 'open', note: '采购款' },
    { fund_type: 'payable', party: '供应商C', amount: 58000, deadline: d(15), status: 'open', note: '' },
    { fund_type: 'receivable', party: '客户F', amount: 42000, deadline: d(-60), status: 'open', note: '长期挂账，需关注' },
    { fund_type: 'payable', party: '税务局', amount: 35000, deadline: d(13), status: 'open', note: '增值税及附加' },
  ];
  const monthClose = [{ month: monthKeyOf(new Date()), status: 'processing', note: '已完成银行对账，待费用分摊' }];
  const tax = [
    { title: '增值税及附加申报', deadline: d(13), status: 'pending', note: '本月销项 26 万，进项 18.1 万' },
    { title: '个人所得税申报', deadline: d(13), status: 'done', note: '已申报', },
    { title: '企业所得税预缴', deadline: d(20), status: 'pending', note: '季度预缴，注意申报表勾稽' },
  ];
  const knowledge = [
    { title: '增值税专用发票认证时限', body: '自开具之日起 360 日内勾选认证，逾期无法抵扣。', tag: 'tax' },
    { title: '月末结转常用分录', body: '借：主营业务成本 贷：库存商品；借：本年利润 贷：主营业务成本/费用类科目。', tag: 'entry' },
    { title: 'Excel 快速求和技巧', body: 'Alt+= 一键求和；Ctrl+Shift+L 开启筛选；F4 重复上一步操作。', tag: 'excel' },
  ];
  const todo = [
    { text: '打印本月凭证并装订', priority: 'high', done: false },
    { text: '更新资金日报表', priority: 'mid', done: true },
    { text: '整理合同台账', priority: 'low', done: false },
  ];
  const checkins = [];
  for (let i = 0; i < 30; i++) {
    if (i % 4 !== 3) checkins.push({ date: dayStr(dayOffset(now, -i)), note: '' });
  }
  const study = [
    { chapter: '会计-存货', note: '计划成本法例题重做', minutes: 90 },
    { chapter: '审计-审计计划', note: '重要性水平计算', minutes: 120 },
    { chapter: '税法-增值税', note: '进项税额转出专项练习', minutes: 75 },
    { chapter: '财管-财务报表分析', note: '杜邦分析框架', minutes: 60 },
  ];
  const weekReview = [{ content: '完成应收对账；凭证装订进度 60%；下周一前完成费用分摊。', week_label: '本周' }];
  const monthReview = [{ content: '结账流程整体顺畅，进项发票认证及时率有待提高；下月提前 3 天催收票据。', month_label: monthKeyOf(now) }];

  return { fintodo: finTodo, invoice, fund, monthclose: monthClose, tax, knowledge, todo, checkin: checkins, study, weekreview: weekReview, monthreview: monthReview };
}
