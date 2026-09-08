'use strict';

/**
 * AI-BA 在线答题系统 — 独立全屏窗口组件
 * 功能：出题、答题（选择/判断）、即时反馈、成绩报告、错题本
 */

import { esc, toast } from '../ui.js';
import { getToken } from '../api.js';

const API = '/api/aiba';

async function apiCall(action, method, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['X-App-Token'] = token;
  const url = `${API}?action=${action}`;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || '请求失败');
  return data;
}

// ==================== 主入口 ====================
export const quizPage = {
  id: 'quiz',
  title: '📝 在线答题',
  subtitle: '出题 · 答题 · 即时反馈 · 错题本',
  icon: '📝',
  render: async (container) => {
    container.innerHTML = buildQuizShell();
    await loadQuestionBank(container);
    bindEvents(container);
  },
};

function buildQuizShell() {
  return `
  <div class="quiz-app">
    <!-- 出题区 -->
    <section class="quiz-section" id="quiz-create-section">
      <div class="card-head">
        <span class="card-title"><span class="bar"></span>出题（创建题库）</span>
        <button class="btn btn-sm btn-outline" id="btn-import-demo" title="导入示例题目">📥 示例题</button>
      </div>
      <div class="quiz-create-form">
        <div class="form-grid">
          <div class="field">
            <label class="field-label">题型</label>
            <select class="sel input" id="q-type" required>
              <option value="choice">选择题（A/B/C/D）</option>
              <option value="judge">判断题（✓ 正确 / ✗ 错误）</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label">难度</label>
            <select class="sel input" id="q-diff">
              <option value="easy">🟢 简单</option>
              <option value="medium" selected>🟡 中等</option>
              <option value="hard">🔴 困难</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label">周次</label>
            <select class="sel input" id="q-week">
              <option value="">不限</option>
              ${Array.from({length: 10}, (_, i) => `<option value="${i+1}">第${i+1}周</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label">知识点标签</label>
            <input class="input" id="q-topic" placeholder="SQL / 口径字典 / BRD / 大模型…" />
          </div>
        </div>
        <div class="field" style="margin-top:12px">
          <label class="field-label">题目内容 *</label>
          <textarea class="textarea" id="q-text" placeholder="输入题目…" rows="3" required></textarea>
        </div>
        <!-- 选择题选项区 -->
        <div id="q-options-choices" style="margin-top:12px">
          <label class="field-label">选项 *</label>
          <div class="quiz-opts-grid">
            <div class="quiz-opt-row"><span class="quiz-opt-letter">A</span><input class="input" id="q-opt0" placeholder="A 选项内容" /></div>
            <div class="quiz-opt-row"><span class="quiz-opt-letter">B</span><input class="input" id="q-opt1" placeholder="B 选项内容" /></div>
            <div class="quiz-opt-row"><span class="quiz-opt-letter">C</span><input class="input" id="q-opt2" placeholder="C 选项内容（可选）" /></div>
            <div class="quiz-opt-row"><span class="quiz-opt-letter">D</span><input class="input" id="q-opt3" placeholder="D 选项内容（可选）" /></div>
          </div>
        </div>
        <!-- 判断题选项区 -->
        <div id="q-options-judge" style="display:none;margin-top:12px">
          <label class="field-label">正确答案 *</label>
          <div class="quiz-judge-opts">
            <label class="quiz-judge-opt"><input type="radio" name="q-correct" value="✓" checked><span>✓ 正确</span></label>
            <label class="quiz-judge-opt"><input type="radio" name="q-correct" value="✗"><span>✗ 错误</span></label>
          </div>
        </div>
        <div class="field" style="margin-top:12px">
          <label class="field-label">正确答案（选择题填 A/B/C/D）*</label>
          <input class="input" id="q-answer" placeholder="例：B" style="max-width:200px" />
        </div>
        <div class="field" style="margin-top:12px">
          <label class="field-label">答案解析（可选）</label>
          <textarea class="textarea" id="q-explain" placeholder="解析此题的要点…" rows="2"></textarea>
        </div>
        <div class="action-bar" style="margin-top:14px">
          <button class="btn btn-primary" id="btn-save-question">💾 保存题目</button>
          <button class="btn btn-outline" id="btn-clear-form">清空</button>
        </div>
      </div>
    </section>

    <!-- 题库浏览 -->
    <section class="quiz-section" id="quiz-bank-section">
      <div class="card-head">
        <span class="card-title"><span class="bar"></span>题库</span>
        <div class="action-bar">
          <select class="sel input" id="bank-filter-week" style="min-width:100px">
            <option value="">全部周次</option>
            ${Array.from({length: 10}, (_, i) => `<option value="${i+1}">第${i+1}周</option>`).join('')}
          </select>
          <select class="sel input" id="bank-filter-type" style="min-width:100px">
            <option value="">全部题型</option>
            <option value="choice">选择题</option>
            <option value="judge">判断题</option>
          </select>
          <span class="count-pill" id="bank-count">0 题</span>
        </div>
      </div>
      <div id="bank-list" class="quiz-bank-list"></div>
    </section>

    <!-- 答题区 -->
    <section class="quiz-section" id="quiz-take-section">
      <div class="card-head">
        <span class="card-title"><span class="bar"></span>开始答题</span>
      </div>
      <div class="quiz-start-config">
        <div class="form-grid">
          <div class="field">
            <label class="field-label">周次</label>
            <select class="sel input" id="quiz-week">
              <option value="">不限周次</option>
              ${Array.from({length: 10}, (_, i) => `<option value="${i+1}">第${i+1}周</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label">题数</label>
            <select class="sel input" id="quiz-count">
              <option value="5">5 题</option>
              <option value="10" selected>10 题</option>
              <option value="20">20 题</option>
              <option value="9999">全部</option>
            </select>
          </div>
        </div>
        <button class="btn btn-primary btn-lg" id="btn-start-quiz" style="margin-top:14px">
          🚀 开始答题
        </button>
      </div>
    </section>

    <!-- 答题进行中（初始隐藏） -->
    <div id="quiz-runner" class="quiz-runner hidden">
      <div class="quiz-runner-head">
        <div class="quiz-runner-title">📝 在线答题</div>
        <div class="quiz-runner-meta">
          <span id="quiz-prog">0 / 0</span>
          <span class="quiz-timer" id="quiz-timer">00:00</span>
          <button class="btn btn-sm btn-outline" id="btn-quit-quiz">退出</button>
        </div>
      </div>
      <div class="quiz-progress-bar"><div class="quiz-progress-fill" id="quiz-pbar"></div></div>
      <div id="quiz-card-area"></div>
    </div>

    <!-- 成绩报告（初始隐藏） -->
    <div id="quiz-report" class="quiz-report hidden">
      <div class="quiz-report-card" id="quiz-report-inner"></div>
    </div>

    <!-- 错题本 -->
    <section class="quiz-section" id="quiz-wrong-section">
      <div class="card-head">
        <span class="card-title"><span class="bar"></span>错题本</span>
        <span class="count-pill" id="wrong-count">0 题</span>
      </div>
      <div id="wrong-list" class="quiz-bank-list"></div>
    </section>
  </div>`;
}

// ==================== 数据层 ====================
let questions = [];
let wrongQuestions = [];  // localStorage
let quizState = null;     // { questions: [...], answers: Map, current: 0, timer, startTime }

function loadWrongQuestions() {
  try { wrongQuestions = JSON.parse(localStorage.getItem('aiba_wrong_questions') || '[]'); } catch { wrongQuestions = []; }
}
function saveWrongQuestions() {
  localStorage.setItem('aiba_wrong_questions', JSON.stringify(wrongQuestions.slice(0, 200)));
}
function addWrongQuestion(q, userAnswer) {
  loadWrongQuestions();
  const exists = wrongQuestions.find((w) => w.question_id === q.id && w.user_answer === userAnswer);
  if (!exists) {
    wrongQuestions.unshift({ ...q, user_answer: userAnswer, review_count: 0, wrong_at: Date.now() });
    saveWrongQuestions();
  }
}
function removeWrongQuestion(id) {
  loadWrongQuestions();
  wrongQuestions = wrongQuestions.filter((w) => w.id !== id);
  saveWrongQuestions();
}

async function loadQuestionBank(container) {
  try {
    const data = await apiCall('questions', 'GET');
    questions = data.data || [];
    renderBankList(container);
  } catch (err) {
    questions = [];
    const el = container.querySelector('#bank-list');
    if (el) el.innerHTML = `<div class="empty-state"><div class="empty-ic">📦</div><div>题库为空，先出题吧！<br><small>${esc(err.message)}</small></div></div>`;
  }
  loadWrongQuestions();
  renderWrongList(container);
}

// ==================== 绑定事件 ====================
function bindEvents(container) {
  // 题型切换
  const typeSelect = container.querySelector('#q-type');
  if (typeSelect) {
    typeSelect.addEventListener('change', () => {
      container.querySelector('#q-options-choices').style.display = typeSelect.value === 'choice' ? '' : 'none';
      container.querySelector('#q-options-judge').style.display = typeSelect.value === 'judge' ? '' : 'none';
      if (typeSelect.value === 'judge') container.querySelector('#q-answer').value = '';
    });
  }

  // 保存题目
  const saveBtn = container.querySelector('#btn-save-question');
  if (saveBtn) saveBtn.onclick = () => saveQuestion(container);

  // 清空
  const clearBtn = container.querySelector('#btn-clear-form');
  if (clearBtn) clearBtn.onclick = () => clearForm(container);

  // 示例题导入
  const demoBtn = container.querySelector('#btn-import-demo');
  if (demoBtn) demoBtn.onclick = () => importDemoQuestions(container);

  // 题库筛选
  const fw = container.querySelector('#bank-filter-week');
  const ft = container.querySelector('#bank-filter-type');
  if (fw) fw.onchange = () => renderBankList(container);
  if (ft) ft.onchange = () => renderBankList(container);

  // 开始答题
  const startBtn = container.querySelector('#btn-start-quiz');
  if (startBtn) startBtn.onclick = () => startQuiz(container);

  // 退出答题
  const quitBtn = container.querySelector('#btn-quit-quiz');
  if (quitBtn) quitBtn.onclick = () => {
    if (confirm('确定退出本次答题？')) stopQuiz(container);
  };
}

// ==================== 出题 ====================
async function saveQuestion(container) {
  const type = container.querySelector('#q-type').value;
  const text = container.querySelector('#q-text').value.trim();
  const diff = container.querySelector('#q-diff').value;
  const week = container.querySelector('#q-week').value;
  const topic = container.querySelector('#q-topic').value.trim();
  const explain = container.querySelector('#q-explain').value.trim();

  if (!text) { toast('请填写题目内容', 'warn'); return; }

  let correct = container.querySelector('#q-answer').value.trim().toUpperCase();
  let options;

  if (type === 'choice') {
    const rawOpts = [0, 1, 2, 3].map(i => container.querySelector(`#q-opt${i}`).value.trim());
    const validOpts = rawOpts.filter(Boolean);
    if (validOpts.length < 2) { toast('至少填写 2 个选项', 'warn'); return; }
    if (!correct) { toast('请填写正确答案（A/B/C/D）', 'warn'); return; }
    options = validOpts.map((opt, i) => `${String.fromCharCode(65 + i)}. ${opt}`);
  } else {
    correct = (container.querySelector('input[name="q-correct"]:checked') || {}).value || '✓';
    options = ['✓ 正确', '✗ 错误'];
  }

  try {
    await apiCall('question', 'POST', {
      question_type: type,
      question_text: text,
      options, correct_answer: correct,
      explanation: explain || null,
      difficulty: diff,
      week_num: week ? parseInt(week) : null,
      topic: topic || null,
    });
    toast('✅ 题目已保存！', 'success');
    clearForm(container);
    await loadQuestionBank(container);
  } catch (err) { toast('❌ ' + err.message, 'error'); }
}

function clearForm(container) {
  ['q-text', 'q-opt0', 'q-opt1', 'q-opt2', 'q-opt3', 'q-answer', 'q-explain', 'q-topic'].forEach((id) => {
    const el = container.querySelector(`#${id}`);
    if (el) el.value = '';
  });
  container.querySelector('#q-type').value = 'choice';
  container.querySelector('#q-diff').value = 'medium';
  container.querySelector('#q-week').value = '';
  container.querySelector('#q-options-choices').style.display = '';
  container.querySelector('#q-options-judge').style.display = 'none';
}

// ==================== 题库列表 ====================
function renderBankList(container) {
  const el = container.querySelector('#bank-list');
  const filterWeek = container.querySelector('#bank-filter-week')?.value;
  const filterType = container.querySelector('#bank-filter-type')?.value;
  let filtered = questions;
  if (filterWeek) filtered = filtered.filter((q) => String(q.week_num) === filterWeek);
  if (filterType) filtered = filtered.filter((q) => q.question_type === filterType);

  container.querySelector('#bank-count').textContent = `${filtered.length} 题`;

  if (!filtered.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-ic">📦</div><div>暂无题目，先出题吧！</div></div>`;
    return;
  }

  el.innerHTML = filtered.map((q, i) => `
    <div class="quiz-bank-item" data-id="${q.id}">
      <div class="quiz-bank-meta">
        <span class="tag ${q.question_type === 'choice' ? 'tag-blue' : 'tag-orange'}">${q.question_type === 'choice' ? '选择' : '判断'}</span>
        <span class="tag ${q.difficulty === 'easy' ? 'tag-green' : q.difficulty === 'hard' ? 'tag-red' : 'tag-yellow'}">${q.difficulty}</span>
        ${q.week_num ? `<span class="tag">W${q.week_num}</span>` : ''}
        ${q.topic ? `<span class="tag">${esc(q.topic)}</span>` : ''}
      </div>
      <div class="quiz-bank-q">${esc(q.question_text)}</div>
      <div class="quiz-bank-answer">
        <span>答案：<strong>${esc(q.correct_answer)}</strong></span>
        ${q.explanation ? `<span class="text-secondary">｜${esc(q.explanation)}</span>` : ''}
      </div>
      <div class="quiz-bank-actions">
        <button class="btn btn-sm btn-danger btn-del-question" data-id="${q.id}">🗑 删除</button>
      </div>
    </div>
  `).join('');

  // 删除按钮
  el.querySelectorAll('.btn-del-question').forEach((btn) => {
    btn.onclick = async () => {
      try {
        await apiCall('question', 'DELETE', null);
        // DELETE uses query param: action=question&id=xxx
        await fetch(`${API}?action=question&id=${btn.dataset.id}`, {
          method: 'DELETE',
          headers: { 'X-App-Token': getToken() || '' },
        });
        toast('🗑 已删除', 'success');
        await loadQuestionBank(container);
      } catch (err) { toast('❌ ' + err.message, 'error'); }
    };
  });
}

// ==================== 示例题导入 ====================
async function importDemoQuestions(container) {
  const demoQuestions = [
    { type: 'judge', text: 'AI-BA 只需要写 BRD 文档，不需要写 PRD 和原型。', correct: '✓', diff: 'easy', w: 1, topic: '角色边界', explain: 'AI-BA（业务分析师）职责边界：输出 BRD、口径字典、测试用例、业务评测，而非 PRD、原型或排期。' },
    { type: 'judge', text: 'AI-BA 需要学习 Python 和深度学习才能胜任岗位。', correct: '✗', diff: 'easy', w: 1, topic: '角色边界', explain: 'AI-BA 专注业务侧（需求、口径、测试），不需要调参或训练模型，不强制要求 Python/DL 技能。' },
    { type: 'choice', text: '业务口径字典中，"约束&禁忌" 字段的核心作用是？', opts: ['规定字段是否允许大模型猜测/推断，缺失时输出什么', '指定 SQL 查询语句', '定义 UI 原型交互规范', '记录发票编码规则'], correct: 'A', diff: 'medium', w: 4, topic: '口径字典', explain: '口径字典的"约束&禁忌"是防幻觉核心，明确：缺失字段是否允许推断（通常不允许）、缺失时输出【未识别】。' },
    { type: 'choice', text: '当大模型对"报关单金额"字段无法识别时，正确的业务处理是？', opts: ['猜测一个大概金额并输出', '输出【未识别】，由人工补充', '返回空值', '根据商品类别自动推算'], correct: 'B', diff: 'medium', w: 4, topic: '口径字典', explain: '财务铁律：金额、日期、贸易条款等关键字段禁止模型编造，缺失必须输出【未识别】。' },
    { type: 'judge', text: 'AI-BA 的项目流程中，"AI 可行性筛选"应在"业务调研"之后、"需求输出"之前完成。', correct: '✓', diff: 'medium', w: 1, topic: '项目链路', explain: '项目链路：业务调研→痛点收集→AI可行性筛选→口径定义→需求输出→测试→评测→上线。' },
    { type: 'choice', text: 'BRD 文档通常不包含以下哪个章节？', opts: ['业务背景与痛点', '项目边界（做什么/不做什么）', 'UI 原型设计', '成功衡量标准（业务层）'], correct: 'C', diff: 'easy', w: 5, topic: 'BRD文档', explain: 'BRD（业务需求文档）不含 UI 原型，原型属于 PRD 产品文档。' },
    { type: 'judge', text: '口径字典中"数据来源"字段不需要标注，字段本身已隐含来源。', correct: '✗', diff: 'easy', w: 4, topic: '口径字典', explain: '口径字典 7 要素都需填写：字段名称、业务含义、数据来源、取值范围、计算/提取规则、边界条件、约束&禁忌。' },
    { type: 'choice', text: '以下哪种业务场景最适合用 AI 自动化？', opts: ['涉及大额资金审批的最终签字', '从图片发票中提取字段（OCR+LLM）', '税务合规风险最终裁决', '需要现场沟通的客户对账'], correct: 'B', diff: 'easy', w: 1, topic: 'AI可行性', explain: '图片→结构化字段的提取（OCR+LLM）适合 AI 自动化；审批/裁决/对账涉及人的判断，不适合全自动。' },
    { type: 'judge', text: 'FusionAI 用友 BIP 中的 AI 功能主要用于单据智能录入和财务智能分析。', correct: '✓', diff: 'medium', w: 10, topic: '行业调研', explain: '用友 BIP AI 功能：单据智能录入、财务异常检测、报表智能分析、预算智能管控等。' },
    { type: 'choice', text: '在写 AI 业务测试用例时，哪类用例最容易暴露模型幻觉问题？', opts: ['正常输入常规数据', '边界值：日期月末/年末', '干扰样本：输入矛盾或无效信息', '空数据测试'], correct: 'C', diff: 'hard', w: 7, topic: '业务测试', explain: '干扰样本最能暴露幻觉——矛盾/无效输入时模型仍编造输出，正是 AI 与传统软件测试的核心区别。' },
  ];

  let success = 0;
  for (const q of demoQuestions) {
    try {
      await apiCall('question', 'POST', {
        question_type: q.type,
        question_text: q.text,
        options: q.type === 'choice'
          ? q.opts.map((o, i) => `${String.fromCharCode(65 + i)}. ${o}`)
          : ['✓ 正确', '✗ 错误'],
        correct_answer: q.correct,
        explanation: q.explain,
        difficulty: q.diff,
        week_num: q.w || null,
        topic: q.topic || null,
      });
      success++;
    } catch { /* skip */ }
  }
  toast(`✅ 已导入 ${success} 道示例题目`, 'success');
  await loadQuestionBank(container);
}

// ==================== 答题流程 ====================
async function startQuiz(container) {
  const weekNum = container.querySelector('#quiz-week')?.value || null;
  const count = parseInt(container.querySelector('#quiz-count')?.value || '10');

  let bank = questions;
  if (weekNum) bank = bank.filter((q) => String(q.week_num) === weekNum);
  if (!bank.length) { toast('题库为空，请先出题！', 'warn'); return; }

  // 随机抽取 count 题
  const shuffled = [...bank].sort(() => Math.random() - 0.5).slice(0, Math.min(count, bank.length));

  quizState = {
    questions: shuffled,
    answers: new Map(),
    current: 0,
    startTime: Date.now(),
    timer: null,
  };

  // 切换 UI
  container.querySelector('#quiz-runner').classList.remove('hidden');
  container.querySelector('#quiz-report').classList.add('hidden');
  container.querySelectorAll('.quiz-section').forEach((s) => s.style.display = 'none');

  startTimer(container);
  renderQuizCard(container);
}

function startTimer(container) {
  const el = container.querySelector('#quiz-timer');
  quizState.timer = setInterval(() => {
    const sec = Math.floor((Date.now() - quizState.startTime) / 1000);
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    if (el) el.textContent = `${m}:${s}`;
  }, 1000);
}

function stopQuiz(container) {
  if (quizState?.timer) clearInterval(quizState.timer);
  quizState = null;
  container.querySelector('#quiz-runner').classList.add('hidden');
  container.querySelector('#quiz-report').classList.add('hidden');
  container.querySelectorAll('.quiz-section').forEach((s) => s.style.display = '');
}

function renderQuizCard(container) {
  if (!quizState) return;
  const q = quizState.questions[quizState.current];
  const total = quizState.questions.length;
  const answered = quizState.answers.size;
  const current = quizState.current;

  // 更新进度
  container.querySelector('#quiz-prog').textContent = `${current + 1} / ${total}`;
  container.querySelector('#quiz-pbar').style.width = `${((current + 1) / total) * 100}%`;

  const optsHtml = (q.options || []).map((opt, i) => {
    const letter = String.fromCharCode(65 + i);
    const userAns = quizState.answers.get(current);
    const isCorrect = opt.startsWith(q.correct_answer + '.');
    const isSelected = userAns === letter;
    const showResult = userAns !== undefined;
    let cls = 'quiz-card-opt';
    if (isSelected) cls += ' selected';
    if (showResult && isCorrect) cls += ' correct';
    if (showResult && isSelected && !isCorrect) cls += ' wrong';
    return `<button class="${cls}" data-letter="${letter}" ${showResult ? 'disabled' : ''}>
      <span class="quiz-card-letter">${letter}</span>
      <span class="quiz-card-text">${esc(opt.replace(/^[A-Z]\.\s*/, ''))}</span>
      ${showResult && isCorrect ? '<span class="quiz-card-icon">✓</span>' : ''}
      ${showResult && isSelected && !isCorrect ? '<span class="quiz-card-icon bad">✗</span>' : ''}
    </button>`;
  }).join('');

  const answeredNow = quizState.answers.get(current) !== undefined;

  container.querySelector('#quiz-card-area').innerHTML = `
    <div class="quiz-card ${answeredNow ? 'answered' : ''}">
      <div class="quiz-card-qnum">第 ${current + 1} 题</div>
      <div class="quiz-card-type">
        <span class="tag ${q.question_type === 'choice' ? 'tag-blue' : 'tag-orange'}">${q.question_type === 'choice' ? '选择题' : '判断题'}</span>
        <span class="tag ${q.difficulty === 'easy' ? 'tag-green' : q.difficulty === 'hard' ? 'tag-red' : 'tag-yellow'}">${q.difficulty}</span>
        ${q.topic ? `<span class="tag">${esc(q.topic)}</span>` : ''}
      </div>
      <div class="quiz-card-question">${esc(q.question_text)}</div>
      <div class="quiz-card-options">${optsHtml}</div>
      ${answeredNow ? `<div class="quiz-card-feedback ${quizState.answers.get(current) === q.correct_answer ? 'correct' : 'wrong'}">
        <div class="quiz-card-feedback-title">${quizState.answers.get(current) === q.correct_answer ? '✓ 回答正确！' : '✗ 回答错误'}</div>
        ${q.explanation ? `<div class="quiz-card-feedback-explain">💡 ${esc(q.explanation)}</div>` : ''}
      </div>` : ''}
      <div class="quiz-card-nav">
        <button class="btn btn-outline" ${current === 0 ? 'disabled' : ''} id="btn-q-prev">上一题</button>
        ${answeredNow ?
          (current < total - 1 ?
            '<button class="btn btn-primary" id="btn-q-next">下一题</button>' :
            '<button class="btn btn-success" id="btn-q-finish">🏁 查看成绩</button>'
          ) :
          ''
        }
      </div>
    </div>
  `;

  // 绑定选项点击
  container.querySelectorAll('.quiz-card-opt:not([disabled])').forEach((btn) => {
    btn.onclick = () => {
      quizState.answers.set(current, btn.dataset.letter);
      if (btn.dataset.letter !== q.correct_answer) addWrongQuestion(q, btn.dataset.letter);
      renderQuizCard(container);
    };
  });

  // 上一题/下一题
  const prevBtn = container.querySelector('#btn-q-prev');
  if (prevBtn) prevBtn.onclick = () => { quizState.current--; renderQuizCard(container); };
  const nextBtn = container.querySelector('#btn-q-next');
  if (nextBtn) nextBtn.onclick = () => { quizState.current++; renderQuizCard(container); };
  const finishBtn = container.querySelector('#btn-q-finish');
  if (finishBtn) finishBtn.onclick = () => finishQuiz(container);
}

// ==================== 成绩报告 ====================
async function finishQuiz(container) {
  if (!quizState) return;
  const duration = Math.floor((Date.now() - quizState.startTime) / 1000);
  const total = quizState.questions.length;
  let correct = 0;
  const details = [];

  for (let i = 0; i < total; i++) {
    const q = quizState.questions[i];
    const ans = quizState.answers.get(i);
    const isCorrect = ans === q.correct_answer;
    if (isCorrect) correct++;
    details.push({ ...q, user_answer: ans || '', is_correct: isCorrect });
  }

  const score = total ? Math.round((correct / total) * 100) : 0;
  const grade = score >= 90 ? { text: '优秀', emoji: '🏆', cls: 'excellent' }
    : score >= 70 ? { text: '良好', emoji: '👍', cls: 'good' }
    : score >= 60 ? { text: '及格', emoji: '📈', cls: 'pass' }
    : { text: '再接再厉', emoji: '💪', cls: 'fail' };

  // 隐藏答题卡，显示报告
  container.querySelector('#quiz-runner').classList.add('hidden');
  container.querySelector('#quiz-report').classList.remove('hidden');

  const durationStr = `${Math.floor(duration / 60)}分${duration % 60}秒`;

  container.querySelector('#quiz-report-inner').innerHTML = `
    <div class="quiz-report-hero">
      <div class="quiz-report-score ${grade.cls}">
        <span class="quiz-report-emoji">${grade.emoji}</span>
        <span class="quiz-report-val">${score}</span>
        <span class="quiz-report-sub">分</span>
      </div>
      <div class="quiz-report-grade">${grade.text}</div>
      <div class="quiz-report-stats">
        <span>共 ${total} 题</span>
        <span>✓ ${correct} 正确</span>
        <span>✗ ${total - correct} 错误</span>
        <span>⏱ ${durationStr}</span>
      </div>
    </div>
    <div class="quiz-report-details">
      <h3>答题详情</h3>
      ${details.map((d, i) => `
        <div class="quiz-report-item ${d.is_correct ? 'ok' : 'err'}">
          <div class="quiz-report-item-head">
            <span class="quiz-report-item-num">${i + 1}</span>
            <span class="quiz-report-item-icon">${d.is_correct ? '✓' : '✗'}</span>
          </div>
          <div class="quiz-report-item-q">${esc(d.question_text)}</div>
          <div class="quiz-report-item-a">
            你的答案：<strong>${esc(d.user_answer) || '未作答'}</strong>
            ${!d.is_correct ? `｜正确答案：<strong class="quiz-correct-answer">${esc(d.correct_answer)}</strong>` : ''}
          </div>
          ${d.explanation ? `<div class="quiz-report-item-explain">💡 ${esc(d.explanation)}</div>` : ''}
        </div>
      `).join('')}
    </div>
    <div class="quiz-report-actions">
      <button class="btn btn-primary" id="btn-retry">🔄 再来一次</button>
      <button class="btn btn-outline" id="btn-back">返回列表</button>
    </div>
  `;

  container.querySelector('#btn-retry')?.addEventListener('click', () => {
    container.querySelector('#quiz-report').classList.add('hidden');
    startQuiz(container);
  });
  container.querySelector('#btn-back')?.addEventListener('click', () => stopQuiz(container));
}

// ==================== 错题本 ====================
function renderWrongList(container) {
  loadWrongQuestions();
  const el = container.querySelector('#wrong-list');
  const countEl = container.querySelector('#wrong-count');
  if (countEl) countEl.textContent = `${wrongQuestions.length} 题`;

  if (!wrongQuestions.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-ic">✨</div><div>暂无错题，继续保持！</div></div>`;
    return;
  }

  el.innerHTML = wrongQuestions.map((q) => `
    <div class="quiz-bank-item wrong">
      <div class="quiz-bank-meta">
        <span class="tag ${q.question_type === 'choice' ? 'tag-blue' : 'tag-orange'}">${q.question_type === 'choice' ? '选择' : '判断'}</span>
        <span class="tag ${q.difficulty === 'easy' ? 'tag-green' : q.difficulty === 'hard' ? 'tag-red' : 'tag-yellow'}">${q.difficulty}</span>
        ${q.topic ? `<span class="tag">${esc(q.topic)}</span>` : ''}
      </div>
      <div class="quiz-bank-q">${esc(q.question_text)}</div>
      <div class="quiz-bank-answer">
        <span>你的答案：<strong class="quiz-wrong-answer">${esc(q.user_answer)}</strong></span>
        <span>正确答案：<strong class="quiz-correct-answer">${esc(q.correct_answer)}</strong></span>
      </div>
      ${q.explanation ? `<div class="quiz-bank-explain">💡 ${esc(q.explanation)}</div>` : ''}
      <div class="quiz-bank-actions">
        <button class="btn btn-sm btn-outline btn-remove-wrong" data-id="${q.id}">✓ 已掌握</button>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('.btn-remove-wrong').forEach((btn) => {
    btn.onclick = () => {
      removeWrongQuestion(btn.dataset.id);
      renderWrongList(container);
      toast('✅ 已标记为掌握', 'success');
    };
  });
}
