import { createCrudPage } from '../crud.js';
import { esc, toast, openModal, confirmDialog, emptyState } from '../ui.js';
import { fetchEntity, addRow, updateRow, removeRow } from '../store.js';

// CPA科目定义
const SUBJECTS = [
  { value: 'accounting', label: '会计', color: '#5870f0' },
  { value: 'auditing', label: '审计', color: '#34ce94' },
  { value: 'tax', label: '税法', color: '#ff9b42' },
  { value: 'economic', label: '经济法', color: '#ff5464' },
  { value: 'financial', label: '财务成本管理', color: '#b294ff' },
  { value: 'strategy', label: '公司战略与风险管理', color: '#5fd9d3' },
];

// 学习状态定义
const MASTERY_LEVELS = [
  { value: 'learning', label: '学习中', color: '#ff9b42' },
  { value: 'reviewing', label: '复习中', color: '#f7d046' },
  { value: 'mastered', label: '已掌握', color: '#34ce94' },
];

// 难度等级
const DIFFICULTY_LEVELS = [
  { value: 1, label: '★☆☆☆☆' },
  { value: 2, label: '★★☆☆☆' },
  { value: 3, label: '★★★☆☆' },
  { value: 4, label: '★★★★☆' },
  { value: 5, label: '★★★★★' },
];

/**
 * 获取科目颜色
 */
function getSubjectColor(subject) {
  const s = SUBJECTS.find(s => s.value === subject);
  return s ? s.color : '#989cb3';
}

/**
 * 获取科目标签
 */
function getSubjectLabel(subject) {
  const s = SUBJECTS.find(s => s.value === subject);
  return s ? s.label : '未分类';
}

/**
 * 获取掌握程度标签
 */
function getMasteryLabel(mastery) {
  const m = MASTERY_LEVELS.find(m => m.value === mastery);
  return m ? m.label : '学习中';
}

/**
 * 获取难度标签
 */
function getDifficultyLabel(difficulty) {
  const d = DIFFICULTY_LEVELS.find(d => d.value === difficulty);
  return d ? d.label : '★★★☆☆';
}

/**
 * 计算学习统计数据
 */
function calculateStats(rows) {
  const stats = {
    totalMinutes: 0,
    totalCount: 0,
    bySubject: {},
    byMastery: { learning: 0, reviewing: 0, mastered: 0 },
    recentDays: {},
  };

  rows.forEach(row => {
    const minutes = Number(row.minutes) || 0;
    stats.totalMinutes += minutes;
    stats.totalCount++;

    // 按科目统计
    const subject = row.subject || 'other';
    if (!stats.bySubject[subject]) {
      stats.bySubject[subject] = { minutes: 0, count: 0 };
    }
    stats.bySubject[subject].minutes += minutes;
    stats.bySubject[subject].count++;

    // 按掌握程度统计
    const mastery = row.mastery || 'learning';
    stats.byMastery[mastery] = (stats.byMastery[mastery] || 0) + 1;

    // 按日期统计（最近7天）
    if (row.created_at) {
      const date = new Date(row.created_at).toISOString().split('T')[0];
      if (!stats.recentDays[date]) {
        stats.recentDays[date] = 0;
      }
      stats.recentDays[date] += minutes;
    }
  });

  return stats;
}

/**
 * 渲染学习统计面板
 */
function renderStatsPanel(rows) {
  const stats = calculateStats(rows);
  const hours = Math.floor(stats.totalMinutes / 60);
  const minutes = stats.totalMinutes % 60;

  return `
    <div class="stats-panel">
      <div class="stat-card">
        <div class="stat-icon">⏱️</div>
        <div class="stat-content">
          <div class="stat-value">${hours}小时${minutes}分钟</div>
          <div class="stat-label">总学习时长</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📝</div>
        <div class="stat-content">
          <div class="stat-value">${stats.totalCount}</div>
          <div class="stat-label">学习记录</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">✅</div>
        <div class="stat-content">
          <div class="stat-value">${stats.byMastery.mastered || 0}</div>
          <div class="stat-label">已掌握</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📚</div>
        <div class="stat-content">
          <div class="stat-value">${Object.keys(stats.bySubject).length}</div>
          <div class="stat-label">学习科目</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * 渲染科目进度
 */
function renderSubjectProgress(rows) {
  const stats = calculateStats(rows);
  const totalMinutes = stats.totalMinutes || 1;

  const subjectBars = SUBJECTS.map(subject => {
    const subjectStats = stats.bySubject[subject.value] || { minutes: 0 };
    const percentage = Math.round((subjectStats.minutes / totalMinutes) * 100);
    return `
      <div class="subject-progress-item">
        <div class="subject-info">
          <span class="subject-dot" style="background:${subject.color}"></span>
          <span class="subject-name">${subject.label}</span>
          <span class="subject-minutes">${subjectStats.minutes}分钟</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${percentage}%;background:${subject.color}"></div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="subject-progress-panel">
      <h4>科目学习进度</h4>
      ${subjectBars}
    </div>
  `;
}

/**
 * 渲染掌握程度分布
 */
function renderMasteryDistribution(rows) {
  const stats = calculateStats(rows);
  const total = stats.totalCount || 1;

  return `
    <div class="mastery-panel">
      <h4>掌握程度分布</h4>
      <div class="mastery-chart">
        ${MASTERY_LEVELS.map(level => {
          const count = stats.byMastery[level.value] || 0;
          const percentage = Math.round((count / total) * 100);
          return `
            <div class="mastery-item">
              <div class="mastery-label">${level.label}</div>
              <div class="mastery-bar">
                <div class="mastery-fill" style="width:${percentage}%;background:${level.color}"></div>
              </div>
              <div class="mastery-count">${count}条 (${percentage}%)</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// 创建增强版的CPA备考系统页面
export const studyPage = createCrudPage({
  id: 'study',
  title: 'CPA 备考系统',
  subtitle: '学习记录 · 时长统计 · 进度跟踪',
  icon: '📖',
  entity: 'study',
  formTitle: '新增学习记录',
  addText: '保存学习记录',
  fields: [
    { 
      name: 'subject', 
      label: '科目', 
      type: 'select', 
      options: SUBJECTS.map(s => ({ value: s.value, label: s.label })),
      span: 1 
    },
    { 
      name: 'chapter', 
      label: '学习章节', 
      type: 'text', 
      placeholder: '例如：存货、审计计划', 
      span: 2 
    },
    { 
      name: 'minutes', 
      label: '学习时长（分钟）', 
      type: 'number', 
      placeholder: '0',
      span: 1 
    },
    { 
      name: 'difficulty', 
      label: '难度', 
      type: 'select', 
      options: DIFFICULTY_LEVELS.map(d => ({ value: d.value, label: d.label })),
      span: 1 
    },
    { 
      name: 'mastery', 
      label: '掌握程度', 
      type: 'select', 
      options: MASTERY_LEVELS.map(m => ({ value: m.value, label: m.label })),
      span: 1 
    },
    { 
      name: 'note', 
      label: '错题 / 知识点 / 心得', 
      type: 'textarea', 
      span: 4 
    },
  ],
  defaultValues: { 
    minutes: 0, 
    difficulty: 3, 
    mastery: 'learning',
    subject: 'accounting'
  },
  filters: [
    {
      param: 'subject',
      label: '科目',
      type: 'select',
      options: SUBJECTS.map(s => ({ value: s.value, label: s.label })),
      matches: (row, val) => row.subject === val,
    },
    {
      param: 'mastery',
      label: '掌握程度',
      type: 'select',
      options: MASTERY_LEVELS.map(m => ({ value: m.value, label: m.label })),
      matches: (row, val) => row.mastery === val,
    },
  ],
  searchFields: ['chapter', 'note', 'subject'],
  sort: (rows) => rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
  rowRenderer: (row) => ({
    main: `
      <div class="study-row-main">
        <span class="subject-tag" style="background:${getSubjectColor(row.subject)}20;color:${getSubjectColor(row.subject)}">
          ${getSubjectLabel(row.subject)}
        </span>
        <strong>${esc(row.chapter || '未填写章节')}</strong>
        <span class="difficulty">${getDifficultyLabel(row.difficulty)}</span>
      </div>
    `,
    sub: `
      <div class="study-row-sub">
        <span>⏱ ${Number(row.minutes) || 0} 分钟</span>
        <span class="mastery-tag" style="background:${MASTERY_LEVELS.find(m => m.value === row.mastery)?.color || '#989cb3'}20;color:${MASTERY_LEVELS.find(m => m.value === row.mastery)?.color || '#989cb3'}">
          ${getMasteryLabel(row.mastery)}
        </span>
        <span>🕐 ${row.created_at ? new Date(row.created_at).toLocaleString() : ''}</span>
      </div>
    `,
    body: row.note ? `<div class="study-note">${esc(row.note)}</div>` : '',
    tags: [
      { text: getSubjectLabel(row.subject), cls: 'tag-subject' },
      { text: getMasteryLabel(row.mastery), cls: 'tag-mastery' },
    ],
  }),
  emptyText: '暂无学习记录，开始你的CPA备考之旅吧！',
  emptyIcon: '📖',
  // 自定义渲染：在列表前添加统计面板
  render: async (container) => {
    // 先调用原始render
    await studyPage._originalRender(container);
    
    // 添加统计面板
    try {
      const rows = await fetchEntity('study', { force: true, order: 'created_at.desc' });
      const listWrap = container.querySelector('#crud-list');
      if (listWrap && rows.length > 0) {
        const statsHtml = `
          <div class="cpa-stats-container">
            ${renderStatsPanel(rows)}
            <div class="stats-row">
              ${renderSubjectProgress(rows)}
              ${renderMasteryDistribution(rows)}
            </div>
          </div>
        `;
        listWrap.insertAdjacentHTML('beforebegin', statsHtml);
      }
    } catch (err) {
      console.error('Failed to load study stats:', err);
    }
  },
});