/**
 * 通用 CRUD 页面工厂：表单新增 + 搜索/筛选 + 卡片列表 + 编辑弹窗 + 删除
 * 所有业务模块基于同一套交互范式，保证一致性。
 */

import { esc, toast, openModal, confirmDialog, emptyState, debounce } from './ui.js';
import { fetchEntity, addRow, updateRow, removeRow, invalidate } from './store.js';

function fieldHtml(f) {
  const label = `<label class="field-label">${esc(f.label)}${f.required ? ' <span class="text-danger">*</span>' : ''}</label>`;
  const span = f.span ? ` style="grid-column: span ${f.span};"` : '';
  let control = '';
  switch (f.type) {
    case 'textarea':
      control = `<textarea class="textarea" id="f-${f.name}" placeholder="${esc(f.placeholder || '')}"></textarea>`;
      break;
    case 'select':
      control = `<select class="sel input" id="f-${f.name}">${(f.options || []).map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select>`;
      break;
    default:
      control = `<input class="input" type="${f.type === 'number' ? 'number' : f.type || 'text'}" id="f-${f.name}" placeholder="${esc(f.placeholder || '')}" ${f.required ? 'required' : ''}>`;
  }
  return `<div class="field"${span}>${label}${control}</div>`;
}

function filterHtml(f) {
  if (f.type === 'select') {
    const opts = [`<option value="">全部${esc(f.label)}</option>`]
      .concat((f.options || []).map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`))
      .join('');
    return `<select class="sel input" data-filter="${f.param}">${opts}</select>`;
  }
  return '';
}

function readFieldById(id, type) {
  const node = document.getElementById(id);
  if (!node) return undefined;
  if (type === 'number') {
    const v = node.value.trim();
    if (v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return node.value.trim();
}

export function createCrudPage(cfg) {
  let rows = [];
  let state = { search: '', filters: {} };

  function visibleRows() {
    let out = rows.slice();
    const q = state.search.trim().toLowerCase();
    if (q && cfg.searchFields && cfg.searchFields.length) {
      out = out.filter((r) => cfg.searchFields.some((f) => String(r[f] || '').toLowerCase().includes(q)));
    }
    for (const f of cfg.filters || []) {
      const v = state.filters[f.param];
      if (v) out = out.filter((r) => f.matches(r, v));
    }
    if (cfg.sort) out = cfg.sort(out);
    return out;
  }

  function renderList(wrap) {
    const list = visibleRows();
    const count = document.getElementById('crud-count');
    if (count) count.textContent = `共 ${list.length} / ${rows.length} 条`;

    if (!list.length) {
      wrap.innerHTML = emptyState(cfg.emptyText || '暂无数据', cfg.emptyIcon || '🗂️');
      return;
    }
    wrap.innerHTML = '';
    list.forEach((row, idx) => {
      const parts = cfg.rowRenderer(row, idx);
      const actions = [];
      if (cfg.itemActions) {
        for (const a of cfg.itemActions) {
          if (a.when && !a.when(row)) continue;
          actions.push(`<button class="btn btn-sm ${a.cls || 'btn-outline'}" data-act="${a.key}" data-i="${idx}">${esc(a.label)}</button>`);
        }
      }
      if (cfg.editable !== false) actions.push(`<button class="btn btn-sm btn-outline" data-act="__edit" data-i="${idx}">✏️ 编辑</button>`);
      actions.push(`<button class="btn btn-sm btn-danger" data-act="__del" data-i="${idx}">删除</button>`);

      const tagsHtml = (parts.tags || []).map((t) => `<span class="tag ${t.cls || 'tag-default'}">${esc(t.text)}</span>`).join('');
      const sub = parts.sub ? `<div class="item-sub">${parts.sub}</div>` : '';
      const meta = parts.meta ? `<div class="item-meta">${parts.meta}</div>` : '';
      const body = parts.body ? `<div class="item-body">${parts.body}</div>` : '';

      const item = document.createElement('div');
      item.className = 'list-item' + (parts.overdue ? ' overdue' : '');
      item.style.animationDelay = `${Math.min(idx, 8) * 40}ms`;
      item.innerHTML = `
        <div class="item-main">
          <div style="flex:1;min-width:0;">
            <div class="item-title">${parts.main || ''}</div>
            ${sub}${meta}${body}
            ${tagsHtml ? `<div class="mt-8">${tagsHtml}</div>` : ''}
          </div>
        </div>
        <div class="item-actions">${actions.join('')}</div>`;
      wrap.appendChild(item);
    });
  }

  async function refresh() {
    const wrap = document.getElementById('crud-list');
    try {
      rows = await fetchEntity(cfg.entity, { force: true, order: cfg.order || 'created_at.desc' });
      renderList(wrap);
    } catch (err) {
      wrap.innerHTML = emptyState(`加载失败：${esc(err.message)}`, '⚠️');
    }
  }

  function openEdit(row) {
    const bodyHtml = cfg.fields.map((f) => {
      const val = row[f.name] === null || row[f.name] === undefined ? '' : row[f.name];
      let control = '';
      switch (f.type) {
        case 'textarea':
          control = `<textarea class="textarea" id="e-${f.name}">${esc(val)}</textarea>`;
          break;
        case 'select':
          control = `<select class="sel input" id="e-${f.name}">${(f.options || []).map((o) => `<option value="${esc(o.value)}" ${String(o.value) === String(val) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`;
          break;
        default:
          control = `<input class="input" type="${f.type === 'number' ? 'number' : f.type || 'text'}" id="e-${f.name}" value="${esc(val)}">`;
      }
      return `<div class="field"><label class="field-label">${esc(f.label)}</label>${control}</div>`;
    }).join('');

    openModal({
      title: `编辑${cfg.title}`,
      bodyHtml: `<div class="form-grid">${bodyHtml}</div>`,
      footHtml: `<button class="btn btn-outline" id="ed-cancel">取消</button><button class="btn btn-primary" id="ed-save">保存修改</button>`,
      onMount(box, close) {
        box.querySelector('#ed-cancel').onclick = close;
        box.querySelector('#ed-save').onclick = async () => {
          const patch = {};
          for (const f of cfg.fields) patch[f.name] = readFieldById(`e-${f.name}`, f.type);
          try {
            await updateRow(cfg.entity, row.id, patch);
            toast('已保存', 'success');
            close();
            refresh();
            if (cfg.onChanged) cfg.onChanged();
          } catch (err) {
            toast(err.message, 'error');
          }
        };
      },
    });
  }

  return {
    id: cfg.id,
    title: cfg.title,
    subtitle: cfg.subtitle,
    icon: cfg.icon,
    render: async (container) => {
      container.innerHTML = `
        <div class="glass-card fade-in">
          <div class="card-head"><div class="card-title"><span class="bar"></span>${esc(cfg.formTitle || cfg.title)}</div></div>
          <form id="crud-form" class="form-grid">
            ${cfg.fields.map(fieldHtml).join('')}
          </form>
          <div class="action-bar"><button type="submit" form="crud-form" class="btn btn-primary">＋ ${esc(cfg.addText || '新增')}</button></div>
        </div>
        <div class="glass-card fade-in">
          <div class="filter-bar">
            ${cfg.searchFields && cfg.searchFields.length ? `<div class="search-box"><input class="input" id="crud-search" placeholder="搜索…"></div>` : ''}
            ${(cfg.filters || []).map(filterHtml).join('')}
            <span class="count-pill" id="crud-count"></span>
          </div>
          <div id="crud-list" class="list-wrap"></div>
        </div>`;

      // 新增表单
      const form = container.querySelector('#crud-form');
      form.onsubmit = async (e) => {
        e.preventDefault();
        const row = { ...(cfg.defaultValues || {}) };
        for (const f of cfg.fields) {
          const v = readFieldById(`f-${f.name}`, f.type);
          if (v !== undefined && v !== '') row[f.name] = v;
        }
        if (cfg.requiredFields) {
          for (const f of cfg.requiredFields) {
            if (!row[f]) { toast(`请填写「${f}」`, 'warn'); return; }
          }
        }
        try {
          await addRow(cfg.entity, row);
          toast(cfg.addSuccessText || '新增成功', 'success');
          form.reset();
          if (cfg.onChanged) cfg.onChanged();
          await refresh();
        } catch (err) {
          toast(err.message, 'error');
        }
      };

      // 搜索 / 筛选
      if (cfg.searchFields && cfg.searchFields.length) {
        const sb = container.querySelector('#crud-search');
        sb.oninput = debounce((e) => { state.search = e.target.value; renderList(container.querySelector('#crud-list')); }, 180);
      }
      container.querySelectorAll('[data-filter]').forEach((sel) => {
        sel.onchange = () => { state.filters[sel.dataset.filter] = sel.value; renderList(container.querySelector('#crud-list')); };
      });

      // 列表操作（事件委托）
      const list = container.querySelector('#crud-list');
      list.onclick = async (e) => {
        const btn = e.target.closest('[data-act]');
        if (!btn) return;
        const idx = Number(btn.dataset.i);
        const row = visibleRows()[idx];
        if (!row) return;
        const act = btn.dataset.act;

        if (act === '__edit') { openEdit(row); return; }
        if (act === '__del') {
          confirmDialog({
            title: '删除确认',
            message: `确定删除这条记录吗？此操作不可恢复。`,
            okText: '删除',
            danger: true,
            onOk: async () => {
              try {
                await removeRow(cfg.entity, row.id);
                toast('已删除', 'success');
                if (cfg.onChanged) cfg.onChanged();
                await refresh();
              } catch (err) { toast(err.message, 'error'); }
            },
          });
          return;
        }
        const custom = (cfg.itemActions || []).find((a) => a.key === act);
        if (custom && custom.run) {
          try { await custom.run(row, { refresh, rerender: () => renderList(list) }); }
          catch (err) { toast(err.message, 'error'); }
        }
      };

      await refresh();
    },
  };
}
