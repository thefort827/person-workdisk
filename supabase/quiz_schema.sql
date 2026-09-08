-- ============================================================================
-- AI-BA 在线答题系统 · 补充建表脚本
-- 在 Supabase SQL Editor 执行：https://supabase.com/dashboard/project/cnurfjamlzxbnctkfezv/sql/new
-- ============================================================================

-- 题库（选择题 / 判断题）
CREATE TABLE IF NOT EXISTS public.aiba_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_num        SMALLINT CHECK (week_num BETWEEN 1 AND 10), -- 关联周次（可选）
  question_type   TEXT NOT NULL CHECK (question_type IN ('choice', 'judge')),
  -- choice: 选择题  judge: 判断题
  question_text   TEXT NOT NULL,
  -- 选择题选项（JSONB 数组 ["A. xxx", "B. xxx", ...]）
  -- 判断题固定 ["✓ 正确", "✗ 错误"]
  options         JSONB,
  -- 正确答案：选择题 "A"/"B"/"C"/"D"，判断题 "✓"/"✗"
  correct_answer  TEXT NOT NULL,
  explanation     TEXT,           -- 答案解析
  difficulty      TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  topic           TEXT,           -- 知识点标签（如 'SQL'、'口径字典'、'大模型概念'）
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 答题记录（一次答题 = 一个 quiz）
CREATE TABLE IF NOT EXISTS public.aiba_quizzes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_num        SMALLINT,
  total_questions INTEGER NOT NULL DEFAULT 0,
  correct_count   INTEGER NOT NULL DEFAULT 0,
  score           NUMERIC(5,2) DEFAULT 0,  -- 百分制得分
  duration_sec    INTEGER,                  -- 答题时长（秒）
  completed       BOOLEAN DEFAULT FALSE,
  started_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

-- 每题作答明细
CREATE TABLE IF NOT EXISTS public.aiba_quiz_answers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id         UUID NOT NULL REFERENCES public.aiba_quizzes(id) ON DELETE CASCADE,
  question_id     UUID NOT NULL REFERENCES public.aiba_questions(id) ON DELETE CASCADE,
  user_answer     TEXT,             -- 用户答案
  is_correct      BOOLEAN,
  answered_at     TIMESTAMPTZ DEFAULT now()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_aiba_questions_week ON public.aiba_questions(week_num);
CREATE INDEX IF NOT EXISTS idx_aiba_questions_type ON public.aiba_questions(question_type);
CREATE INDEX IF NOT EXISTS idx_aiba_questions_topic ON public.aiba_questions(topic);
CREATE INDEX IF NOT EXISTS idx_aiba_quiz_answers_quiz ON public.aiba_quiz_answers(quiz_id);
CREATE INDEX IF NOT EXISTS idx_aiba_quiz_answers_question ON public.aiba_quiz_answers(question_id);

-- RLS
ALTER TABLE public.aiba_questions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aiba_quizzes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aiba_quiz_answers   ENABLE ROW LEVEL SECURITY;
