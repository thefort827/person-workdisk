-- ============================================================================
-- 财务工程师个人工作台 · Supabase 数据库初始化脚本
-- 使用方式：登录 Supabase 控制台 -> SQL Editor -> 粘贴本文件全部内容 -> Run
-- 脚本可重复执行（幂等），不会破坏已有数据。
-- ============================================================================

-- ---------- 公共工具：自动更新 updated_at ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- 1. 财务专项待办 ----------
create table if not exists public.ft_tasks (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  deadline    date,
  priority    text not null default 'mid',   -- high / mid / low
  category    text not null default 'tax',   -- tax / receivable / payable / cost / close
  status      text not null default 'pending',-- pending / processing / review / done
  note        text,
  done_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists trg_ft_tasks_upd on public.ft_tasks;
create trigger trg_ft_tasks_upd before update on public.ft_tasks
  for each row execute function public.set_updated_at();
create index if not exists idx_ft_tasks_status on public.ft_tasks(status);
create index if not exists idx_ft_tasks_deadline on public.ft_tasks(deadline);

-- ---------- 2. 票据全生命周期台账 ----------
create table if not exists public.invoices (
  id            uuid primary key default gen_random_uuid(),
  inv_type      text not null default 'input',  -- input/output/expense/accept
  inv_no        text,
  counterparty  text,
  inv_date      date,
  expire        date,
  amount        numeric(18,2),
  status        text not null default 'wait',   -- wait/auth/entry/archive
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
drop trigger if exists trg_invoices_upd on public.invoices;
create trigger trg_invoices_upd before update on public.invoices
  for each row execute function public.set_updated_at();
create index if not exists idx_invoices_type on public.invoices(inv_type);
create index if not exists idx_invoices_expire on public.invoices(expire);

-- ---------- 3. 往来资金风险预警 ----------
create table if not exists public.funds (
  id          uuid primary key default gen_random_uuid(),
  fund_type   text not null default 'receivable', -- receivable / payable
  party       text not null,
  amount      numeric(18,2),
  deadline    date,
  status      text not null default 'open',      -- open / cleared
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists trg_funds_upd on public.funds;
create trigger trg_funds_upd before update on public.funds
  for each row execute function public.set_updated_at();
create index if not exists idx_funds_type on public.funds(fund_type);
create index if not exists idx_funds_deadline on public.funds(deadline);

-- ---------- 4. 月末结账 ----------
create table if not exists public.month_closes (
  id          uuid primary key default gen_random_uuid(),
  month       text not null unique,             -- YYYY-MM
  status      text not null default 'pending',  -- pending/processing/review/done
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists trg_month_closes_upd on public.month_closes;
create trigger trg_month_closes_upd before update on public.month_closes
  for each row execute function public.set_updated_at();

-- ---------- 5. 税务管理专区 ----------
create table if not exists public.tax_records (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  deadline    date,
  status      text not null default 'pending',  -- pending / done
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists trg_tax_records_upd on public.tax_records;
create trigger trg_tax_records_upd before update on public.tax_records
  for each row execute function public.set_updated_at();
create index if not exists idx_tax_records_deadline on public.tax_records(deadline);

-- ---------- 6. 结构化财务知识库 ----------
create table if not exists public.knowledge (
  id          uuid primary key default gen_random_uuid(),
  title       text,
  body        text not null,
  tag         text not null default 'entry',    -- entry/tax/sys/excel/other
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists trg_knowledge_upd on public.knowledge;
create trigger trg_knowledge_upd before update on public.knowledge
  for each row execute function public.set_updated_at();

-- ---------- 7. 日常待办 ----------
create table if not exists public.todos (
  id          uuid primary key default gen_random_uuid(),
  text        text not null,
  priority    text not null default 'mid',      -- high / mid / low
  done        boolean not null default false,
  done_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists trg_todos_upd on public.todos;
create trigger trg_todos_upd before update on public.todos
  for each row execute function public.set_updated_at();

-- ---------- 8. 习惯打卡 ----------
create table if not exists public.checkins (
  id          uuid primary key default gen_random_uuid(),
  date        text not null unique,             -- YYYY-MM-DD
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_checkins_date on public.checkins(date);

-- ---------- 9. CPA / 中级备考系统 ----------
create table if not exists public.studies (
  id          uuid primary key default gen_random_uuid(),
  chapter     text,
  note        text,
  minutes     integer not null default 0,       -- 学习时长（分钟）
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
drop trigger if exists trg_studies_upd on public.studies;
create trigger trg_studies_upd before update on public.studies
  for each row execute function public.set_updated_at();

-- ---------- 10. 周复盘 ----------
create table if not exists public.week_reviews (
  id          uuid primary key default gen_random_uuid(),
  content     text not null,
  week_label  text,
  created_at  timestamptz not null default now()
);

-- ---------- 11. 月复盘 ----------
create table if not exists public.month_reviews (
  id          uuid primary key default gen_random_uuid(),
  content     text not null,
  month_label text,
  created_at  timestamptz not null default now()
);

-- ---------- 12. 系统设置（键值存储） ----------
create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
drop trigger if exists trg_app_settings_upd on public.app_settings;
create trigger trg_app_settings_upd before update on public.app_settings
  for each row execute function public.set_updated_at();

-- ---------- 权限与安全 ----------
-- 启用行级安全：仅服务端密钥（service_role，自动绕过 RLS）可读写，
-- 前端浏览器中的公开密钥（anon/publishable）无法直接访问数据，必须经过我们的 API。
alter table public.ft_tasks      enable row level security;
alter table public.invoices      enable row level security;
alter table public.funds         enable row level security;
alter table public.month_closes  enable row level security;
alter table public.tax_records   enable row level security;
alter table public.knowledge     enable row level security;
alter table public.todos         enable row level security;
alter table public.checkins      enable row level security;
alter table public.studies       enable row level security;
alter table public.week_reviews  enable row level security;
alter table public.month_reviews enable row level security;
alter table public.app_settings  enable row level security;

-- 提示：以上全部执行成功即完成初始化。可在 SQL Editor 中执行以下语句自检：
-- select table_name from information_schema.tables where table_schema='public' order by table_name;
