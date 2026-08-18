import { createCrudPage } from '../crud.js';
import { esc, daysFromToday, fmtDate, toast } from '../ui.js';
import { updateRow } from '../store.js';

const STATUS = [
  { value: 'pending', label: '待申报' },
  { value: 'done', label: '已申报' },
];
const sMap = Object.fromEntries(STATUS.map((o) => [o.value, o.label]));

export const taxPage = createCrudPage({
  id: 'tax',
  title: '税务管理',
  subtitle: '申报事项与截止日期跟踪',
  icon: '📑',
  entity: 'tax',
  formTitle: '新增税务记录',
  addText: '新增税务记录',
  fields: [
    { name: 'title', label: '税务事项标题', type: 'text', placeholder: '例如：增值税及附加申报', required: true, span: 2 },
    { name: 'deadline', label: '申报截止日期', type: 'date' },
    { name: 'status', label: '状态', type: 'select', options: STATUS },
    { name: 'note', label: '申报记录 / 风险点 / 备注', type: 'textarea', span: 4 },
  ],
  defaultValues: { status: 'pending' },
  requiredFields: ['title'],
  searchFields: ['title', 'note'],
  filters: [
    { type: 'select', label: '状态', param: 'status', options: STATUS, matches: (r, v) => r.status === v },
  ],
  sort: (rows) => rows.slice().sort((a, b) => {
    const aO = a.status !== 'done' && daysFromToday(a.deadline) !== null && daysFromToday(a.deadline) < 0;
    const bO = b.status !== 'done' && daysFromToday(b.deadline) !== null && daysFromToday(b.deadline) < 0;
    if (aO !== bO) return aO ? -1 : 1;
    if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1;
    return (b.deadline || '').localeCompare(a.deadline || '');
  }),
  rowRenderer: (row) => {
    const days = daysFromToday(row.deadline);
    const overdue = row.status !== 'done' && days !== null && days < 0;
    return {
      overdue,
      main: `<strong>${esc(row.title)}</strong>`,
      sub: `⏰ 截止：${row.deadline ? fmtDate(row.deadline) : '未设置'}${days !== null ? (days < 0 ? `（已逾期 ${-days} 天）` : days === 0 ? '（今天截止）' : `（还剩 ${days} 天）`) : ''}`,
      tags: [
        { cls: `tag-${row.status}`, text: sMap[row.status] || row.status },
        ...(overdue ? [{ cls: 'tag-overdue', text: '⚠️ 已逾期' }] : []),
      ],
      body: row.note ? esc(row.note) : '',
    };
  },
  itemActions: [
    { key: 'done', label: '✔ 标记已申报', cls: 'btn-success', when: (r) => r.status !== 'done', run: async (row, ctx) => {
      await updateRow('tax', row.id, { status: 'done' });
      toast('已标记为已申报', 'success');
      await ctx.refresh();
    } },
    { key: 'reopen', label: '重新打开', cls: 'btn-outline', when: (r) => r.status === 'done', run: async (row, ctx) => {
      await updateRow('tax', row.id, { status: 'pending' });
      toast('已重新打开', 'success');
      await ctx.refresh();
    } },
  ],
  emptyText: '暂无税务记录，点击上方新增',
  emptyIcon: '📑',
});
