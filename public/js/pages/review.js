import { createCrudPage } from '../crud.js';
import { esc, monthKeyOf, todayStr } from '../ui.js';

export const weekreviewPage = createCrudPage({
  id: 'weekreview',
  title: '周复盘',
  subtitle: '本周收获 · 问题 · 下周计划',
  icon: '📝',
  entity: 'weekreview',
  formTitle: '保存周复盘',
  addText: '保存周复盘',
  fields: [
    { name: 'week_label', label: '周次标签', type: 'text', placeholder: '例如：2025-W13 / 本周' },
    { name: 'content', label: '本周收获、问题、下周计划', type: 'textarea', placeholder: '本周收获：…\n本周问题：…\n下周计划：…', required: true, span: 4 },
  ],
  defaultValues: { week_label: '本周' },
  requiredFields: ['content'],
  searchFields: ['content'],
  sort: (rows) => rows.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')),
  rowRenderer: (row) => ({
    main: `<strong>${esc(row.week_label || '未命名周')}</strong>`,
    sub: `🕐 ${row.created_at ? new Date(row.created_at).toLocaleString() : ''}`,
    body: esc(row.content),
  }),
  emptyText: '本周还没有复盘，写点什么吧',
  emptyIcon: '📝',
});

export const monthreviewPage = createCrudPage({
  id: 'monthreview',
  title: '月复盘',
  subtitle: '月度总结 · 踩坑记录 · 下月规划',
  icon: '🗓',
  entity: 'monthreview',
  formTitle: '保存月复盘',
  addText: '保存月复盘',
  fields: [
    { name: 'month_label', label: '月份标签', type: 'text', placeholder: '例如：2025-04' },
    { name: 'content', label: '月度总结 / 踩坑记录 / 下月规划', type: 'textarea', placeholder: '月度总结：…\n踩坑记录：…\n下月规划：…', required: true, span: 4 },
  ],
  defaultValues: { month_label: monthKeyOf(new Date()) },
  requiredFields: ['content'],
  searchFields: ['content'],
  sort: (rows) => rows.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')),
  rowRenderer: (row) => ({
    main: `<strong>${esc(row.month_label || '未命名月份')}</strong>`,
    sub: `🕐 ${row.created_at ? new Date(row.created_at).toLocaleString() : ''}`,
    body: esc(row.content),
  }),
  emptyText: '本月还没有复盘',
  emptyIcon: '🗓',
});
