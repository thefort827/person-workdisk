/**
 * AI-BA（业财供应链）学习工作台模块
 * 
 * 包含：10周计划、任务勾选、复盘、学习资源、模板仓库、进度BI看板
 */

import { toast, esc, fmtDate } from '../ui.js';
import { fetchEntity, addRow, updateRow, removeRow, loadDashboard } from '../store.js';
import { makeChart, SERIES, PALETTE } from '../charts.js';
import { getToken } from '../api.js';

const ENTITY = 'aiba';

// 10周计划初始化数据
const WEEK_PLANS = [
  { week_num: 1, week_title: '企业大模型基础 + AI-BA项目全景', goal: '听懂术语，掌握B端AI完整项目流程，分清角色', learning_points: ['RAG、Agent、知识库、工作流、大模型幻觉', 'OCR+LLM单据解析、业务评测、RPA+AI', '项目链路：业务调研→痛点收集→AI可行性筛选→口径定义→需求输出→测试→评测→上线', '区分AI-BA / AI产品 / 算法职责边界'] },
  { week_num: 2, week_title: 'SQL基础语法（第1部分）', goal: '掌握基础SQL查询', learning_points: ['SELECT、WHERE、GROUP BY、ORDER BY', 'DISTINCT、COUNT、SUM、AVG', '财务场景：应收逾期查询、订单统计'] },
  { week_num: 3, week_title: 'SQL多表关联（第2部分）', goal: '掌握JOIN和子查询', learning_points: ['LEFT JOIN、INNER JOIN、RIGHT JOIN', '子查询、EXISTS', '模拟核对AI输出结果'] },
  { week_num: 4, week_title: '业务口径治理', goal: '会编写口径字典，理解口径不一致风险', learning_points: ['口径字典7要素：字段名称、业务含义、数据来源、取值范围、计算规则、边界条件、约束禁忌', '复盘应收确认、账期、FOB/DDP贸易条款口径', '报关单字段缺失处理：哪些字段禁止模型猜测'] },
  { week_num: 5, week_title: '业务调研方法', goal: '掌握B端业务调研技巧', learning_points: ['业务调研访谈方法', '区分适合/不适合AI的业财场景', '业务流程图绘制'] },
  { week_num: 6, week_title: 'BRD撰写', goal: '输出业务BRD（非产品PRD）', learning_points: ['BRD四大模块：业务背景、流程、目标、约束', '成功衡量标准（业务层面）', '不写交互原型'] },
  { week_num: 7, week_title: 'AI业务测试用例 + 评测报告', goal: '针对大模型幻觉设计测试', learning_points: ['4类用例：正常、边界、字段缺失、干扰异常', '财务铁律：金额、日期、贸易条款禁止编造', '缺失值输出【未识别】'] },
  { week_num: 8, week_title: 'Dify零代码实战（第1周）', goal: '搭建报关单提取Agent', learning_points: ['熟悉Dify平台', '搭建Agent，导入知识库', '配置防幻觉提示词'] },
  { week_num: 9, week_title: 'Dify实战（第2周）+ 评测', goal: '完成Agent项目并评测', learning_points: ['导入30条样本跑输出', '对照口径字典做业务评测', '输出Demo文档'] },
  { week_num: 10, week_title: '行业调研 + 面试准备', goal: '完成求职物料', learning_points: ['调研：用友BIP AI、金蝶星空AI、实在智能、甄云', '改写简历，突出财务供应链背景+AI-BA实战项目', '高频面试问答准备'] },
];

const LEARNING_RESOURCES = [
  { week_num: 1, title: 'RAG通俗讲解', url: 'https://www.bilibili.com/video/BV1Mm421g7vE', platform: 'B站', description: '理解RAG原理' },
  { week_num: 1, title: '大模型BA是什么', url: 'https://zhuanlan.zhihu.com/p/687174740', platform: '知乎', description: '岗位定位和职责' },
  { week_num: 2, title: 'SQLZoo在线练习', url: 'https://sqlzoo.net/', platform: '其他', description: 'SQL基础练习' },
  { week_num: 2, title: '菜鸟SQL教程', url: 'https://www.runoob.com/sql/sql-tutorial.html', platform: '菜鸟', description: '语法参考' },
  { week_num: 4, title: '口径字典文章', url: 'https://zhuanlan.zhihu.com/p/408213128', platform: '知乎', description: '理解口径治理' },
  { week_num: 5, title: 'BRD怎么写', url: 'https://zhuanlan.zhihu.com/p/143351342', platform: '知乎', description: 'BRD模板' },
  { week_num: 5, title: 'B端业务调研方法', url: 'https://zhuanlan.zhihu.com/p/364242011', platform: '知乎', description: '调研技巧' },
  { week_num: 7, title: '大模型业务测试思路', url: 'https://zhuanlan.zhihu.com/p/701147961', platform: '知乎', description: '测试方法论' },
  { week_num: 8, title: 'Dify官网', url: 'https://dify.ai/', platform: '其他', description: '零代码AI平台' },
  { week_num: 8, title: 'Dify快速上手', url: 'https://www.bilibili.com/video/BV1ku4y1k7tM', platform: 'B站', description: '入门教程' },
];

const TEMPLATES = [
  { name: '业务口径字典', category: '口径字典', content: `# XX项目-业务口径字典

1. 字段名称：
2. 业务含义：
3. 数据来源：
4. 取值范围：
5. 计算/提取规则：
6. 边界条件：
7. 约束&禁忌：（重点：是否允许模型推断，缺失值输出什么）` },
  { name: 'BRD业务需求文档', category: 'BRD文档', content: `# BRD-报关单信息提取项目

1. 业务背景与痛点
2. 当前业务流程
3. AI业务目标
4. 项目边界：【做什么】【坚决不做什么】
5. 业务约束规则（会计准则、报关规则、大模型输出约束）
6. 成功衡量标准（业务层面，不是算法指标）` },
  { name: 'AI业务测试用例', category: '测试用例', content: `用例ID：
用例类型：正常/边界/字段缺失/干扰异常
输入内容：
预期输出：
约束说明：
实际输出：
测试结果：通过/不通过
问题备注：` },
];

const ROLE_BOUNDARIES = [
  { role: 'AI-BA', can_do: ['BRD、口径字典、测试用例、业务评测'], cannot_do: [] },
  { role: 'AI产品', can_do: [], cannot_do: ['PRD、原型、排期'] },
  { role: '算法', can_do: [], cannot_do: ['调参、模型训练'] },
];

const PITFALLS = [
  { content: '❌拒绝沉迷花式prompt，重点：约束、口径、防幻觉', is_warning: false },
  { content: '❌不学Python、深度学习，岗位不需要', is_warning: false },
  { content: '❌只输出BRD，不要写PRD原型', is_warning: false },
  { content: '✅Demo不求炫酷，重点体现业务风险与局限性', is_warning: true },
];

const JOB_KEYWORDS = [
  { keyword: 'AI业务分析师', category: '核心岗位' },
  { keyword: '大模型BA', category: '核心岗位' },
  { keyword: '业财BA', category: '核心岗位' },
  { keyword: '供应链AI业务分析师', category: '细分方向' },
  { keyword: '智能财务业务分析师', category: '细分方向' },
];

const TEMPLATE_MAP = {
  '口径字典': 'tag-tax',
  'BRD文档': 'tag-cyan',
  '测试用例': 'tag-orange',
};

const CATEGORY_ICONS = {
  '文档': '📄',
  '代码': '💻',
  '报告': '📊',
  '素材': '📁',
  'SQL练习': '📊',
  'Agent平台': '🤖',
  '文档工具': '📝',
  '行业参考': '🏢',
};

// 前端状态
let currentData = { plans: [], tasks: [], reviews: [], deliverables: [], resources: [], tools: [], pitfalls: [], jobKeywords: [], studyLogs: [] };
let activeTab = 'progress'; // progress | plan | resources | templates | deliverables

export const aibaPage = {
  id: 'aiba',
  title: 'AI-BA 学习计划',
  subtitle: 'AI业务分析师·10周在职学习工作台',
  icon: '🤖',
  render: async (container) => {
    container.innerHTML = renderPage();
    bindEvents(container);
    await loadData(container);
    renderActiveTab(container);
    renderProgressCharts(container);
  },
};

function renderPage() {
  return `
    <div class="flex flex-col lg:flex-row gap-6">
      <!-- 左侧边栏 -->
      <aside class="lg:w-80 space-y-4">
        <!-- 角色边界 -->
        <div class="glass-card hoverable">
          <div class="card-head">
            <span class="card-title"><span class="bar"></span>角色边界</span>
          </div>
          <div class="space-y-3 text-sm">
            ${ROLE_BOUNDARIES.map((r) => `
              <div class="flex items-start gap-2">
                <span class="icon-tag ${r.can_do.length ? 'tag-high' : 'tag-low'}">${r.role}</span>
                <div class="flex-1">
                  ${r.can_do.map((t) => `<div class="flex items-center gap-1.5"><span class="icon-check text-green-500">✓</span><span>${t}</span></div>`).join('')}
                  ${r.cannot_do.map((t) => `<div class="flex items-center gap-1.5"><span class="icon-cross text-red-500">✗</span><span class="text-secondary">${t}</span></div>`).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- 输出物清单 -->
        <div class="glass-card hoverable">
          <div class="card-head">
            <span class="card-title"><span class="bar"></span>必须完成输出物</span>
          </div>
          <div class="space-y-2 text-sm" id="deliverables-list"></div>
        </div>

        <!-- 工具库 -->
        <div class="glass-card hoverable">
          <div class="card-head">
            <span class="card-title"><span class="bar"></span>工具库</span>
          </div>
          <div class="space-y-2 text-sm" id="tools-list"></div>
        </div>

        <!-- 避坑清单 -->
        <div class="glass-card hoverable border-amber-200 bg-amber-50/10">
          <div class="card-head">
            <span class="card-title text-amber-600"><span class="bar"></span>避坑清单</span>
          </div>
          <div class="space-y-2 text-sm" id="pitfalls-list"></div>
        </div>

        <!-- 求职关键词 -->
        <div class="glass-card hoverable">
          <div class="card-head">
            <span class="card-title"><span class="bar"></span>求职关键词</span>
          </div>
          <div class="flex flex-wrap gap-2" id="keywords-list"></div>
        </div>
      </aside>

      <!-- 主内容区 -->
      <main class="flex-1">
        <!-- 标签页导航 -->
        <div class="glass-card mb-4">
          <div class="flex flex-wrap gap-2">
            <button class="chip active" data-tab="progress">📊 进度看板</button>
            <button class="chip" data-tab="plan">📅 学习计划</button>
            <button class="chip" data-tab="quiz">📝 在线答题</button>
            <button class="chip" data-tab="resources">📖 学习资源</button>
            <button class="chip" data-tab="templates">📋 模板仓库</button>
            <button class="chip" data-tab="deliverables">✅ 输出物</button>
          </div>
        </div>

        <!-- 内容区 -->
        <div id="tab-progress" class="tab-content">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div class="glass-card hoverable">
              <div class="kpi-top"><span class="kpi-label">总完成率</span><span class="kpi-ic">🎯</span></div>
              <div class="kpi-val" id="kpi-completion">0%</div>
              <div class="kpi-delta" id="kpi-completion-detail">0/0 任务完成</div>
            </div>
            <div class="glass-card hoverable">
              <div class="kpi-top"><span class="kpi-label">累计学习时长</span><span class="kpi-ic">⏰</span></div>
              <div class="kpi-val" id="kpi-hours">0h</div>
              <div class="kpi-delta" id="kpi-hours-detail">10周计划</div>
            </div>
            <div class="glass-card hoverable">
              <div class="kpi-top"><span class="kpi-label">输出物交付</span><span class="kpi-ic">📦</span></div>
              <div class="kpi-val" id="kpi-deliverables">0/0</div>
              <div class="kpi-delta" id="kpi-deliverables-detail">完成率 0%</div>
            </div>
          </div>
          <div class="glass-card">
            <div class="card-head">
              <span class="card-title"><span class="bar"></span>每周完成率</span>
            </div>
            <div class="chart-wrap"><canvas id="aiba-completion-chart"></canvas></div>
          </div>
          <div class="glass-card">
            <div class="card-head">
              <span class="card-title"><span class="bar"></span>当前进度</span>
            </div>
            <div id="current-week-progress"></div>
          </div>
        </div>

        <div id="tab-plan" class="tab-content hidden">
          <div class="glass-card">
            <div class="card-head">
              <span class="card-title"><span class="bar"></span>10周学习任务计划</span>
            </div>
            <div class="space-y-4 max-h-[800px] overflow-y-auto pr-2 scrollbar-hide" id="plans-container"></div>
          </div>
        </div>

        <!-- 在线答题 -->
        <div id="tab-quiz" class="tab-content hidden">
          <!-- 出题区 -->
          <div class="glass-card">
            <div class="card-head">
              <span class="card-title"><span class="bar"></span>出题（创建题库）</span>
            </div>
            <div class="form-grid">
              <div class="field">
                <label class="field-label">题目类型</label>
                <select class="sel input" id="q-type">
                  <option value="choice">选择题（A/B/C/D）</option>
                  <option value="judge">判断题（✓ 正确 / ✗ 错误）</option>
                </select>
              </div>
              <div class="field">
                <label class="field-label">关联周次</label>
                <select class="sel input" id="q-week">
                  <option value="">不限</option>
                  ${WEEK_PLANS.map((w) => `<option value="${w.week_num}">第${w.week_num}周</option>`).join('')}
                </select>
              </div>
              <div class="field">
                <label class="field-label">知识点</label>
                <input class="input" id="q-topic" placeholder="如：SQL、口径字典、大模型概念">
              </div>
              <div class="field">
                <label class="field-label">难度</label>
                <select class="sel input" id="q-diff">
                  <option value="easy">简单</option>
                  <option value="medium" selected>中等</option>
                  <option value="hard">困难</option>
                </select>
              </div>
            </div>
            <div class="field mb-12">
              <label class="field-label">题目内容</label>
              <textarea class="textarea" id="q-text" placeholder="输入题目..."></textarea>
            </div>
            <div id="q-options-area" class="mb-12">
              <label class="field-label">选项（A/B/C/D）</label>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input class="input" id="q-optA" placeholder="A.">
                <input class="input" id="q-optB" placeholder="B.">
                <input class="input" id="q-optC" placeholder="C.">
                <input class="input" id="q-optD" placeholder="D.">
              </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div class="field">
                <label class="field-label">正确答案</label>
                <input class="input" id="q-answer" placeholder="如：A 或 ✓">
              </div>
              <div class="field">
                <label class="field-label">解析（可选）</label>
                <input class="input" id="q-explain" placeholder="答案解析">
              </div>
            </div>
            <div class="action-bar mt-12">
              <button class="btn btn-primary" id="q-save">✨ 保存题目</button>
              <button class="btn btn-outline" id="q-clear">清空</button>
            </div>
          </div>

          <!-- 答题区 -->
          <div class="glass-card">
            <div class="card-head">
              <span class="card-title"><span class="bar"></span>答题测试</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
              <div class="field">
                <label class="field-label">按周次筛选</label>
                <select class="sel input" id="quiz-week">
                  <option value="">全部周次</option>
                  ${WEEK_PLANS.map((w) => `<option value="${w.week_num}">第${w.week_num}周</option>`).join('')}
                </select>
              </div>
              <div class="field">
                <label class="field-label">题目数量</label>
                <select class="sel input" id="quiz-count">
                  <option value="5">5 题</option>
                  <option value="10" selected>10 题</option>
                  <option value="20">20 题</option>
                </select>
              </div>
              <div class="field flex items-end">
                <button class="btn btn-success" id="quiz-start">🚀 开始答题</button>
              </div>
            </div>
            <div id="quiz-area"></div>
          </div>

          <!-- 历史记录 -->
          <div class="glass-card">
            <div class="card-head">
              <span class="card-title"><span class="bar"></span>答题记录</span>
            </div>
            <div id="quiz-history"></div>
          </div>
        </div>

        <div id="tab-resources" class="tab-content hidden">
          <div class="glass-card">
            <div class="card-head">
              <span class="card-title"><span class="bar"></span>每周配套学习资源（全部免费）</span>
            </div>
            <div class="space-y-3" id="resources-container"></div>
          </div>
        </div>

        <div id="tab-templates" class="tab-content hidden">
          <div class="glass-card">
            <div class="card-head">
              <span class="card-title"><span class="bar"></span>模板仓库（复制即可使用）</span>
            </div>
            <div class="space-y-4" id="templates-container"></div>
          </div>
        </div>

        <div id="tab-deliverables" class="tab-content hidden">
          <div class="glass-card">
            <div class="card-head">
              <span class="card-title"><span class="bar"></span>输出物管理</span>
            </div>
            <div id="deliverables-container"></div>
          </div>
        </div>
      </main>
    </div>
  `;
}

function bindEvents(container) {
  // 标签页切换
  container.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('[data-tab]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.tab;
      renderActiveTab(container);
      if (activeTab === 'progress') renderProgressCharts(container);
    });
  });

  // 输出物勾选
  container.addEventListener('change', async (e) => {
    if (e.target.classList.contains('deliverable-check')) {
      const id = e.target.dataset.id;
      await updateRow('aiba_deliverables', id, { status: e.target.checked ? 'done' : 'pending' });
      toast(e.target.checked ? '✅ 输出物已完成' : '↩️ 已取消完成', 'success');
      await loadData(container);
      renderActiveTab(container);
      renderProgressCharts(container);
    }
  });

  // 题目类型切换（选择题显示选项，判断题隐藏）
  const qType = container.querySelector('#q-type');
  if (qType) {
    qType.addEventListener('change', () => {
      const optArea = container.querySelector('#q-options-area');
      if (optArea) optArea.style.display = qType.value === 'judge' ? 'none' : '';
    });
  }

  // 保存题目（出题）
  container.addEventListener('click', async (e) => {
    if (e.target.closest('#q-save')) {
      const type = container.querySelector('#q-type').value;
      const text = container.querySelector('#q-text').value.trim();
      const answer = container.querySelector('#q-answer').value.trim();
      if (!text) return toast('请输入题目内容', 'warn');
      if (!answer) return toast('请输入正确答案', 'warn');

      let options = null;
      if (type === 'choice') {
        const a = container.querySelector('#q-optA').value.trim();
        const b = container.querySelector('#q-optB').value.trim();
        const c = container.querySelector('#q-optC').value.trim();
        const d = container.querySelector('#q-optD').value.trim();
        if (!a || !b) return toast('至少填写 A 和 B 选项', 'warn');
        options = ['A. ' + a, 'B. ' + b];
        if (c) options.push('C. ' + c);
        if (d) options.push('D. ' + d);
      }

      try {
        await addRow('aiba_questions', {
          question_type: type,
          question_text: text,
          options: type === 'judge' ? ['✓ 正确', '✗ 错误'] : options,
          correct_answer: answer,
          explanation: container.querySelector('#q-explain').value.trim(),
          difficulty: container.querySelector('#q-diff').value,
          topic: container.querySelector('#q-topic').value.trim(),
          week_num: container.querySelector('#q-week').value || null,
        });
        toast('✅ 题目已保存！', 'success');
        // 清空
        container.querySelector('#q-text').value = '';
        container.querySelector('#q-answer').value = '';
        container.querySelector('#q-explain').value = '';
        container.querySelector('#q-optA').value = '';
        container.querySelector('#q-optB').value = '';
        container.querySelector('#q-optC').value = '';
        container.querySelector('#q-optD').value = '';
      } catch (err) { toast('❌ 保存失败: ' + err.message, 'error'); }
    }
  });

  // 开始答题
  container.addEventListener('click', async (e) => {
    if (e.target.closest('#quiz-start')) {
      await startQuiz(container);
    }
  });

  // 提交答案
  container.addEventListener('click', async (e) => {
    if (e.target.closest('#quiz-submit')) {
      await submitQuiz(container);
    }
  });

  // 记录学习时间按钮
  container.addEventListener('click', async (e) => {
    if (e.target.closest('#btn-log-study')) {
      const week = parseInt(prompt('输入周次（1-10）：'));
      const minutes = parseInt(prompt('输入学习时长（分钟）：'));
      if (week && minutes) {
        await addRow('aiba_study_logs', { week_num: week, study_date: new Date().toISOString().slice(0, 10), duration_minutes: minutes });
        toast(`✅ 已记录 ${minutes} 分钟学习时间`, 'success');
        await loadData(container);
        renderProgressCharts(container);
      }
    }
  });
}

async function loadData(container) {
  try {
    const [plans, tasks, reviews, deliverables, resources, tools, pitfalls, keywords, studyLogs] = await Promise.all([
      fetchEntity('aiba_plans'),
      fetchEntity('aiba_tasks'),
      fetchEntity('aiba_weekly_reviews'),
      fetchEntity('aiba_deliverables'),
      fetchEntity('aiba_resources'),
      fetchEntity('aiba_tools'),
      fetchEntity('aiba_pitfalls'),
      fetchEntity('aiba_job_keywords'),
      fetchEntity('aiba_study_logs'),
    ]);
    currentData = { plans, tasks, reviews, deliverables, resources, tools, pitfalls, keywords, studyLogs };
  } catch (err) {
    console.error('加载 AI-BA 数据失败:', err);
  }
}

function renderActiveTab(container) {
  container.querySelectorAll('.tab-content').forEach((el) => el.classList.add('hidden'));
  const tab = container.querySelector(`#tab-${activeTab}`);
  if (tab) {
    tab.classList.remove('hidden');
    // 填充内容
    switch (activeTab) {
      case 'progress': renderProgress(container); break;
      case 'plan': renderPlans(container); break;
      case 'resources': renderResources(container); break;
      case 'templates': renderTemplates(container); break;
      case 'deliverables': renderDeliverables(container); break;
      case 'quiz': renderQuizTab(container); break;
    }
  }
}

function renderProgress(container) {
  const { plans, tasks, studyLogs } = currentData;
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed).length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const totalHours = studyLogs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0) / 60;

  // KPI
  container.querySelector('#kpi-completion').textContent = `${completionRate}%`;
  container.querySelector('#kpi-completion-detail').textContent = `${completedTasks}/${totalTasks} 任务完成`;
  container.querySelector('#kpi-hours').textContent = `${Math.round(totalHours)}h`;
  container.querySelector('#kpi-deliverables').textContent = `${currentData.deliverables.filter((d) => d.status === 'done').length}/${currentData.deliverables.length}`;

  // 当前周进度
  const currentWeek = plans.find((p) => {
    const weekTasks = tasks.filter((t) => t.plan_id === p.id);
    return weekTasks.length > 0 && !weekTasks.every((t) => t.completed);
  });
  const progressEl = container.querySelector('#current-week-progress');
  if (currentWeek) {
    const weekTasks = tasks.filter((t) => t.plan_id === currentWeek.id);
    const weekDone = weekTasks.filter((t) => t.completed).length;
    const pct = weekTasks.length > 0 ? Math.round((weekDone / weekTasks.length) * 100) : 0;
    progressEl.innerHTML = `
      <div class="mb-3">
        <div class="flex justify-between mb-1">
          <span class="font-semibold">第${currentWeek.week_num}周</span>
          <span class="text-secondary">${currentWeek.week_title}</span>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="flex justify-between mt-2 text-sm">
          <span>完成 ${weekDone}/${weekTasks.length} 任务</span>
          <span class="text-secondary">${pct}%</span>
        </div>
      </div>
      <div class="space-y-2">
        ${weekTasks.map((t) => `
          <div class="flex items-center gap-3 ${t.completed ? 'text-secondary line-through' : ''}">
            <span class="w-5 h-5 rounded-full flex items-center justify-center text-xs ${t.completed ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}">${t.completed ? '✓' : '○'}</span>
            <span class="flex-1">${t.description}</span>
            ${t.output_doc ? `<span class="tag tag-blue">${t.output_doc}</span>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  } else {
    progressEl.innerHTML = `<div class="text-center py-8 text-secondary">所有周次已完成！</div>`;
  }
}

function renderPlans(container) {
  const { plans, tasks } = currentData;
  const containerEl = container.querySelector('#plans-container');
  containerEl.innerHTML = plans.map((plan) => {
    const weekTasks = tasks.filter((t) => t.plan_id === plan.id);
    const done = weekTasks.filter((t) => t.completed).length;
    const pct = weekTasks.length > 0 ? Math.round((done / weekTasks.length) * 100) : 0;
    return `
      <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
        <div class="flex justify-between items-start mb-3">
          <div>
            <h3 class="font-bold text-primary">第${plan.week_num}周｜${plan.week_title}</h3>
            <p class="text-sm text-secondary mt-1">${plan.goal || ''}</p>
          </div>
          <div class="text-right">
            <span class="tag ${pct === 100 ? 'tag-green' : pct >= 50 ? 'tag-blue' : 'tag-orange'}">${pct}%</span>
          </div>
        </div>
        <div class="progress-track mb-3"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="space-y-2">
          ${weekTasks.map((t) => `
            <label class="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" class="mt-1 w-4 h-4" data-task-id="${t.id}" ${t.completed ? 'checked' : ''}>
              <div class="flex-1">
                <span class="${t.completed ? 'line-through text-secondary' : ''}">${t.description}</span>
                ${t.output_doc ? `<span class="tag tag-blue ml-2">${t.output_doc}</span>` : ''}
              </div>
            </label>
          `).join('')}
        </div>
        ${plan.learning_points ? `
          <div class="mt-3 pt-3 border-t border-gray-100">
            <span class="text-xs font-semibold text-secondary">知识点：</span>
            <div class="flex flex-wrap gap-1.5 mt-1">
              ${plan.learning_points.map((p) => `<span class="bg-gray-50 px-2 py-0.5 rounded text-xs">${p}</span>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // 绑定勾选事件
  containerEl.querySelectorAll('[data-task-id]').forEach((cb) => {
    cb.addEventListener('change', async () => {
      const taskId = cb.dataset.taskId;
      await updateRow('aiba_tasks', taskId, { completed: cb.checked });
      toast(cb.checked ? '✅ 任务已完成' : '↩️ 已取消完成', 'success');
      await loadData(container);
      renderPlans(container);
      if (activeTab === 'progress') renderProgressCharts(container);
    });
  });
}

function renderResources(container) {
  const { resources } = currentData;
  const resourcesEl = container.querySelector('#resources-container');
  const grouped = {};
  resources.forEach((r) => {
    if (!grouped[r.week_num]) grouped[r.week_num] = [];
    grouped[r.week_num].push(r);
  });

  resourcesEl.innerHTML = Object.entries(grouped)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .map(([week, items]) => `
      <div class="border border-gray-200 rounded-lg p-3">
        <h4 class="font-semibold text-primary mb-2">第${week}周</h4>
        <div class="space-y-2">
          ${items.map((item) => `
            <div class="flex items-center gap-2">
              <span class="tag ${item.platform === 'B站' ? 'tag-blue' : 'tag-gray'}">${item.platform}</span>
              <a href="${item.url}" target="_blank" class="text-blue-600 hover:underline flex-1">${item.title}</a>
              ${item.description ? `<span class="text-secondary text-sm">— ${item.description}</span>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `).join('') || `<div class="text-center py-8 text-secondary">暂无学习资源</div>`;
}

function renderTemplates(container) {
  const { templates } = currentData;
  const templatesEl = container.querySelector('#templates-container');

  templatesEl.innerHTML = templates.map((tmpl) => `
    <div class="bg-gray-50/50 rounded-lg p-4">
      <div class="flex justify-between items-center mb-3">
        <h4 class="font-semibold">${tmpl.name}</h4>
        <span class="tag ${TEMPLATE_MAP[tmpl.category] || 'tag-gray'}">${tmpl.category}</span>
      </div>
      <pre class="bg-white rounded p-3 text-sm overflow-x-auto font-mono whitespace-pre-wrap">${esc(tmpl.content)}</pre>
      <div class="mt-3 flex justify-end">
        <button class="btn btn-sm btn-outline copy-template" data-content="${encodeURIComponent(tmpl.content)}">📋 复制模板</button>
      </div>
    </div>
  `).join('') || `<div class="text-center py-8 text-secondary">暂无模板</div>`;

  templatesEl.querySelectorAll('.copy-template').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText(decodeURIComponent(btn.dataset.content))
        .then(() => toast('✅ 已复制到剪贴板', 'success'))
        .catch(() => toast('❌ 复制失败', 'error'));
    });
  });
}

function renderDeliverables(container) {
  const { deliverables } = currentData;
  const containerEl = container.querySelector('#deliverables-container');

  containerEl.innerHTML = deliverables.length === 0
    ? `<div class="text-center py-8 text-secondary">暂无输出物</div>`
    : `<div class="space-y-3">
        ${deliverables.map((d) => `
          <div class="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition">
            <input type="checkbox" class="deliverable-check mt-1 w-5 h-5" data-id="${d.id}" ${d.status === 'done' ? 'checked' : ''}>
            <div class="flex-1">
              <div class="flex justify-between items-start">
                <span class="font-medium ${d.status === 'done' ? 'line-through text-secondary' : ''}">${d.name}</span>
                <span class="tag ${d.status === 'done' ? 'tag-green' : 'tag-orange'}">${d.status === 'done' ? '已完成' : '进行中'}</span>
              </div>
              ${d.description ? `<p class="text-sm text-secondary mt-1">${d.description}</p>` : ''}
              ${d.file_url ? `<a href="${d.file_url}" target="_blank" class="text-sm text-blue-500 hover:underline">📄 查看文件</a>` : ''}
            </div>
          </div>
        `).join('')}
      </div>`;
}

function renderProgressCharts(container) {
  const { plans, tasks, studyLogs } = currentData;

  // 每周完成率图表
  const completionData = plans.map((plan) => {
    const weekTasks = tasks.filter((t) => t.plan_id === plan.id);
    const done = weekTasks.filter((t) => t.completed).length;
    return { week: `W${plan.week_num}`, rate: weekTasks.length > 0 ? Math.round((done / weekTasks.length) * 100) : 0, done, total: weekTasks.length };
  });

  makeChart('aiba-completion-chart', {
    type: 'bar',
    data: {
      labels: completionData.map((d) => d.week),
      datasets: [{
        label: '完成率 (%)',
        data: completionData.map((d) => d.rate),
        backgroundColor: completionData.map((d) => d.rate === 100 ? PALETTE.green : d.rate >= 50 ? PALETTE.blue : PALETTE.orange),
        borderRadius: 6,
        barThickness: 30,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + '%' } },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const d = completionData[ctx.dataIndex];
              return `完成率: ${d.rate}% (${d.done}/${d.total} 任务)`;
            },
          },
        },
      },
    },
  });
}

// ============ 在线答题系统 ============

let currentQuiz = null;

async function renderQuizTab(container) {
  await renderQuizHistory(container);
}

async function startQuiz(container) {
  const weekNum = container.querySelector('#quiz-week').value;
  const count = parseInt(container.querySelector('#quiz-count').value) || 10;
  const body = { count };
  if (weekNum) body.week_num = parseInt(weekNum);
  const btn = container.querySelector('#quiz-start');
  btn.disabled = true;
  btn.textContent = '⏳ 生成试卷中…';
  try {
    const res = await fetch('/api/aiba?action=start-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(getToken() ? { 'X-App-Token': getToken() } : {}) },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    currentQuiz = { quizId: data.data.quiz.id, questions: data.data.questions, startedAt: Date.now() };
    renderQuizUI(container, data.data.questions);
    toast('📝 已生成 ' + data.data.questions.length + ' 题，开始答题！', 'success');
  } catch (err) { toast('❌ ' + err.message, 'error'); }
  finally { btn.disabled = false; btn.textContent = '🚀 开始答题'; }
}

function renderQuizUI(container, questions) {
  const area = container.querySelector('#quiz-area');
  if (!area) return;
  area.innerHTML = [
    '<div class="quiz-progress-bar"><div class="quiz-progress-fill" id="quiz-progress-fill" style="width:0%"></div></div>',
    '<div id="quiz-question-area"></div>',
    '<div class="action-bar mt-12">',
    '<button class="btn btn-outline" id="quiz-prev" disabled>← 上一题</button>',
    '<span class="count-pill" id="quiz-counter">1 / ' + questions.length + '</span>',
    '<button class="btn btn-outline" id="quiz-next">下一题 →</button>',
    '<button class="btn btn-primary" id="quiz-submit" style="display:none">✅ 提交答题</button>',
    '</div>',
  ].join('');
  let currentQ = 0;
  const answers = new Array(questions.length).fill(null);
  function renderQuestion(idx) {
    const q = questions[idx];
    const qArea = area.querySelector('#quiz-question-area');
    const opts = (q.options || []).map((opt, oi) => {
      const letter = String.fromCharCode(65 + oi);
      const isJudge = q.question_type === 'judge';
      const val = isJudge ? (oi === 0 ? '✓' : '✗') : letter;
      const sel = answers[idx] === val;
      return '<label class="quiz-option '+(sel?'selected':'')+'"><input type="radio" name="quiz-answer" value="'+val+'" '+(sel?'checked':'')+'><span class="quiz-opt-marker">'+letter+'</span><span class="quiz-opt-text">'+esc(opt)+'</span></label>';
    }).join('');
    const diffTag = {easy:'🟢 简单',medium:'🟡 中等',hard:'🔴 困难'}[q.difficulty] || '';
    qArea.innerHTML = '<div class="quiz-question-card fade-in">'
      + '<div class="flex-between mb-8"><span class="tag '+(q.question_type==='choice'?'tag-blue':'tag-orange')+'">'+(q.question_type==='choice'?'选择题':'判断题')+'</span><div class="flex gap-2">'+diffTag+(q.topic?'<span class="tag">'+esc(q.topic)+'</span>':'')+'</div></div>'
      + '<div class="quiz-q-text">'+esc(q.question_text)+'</div>'
      + '<div class="quiz-options mt-12">'+opts+'</div></div>';
    qArea.querySelectorAll('.quiz-option').forEach((opt) => {
      opt.addEventListener('click', () => {
        answers[idx] = opt.querySelector('input').value;
        qArea.querySelectorAll('.quiz-option').forEach((o) => o.classList.remove('selected'));
        opt.classList.add('selected');
        opt.querySelector('input').checked = true;
        const fill = area.querySelector('#quiz-progress-fill');
        const ac = answers.filter((a) => a !== null).length;
        fill.style.width = (ac / questions.length * 100) + '%';
      });
    });
    area.querySelector('#quiz-prev').disabled = idx === 0;
    area.querySelector('#quiz-next').style.display = idx < questions.length - 1 ? '' : 'none';
    area.querySelector('#quiz-submit').style.display = idx === questions.length - 1 ? '' : 'none';
    area.querySelector('#quiz-counter').textContent = (idx + 1) + ' / ' + questions.length;
  }
  renderQuestion(0);
  area.querySelector('#quiz-prev').addEventListener('click', () => { if (currentQ > 0) { currentQ--; renderQuestion(currentQ); } });
  area.querySelector('#quiz-next').addEventListener('click', () => { if (currentQ < questions.length - 1) { currentQ++; renderQuestion(currentQ); } });
  area.querySelector('#quiz-submit').addEventListener('click', async () => {
    const ua = answers.filter((a) => a === null).length;
    if (ua > 0 && !confirm('还有 ' + ua + ' 题未作答，确定提交？')) return;
    await submitQuiz(container, answers);
  });
}

async function submitQuiz(container, answers) {
  if (!currentQuiz) return toast('请先开始答题', 'warn');
  const payload = currentQuiz.questions.map((q, i) => ({ question_id: q.id, user_answer: answers[i] || '' })).filter((a) => a.user_answer);
  try {
    const res = await fetch('/api/aiba?action=submit-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(getToken() ? { 'X-App-Token': getToken() } : {}) },
      body: JSON.stringify({ quiz_id: currentQuiz.quizId, answers: payload, duration_sec: Math.round((Date.now() - currentQuiz.startedAt) / 1000) }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    renderQuizResult(container, data.data);
    toast('🎉 答题完成！得分 ' + data.data.score + ' 分', 'success');
    currentQuiz = null;
  } catch (err) { toast('❌ 提交失败: ' + err.message, 'error'); }
}

function renderQuizResult(container, result) {
  const area = container.querySelector('#quiz-area');
  if (!area) return;
  const grade = result.score >= 90 ? '🏆 优秀' : result.score >= 70 ? '👍 良好' : result.score >= 60 ? '📈 及格' : '💪 继续努力';
  const gc = result.score >= 90 ? 'green' : result.score >= 70 ? 'blue' : result.score >= 60 ? 'orange' : 'red';
  const rows = (result.details || []).map((d, i) =>
    '<div class="quiz-result-item '+(d.is_correct?'correct':'wrong')+'">'
    + '<div class="flex-between"><span class="quiz-result-num">'+(i+1)+'</span><span>'+(d.is_correct?'✅':'❌')+'</span></div>'
    + '<div class="quiz-result-question">'+esc(d.question_text)+'</div>'
    + '<div class="quiz-result-answers"><span>你的：<strong>'+(esc(d.user_answer)||'未答')+'</strong></span>'
    + (!d.is_correct?'<span>正确：<strong>'+esc(d.correct_answer)+'</strong></span>':'')+'</div>'
    + (d.explanation?'<div class="quiz-result-explain">💡 '+esc(d.explanation)+'</div>':'')+'</div>'
  ).join('');
  area.innerHTML = '<div class="quiz-result-card fade-in">'
    + '<div class="quiz-score-ring"><div class="quiz-score-val">'+result.score+'</div><div class="quiz-score-sub">分</div></div>'
    + '<div class="quiz-score-grade tag-'+gc+'">'+grade+'</div>'
    + '<div class="quiz-score-stats"><span>共 '+result.total+' 题</span><span class="text-success">✓ '+result.correct+' 题正确</span><span class="text-danger">✗ '+(result.total-result.correct)+' 题错误</span></div></div>'
    + '<div class="quiz-details mt-12"><div class="card-head"><span class="card-title"><span class="bar"></span>答题详情</span></div>'+rows+'</div>'
    + '<div class="action-bar mt-12"><button class="btn btn-primary" id="quiz-retry-btn">🔄 再来一次</button></div>';
  area.querySelector('#quiz-retry-btn').addEventListener('click', () => { document.querySelector('#quiz-start')?.click(); });
}

async function renderQuizHistory(container) {
  const area = container.querySelector('#quiz-history');
  if (!area) return;
  try {
    const res = await fetch('/api/aiba?action=quiz-history', {
      headers: { ...(getToken() ? { 'X-App-Token': getToken() } : {}) },
    });
    const data = await res.json();
    if (!data.ok || !data.data.length) {
      area.innerHTML = '<div class="text-secondary p-12">暂无答题记录</div>';
      return;
    }
    area.innerHTML = data.data.slice(0, 10).map((q) => {
      const gc = q.score >= 90 ? 'green' : q.score >= 70 ? 'blue' : q.score >= 60 ? 'orange' : 'red';
      return '<div class="quiz-history-item"><div class="flex-between"><span class="tag tag-'+gc+'">'+q.score+' 分</span><span class="text-secondary">'+q.correct_count+'/'+q.total_questions+' 正确</span></div><div class="text-secondary">'+(q.completed_at ? new Date(q.completed_at).toLocaleString() : '进行中')+'</div></div>';
    }).join('');
  } catch (err) {
    area.innerHTML = '<div class="text-secondary p-12">暂无记录</div>';
  }
}
