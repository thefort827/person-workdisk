import { createCrudPage } from '../crud.js';
import { esc } from '../ui.js';

export const studyPage = createCrudPage({
  id: 'study',
  title: 'CPA 备考系统',
  subtitle: '学习记录 · 时长统计',
  icon: '📖',
  entity: 'study',
  formTitle: '新增学习记录',
  addText: '保存学习记录',
  fields: [
    { name: 'chapter', label: '学习章节', type: 'text', placeholder: '例如：会计-存货', span: 2 },
    { name: 'minutes', label: '学习时长（分钟）', type: 'number', placeholder: '0' },
    { name: 'note', label: '错题 / 知识点 / 心得', type: 'textarea', span: 4 },
  ],
  defaultValues: { minutes: 0 },
  searchFields: ['chapter', 'note'],
  rowRenderer: (row) => ({
    main: `<strong>${esc(row.chapter || '未填写章节')}</strong>`,
    sub: `⏱ 学习 ${Number(row.minutes) || 0} 分钟　🕐 ${row.created_at ? new Date(row.created_at).toLocaleString() : ''}`,
    body: row.note ? esc(row.note) : '',
  }),
  emptyText: '暂无学习记录，加油！',
  emptyIcon: '📖',
});
