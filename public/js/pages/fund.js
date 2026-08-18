import { createCrudPage } from '../crud.js';
import { esc, fmtMoney, daysFromToday, toast } from '../ui.js';
import { updateRow } from '../store.js';

const TYPES = [
  { value: 'receivable', label: '应收' },
  { value: 'payable', label: '应付' },
];
const STATUS = [
  { value: 'open', label: '未清' },
  { value: 'cleared', label: '已清' },
];
const tMap = Object.fromEntries(TYPES.map((o) => [o.value, o.label]));
const sMap = Object.fromEntries(STATUS.map((o) => [o.value, o.label]));

export const fundPage = createCrudPage({
  id: 'fund',
  title: '往来资金',
  subtitle: '应收应付风险预警 · 账龄跟踪',
  icon: '💰',
  entity: 'fund',
  formTitle: '新增往来记录',
  addText: '新增往来记录',
  fields: [
    { name: 'fund_type', label: '类型', type: 'select', options: TYPES },
    { name: 'party', label: '客户 / 供应商', type: 'text', placeholder: '对方名称', required: true },
    { name: 'amount', label: '金额', type: 'number', placeholder: '0.00' },
    { name: 'deadline', label: '到期日', type: 'date' },
    { name: 'status', label: '状态', type: 'select', options: STATUS },
    { name: 'note', label: '备注', type: 'textarea', span: 4 },
  ],
  defaultValues: { fund_type: 'receivable', status: 'open' },
  requiredFields: ['party'],
  searchFields: ['party', 'note'],
  filters: [
    { type: 'select', label: '类型', param: 'fund_type', options: TYPES, matches: (r, v) => r.fund_type === v },
    { type: 'select', label: '状态', param: 'status', options: STATUS, matches: (r, v) => r.status === v },
  ],
  sort: (rows) => rows.slice().sort((a, b) => {
    const aO = a.status !== 'cleared' && daysFromToday(a.deadline) !== null && daysFromToday(a.deadline) < 0;
    const bO = b.status !== 'cleared' && daysFromToday(b.deadline) !== null && daysFromToday(b.deadline) < 0;
    if (aO !== bO) return aO ? -1 : 1;
    if ((a.status === 'cleared') !== (b.status === 'cleared')) return a.status === 'cleared' ? 1 : -1;
    return (b.deadline || '').localeCompare(a.deadline || '');
  }),
  rowRenderer: (row) => {
    const days = daysFromToday(row.deadline);
    const overdue = row.status !== 'cleared' && days !== null && days < 0;
    const isRec = row.fund_type === 'receivable';
    return {
      overdue,
      main: `<span class="tag ${isRec ? 'tag-receivable' : 'tag-payable'}">${esc(tMap[row.fund_type])}</span>　<strong>${esc(row.party)}</strong>　<span class="num-mono bold">¥ ${fmtMoney(row.amount)}</span>`,
      sub: `到期：${row.deadline || '未设置'}${days !== null ? (days < 0 ? `（已逾期 ${-days} 天）` : days === 0 ? '（今天到期）' : `（还剩 ${days} 天）`) : ''}`,
      meta: `创建：${row.created_at ? new Date(row.created_at).toLocaleString() : '—'}`,
      tags: [
        { cls: `tag-${row.status}`, text: sMap[row.status] || row.status },
        ...(overdue ? [{ cls: 'tag-overdue', text: '⚠️ 逾期风险' }] : []),
      ],
      body: row.note ? esc(row.note) : '',
    };
  },
  itemActions: [
    { key: 'clear', label: '✔ 标记已清', cls: 'btn-success', when: (r) => r.status !== 'cleared', run: async (row, ctx) => {
      await updateRow('fund', row.id, { status: 'cleared' });
      toast('已标记为已清', 'success');
      await ctx.refresh();
    } },
    { key: 'reopen', label: '重新打开', cls: 'btn-outline', when: (r) => r.status === 'cleared', run: async (row, ctx) => {
      await updateRow('fund', row.id, { status: 'open' });
      toast('已重新打开', 'success');
      await ctx.refresh();
    } },
  ],
  emptyText: '暂无往来记录，点击上方新增',
  emptyIcon: '💰',
});
