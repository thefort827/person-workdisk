-- 迁移脚本：为CPA备考系统添加新字段
-- 执行方式：登录Supabase控制台 -> SQL Editor -> 粘贴本文件内容 -> Run

-- 为studies表添加新字段
ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS subject text not null default 'accounting';
ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS difficulty integer not null default 3;
ALTER TABLE public.studies ADD COLUMN IF NOT EXISTS mastery text not null default 'learning';

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_studies_subject ON public.studies(subject);
CREATE INDEX IF NOT EXISTS idx_studies_mastery ON public.studies(mastery);

-- 更新现有数据的默认值（可选）
-- UPDATE public.studies SET subject = 'accounting' WHERE subject IS NULL;
-- UPDATE public.studies SET difficulty = 3 WHERE difficulty IS NULL;
-- UPDATE public.studies SET mastery = 'learning' WHERE mastery IS NULL;