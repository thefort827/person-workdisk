import { esc, toast, dayStr, dayOffset, monthKeyOf, todayStr } from '../ui.js';
import { fetchEntity, addRow, removeRow } from '../store.js';

export const checkinPage = {
  id: 'checkin',
  title: '习惯打卡',
  subtitle: '连续坚持，财务精进',
  icon: '🔥',
  render: async (container) => {
    container.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card green"><div class="kpi-top"><span class="kpi-label">连续打卡</span><span class="kpi-ic">🔥</span></div><div class="kpi-val" id="ci-streak">0<small>天</small></div></div>
        <div class="kpi-card"><div class="kpi-top"><span class="kpi-label">累计打卡</span><span class="kpi-ic">📅</span></div><div class="kpi-val" id="ci-total">0<small>天</small></div></div>
        <div class="kpi-card"><div class="kpi-top"><span class="kpi-label">本月打卡</span><span class="kpi-ic">🗓</span></div><div class="kpi-val" id="ci-month">0<small>天</small></div></div>
      </div>
      <div class="glass-card fade-in center">
        <button class="btn btn-success" id="ci-btn" style="padding:13px 38px;font-size:15px;">✔ 今日打卡</button>
        <p class="text-secondary mt-8" id="ci-tip" style="font-size:12px;"></p>
      </div>
      <div class="glass-card fade-in">
        <div class="card-head">
          <div class="card-title"><span class="bar"></span>近 26 周打卡热力图</div>
          <div class="heat-legend">少 <span class="heat-cell"></span><span class="heat-cell l1"></span><span class="heat-cell l2"></span><span class="heat-cell l3"></span><span class="heat-cell l4"></span> 多</div>
        </div>
        <div class="heatmap" id="ci-heat"></div>
      </div>
      <div class="glass-card fade-in">
        <div class="card-head"><div class="card-title"><span class="bar"></span>本月日历</div><span class="count-pill" id="ci-cal-title"></span></div>
        <div class="cal-grid" id="ci-cal"></div>
      </div>`;

    let checkedSet = new Set();
    let today = todayStr();

    async function refresh() {
      const rows = await fetchEntity('checkin', { force: true });
      checkedSet = new Set(rows.map((r) => r.date));
      render();
    }

    function render() {
      const now = new Date();
      // 连续天数
      let streak = 0;
      for (let i = 0; i < 3650; i++) {
        if (checkedSet.has(dayStr(dayOffset(now, -i)))) streak++;
        else break;
      }
      container.querySelector('#ci-streak').textContent = streak;
      container.querySelector('#ci-total').textContent = checkedSet.size;
      const mk = monthKeyOf(now);
      container.querySelector('#ci-month').textContent = [...checkedSet].filter((d) => d.startsWith(mk)).length;

      const doneToday = checkedSet.has(today);
      const btn = container.querySelector('#ci-btn');
      btn.textContent = doneToday ? '✅ 今日已打卡（点击取消）' : '✔ 今日打卡';
      btn.className = 'btn ' + (doneToday ? 'btn-outline' : 'btn-success');
      container.querySelector('#ci-tip').textContent = doneToday
        ? '已连续坚持，继续保持！'
        : streak > 0 ? `已连续打卡 ${streak} 天，今天别忘了哦` : '开始今天的打卡吧！';

      // 热力图：26 周 × 7 天
      const heat = container.querySelector('#ci-heat');
      const start = dayOffset(now, -(25 * 7 + now.getDay()));
      heat.innerHTML = '';
      for (let w = 0; w < 26; w++) {
        const col = document.createElement('div');
        col.className = 'heat-col';
        for (let k = 0; k < 7; k++) {
          const d = dayOffset(start, w * 7 + k);
          const ds = dayStr(d);
          const cell = document.createElement('div');
          cell.className = 'heat-cell';
          if (d > now) cell.classList.add('future');
          else if (checkedSet.has(ds)) cell.classList.add('l4');
          else cell.classList.add('l0');
          if (ds === today) cell.classList.add('today');
          cell.title = `${ds}${checkedSet.has(ds) ? ' 已打卡' : ''}`;
          col.appendChild(cell);
        }
        heat.appendChild(col);
      }

      // 本月日历
      const cal = container.querySelector('#ci-cal');
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const firstDow = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
      container.querySelector('#ci-cal-title').textContent = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月`;
      cal.innerHTML = '';
      for (let i = 0; i < firstDow; i++) cal.appendChild(Object.assign(document.createElement('div'), { className: 'cal-cell blank' }));
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${mk}-${String(d).padStart(2, '0')}`;
        const cell = Object.assign(document.createElement('div'), { className: 'cal-cell' });
        if (ds === today) cell.classList.add('today');
        if (checkedSet.has(ds)) cell.classList.add('checked');
        cell.innerHTML = `<span>${d}</span>${checkedSet.has(ds) ? '<span class="dot"></span>' : ''}`;
        cal.appendChild(cell);
      }
    }

    container.querySelector('#ci-btn').onclick = async () => {
      try {
        if (checkedSet.has(today)) {
          // 取消今日打卡（删除记录）
          const rows = await fetchEntity('checkin');
          const rec = rows.find((r) => r.date === today);
          if (rec) await removeRow('checkin', rec.id);
          toast('已取消今日打卡', 'info');
        } else {
          await addRow('checkin', { date: today, note: '' });
          toast('🎉 打卡成功！', 'success');
        }
        refresh();
      } catch (err) { toast(err.message, 'error'); }
    };

    await refresh();
  },
};
