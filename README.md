# 💼 财务工程师个人工作台 · BI 财务平台

基于「基础设计」升级打造的 **BI 风格财务管理工作平台**：拥有**自有后端**（Supabase 云数据库 + Serverless API），
完整的业务功能、专业 UI、细腻动画与全面响应式，可直接部署到 **Vercel**。

> ⚠️ 仅供个人备忘使用，请勿录入企业涉密真实财务数据。

---

## ✨ 功能总览

| 模块 | 说明 |
| --- | --- |
| 📊 **智能首页 · BI 看板** | KPI 指标卡（任务完成率环形图/应收应付/报税倒计时/逾期风险/打卡/学习时长）、5 组 BI 图表（任务趋势/票据占比/资金账龄/状态分布/备考时长）、今日事务中心（风险事件 60 秒自动巡检）、快捷操作 |
| 📈 **报表中心** | 区间查询（本月/上月/近30天/近90天/今年/自定义）、KPI 汇总、月度趋势组合图、票据类型分布、应收/应付 TOP5、月度明细表、一键导出 CSV |
| 📋 **财务专项待办** | 状态机管理（待处理→处理中→待复核→已完成）、优先级/分类、逾期自动高亮 |
| 🧾 **票据台账** | 进项/销项/报销/承兑全生命周期（待收票→认证→入账→归档）、到期预警 |
| 💰 **往来资金预警** | 应收应付账龄跟踪、逾期风险预警、一键标记已清 |
| 📆 **月末结账** | 按月管理结账状态与检查记录 |
| 📑 **税务管理** | 申报事项跟踪、截止日期倒计时、已申报标记 |
| 📚 **财务知识库** | 分录/税务/系统操作/Excel 技巧分类沉淀 |
| ✅ **日常待办** | 优先级清单、勾选完成、回车快速添加 |
| 🔥 **习惯打卡** | 连续天数统计、GitHub 风格 26 周热力图、本月日历 |
| 📖 **CPA 备考系统** | 章节学习记录 + 时长统计（看板图表联动） |
| 📝 **周复盘 / 🗓 月复盘** | 周期性总结沉淀 |
| 🤖 **AI 财务助手** | 右下角悬浮聊天窗 · 小米 MiMo 驱动 · 会计/税务/结账/Excel 问答 · 自动读取工作台数据回答"本周到期/逾期/应收应付"等实时问题 · SSE 流式输出 · Markdown 渲染 · 对话历史本地保存 |
| ⚙️ **设置 · 备份** | 系统连接状态巡检、JSON 全量备份/导入恢复、一键导入演示数据、访问口令锁定 |

**UI 与体验**：小清新浅色设计（薄荷绿/天蓝马卡龙配色）· 柔和光斑背景 · 卡片悬浮/入场动效 · 数字滚动 · 骨架屏 ·
Toast 轻提示 · 弹窗确认 · 响应式（桌面/平板/手机，移动端抽屉导航）。

---

## 🏗 技术架构

```
浏览器（零构建，原生 ES Modules）
   │  HTTPS（fetch）
   ▼
Vercel Serverless Functions（/api/*）—— 访问口令校验
   │  服务端密钥（浏览器不可见）
   ▼
Supabase PostgreSQL（12 张表，行级安全 RLS）
```

- **前端**：原生 HTML/CSS/JS（ES Modules + Hash 路由），Chart.js 本地化，无框架、无构建步骤
- **后端**：Vercel Serverless Functions（Node.js，零依赖），本地 `server.js` 可同构运行
- **数据库**：Supabase（PostgREST），服务端密钥只存在于后端，浏览器永远接触不到

### 目录结构

```
person-workdisk/
├── public/                  # 前端（Vercel 静态托管根目录）
│   ├── index.html           # 应用外壳
│   ├── css/app.css          # 全局样式（UI/动画/响应式）
│   ├── js/                  # ES Modules
│   │   ├── app.js           # 引导：健康检查/锁屏/时钟
│   │   ├── router.js        # Hash 路由
│   │   ├── api.js           # API 封装
│   │   ├── ai.js            # AI 财务助手（悬浮聊天窗）
│   │   ├── ui.js            # UI 组件库
│   │   ├── charts.js        # Chart.js 主题封装
│   │   ├── store.js         # 数据层/备份/演示数据
│   │   ├── crud.js          # 通用 CRUD 页面工厂
│   │   └── pages/           # 各业务页面
│   ├── vendor/              # Chart.js（本地化）
│   └── supabase/schema.sql  # 建表脚本副本（网页内可一键复制）
├── api/                     # Vercel Serverless Functions
│   ├── data.js              # 通用 CRUD
│   ├── dashboard.js         # BI 看板聚合
│   ├── report.js            # 报表中心聚合
│   ├── chat.js              # AI 助手（代理 MiMo + 数据摘要 + SSE 流式）
│   ├── health.js            # 健康检查/建表自检
│   ├── import.js            # 批量导入
│   └── _lib/                # 共享工具（Supabase 客户端/响应/鉴权）
├── supabase/schema.sql      # 数据库初始化脚本（唯一权威版本）
├── scripts/                 # 开发辅助（迁移工具/冒烟测试，非部署依赖）
├── server.js                # 本地开发服务器（零依赖）
├── vercel.json
└── .env.example
```

---

## 🚀 部署到 Vercel

### 第 1 步：初始化数据库（只需一次）

1. 打开 Supabase 控制台 → **SQL Editor**：`https://supabase.com/dashboard/project/<你的项目ref>/sql/new`
2. 把 [`supabase/schema.sql`](supabase/schema.sql) 全部内容粘贴进去，点击 **Run** 执行
   （脚本幂等，可重复执行；执行后自动创建 12 张业务表并启用行级安全）
3. 也可先部署网站，首次打开时页面会弹出"数据库尚未初始化"引导，一键复制脚本

### 第 2 步：推送到 GitHub

```bash
git init && git add . && git commit -m "feat: 财务工程师个人工作台 v1.0"
git remote add origin https://github.com/<你的账号>/person-workdisk.git
git push -u origin main
```

### 第 3 步：Vercel 导入项目

1. 登录 [vercel.com](https://vercel.com) → **Add New → Project** → 选择 `person-workdisk` 仓库
2. Framework Preset 选 **Other**（本项目无构建步骤，纯静态 + Serverless）
3. 配置环境变量（Settings → Environment Variables）：

| 变量 | 说明 | 示例 |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase 项目地址 | `https://<ref>.supabase.co` |
| `SUPABASE_SECRET_KEY` | 服务端密钥（**只配在后端**） | `sb_secret_xxxx` |
| `APP_TOKEN` | 访问口令（可选，设置后需口令才能使用） | `你的口令` |
| `MIMO_API_KEY` | AI 助手 · 小米 MiMo Token Plan 密钥（**只配在后端**） | `tp_xxxx` |
| `MIMO_API_BASE` | AI 助手 · MiMo 接口地址（可选，tp- 密钥默认） | `https://token-plan-cn.xiaomimimo.com/v1` |
| `MIMO_MODEL` | AI 助手 · 模型名（可选） | `mimov2.5` |
| `MIMO_MAX_TOKENS` | AI 助手 · 单次回答最大 token（可选） | `1600` |

4. 点击 **Deploy**，等待部署完成即可访问 `https://<项目名>.vercel.app`

> 数据库初始化时若应用提示未就绪，回到第 1 步确认建表脚本已执行。

---

## 💻 本地运行

```bash
# 1. 配置环境变量
cp .env.example .env        # 填入真实值（本地默认已指向你的 Supabase 项目）

# 2. 启动（零依赖，仅需 Node.js ≥ 18）
npm start                   # 或 node server.js
# 访问 http://localhost:3000
```

常用脚本：

```bash
# 数据库迁移（需直连数据库的网络环境，或用 Supabase SQL Editor）
cd scripts && npm install && node migrate.js ../supabase/schema.sql

# 前端冒烟测试（需先启动 server.js）
node scripts/smoke.js
```

---

## 🤖 AI 财务助手

右下角悬浮机器人，基于**小米 MiMo**（OpenAI 兼容接口）实现，后端 `api/chat.js` 代理调用，**双模式**：

- **在线模式**（配置 `MIMO_API_KEY`）：
  - **财务专家问答**：会计分录、增值税/个税/企业所得税申报、发票认证抵扣、月末结账、往来账龄与坏账、Excel 技巧、CPA/中级备考
  - **实时数据问答**：每次提问后端自动从数据库生成一份**数据摘要**注入上下文，可回答"本周有哪些到期/逾期""应收应付情况""帮我做学习复盘"等
  - **流式输出**：SSE 打字机效果 + Markdown 渲染（标题/列表/代码块/引用）
- **离线模式**（未配置密钥）：自动基于工作台实时数据生成**结构化分析报告**（资金概览、逾期应收应付、票据到期提醒、任务完成率、税务待办、结账状态、习惯与建议），开箱即用、无需任何密钥

**隐私与安全**：AI 密钥只存在于后端环境变量（`MIMO_API_KEY`），浏览器永远接触不到；对话历史仅保存在本地浏览器 `localStorage`，不上传数据库；发送给模型的是工作台数据摘要，请勿在对话中透露企业涉密信息。

> ⚠️ 需在 [小米 MiMo 开放平台](https://platform.xiaomimimo.com) 创建 API Key（Token Plan 的 tp- 密钥或按量付费的 sk- 密钥）；Token Plan 请确保套餐额度充足，按量付费请确保账户余额充足。
> 生成的政策类回答仅供参考，重要事项请以最新法规为准并咨询税务师。

---

## 🔐 安全说明

- `SUPABASE_SECRET_KEY`（服务端密钥）**仅用于后端**，请勿放入前端代码或浏览器环境变量
- 数据库已启用 **RLS 行级安全**：公钥无法绕过 API 直接访问数据
- 建议在生产环境设置 `APP_TOKEN` 访问口令
- 本项目为单用户个人工具，未实现多用户鉴权

---

## 📄 License

个人项目，自由使用。
