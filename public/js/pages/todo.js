import { esc, toast, emptyState } from '../ui.js';
import { fetchEntity, addRow, updateRow, removeRow } from '../store.js';

const PRIORITY = [
  { value: 'low', label: '低' },
  { value: 'mid', label: '中' },
  { value: 'high', label: '高' },
];
const priCls = { high: 'tag-high', mid: 'tag-mid', low: 'tag-low' };
const priLabel = { high: '高', mid: '中', low: '低' };

export const todoPage = {
  id: 'todo',
  title: '日常待办',
  subtitle: '轻量任务清单',
  icon: '✅',
  render: async (container) => {
    container.innerHTML = `
      <div class="glass-card fade-in">
        <div class="card-head"><div class="card-title"><span class="bar"></span>新增待办</div></div>
        <div class="form-grid">
          <div class="field" style="grid-column: span 2;">
            <input class="input" id="todo-text" placeholder="输入待办事项，回车快速添加">
          </div>
          <div class="field">
            <select class="sel input" id="todo-pri">
              ${PRIORITY.map((o) => `<option value="${o.value}">优先级：${o.label}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="action-bar">
          <button class="btn btn-primary" id="todo-add">＋ 新增</button>
          <span class="count-pill" id="todo-count"></span>
        </div>
      </div>
      <div class="glass-card fade-in">
        <div class="filter-bar">
          <div class="action-bar">
            <button class="chip active" data-filter="">全部</button>
            <button class="chip" data-filter="active">未完成</button>
            <button class="chip" data-filter="done">已完成</button>
          </div>
        </div>
        <div id="todo-list" class="list-wrap"></div>
      </div>`;

    let rows = [];
    let view = '';

    async function refresh() {
      rows = await fetchEntity('todo', { force: true, order: 'created_at.desc' });
      render();
    }

    function render() {
      const list = rows.filter((r) => (view === 'done' ? r.done : view === 'active' ? !r.done : true));
      const count = container.querySelector('#todo-count');
      const doneCount = rows.filter((r) => r.done).length;
      count.textContent = `已完成 ${doneCount} / ${rows.length}`;

      const wrap = container.querySelector('#todo-list');
      if (!list.length) {
        wrap.innerHTML = emptyState(view === 'done' ? '还没有已完成的事项' : '暂无待办，享受当下 🎉', '✅');
        return;
      }
      wrap.innerHTML = '';
      list.forEach((row, idx) => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.style.animationDelay = `${Math.min(idx, 8) * 40}ms`;
        item.innerHTML = `
          <div class="item-main" style="align-items:center;">
            <label class="flex" style="flex:1;min-width:0;cursor:pointer;gap:11px;">
              <input type="checkbox" class="todo-chk" ${row.done ? 'checked' : ''} data-i="${idx}" style="width:17px;height:17px;accent-color:#2fd99a;cursor:pointer;">
              <span class="ellipsis" style="${row.done ? 'text-decoration:line-through;color:var(--text-faint);' : ''}">${esc(row.text)}</span>
              <span class="tag ${priCls[row.priority] || 'tag-low'}">${priLabel[row.priority] || row.priority}</span>
            </label>
            <button class="btn btn-sm btn-danger" data-i="${idx}" data-del="1">删除</button>
          </div>`;
        wrap.appendChild(item);
      });

      wrap.querySelectorAll('.todo-chk').forEach((cb) => {
        cb.onchange = async () => {
          const row = list[Number(cb.dataset.i)];
          await updateRow('todo', row.id, { done: cb.checked, done_at: cb.checked ? new Date().toISOString() : null });
          await refresh();
        };
      });
      wrap.querySelectorAll('[data-del]').forEach((b) => {
        b.onclick = async () => {
          const row = list[Number(b.dataset.i)];
          await removeRow('todo', row.id);
          toast('已删除', 'success');
          refresh();
        };
      });
    }

    container.querySelector('#todo-add').onclick = add;
    container.querySelector('#todo-text').onkeydown = (e) => { if (e.key === 'Enter') add(); };
    async function add() {
      const text = container.querySelector('#todo-text').value.trim();
      if (!text) { toast('请输入待办内容', 'warn'); return; }
      const pri = container.querySelector('#todo-pri').value;
      try {
        await addRow('todo', { text, priority: pri, done: false });
        container.querySelector('#todo-text').value = '';
        toast('已添加', 'success');
        refresh();
      } catch (err) { toast(err.message, 'error'); }
    }

    container.querySelectorAll('.chip').forEach((c) => {
      c.onclick = () => {
        container.querySelectorAll('.chip').forEach((x) => x.classList.remove('active'));
        c.classList.add('active');
        view = c.dataset.filter;
        render();
      };
    });

    await refresh();
  },
};
