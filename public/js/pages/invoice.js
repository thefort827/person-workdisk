import { createCrudPage } from '../crud.js';
import { esc, fmtMoney, daysFromToday, toast } from '../ui.js';
import { updateRow } from '../store.js';

const TYPES = [
  { value: 'input', label: '进项发票' },
  { value: 'output', label: '销项发票' },
  { value: 'expense', label: '费用报销' },
  { value: 'accept', label: '承兑汇票' },
];
const STATUS = [
  { value: 'wait', label: '待收票' },
  { value: 'auth', label: '已认证' },
  { value: 'entry', label: '已入账' },
  { value: 'archive', label: '已归档' },
];
const tMap = Object.fromEntries(TYPES.map((o) => [o.value, o.label]));
const sMap = Object.fromEntries(STATUS.map((o) => [o.value, o.label]));

export const invoicePage = createCrudPage({
  id: 'invoice',
  title: '票据台账',
  subtitle: '票据全生命周期管理',
  icon: '🧾',
  entity: 'invoice',
  formTitle: '新增票据记录',
  addText: '新增票据记录',
  fields: [
    { name: 'inv_type', label: '票据类型', type: 'select', options: TYPES },
    { name: 'inv_no', label: '发票号码', type: 'text', placeholder: '发票号 / 票据号' },
    { name: 'counterparty', label: '对方单位', type: 'text', placeholder: '开票方 / 收票方' },
    { name: 'inv_date', label: '票据日期', type: 'date' },
    { name: 'expire', label: '到期日', type: 'date' },
    { name: 'amount', label: '金额', type: 'number', placeholder: '0.00' },
    { name: 'status', label: '状态', type: 'select', options: STATUS },
    { name: 'note', label: '备注', type: 'textarea', span: 4 },
  ],
  defaultValues: { inv_type: 'input', status: 'wait' },
  searchFields: ['inv_no', 'counterparty', 'note'],
  filters: [
    { type: 'select', label: '类型', param: 'inv_type', options: TYPES, matches: (r, v) => r.inv_type === v },
    { type: 'select', label: '状态', param: 'status', options: STATUS, matches: (r, v) => r.status === v },
  ],
  sort: (rows) => rows.slice().sort((a, b) => {
    const aO = a.status !== 'archive' && daysFromToday(a.expire) !== null && daysFromToday(a.expire) < 0;
    const bO = b.status !== 'archive' && daysFromToday(b.expire) !== null && daysFromToday(b.expire) < 0;
    if (aO !== bO) return aO ? -1 : 1;
    return (b.expire || '').localeCompare(a.expire || '');
  }),
  rowRenderer: (row) => {
    const days = daysFromToday(row.expire);
    const overdue = row.status !== 'archive' && days !== null && days < 0;
    return {
      overdue,
      main: `<strong>${esc(tMap[row.inv_type] || row.inv_type)}</strong>　金额 <span class="num-mono bold">¥ ${fmtMoney(row.amount)}</span>`,
      sub: `${row.inv_no ? `号码：${esc(row.inv_no)}` : ''}${row.counterparty ? `　对方：${esc(row.counterparty)}` : ''}`,
      meta: `票据日期：${row.inv_date || '—'}　到期：${row.expire || '—'}${days !== null && days < 0 ? '（已到期）' : days === 0 ? '（今天到期）' : ''}`,
      tags: [
        { cls: `tag-${row.inv_type}`, text: tMap[row.inv_type] || row.inv_type },
        { cls: `tag-${row.status}`, text: sMap[row.status] || row.status },
        ...(overdue ? [{ cls: 'tag-overdue', text: '⚠️ 到期提醒' }] : []),
      ],
      body: row.note ? esc(row.note) : '',
    };
  },
  itemActions: [
    { key: 'to-archive', label: '🗄 归档', cls: 'btn-outline', when: (r) => r.status !== 'archive', run: async (row, ctx) => {
      await updateRow('invoice', row.id, { status: 'archive' });
      toast('已归档', 'success');
      await ctx.refresh();
    } },
  ],
  emptyText: '暂无票据记录，点击上方新增',
  emptyIcon: '🧾',
});
