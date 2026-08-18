import { createCrudPage } from '../crud.js';
import { esc, daysFromToday, fmtDate, toast } from '../ui.js';
import { updateRow } from '../store.js';

const PRIORITY = [
  { value: 'high', label: '高优先级' },
  { value: 'mid', label: '中优先级' },
  { value: 'low', label: '低优先级' },
];
const CATEGORY = [
  { value: 'tax', label: '税务' },
  { value: 'receivable', label: '应收' },
  { value: 'payable', label: '应付' },
  { value: 'cost', label: '成本' },
  { value: 'close', label: '月末结账' },
];
const STATUS = [
  { value: 'pending', label: '待处理' },
  { value: 'processing', label: '处理中' },
  { value: 'review', label: '待复核' },
  { value: 'done', label: '已完成' },
];
const catMap = Object.fromEntries(CATEGORY.map((o) => [o.value, o.label]));
const stMap = Object.fromEntries(STATUS.map((o) => [o.value, o.label]));

export const fintodoPage = createCrudPage({
  id: 'fintodo',
  title: '财务专项待办',
  subtitle: '状态机管理 · 优先级与分类',
  icon: '📋',
  entity: 'fintodo',
  formTitle: '新增财务专项任务',
  addText: '新增财务专项任务',
  fields: [
    { name: 'name', label: '任务名称', type: 'text', placeholder: '例如：应收账款对账', required: true, span: 2 },
    { name: 'deadline', label: '截止日期', type: 'date' },
    { name: 'priority', label: '优先级', type: 'select', options: PRIORITY },
    { name: 'category', label: '分类', type: 'select', options: CATEGORY },
    { name: 'note', label: '任务说明 / 备注', type: 'textarea', span: 4 },
  ],
  defaultValues: { priority: 'mid', category: 'tax', status: 'pending' },
  requiredFields: ['name'],
  searchFields: ['name', 'note'],
  filters: [
    { type: 'select', label: '状态', param: 'status', options: STATUS, matches: (r, v) => r.status === v },
    { type: 'select', label: '分类', param: 'category', options: CATEGORY, matches: (r, v) => r.category === v },
    { type: 'select', label: '优先级', param: 'priority', options: PRIORITY, matches: (r, v) => r.priority === v },
  ],
  sort: (rows) => {
    const lv = { danger: 0, warn: 1, normal: 2, done: 3 };
    return rows.slice().sort((a, b) => {
      const aOver = a.status !== 'done' && daysFromToday(a.deadline) !== null && daysFromToday(a.deadline) < 0;
      const bOver = b.status !== 'done' && daysFromToday(b.deadline) !== null && daysFromToday(b.deadline) < 0;
      if (aOver !== bOver) return aOver ? -1 : 1;
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (a.status !== 'done' && b.status === 'done') return -1;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
  },
  rowRenderer: (row) => {
    const days = daysFromToday(row.deadline);
    const overdue = row.status !== 'done' && days !== null && days < 0;
    const dueText = row.deadline
      ? `${fmtDate(row.deadline)}${days === null ? '' : days < 0 ? `（已逾期 ${-days} 天）` : days === 0 ? '（今天截止）' : `（还剩 ${days} 天）`}`
      : '未设置截止日期';
    return {
      overdue,
      main: `${esc(row.name)}`,
      sub: `⏰ ${dueText}`,
      tags: [
        { cls: `tag-${row.priority}`, text: PRIORITY.find((o) => o.value === row.priority)?.label || row.priority },
        { cls: `tag-${row.category}`, text: catMap[row.category] || row.category },
        { cls: row.status === 'done' ? 'tag-done' : row.status === 'processing' ? 'tag-processing' : row.status === 'review' ? 'tag-review' : 'tag-pending', text: stMap[row.status] || row.status },
        ...(overdue ? [{ cls: 'tag-overdue', text: '⚠️ 已逾期' }] : []),
      ],
      body: row.note ? esc(row.note) : '',
      meta: `创建：${row.created_at ? new Date(row.created_at).toLocaleString() : '—'}`,
    };
  },
  itemActions: [
    { key: 'st-pending', label: '待处理', cls: 'btn-outline', when: (r) => r.status !== 'pending' && r.status !== 'done', run: (row, ctx) => applyStatus(row, 'pending', ctx) },
    { key: 'st-proc', label: '处理中', cls: 'btn-outline', when: (r) => r.status !== 'processing' && r.status !== 'done', run: (row, ctx) => applyStatus(row, 'processing', ctx) },
    { key: 'st-review', label: '待复核', cls: 'btn-outline', when: (r) => r.status !== 'review' && r.status !== 'done', run: (row, ctx) => applyStatus(row, 'review', ctx) },
    { key: 'st-done', label: '✔ 完成', cls: 'btn-success', when: (r) => r.status !== 'done', run: (row, ctx) => applyStatus(row, 'done', ctx) },
  ],
  emptyText: '暂无财务专项任务，点击上方新增',
  emptyIcon: '📋',
});

async function applyStatus(row, status, ctx) {
  try {
    await updateRow('fintodo', row.id, { status, done_at: status === 'done' ? new Date().toISOString() : null });
    toast(status === 'done' ? '🎉 任务已完成' : `状态已更新为「${status}」`, 'success');
    if (ctx && ctx.refresh) await ctx.refresh();
  } catch (err) {
    toast(err.message, 'error');
  }
}
