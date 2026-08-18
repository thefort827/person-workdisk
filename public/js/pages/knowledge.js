import { createCrudPage } from '../crud.js';
import { esc } from '../ui.js';

const TAGS = [
  { value: 'entry', label: '分录' },
  { value: 'tax', label: '税务' },
  { value: 'sys', label: '系统操作' },
  { value: 'excel', label: 'Excel 技巧' },
  { value: 'other', label: '其他' },
];
const tagMap = Object.fromEntries(TAGS.map((o) => [o.value, o.label]));

export const knowledgePage = createCrudPage({
  id: 'knowledge',
  title: '财务知识库',
  subtitle: '分录模板 · 税务政策 · 系统技巧',
  icon: '📚',
  entity: 'knowledge',
  formTitle: '保存知识库条目',
  addText: '保存知识库条目',
  fields: [
    { name: 'title', label: '标题', type: 'text', placeholder: '条目标题', span: 3 },
    { name: 'tag', label: '分类', type: 'select', options: TAGS },
    { name: 'body', label: '内容', type: 'textarea', placeholder: '分录模板｜税务政策｜系统报错｜Excel 技巧…', required: true, span: 4 },
  ],
  defaultValues: { tag: 'entry' },
  requiredFields: ['body'],
  searchFields: ['title', 'body'],
  filters: [
    { type: 'select', label: '分类', param: 'tag', options: TAGS, matches: (r, v) => r.tag === v },
  ],
  sort: (rows) => rows.slice().sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')),
  rowRenderer: (row) => ({
    main: `<strong>${esc(row.title || '无标题')}</strong>`,
    sub: `🕐 ${row.created_at ? new Date(row.created_at).toLocaleString() : ''}`,
    tags: [{ cls: `tag-${row.tag}`, text: tagMap[row.tag] || row.tag || '其他' }],
    body: esc(row.body),
  }),
  emptyText: '知识库为空，记录第一条经验吧',
  emptyIcon: '📚',
});
