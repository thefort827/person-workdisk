'use strict';

/**
 * /api/aiba —— AI-BA 学习计划 API
 * 
 * GET /api/aiba?action=progress          → 学习进度统计
 * GET /api/aiba?action=plans             → 所有周计划 + 任务
 * GET /api/aiba?action=plan&week=1       → 指定周计划 + 任务
 * POST /api/aiba?action=task             → 创建任务 {plan_id, description, output_doc}
 * PATCH /api/aiba?action=task&id=xxx     → 更新任务 {completed, output_file_url}
 * DELETE /api/aiba?action=task&id=xxx    → 删除任务
 * POST /api/aiba?action=review           → 保存周复盘 {week_num, review_text, kpis}
 * GET /api/aiba?action=resources&week=1  → 学习资源
 * GET /api/aiba?action=templates         → 模板仓库
 * GET /api/aiba?action=tools             → 工具库
 * GET /api/aiba?action=deliverables      → 输出物清单
 * POST /api/aiba?action=studylog         → 记录学习时间 {week_num, study_date, duration_minutes, description}
 */

const { listTable, insertRow, updateRow, deleteRow } = require('./_lib/supabase');
const { sendJson, sendError, checkAuth, readBody, parseQuery } = require('./_lib/respond');

module.exports = async function handler(req, res) {
  try {
    if (!checkAuth(req)) return sendJson(res, 401, { ok: false, error: '访问口令不正确', code: 'AUTH' });
    if ((req.method || 'GET').toUpperCase() === 'OPTIONS') return sendJson(res, 200, { ok: true });

    const method = (req.method || 'GET').toUpperCase();
    const q = parseQuery(req.url.split('?')[1]);
    const action = q.action;

    // 1. 学习进度统计
    if (action === 'progress' && method === 'GET') {
      const [plans, tasks, reviews, deliverables, studyLogs] = await Promise.all([
        listTable('aiba_plans', { order: 'week_num.asc' }),
        listTable('aiba_tasks'),
        listTable('aiba_weekly_reviews'),
        listTable('aiba_deliverables'),
        listTable('aiba_study_logs'),
      ]);

      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t) => t.completed).length;
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      const totalStudyHours = studyLogs.reduce((sum, log) => sum + (log.duration_minutes || 0), 0) / 60;
      const deliverablesDone = deliverables.filter((d) => d.status === 'done').length;

      const weeklyProgress = plans.map((plan) => {
        const planTasks = tasks.filter((t) => t.plan_id === plan.id);
        const planDone = planTasks.filter((t) => t.completed).length;
        return {
          week_num: plan.week_num,
          week_title: plan.week_title,
          total: planTasks.length,
          done: planDone,
          rate: planTasks.length > 0 ? Math.round((planDone / planTasks.length) * 100) : 0,
        };
      });

      const currentWeek = plans.find((p) => {
        const planTasks = tasks.filter((t) => t.plan_id === p.id);
        return planTasks.length > 0 && !planTasks.every((t) => t.completed);
      });

      return sendJson(res, 200, {
        ok: true,
        data: {
          summary: {
            totalWeeks: plans.length,
            totalTasks,
            completedTasks,
            completionRate,
            totalStudyHours: Math.round(totalStudyHours * 10) / 10,
            deliverablesDone,
            deliverablesTotal: deliverables.length,
            currentWeek: currentWeek ? currentWeek.week_num : null,
          },
          weeklyProgress,
        },
      });
    }

    // 2. 获取所有周计划 + 任务
    if (action === 'plans' && method === 'GET') {
      const [plans, tasks] = await Promise.all([
        listTable('aiba_plans', { order: 'week_num.asc' }),
        listTable('aiba_tasks', { order: 'created_at.asc' }),
      ]);
      const plansWithTasks = plans.map((plan) => ({
        ...plan,
        tasks: tasks.filter((t) => t.plan_id === plan.id),
      }));
      return sendJson(res, 200, { ok: true, data: plansWithTasks });
    }

    // 3. 获取指定周计划
    if (action === 'plan' && method === 'GET') {
      const week = parseInt(q.week);
      if (!week || week < 1 || week > 10) return sendJson(res, 400, { ok: false, error: 'week 参数必须 1-10' });
      const [plans, tasks] = await Promise.all([
        listTable('aiba_plans', { filters: { week_num: `eq.${week}` } }),
        listTable('aiba_tasks'),
      ]);
      const plan = plans[0];
      if (!plan) return sendJson(res, 200, { ok: true, data: null });
      const planTasks = tasks.filter((t) => t.plan_id === plan.id);
      return sendJson(res, 200, { ok: true, data: { ...plan, tasks: planTasks } });
    }

    // 4. 创建任务
    if (action === 'task' && method === 'POST') {
      const body = await readBody(req);
      if (!body.plan_id || !body.description) return sendJson(res, 400, { ok: false, error: '缺少 plan_id 或 description' });
      const newTask = await insertRow('aiba_tasks', {
        plan_id: body.plan_id,
        description: body.description,
        output_doc: body.output_doc || null,
        completed: false,
      });
      return sendJson(res, 201, { ok: true, data: newTask });
    }

    // 5. 更新任务
    if (action === 'task' && method === 'PATCH') {
      if (!q.id) return sendJson(res, 400, { ok: false, error: '缺少 id' });
      const body = await readBody(req);
      const updated = await updateRow('aiba_tasks', q.id, {
        completed: body.completed,
        output_doc: body.output_doc,
        output_file_url: body.output_file_url,
      });
      return sendJson(res, 200, { ok: true, data: updated });
    }

    // 6. 删除任务
    if (action === 'task' && method === 'DELETE') {
      if (!q.id) return sendJson(res, 400, { ok: false, error: '缺少 id' });
      await deleteRow('aiba_tasks', q.id);
      return sendJson(res, 200, { ok: true });
    }

    // 7. 保存周复盘
    if (action === 'review' && method === 'POST') {
      const body = await readBody(req);
      if (!body.week_num) return sendJson(res, 400, { ok: false, error: '缺少 week_num' });
      const existing = await listTable('aiba_weekly_reviews', { filters: { week_num: `eq.${body.week_num}` } });
      let result;
      if (existing.length > 0) {
        result = await updateRow('aiba_weekly_reviews', existing[0].id, {
          review_text: body.review_text,
          kpis: body.kpis,
        });
      } else {
        result = await insertRow('aiba_weekly_reviews', {
          week_num: body.week_num,
          review_text: body.review_text,
          kpis: body.kpis,
        });
      }
      return sendJson(res, 200, { ok: true, data: result });
    }

    // 8. 学习资源
    if (action === 'resources' && method === 'GET') {
      const filters = q.week ? { week_num: `eq.${q.week}` } : {};
      const data = await listTable('aiba_resources', { filters, order: 'week_num.asc' });
      return sendJson(res, 200, { ok: true, data });
    }

    // 9. 模板仓库
    if (action === 'templates' && method === 'GET') {
      const data = await listTable('aiba_templates', { order: 'category.asc' });
      return sendJson(res, 200, { ok: true, data });
    }

    // 10. 工具库
    if (action === 'tools' && method === 'GET') {
      const data = await listTable('aiba_tools', { order: 'category.asc' });
      return sendJson(res, 200, { ok: true, data });
    }

    // 11. 输出物清单
    if (action === 'deliverables' && method === 'GET') {
      const data = await listTable('aiba_deliverables', { order: 'created_at.asc' });
      return sendJson(res, 200, { ok: true, data });
    }

    // 12. 记录学习时间
    if (action === 'studylog' && method === 'POST') {
      const body = await readBody(req);
      if (!body.week_num || !body.duration_minutes) return sendJson(res, 400, { ok: false, error: '缺少 week_num 或 duration_minutes' });
      const newLog = await insertRow('aiba_study_logs', {
        week_num: body.week_num,
        study_date: body.study_date || new Date().toISOString().slice(0, 10),
        duration_minutes: body.duration_minutes,
        description: body.description || null,
      });
      return sendJson(res, 201, { ok: true, data: newLog });
    }

    // ============ 题库管理 & 答题系统 ============

    // 13. 创建题目（出题）
    if (action === 'question' && method === 'POST') {
      const body = await readBody(req);
      if (!body.question_text) return sendJson(res, 400, { ok: false, error: '缺少题目内容' });
      if (!body.question_type || !['choice', 'judge'].includes(body.question_type)) {
        return sendJson(res, 400, { ok: false, error: 'question_type 必须为 choice 或 judge' });
      }
      if (!body.correct_answer) return sendJson(res, 400, { ok: false, error: '缺少正确答案' });

      // 判断题自动生成选项
      let options = body.options;
      if (body.question_type === 'judge') {
        options = ['✓ 正确', '✗ 错误'];
      }

      const newQ = await insertRow('aiba_questions', {
        week_num: body.week_num || null,
        question_type: body.question_type,
        question_text: body.question_text,
        options,
        correct_answer: body.correct_answer,
        explanation: body.explanation || null,
        difficulty: body.difficulty || 'medium',
        topic: body.topic || null,
      });
      return sendJson(res, 201, { ok: true, data: newQ });
    }

    // 14. 获取题库（支持按周次/知识点/类型筛选）
    if (action === 'questions' && method === 'GET') {
      const filters = {};
      if (q.week_num) filters.week_num = `eq.${q.week_num}`;
      if (q.topic) filters.topic = `eq.${q.topic}`;
      if (q.question_type) filters.question_type = `eq.${q.question_type}`;
      const data = await listTable('aiba_questions', { filters, order: 'created_at.desc' });
      return sendJson(res, 200, { ok: true, data });
    }

    // 15. 删除题目
    if (action === 'question' && method === 'DELETE') {
      if (!q.id) return sendJson(res, 400, { ok: false, error: '缺少 id' });
      await deleteRow('aiba_questions', q.id);
      return sendJson(res, 200, { ok: true });
    }

    // 16. 开始答题（生成试卷）
    if (action === 'start-quiz' && method === 'POST') {
      const body = await readBody(req);
      const limit = Math.min(body.count || 10, 50);
      const filters = {};
      if (body.week_num) filters.week_num = `eq.${body.week_num}`;
      if (body.topic) filters.topic = `eq.${body.topic}`;
      if (body.difficulty) filters.difficulty = `eq.${body.difficulty}`;

      const allQ = await listTable('aiba_questions', { filters, limit: 200 });
      if (!allQ.length) return sendJson(res, 400, { ok: false, error: '题库为空，请先出题' });

      // 随机抽题
      const shuffled = allQ.sort(() => Math.random() - 0.5).slice(0, limit);
      const quiz = await insertRow('aiba_quizzes', {
        week_num: body.week_num || null,
        total_questions: shuffled.length,
        correct_count: 0,
        score: 0,
      });

      return sendJson(res, 200, {
        ok: true,
        data: {
          quiz,
          questions: shuffled.map((q2) => ({
            id: q2.id,
            question_type: q2.question_type,
            question_text: q2.question_text,
            options: q2.options,
            difficulty: q2.difficulty,
            topic: q2.topic,
          })),
        },
      });
    }

    // 17. 提交答题 & 自动评分
    if (action === 'submit-quiz' && method === 'POST') {
      const body = await readBody(req);
      if (!body.quiz_id) return sendJson(res, 400, { ok: false, error: '缺少 quiz_id' });
      if (!Array.isArray(body.answers)) return sendJson(res, 400, { ok: false, error: 'answers 必须是数组' });

      // 获取题目（含正确答案）
      const questionIds = body.answers.map((a) => a.question_id);
      const questions = await Promise.all(
        questionIds.map((id) =>
          listTable('aiba_questions', { filters: { id: `eq.${id}` }, limit: 1 }).then((r) => r[0])
        )
      );

      let correct = 0;
      const details = [];

      for (const ans of body.answers) {
        const q2 = questions.find((x) => x && x.id === ans.question_id);
        if (!q2) continue;
        const isCorrect = ans.user_answer === q2.correct_answer;
        if (isCorrect) correct++;

        await insertRow('aiba_quiz_answers', {
          quiz_id: body.quiz_id,
          question_id: ans.question_id,
          user_answer: ans.user_answer,
          is_correct: isCorrect,
        });

        details.push({
          question_id: ans.question_id,
          question_text: q2.question_text,
          user_answer: ans.user_answer,
          correct_answer: q2.correct_answer,
          is_correct: isCorrect,
          explanation: q2.explanation,
          options: q2.options,
        });
      }

      const total = body.answers.length;
      const score = total > 0 ? Math.round((correct / total) * 100) : 0;

      // 更新 quiz 记录
      await updateRow('aiba_quizzes', body.quiz_id, {
        correct_count: correct,
        score,
        completed: true,
        completed_at: new Date().toISOString(),
        duration_sec: body.duration_sec || null,
      });

      return sendJson(res, 200, {
        ok: true,
        data: { total, correct, score, details },
      });
    }

    // 18. 答题记录（历史）
    if (action === 'quiz-history' && method === 'GET') {
      const data = await listTable('aiba_quizzes', { order: 'started_at.desc', limit: 50 });
      return sendJson(res, 200, { ok: true, data });
    }

    return sendJson(res, 400, { ok: false, error: '无效的 action' });
  } catch (err) {
    return sendError(res, err);
  }
};
