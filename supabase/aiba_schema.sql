-- ============================================================================
-- AI-BA（业财供应链）学习工作台 · Supabase 数据库初始化脚本
-- 使用方式：在 Supabase 控制台 → SQL Editor 粘贴执行
-- ============================================================================

-- 学习计划主表（10周任务）
CREATE TABLE IF NOT EXISTS public.aiba_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_num        SMALLINT NOT NULL CHECK (week_num BETWEEN 1 AND 10),
  week_title      TEXT NOT NULL,
  goal            TEXT,
  learning_points TEXT[], -- 学习知识点
  completed       BOOLEAN DEFAULT FALSE,
  order_index     INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 学习任务（每周的子任务）
CREATE TABLE IF NOT EXISTS public.aiba_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID REFERENCES public.aiba_plans(id) ON DELETE CASCADE,
  description     TEXT NOT NULL,
  completed       BOOLEAN DEFAULT FALSE,
  output_doc      TEXT, -- 输出物名称
  output_file_url TEXT, -- 产出物文件链接
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 每周复盘
CREATE TABLE IF NOT EXISTS public.aiba_weekly_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_num        SMALLINT UNIQUE NOT NULL CHECK (week_num BETWEEN 1 AND 10),
  review_text     TEXT,
  kpis            JSONB, -- {完成率, 时长h, 输出物}
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 输出物清单
CREATE TABLE IF NOT EXISTS public.aiba_deliverables (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  category        TEXT, -- '文档'|'代码'|'报告'|'素材'
  status          TEXT DEFAULT 'pending', -- pending/in_progress/done
  file_url        TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 模板仓库
CREATE TABLE IF NOT EXISTS public.aiba_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  category        TEXT NOT NULL, -- '口径字典'|'BRD文档'|'测试用例'
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 学习资源
CREATE TABLE IF NOT EXISTS public.aiba_resources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_num        SMALLINT NOT NULL CHECK (week_num BETWEEN 1 AND 10),
  title           TEXT NOT NULL,
  url             TEXT,
  platform        TEXT, -- 'B站'|'知乎'|'其他'
  description     TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 工具库
CREATE TABLE IF NOT EXISTS public.aiba_tools (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category        TEXT, -- 'SQL练习'|'Agent平台'|'文档工具'|'行业参考'
  name            TEXT NOT NULL,
  url             TEXT,
  description     TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 避坑清单
CREATE TABLE IF NOT EXISTS public.aiba_pitfalls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content         TEXT NOT NULL,
  is_warning      BOOLEAN DEFAULT FALSE, -- TRUE=✅正确做法, FALSE=❌错误做法
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 求职关键词
CREATE TABLE IF NOT EXISTS public.aiba_job_keywords (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword         TEXT NOT NULL UNIQUE,
  category        TEXT, -- '核心岗位'|'细分方向'
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 学习时间记录（手动或自动）
CREATE TABLE IF NOT EXISTS public.aiba_study_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_num        SMALLINT NOT NULL,
  study_date      DATE NOT NULL,
  duration_minutes INTEGER NOT NULL,
  description     TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 角色边界
CREATE TABLE IF NOT EXISTS public.aiba_role_boundaries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name       TEXT NOT NULL, -- 'AI-BA'|'AI产品'|'算法'
  can_do          TEXT[], -- 能做的事
  cannot_do       TEXT[], -- 不能做的事
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 勾选状态索引（加速查询）
CREATE INDEX IF NOT EXISTS idx_aiba_tasks_plan_id ON public.aiba_tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_aiba_tasks_completed ON public.aiba_tasks(completed);
CREATE INDEX IF NOT EXISTS idx_aiba_resources_week ON public.aiba_resources(week_num);
CREATE INDEX IF NOT EXISTS idx_aiba_study_logs_week ON public.aiba_study_logs(week_num);

-- 安全策略（service_role 绕过 RLS，anon 无法直接访问）
ALTER TABLE public.aiba_plans          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aiba_tasks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aiba_weekly_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aiba_deliverables   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aiba_templates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aiba_resources      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aiba_tools          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aiba_pitfalls       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aiba_job_keywords   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aiba_study_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aiba_role_boundaries ENABLE ROW LEVEL SECURITY;
