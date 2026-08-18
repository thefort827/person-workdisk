import { esc, toast, countUp, fmtMoney, fmtMoneyShort, downloadCSV, rangePreset } from '../ui.js';
import { loadReport } from '../store.js';
import { makeChart, SERIES, baseOptions, axisGrid, moneyFmt } from '../charts.js';

const INV_TYPE = { input: '进项发票', output: '销项发票', expense: '费用报销', accept: '承兑汇票' };

export const reportPage = {
  id: 'report',
  title: '报表中心',
  subtitle: '区间经营数据 · BI 分析报表',
  icon: '📈',
  render: async (container) => {
    const presets = [
      { key: 'thisMonth', label: '本月' },
      { key: 'lastMonth', label: '上月' },
      { key: 'last30', label: '近30天' },
      { key: 'last90', label: '近90天' },
      { key: 'thisYear', label: '今年' },
    ];
    const def = rangePreset('last30');

    container.innerHTML = `
      <div class="glass-card fade-in">
        <div class="card-head">
          <div class="card-title"><span class="bar"></span>查询区间</div>
          <span class="count-pill" id="rp-range-info"></span>
        </div>
        <div class="flex-between" style="flex-wrap:wrap;gap:12px;">
          <div class="action-bar">
            ${presets.map((p) => `<button class="chip" data-preset="${p.key}">${p.label}</button>`).join('')}
          </div>
          <div class="action-bar">
            <input class="input" type="date" id="rp-from" value="${def.from}">
            <span class="text-secondary">至</span>
            <input class="input" type="date" id="rp-to" value="${def.to}">
            <button class="btn btn-primary" id="rp-query">📊 生成报表</button>
          </div>
        </div>
      </div>

      <div class="kpi-grid" id="rp-kpis"></div>

      <div class="chart-grid">
        <div class="glass-card hoverable chart-box fade-in">
          <div class="card-head"><div class="card-title"><span class="bar"></span>月度趋势（票据金额 / 完成任务 / 资金到期）</div></div>
          <div class="chart-wrap tall"><canvas id="rp-monthly"></canvas></div>
        </div>
        <div class="glass-card hoverable chart-box fade-in">
          <div class="card-head"><div class="card-title"><span class="bar"></span>票据类型分布</div></div>
          <div class="chart-wrap"><canvas id="rp-invType"></canvas></div>
        </div>
      </div>

      <div class="grid-2">
        <div class="glass-card fade-in">
          <div class="card-head"><div class="card-title"><span class="bar"></span>应收 TOP 5（未清）</div></div>
          <div id="rp-topRec" class="list-wrap"></div>
        </div>
        <div class="glass-card fade-in">
          <div class="card-head"><div class="card-title"><span class="bar"></span>应付 TOP 5（未清）</div></div>
          <div id="rp-topPay" class="list-wrap"></div>
        </div>
      </div>

      <div class="glass-card fade-in">
        <div class="card-head">
          <div class="card-title"><span class="bar"></span>月度明细表</div>
          <button class="btn btn-outline btn-sm" id="rp-csv">⬇ 导出 CSV</button>
        </div>
        <div class="table-wrap"><table class="table"><thead>
          <tr><th>月份</th><th class="num">票据金额</th><th class="num">票据笔数</th><th class="num">完成任务</th><th class="num">应收到期</th><th class="num">应付到期</th></tr>
        </thead><tbody id="rp-tbody"></tbody></table></div>
      </div>`;

    let lastData = null;

    container.querySelectorAll('[data-preset]').forEach((c) => {
      c.onclick = () => {
        container.querySelectorAll('[data-preset]').forEach((x) => x.classList.remove('active'));
        c.classList.add('active');
        const r = rangePreset(c.dataset.preset);
        container.querySelector('#rp-from').value = r.from;
        container.querySelector('#rp-to').value = r.to;
        run();
      };
    });
    container.querySelector('#rp-query').onclick = run;
    container.querySelector('#rp-csv').onclick = () => {
      if (!lastData) return;
      downloadCSV(
        `报表_${lastData.range.from}_至_${lastData.range.to}.csv`,
        ['月份', '票据金额', '票据笔数', '完成任务', '应收到期', '应付到期'],
        lastData.monthly.map((m) => [m.month, m.invAmount, m.invCount, m.doneCount, m.receivable, m.payable])
      );
      toast('CSV 已导出', 'success');
    };

    async function run() {
      const from = container.querySelector('#rp-from').value;
      const to = container.querySelector('#rp-to').value;
      if (!from || !to) { toast('请选择起止日期', 'warn'); return; }
      if (to < from) { toast('结束日期不能早于开始日期', 'warn'); return; }
      const btn = container.querySelector('#rp-query');
      btn.disabled = true;
      btn.textContent = '⏳ 生成中…';
      try {
        const d = await loadReport(from, to);
        lastData = d;
        renderKpis(container, d);
        renderCharts(container, d);
        renderTops(container, d);
        renderTable(container, d);
        container.querySelector('#rp-range-info').textContent = `${d.range.from} ~ ${d.range.to}`;
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '📊 生成报表';
      }
    }

    await run();
  },
};

function renderKpis(dom, d) {
  const k = d.kpis;
  dom.querySelector('#rp-kpis').innerHTML = `
    <div class="kpi-card"><div class="kpi-top"><span class="kpi-label">票据金额合计</span><span class="kpi-ic">🧾</span></div><div class="kpi-val" id="rpk-amt">¥ 0</div><div class="kpi-delta up">共 ${k.invCount} 笔</div></div>
    <div class="kpi-card"><div class="kpi-top"><span class="kpi-label">应收到期</span><span class="kpi-ic">💵</span></div><div class="kpi-val" id="rpk-rec">¥ 0</div><div class="kpi-delta up">区间内到期应收</div></div>
    <div class="kpi-card orange"><div class="kpi-top"><span class="kpi-label">应付到期</span><span class="kpi-ic">💳</span></div><div class="kpi-val" id="rpk-pay">¥ 0</div><div class="kpi-delta down">区间内到期应付</div></div>
    <div class="kpi-card green"><div class="kpi-top"><span class="kpi-label">完成任务</span><span class="kpi-ic">🎯</span></div><div class="kpi-val" id="rpk-done">0</div><div class="kpi-delta up">新增任务 ${k.taskCreated} 项</div></div>
    <div class="kpi-card red"><div class="kpi-top"><span class="kpi-label">税务到期</span><span class="kpi-ic">📑</span></div><div class="kpi-val" id="rpk-tax">0</div><div class="kpi-delta down">区间内待申报事项</div></div>`;
  countUp(dom.querySelector('#rpk-amt'), k.invAmountTotal, { duration: 800, decimals: 0, suffix: '' });
  countUp(dom.querySelector('#rpk-rec'), k.receivableDue, { duration: 800, decimals: 0, suffix: '' });
  countUp(dom.querySelector('#rpk-pay'), k.payableDue, { duration: 800, decimals: 0, suffix: '' });
  countUp(dom.querySelector('#rpk-done'), k.taskDone, { duration: 700 });
  countUp(dom.querySelector('#rpk-tax'), k.taxDue, { duration: 700 });
}

function renderCharts(dom, d) {
  const monthly = d.monthly;
  makeChart('rp-monthly', {
    type: 'bar',
    data: {
      labels: monthly.map((m) => m.month),
      datasets: [
        { label: '票据金额', data: monthly.map((m) => m.invAmount), backgroundColor: 'rgba(91,120,255,0.55)', borderRadius: 5, barPercentage: 0.5, yAxisID: 'y' },
        { label: '应收到期', data: monthly.map((m) => m.receivable), backgroundColor: 'rgba(49,198,232,0.5)', borderRadius: 5, barPercentage: 0.5, yAxisID: 'y' },
        { label: '应付到期', data: monthly.map((m) => m.payable), backgroundColor: 'rgba(255,155,66,0.55)', borderRadius: 5, barPercentage: 0.5, yAxisID: 'y' },
        { label: '完成任务', type: 'line', data: monthly.map((m) => m.doneCount), borderColor: '#2fd99a', backgroundColor: '#2fd99a', tension: 0.4, pointRadius: 4, yAxisID: 'y1' },
      ],
    },
    options: baseOptions({
      plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: (c) => c.dataset.yAxisID === 'y1' ? `完成任务：${c.parsed.y}` : `${c.dataset.label}：¥ ${fmtMoney(c.parsed.y)}` } } },
      scales: {
        x: { stacked: false, ...axisGrid() },
        y: { beginAtZero: true, ...axisGrid(), ticks: { callback: (v) => moneyFmt(v) } },
        y1: { beginAtZero: true, position: 'right', grid: { display: false }, ticks: { precision: 0, color: '#2fd99a' } },
      },
    }),
  });

  const inv = d.invByType.filter((x) => x.count > 0);
  makeChart('rp-invType', {
    type: 'doughnut',
    data: {
      labels: inv.map((x) => `${INV_TYPE[x.type] || x.type}（${moneyFmt(x.amount)}）`),
      datasets: [{ data: inv.map((x) => x.amount), backgroundColor: SERIES, borderWidth: 2, borderColor: 'rgba(7,10,20,0.8)', hoverOffset: 6 }],
    },
    options: baseOptions({ cutout: '60%', plugins: { legend: { position: 'bottom' } } }),
  });
}

function renderTops(dom, d) {
  const rec = dom.querySelector('#rp-topRec');
  const pay = dom.querySelector('#rp-topPay');
  const recData = d.topReceivable;
  const payData = d.topPayable;
  const maxRec = Math.max(1, ...recData.map((x) => x.amount));
  const maxPay = Math.max(1, ...payData.map((x) => x.amount));

  rec.innerHTML = recData.length
    ? recData.map((x, i) => topRow(i, x.party, x.amount, x.amount / maxRec)).join('')
    : '<div class="empty-state">暂无应收数据</div>';
  pay.innerHTML = payData.length
    ? payData.map((x, i) => topRow(i, x.party, x.amount, x.amount / maxPay)).join('')
    : '<div class="empty-state">暂无应付数据</div>';
}

function topRow(idx, name, amount, pct) {
  const medals = ['🥇', '🥈', '🥉'];
  return `
    <div class="list-item" style="animation:none;">
      <div class="flex-between">
        <span style="font-weight:600;">${medals[idx] || idx + 1} ${esc(name)}</span>
        <span class="num-mono bold">¥ ${fmtMoney(amount)}</span>
      </div>
      <div class="progress-track mt-8"><div class="progress-fill" style="width:${(pct * 100).toFixed(0)}%"></div></div>
    </div>`;
}

function renderTable(dom, d) {
  const tbody = dom.querySelector('#rp-tbody');
  tbody.innerHTML = d.monthly.map((m) => `
    <tr>
      <td class="bold">${m.month}</td>
      <td class="num">¥ ${fmtMoney(m.invAmount)}</td>
      <td class="num">${m.invCount}</td>
      <td class="num">${m.doneCount}</td>
      <td class="num">¥ ${fmtMoney(m.receivable)}</td>
      <td class="num">¥ ${fmtMoney(m.payable)}</td>
    </tr>`).join('') || '<tr><td colspan="6" class="center text-secondary" style="padding:26px;">该区间暂无数据</td></tr>';
}
