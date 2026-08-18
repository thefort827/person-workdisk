import { esc, toast, countUp, fmtMoneyShort, fmtMoney, daysFromToday, todayStr } from '../ui.js';
import { loadDashboard } from '../store.js';
import { makeChart, SERIES, PALETTE, baseOptions, axisGrid, moneyFmt } from '../charts.js';

const TASK_STATUS = { pending: '待处理', processing: '处理中', review: '待复核', done: '已完成' };
const TASK_CAT = { tax: '税务', receivable: '应收', payable: '应付', cost: '成本', close: '结账' };
const INV_TYPE = { input: '进项', output: '销项', expense: '报销', accept: '承兑' };

export const dashboardPage = {
  id: 'dashboard',
  title: '智能首页 · BI 看板',
  subtitle: '全自动今日智能事务中心',
  icon: '📊',
  render: async (container) => {
    container.innerHTML = `
      <div class="glass-card fade-in">
        <div class="card-head">
          <div class="card-title"><span class="bar"></span>💡 智能首页</div>
          <div class="card-actions">
            <span class="count-pill" id="dash-ts">加载中…</span>
            <button class="btn btn-outline btn-sm" id="dash-refresh">🔄 刷新</button>
          </div>
        </div>
        <div class="kpi-grid" id="dash-kpis"></div>
      </div>

      <div class="chart-grid">
        <div class="glass-card hoverable chart-box fade-in">
          <div class="card-head"><div class="card-title"><span class="bar"></span>财务任务趋势 · 近12个月</div></div>
          <div class="chart-wrap tall"><canvas id="ch-taskTrend"></canvas></div>
        </div>
        <div class="glass-card hoverable chart-box fade-in">
          <div class="card-head"><div class="card-title"><span class="bar"></span>票据类型金额占比</div></div>
          <div class="chart-wrap"><canvas id="ch-invoiceType"></canvas></div>
        </div>
        <div class="glass-card hoverable chart-box fade-in">
          <div class="card-head"><div class="card-title"><span class="bar"></span>往来资金账龄分布（未清）</div></div>
          <div class="chart-wrap"><canvas id="ch-fundAging"></canvas></div>
        </div>
        <div class="glass-card hoverable chart-box fade-in">
          <div class="card-head"><div class="card-title"><span class="bar"></span>财务任务状态分布</div></div>
          <div class="chart-wrap"><canvas id="ch-taskStatus"></canvas></div>
        </div>
        <div class="glass-card hoverable chart-box fade-in">
          <div class="card-head"><div class="card-title"><span class="bar"></span>备考学习时长 · 按章节</div></div>
          <div class="chart-wrap"><canvas id="ch-study"></canvas></div>
        </div>
        <div class="glass-card hoverable chart-box fade-in">
          <div class="card-head"><div class="card-title"><span class="bar"></span>票据金额趋势 · 近12个月</div></div>
          <div class="chart-wrap"><canvas id="ch-invoiceTrend"></canvas></div>
        </div>
      </div>

      <div class="grid-2">
        <div class="glass-card fade-in">
          <div class="card-head">
            <div class="card-title"><span class="bar"></span>🚨 今日事务中心 <span class="count-pill" id="dash-evCount"></span></div>
            <span class="count-pill" id="dash-countdown"></span>
          </div>
          <div id="dash-events"></div>
        </div>
        <div class="glass-card fade-in">
          <div class="card-head"><div class="card-title"><span class="bar"></span>⚡ 快捷操作</div></div>
          <div class="kpi-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));">
            <a class="kpi-card hoverable" href="#fintodo" style="text-decoration:none;"><div class="kpi-label">📋 新增财务任务</div><div class="kpi-val" style="font-size:15px;">任务管理</div></a>
            <a class="kpi-card hoverable" href="#invoice" style="text-decoration:none;"><div class="kpi-label">🧾 新增票据</div><div class="kpi-val" style="font-size:15px;">票据台账</div></a>
            <a class="kpi-card hoverable" href="#fund" style="text-decoration:none;"><div class="kpi-label">💰 登记往来款</div><div class="kpi-val" style="font-size:15px;">资金预警</div></a>
            <a class="kpi-card hoverable" href="#checkin" style="text-decoration:none;"><div class="kpi-label">🔥 今日打卡</div><div class="kpi-val" style="font-size:15px;">习惯打卡</div></a>
            <a class="kpi-card hoverable" href="#report" style="text-decoration:none;"><div class="kpi-label">📈 查看报表</div><div class="kpi-val" style="font-size:15px;">报表中心</div></a>
            <a class="kpi-card hoverable" href="#knowledge" style="text-decoration:none;"><div class="kpi-label">📚 记一条知识</div><div class="kpi-val" style="font-size:15px;">知识库</div></a>
          </div>
          <div class="divider"></div>
          <div class="card-head"><div class="card-title" style="font-size:13.5px;">📌 结账状态</div></div>
          <div id="dash-close" class="mt-8"></div>
        </div>
      </div>`;

    let lastData = null;

    const refreshBtn = container.querySelector('#dash-refresh');
    refreshBtn.onclick = async () => {
      refreshBtn.disabled = true;
      await load(container);
      refreshBtn.disabled = false;
      toast('看板已刷新', 'success');
    };

    async function load(dom) {
      try {
        const d = await loadDashboard(true);
        lastData = d;
        renderKpis(dom, d);
        renderEvents(dom, d);
        renderClose(dom, d);
        renderCharts(d);
        const ts = dom.querySelector('#dash-ts');
        ts.textContent = `更新于 ${new Date(d.generatedAt).toLocaleTimeString('zh-CN')}`;
      } catch (err) {
        const ev = dom.querySelector('#dash-events');
        if (ev) ev.innerHTML = `<div class="empty-state"><div class="empty-ic">⚠️</div><div>${esc(err.message)}</div></div>`;
      }
    }

    // 60 秒自动巡检
    let countdown = 60;
    const cdEl = container.querySelector('#dash-countdown');
    const tick = setInterval(() => {
      countdown--;
      if (cdEl) cdEl.textContent = `下次自动巡检 ${countdown}s`;
      if (countdown <= 0) {
        countdown = 60;
        load(container);
      }
    }, 1000);
    if (cdEl) cdEl.textContent = '下次自动巡检 60s';

    // 路由切换时清理定时器
    dashboardPage._cleanup = () => clearInterval(tick);

    await load(container);
  },
};

/* ---------------- KPI ---------------- */
function renderKpis(dom, d) {
  const k = d.kpis;
  const wrap = dom.querySelector('#dash-kpis');
  const closeText = { pending: '未开始', processing: '结账进行中', review: '复核中', done: '✅ 已结账' }[k.monthCloseStatus] || '未开始';
  const closeCls = { pending: 'tag-pending', processing: 'tag-processing', review: 'tag-review', done: 'tag-done' }[k.monthCloseStatus] || 'tag-pending';

  wrap.innerHTML = `
    <div class="kpi-card green">
      <div class="kpi-top"><span class="kpi-label">财务任务完成率</span><span class="kpi-ic">🎯</span></div>
      <div class="ring-wrap" style="justify-content:center;">
        <svg class="ring" width="92" height="92" viewBox="0 0 110 110">
          <defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#5b78ff"/><stop offset="100%" stop-color="#2fd99a"/></linearGradient></defs>
          <circle class="ring-track" cx="55" cy="55" r="46" fill="none" stroke-width="10"/>
          <circle class="ring-fill" id="dash-ring" cx="55" cy="55" r="46" fill="none" stroke-width="10" stroke-dasharray="289.03" stroke-dashoffset="289.03"/>
          <text class="ring-text" x="55" y="58" id="dash-ringText">0%</text>
          <text class="ring-sub" x="55" y="73">${k.taskDone}/${k.taskTotal}</text>
        </svg>
      </div>
      <div class="kpi-delta up center">完成 ${k.taskDone} · 共 ${k.taskTotal} 项</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-top"><span class="kpi-label">应收总额（未清）</span><span class="kpi-ic">💵</span></div>
      <div class="kpi-val" id="kpi-rec">¥ 0</div>
      <div class="kpi-delta up">回款压力 ${fmtMoneyShort(k.receivableTotal)}</div>
    </div>
    <div class="kpi-card orange">
      <div class="kpi-top"><span class="kpi-label">应付总额（未清）</span><span class="kpi-ic">💳</span></div>
      <div class="kpi-val" id="kpi-pay">¥ 0</div>
      <div class="kpi-delta down">付款安排 ${fmtMoneyShort(k.payableTotal)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-top"><span class="kpi-label">报税倒计时</span><span class="kpi-ic">🗓</span></div>
      <div class="kpi-val" id="kpi-tax">--<small>天</small></div>
      <div class="kpi-delta">待申报事项 <b>${k.taxPending}</b> 项</div>
    </div>
    <div class="kpi-card red">
      <div class="kpi-top"><span class="kpi-label">逾期风险事项</span><span class="kpi-ic">🚨</span></div>
      <div class="kpi-val" id="kpi-overdue">0</div>
      <div class="kpi-delta down">今日事务 ${k.eventTotal} 条</div>
    </div>
    <div class="kpi-card yellow">
      <div class="kpi-top"><span class="kpi-label">近7天到期</span><span class="kpi-ic">⏳</span></div>
      <div class="kpi-val" id="kpi-near7">0</div>
      <div class="kpi-delta">含今日到期事项</div>
    </div>
    <div class="kpi-card green">
      <div class="kpi-top"><span class="kpi-label">连续打卡</span><span class="kpi-ic">🔥</span></div>
      <div class="kpi-val" id="kpi-streak">0<small>天</small></div>
      <div class="kpi-delta up">累计 ${k.checkinTotal} 天</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-top"><span class="kpi-label">学习时长</span><span class="kpi-ic">📖</span></div>
      <div class="kpi-val" id="kpi-study">0<small>分钟</small></div>
      <div class="kpi-delta">${k.studyCount} 条学习记录</div>
    </div>`;

  // 动画数字
  countUp(dom.querySelector('#kpi-rec'), k.receivableTotal, { duration: 900, decimals: 0, suffix: '' });
  countUp(dom.querySelector('#kpi-pay'), k.payableTotal, { duration: 900, decimals: 0, suffix: '' });
  countUp(dom.querySelector('#kpi-tax'), k.taxCountdown, { duration: 700, suffix: '天' });
  countUp(dom.querySelector('#kpi-overdue'), k.dangerCount, { duration: 700 });
  countUp(dom.querySelector('#kpi-near7'), k.nearCount, { duration: 700 });
  countUp(dom.querySelector('#kpi-streak'), k.checkinStreak, { duration: 800, suffix: '天' });
  countUp(dom.querySelector('#kpi-study'), k.studyMinutes, { duration: 800, suffix: '分钟' });

  // 环形
  const ring = dom.querySelector('#dash-ring');
  const rate = k.taskRate || 0;
  setTimeout(() => {
    if (ring) ring.style.strokeDashoffset = 289.03 * (1 - rate / 100);
    const t = dom.querySelector('#dash-ringText');
    if (t) countUp(t, rate, { duration: 900, suffix: '%' });
  }, 120);
}

/* ---------------- 事件 ---------------- */
function renderEvents(dom, d) {
  const wrap = dom.querySelector('#dash-events');
  const evts = d.lists.events || [];
  dom.querySelector('#dash-evCount').textContent = `${evts.length} 条待处理`;
  if (!evts.length) {
    wrap.innerHTML = `<div class="empty-state"><div class="empty-ic">✅</div><div>暂无风险事件，一切正常</div></div>`;
    return;
  }
  wrap.innerHTML = '';
  const pageMap = { '财务专项待办': 'fintodo', '票据台账': 'invoice', '往来资金': 'fund' };
  evts.slice(0, 12).forEach((e, i) => {
    const daysTxt = e.days < 0 ? `已逾期 ${-e.days} 天` : e.days === 0 ? '今天到期' : `${e.days} 天后到期`;
    const item = document.createElement('div');
    item.className = `event-item ${e.level}`;
    item.style.animationDelay = `${Math.min(i, 8) * 45}ms`;
    item.innerHTML = `
      <span class="event-dot"></span>
      <div class="event-content">
        <div class="event-title"><span class="event-src">${esc(e.src)}</span> ${esc(e.title)}</div>
        <div class="event-date">到期：${esc(e.date)}<span class="days">${daysTxt}</span></div>
      </div>
      <a class="btn btn-sm btn-outline" href="#${pageMap[e.src] || 'fintodo'}">去处理</a>`;
    wrap.appendChild(item);
  });
}

/* ---------------- 结账状态 ---------------- */
function renderClose(dom, d) {
  const k = d.kpis;
  const wrap = dom.querySelector('#dash-close');
  const pct = k.monthCloseStatus === 'done' ? 100 : k.monthCloseStatus === 'review' ? 75 : k.monthCloseStatus === 'processing' ? 45 : 10;
  wrap.innerHTML = `
    <div class="flex-between">
      <span class="tag ${k.monthCloseStatus === 'done' ? 'tag-done' : k.monthCloseStatus === 'processing' ? 'tag-processing' : k.monthCloseStatus === 'review' ? 'tag-review' : 'tag-pending'}">
        ${k.monthCloseStatus === 'done' ? '✅' : k.monthCloseStatus === 'processing' ? '🔄' : k.monthCloseStatus === 'review' ? '🔍' : '⏸️'} ${k.monthCloseStatus === 'done' ? '本月已结账' : k.monthCloseStatus === 'processing' ? '结账进行中' : k.monthCloseStatus === 'review' ? '复核中' : '未开始'}
      </span>
      <a class="btn btn-sm btn-outline" href="#close">去结账 →</a>
    </div>
    <div class="progress-track mt-8"><div class="progress-fill ${k.monthCloseStatus === 'done' ? 'green' : ''}" style="width:${pct}%"></div></div>`;
}

/* ---------------- 图表 ---------------- */
function renderCharts(d) {
  const s = d.series;

  // 任务趋势（柱：创建 / 线：完成）
  const months = s.taskTrend.map((x) => x.month.slice(5));
  makeChart('ch-taskTrend', {
    type: 'bar',
    data: {
      labels: months,
      datasets: [
        { label: '新建任务', data: s.taskTrend.map((x) => x.created), backgroundColor: 'rgba(91,120,255,0.55)', borderRadius: 5, barPercentage: 0.55 },
        { label: '完成任务', data: s.taskTrend.map((x) => x.done), backgroundColor: 'rgba(47,217,154,0.6)', borderRadius: 5, barPercentage: 0.55 },
      ],
    },
    options: baseOptions({ plugins: { legend: { position: 'top' } }, scales: { y: { ...axisGrid(), beginAtZero: true, ticks: { precision: 0 } } } }),
  });

  // 票据类型金额
  const invData = s.invoiceByType.filter((x) => x.count > 0);
  makeChart('ch-invoiceType', {
    type: 'doughnut',
    data: {
      labels: invData.map((x) => `${INV_TYPE[x.type] || x.type}（${moneyFmt(x.amount)}）`),
      datasets: [{ data: invData.map((x) => x.amount), backgroundColor: SERIES, borderWidth: 2, borderColor: 'rgba(7,10,20,0.8)', hoverOffset: 6 }],
    },
    options: baseOptions({ cutout: '62%', plugins: { legend: { position: 'bottom' } } }),
  });

  // 账龄分布
  const agingLabels = s.fundAging.map((x) => x.label);
  makeChart('ch-fundAging', {
    type: 'bar',
    data: {
      labels: agingLabels,
      datasets: [
        { label: '应收', data: s.fundAging.map((x) => x.receivable), backgroundColor: 'rgba(49,198,232,0.65)', borderRadius: 4 },
        { label: '应付', data: s.fundAging.map((x) => x.payable), backgroundColor: 'rgba(255,155,66,0.65)', borderRadius: 4 },
      ],
    },
    options: baseOptions({
      plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}：¥ ${fmtMoney(c.parsed.y)}` } } },
      scales: { x: { stacked: true, ...axisGrid() }, y: { stacked: true, beginAtZero: true, ...axisGrid(), ticks: { callback: (v) => moneyFmt(v) } } },
    }),
  });

  // 任务状态
  const stData = s.taskByStatus.filter((x) => x.count > 0);
  makeChart('ch-taskStatus', {
    type: 'doughnut',
    data: {
      labels: stData.map((x) => TASK_STATUS[x.status] || x.status),
      datasets: [{ data: stData.map((x) => x.count), backgroundColor: ['#f7d046', '#31c6e8', '#8a5bff', '#2fd99a'], borderWidth: 2, borderColor: 'rgba(7,10,20,0.8)', hoverOffset: 6 }],
    },
    options: baseOptions({ cutout: '62%', plugins: { legend: { position: 'bottom' } } }),
  });

  // 备考章节时长
  const study = s.studyByChapter.slice(0, 7);
  makeChart('ch-study', {
    type: 'bar',
    data: {
      labels: study.map((x) => x.chapter),
      datasets: [{ label: '分钟', data: study.map((x) => x.minutes), backgroundColor: 'rgba(167,139,250,0.7)', borderRadius: 5, barPercentage: 0.55 }],
    },
    options: baseOptions({
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ...axisGrid() }, y: { ...axisGrid() } },
    }),
  });

  // 票据金额趋势
  makeChart('ch-invoiceTrend', {
    type: 'line',
    data: {
      labels: s.invoiceTrend.map((x) => x.month.slice(5)),
      datasets: [
        { label: '票据金额', data: s.invoiceTrend.map((x) => x.amount), borderColor: PALETTE.accent, backgroundColor: 'rgba(91,120,255,0.12)', fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: PALETTE.accent },
      ],
    },
    options: baseOptions({
      plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: (c) => `¥ ${fmtMoney(c.parsed.y)}` } } },
      scales: { y: { beginAtZero: true, ...axisGrid(), ticks: { callback: (v) => moneyFmt(v) } } },
    }),
  });
}
