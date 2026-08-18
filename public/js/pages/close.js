import { esc, toast, openModal, confirmDialog, emptyState, monthKeyOf, fmtDateTime } from '../ui.js';
import { fetchEntity, addRow, updateRow, removeRow } from '../store.js';

const STATUS = [
  { value: 'pending', label: '未开始', icon: '⏸️' },
  { value: 'processing', label: '结账进行中', icon: '🔄' },
  { value: 'review', label: '复核中', icon: '🔍' },
  { value: 'done', label: '本月已结账', icon: '✅' },
];
const sMap = Object.fromEntries(STATUS.map((o) => [o.value, o.label]));
const sCls = { pending: 'tag-pending', processing: 'tag-processing', review: 'tag-review', done: 'tag-done' };

export const closePage = {
  id: 'close',
  title: '月末结账',
  subtitle: '每月结账状态与检查记录',
  icon: '📆',
  render: async (container) => {
    const curMonth = monthKeyOf(new Date());
    container.innerHTML = `
      <div class="glass-card fade-in">
        <div class="card-head">
          <div class="card-title"><span class="bar"></span>本月结账 · <span id="curMonth">${curMonth}</span></div>
          <span id="curStatusTag" class="tag tag-pending">—</span>
        </div>
        <div class="form-grid">
          <div class="field">
            <label class="field-label">结账状态</label>
            <select class="sel input" id="close-status">${STATUS.map((o) => `<option value="${o.value}">${o.icon} ${o.label}</option>`).join('')}</select>
          </div>
          <div class="field" style="grid-column: span 3;">
            <label class="field-label">结账检查项、调整分录、待跟进事项</label>
            <textarea class="textarea" id="close-note" placeholder="银行对账 / 费用分摊 / 折旧计提 / 往来核对 / 待跟进事项…"></textarea>
          </div>
        </div>
        <div class="action-bar">
          <button class="btn btn-primary" id="close-save">💾 保存本月结账记录</button>
          <button class="btn btn-outline" id="close-month">🗓 查看历史月份</button>
        </div>
      </div>
      <div class="glass-card fade-in">
        <div class="card-head"><div class="card-title"><span class="bar"></span>结账历史</div></div>
        <div id="close-list" class="list-wrap"></div>
      </div>`;

    let rows = [];
    let current = null;

    async function refresh() {
      rows = await fetchEntity('monthclose', { force: true, order: 'created_at.desc' });
      current = rows.find((r) => r.month === curMonth) || null;
      if (current) {
        container.querySelector('#close-status').value = current.status;
        container.querySelector('#close-note').value = current.note || '';
        const tag = container.querySelector('#curStatusTag');
        tag.className = `tag ${sCls[current.status] || 'tag-pending'}`;
        tag.textContent = (sMap[current.status] || current.status);
      } else {
        container.querySelector('#close-status').value = 'pending';
        container.querySelector('#close-note').value = '';
        const tag = container.querySelector('#curStatusTag');
        tag.className = 'tag tag-pending';
        tag.textContent = '未开始';
      }
      renderList();
    }

    function renderList() {
      const wrap = container.querySelector('#close-list');
      const sorted = rows.slice().sort((a, b) => (b.month || '').localeCompare(a.month || ''));
      if (!sorted.length) {
        wrap.innerHTML = emptyState('还没有结账记录', '📆');
        return;
      }
      wrap.innerHTML = '';
      sorted.forEach((row, i) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.style.animationDelay = `${Math.min(i, 8) * 40}ms`;
        item.innerHTML = `
          <div class="item-main">
            <div class="item-title">${row.month} ${row.month === curMonth ? '<span class="tag tag-default">本月</span>' : ''}
              <span class="tag ${sCls[row.status] || 'tag-pending'}">${sMap[row.status] || row.status}</span>
            </div>
            <div class="item-sub">更新：${row.updated_at ? fmtDateTime(row.updated_at) : '—'}</div>
          </div>
          ${row.note ? `<div class="item-body">${esc(row.note)}</div>` : ''}
          <div class="item-actions">
            <button class="btn btn-sm btn-outline" data-act="edit" data-i="${i}">✏️ 编辑</button>
            <button class="btn btn-sm btn-danger" data-act="del" data-i="${i}">删除</button>
          </div>`;
        wrap.appendChild(item);
      });

      wrap.querySelectorAll('[data-act="edit"]').forEach((b) => {
        b.onclick = () => openEdit(sorted[Number(b.dataset.i)]);
      });
      wrap.querySelectorAll('[data-act="del"]').forEach((b) => {
        b.onclick = () => {
          const row = sorted[Number(b.dataset.i)];
          confirmDialog({
            title: '删除确认',
            message: `确定删除 ${row.month} 的结账记录吗？`,
            okText: '删除', danger: true,
            onOk: async () => {
              await removeRow('monthclose', row.id);
              toast('已删除', 'success');
              refresh();
            },
          });
        };
      });
    }

    function openEdit(row) {
      openModal({
        title: `编辑 ${row.month} 结账记录`,
        bodyHtml: `
          <div class="field mb-12">
            <label class="field-label">月份</label>
            <input class="input" type="month" id="e-month" value="${esc(row.month)}">
          </div>
          <div class="field mb-12">
            <label class="field-label">结账状态</label>
            <select class="sel input" id="e-status">${STATUS.map((o) => `<option value="${o.value}" ${row.status === o.value ? 'selected' : ''}>${o.icon} ${o.label}</option>`).join('')}</select>
          </div>
          <div class="field">
            <label class="field-label">结账记录</label>
            <textarea class="textarea" id="e-note">${esc(row.note || '')}</textarea>
          </div>`,
        footHtml: `<button class="btn btn-outline" id="ec-cancel">取消</button><button class="btn btn-primary" id="ec-save">保存</button>`,
        onMount(box, close) {
          box.querySelector('#ec-cancel').onclick = close;
          box.querySelector('#ec-save').onclick = async () => {
            const month = box.querySelector('#e-month').value;
            const status = box.querySelector('#e-status').value;
            const note = box.querySelector('#e-note').value.trim();
            if (!month) { toast('请选择月份', 'warn'); return; }
            const exists = rows.find((r) => r.month === month && r.id !== row.id);
            if (exists) { toast(`${month} 已有记录，请直接编辑该记录`, 'warn'); return; }
            await updateRow('monthclose', row.id, { month, status, note });
            toast('已保存', 'success');
            close();
            refresh();
          };
        },
      });
    }

    container.querySelector('#close-save').onclick = async () => {
      const status = container.querySelector('#close-status').value;
      const note = container.querySelector('#close-note').value.trim();
      try {
        if (current) {
          await updateRow('monthclose', current.id, { status, note });
          toast('已更新本月结账记录', 'success');
        } else {
          await addRow('monthclose', { month: curMonth, status, note });
          toast('已保存本月结账记录', 'success');
        }
        refresh();
      } catch (err) { toast(err.message, 'error'); }
    };

    // 历史月份入口：跳到指定月份（简化：打开一个月份输入弹窗快速查询）
    container.querySelector('#close-month').onclick = () => {
      openModal({
        title: '查看历史月份',
        bodyHtml: `
          <div class="field">
            <label class="field-label">选择月份（若该月已有记录会在上方列表出现）</label>
            <input class="input" type="month" id="q-month" value="${curMonth}">
          </div>`,
        footHtml: `<button class="btn btn-outline" id="qc-cancel">取消</button><button class="btn btn-primary" id="qc-ok">查看</button>`,
        onMount(box, close) {
          box.querySelector('#qc-cancel').onclick = close;
          box.querySelector('#qc-ok').onclick = () => {
            const month = box.querySelector('#q-month').value;
            if (!month) return;
            const target = rows.find((r) => r.month === month);
            if (!target) { toast(`${month} 还没有结账记录`, 'warn'); return; }
            openEdit(target);
          };
        },
      });
    };

    await refresh();
  },
};
