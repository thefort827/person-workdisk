'use strict';

/**
 * Excel 工作簿模块 —— 基于 HyperFormula（公式引擎）+ SheetJS（xlsx 导入导出）的完整电子表格
 *
 * 功能：单元格编辑、公式计算（300+函数）、多 Sheet、格式化（粗体/颜色/对齐）、
 *       行列操作、复制粘贴、键盘导航、自动保存、xlsx 导入/导出
 *
 * 依赖：window.HyperFormula, window.XLSX（由 vendor/ 脚本提供）
 */

import { addRow, fetchEntity, updateRow } from '../store.js';
import { toast, esc } from '../ui.js';

const COLS = 26; // A-Z
const MAX_ROWS = 200;
const COL_LETTERS = Array.from({ length: COLS }, (_, i) => String.fromCharCode(65 + i));
const SAVE_KEY = 'workbook_default';
const SAVE_DEBOUNCE = 2000;

function colLetter(i) { return COL_LETTERS[i] || ''; }
function cellRef(r, c) { return colLetter(c) + (r + 1); }
function parseRef(ref) {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  if (!m) return null;
  return { row: parseInt(m[2]) - 1, col: m[1].charCodeAt(0) - 65 };
}

/* ==================== Spreadsheet 类 ==================== */
export class Spreadsheet {
  constructor(container) {
    this.root = container;
    this.hf = null;
    this.sheets = [{ name: 'Sheet1', data: [], formats: [] }];
    this.activeSheet = 0;
    this.selection = { row: 0, col: 0, row2: 0, col2: 0 };
    this.editing = false;
    this.editingCell = null;
    this.clipboard = null;
    this.clipboardCut = false;
    this.undoStack = [];
    this.redoStack = [];
    this._saveTimer = null;
    this._mounted = false;
  }

  /* ---------- 初始化 ---------- */
  async init() {
    this.hf = HyperFormula.buildEmpty({ licenseKey: 'gpl-v3', language: 'enGB' });
    this.hf.addSheet(this.sheets[0].name);
    this.render();
    await this.load();
    this._mounted = true;
  }

  /* ---------- 数据模型 ---------- */
  _hfSheet() { return this.activeSheet; }
  _ensureGrid(minR, minC) {
    const sd = this.sheets[this.activeSheet];
    if (!sd.data) sd.data = [];
    while (sd.data.length < minR + 1) sd.data.push([]);
    for (let r = 0; r <= minR; r++) {
      while ((sd.data[r] || []).length < minC + 1) sd.data[r].push('');
    }
    if (!sd.formats) sd.formats = [];
    while (sd.formats.length < minR + 1) sd.formats.push([]);
    for (let r = 0; r <= minR; r++) {
      while ((sd.formats[r] || []).length < minC + 1) sd.formats[r].push(null);
    }
  }

  getCellValue(r, c) {
    try { return this.hf.getCellValue({ sheet: this._hfSheet(), row: r, col: c }); } catch { return ''; }
  }
  getCellFormula(r, c) {
    try { const f = this.hf.getCellFormula({ sheet: this._hfSheet(), row: r, col: c }); return f || ''; } catch { return ''; }
  }
  getCellRaw(r, c) {
    const sd = this.sheets[this.activeSheet];
    return (sd.data[r] && sd.data[r][c]) || '';
  }
  getCellFormat(r, c) {
    const sd = this.sheets[this.activeSheet];
    return (sd.formats[r] && sd.formats[r][c]) || null;
  }
  setCellValue(r, c, raw) {
    this._ensureGrid(r, c);
    this.sheets[this.activeSheet].data[r][c] = raw;
    this.hf.setCellContents({ sheet: this._hfSheet(), row: r, col: c }, [[raw]]);
    this._scheduleSave();
  }
  setCellFormat(r, c, fmt) {
    this._ensureGrid(r, c);
    const old = this.getCellFormat(r, c);
    this.sheets[this.activeSheet].formats[r][c] = { ...old, ...fmt };
    this._scheduleSave();
  }
  clearCells(r1, c1, r2, c2) {
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) this.setCellValue(r, c, '');
  }

  /* ---------- 行列操作 ---------- */
  insertRow(afterRow) {
    this._pushUndo();
    const s = this._hfSheet();
    this.hf.insertRows(s, afterRow + 1, 1);
    const sd = this.sheets[this.activeSheet];
    sd.formats.splice(afterRow + 1, 0, Array(COLS).fill(null));
    this._renderGrid();
    this._scheduleSave();
  }
  insertCol(afterCol) {
    this._pushUndo();
    const s = this._hfSheet();
    this.hf.insertColumns(s, afterCol + 1, 1);
    for (let r = 0; r < this.sheets[this.activeSheet].formats.length; r++) {
      this.sheets[this.activeSheet].formats[r].splice(afterCol + 1, 0, null);
    }
    this._renderGrid();
    this._scheduleSave();
  }
  deleteRow(row) {
    this._pushUndo();
    this.hf.removeRows(this._hfSheet(), row, 1);
    this.sheets[this.activeSheet].formats.splice(row, 1);
    this._renderGrid();
    this._scheduleSave();
  }
  deleteCol(col) {
    this._pushUndo();
    this.hf.removeColumns(this._hfSheet(), col, 1);
    for (const row of this.sheets[this.activeSheet].formats) row.splice(col, 1);
    this._renderGrid();
    this._scheduleSave();
  }

  /* ---------- 渲染 ---------- */
  render() {
    this.root.innerHTML = `
      <div class="ss-wrap">
        <div class="ss-toolbar" id="ssTb">
          <div class="ss-toolbar-group">
            <button class="ss-btn ss-tb-bold" title="粗体 Ctrl+B"><b>B</b></button>
            <button class="ss-btn ss-tb-italic" title="斜体 Ctrl+I"><i>I</i></button>
            <button class="ss-btn ss-tb-underline" title="下划线 Ctrl+U"><u>U</u></button>
          </div>
          <div class="ss-toolbar-group">
            <label class="ss-color-pick" title="文字颜色">A
              <input type="color" id="ssFontColor" value="#34475c" class="ss-color-input">
            </label>
            <label class="ss-color-pick ss-bg-pick" title="背景颜色">■
              <input type="color" id="ssBgColor" value="#ffffff" class="ss-color-input">
            </label>
          </div>
          <div class="ss-toolbar-group">
            <button class="ss-btn ss-tb-al" data-align="left" title="左对齐">≡</button>
            <button class="ss-btn ss-tb-al" data-align="center" title="居中">≡</button>
            <button class="ss-btn ss-tb-al" data-align="right" title="右对齐">≡</button>
          </div>
          <div class="ss-toolbar-group">
            <button class="ss-btn ss-tb-fmt" data-fmt="number" title="数字格式">0.00</button>
            <button class="ss-btn ss-tb-fmt" data-fmt="currency" title="货币格式">¥</button>
            <button class="ss-btn ss-tb-fmt" data-fmt="percent" title="百分比">%</button>
          </div>
          <div class="ss-toolbar-group">
            <button class="ss-btn ss-tb-action" id="ssUndo" title="撤销 Ctrl+Z">↩</button>
            <button class="ss-btn ss-tb-action" id="ssRedo" title="重做 Ctrl+Y">↪</button>
          </div>
          <div class="ss-toolbar-group">
            <button class="ss-btn ss-tb-action" id="ssImportXlsx" title="导入 .xlsx">📂 导入</button>
            <button class="ss-btn ss-tb-action ss-btn-primary" id="ssExportXlsx" title="导出 .xlsx">⬇ 导出</button>
          </div>
          <input type="file" id="ssFileInput" accept=".xlsx,.xls" style="display:none">
        </div>
        <div class="ss-formula-bar">
          <span class="ss-cell-ref" id="ssCellRef">A1</span>
          <span class="ss-fx">fx</span>
          <input class="ss-formula-input" id="ssFormula" placeholder="输入值或公式（以 = 开头）">
        </div>
        <div class="ss-grid-wrap" id="ssGridWrap">
          <table class="ss-grid" id="ssGrid">
            <thead><tr id="ssColHead"></tr></thead>
            <tbody id="ssBody"></tbody>
          </table>
        </div>
        <div class="ss-footer">
          <div class="ss-tabs" id="ssTabs"></div>
          <div class="ss-status" id="ssStatus">就绪</div>
        </div>
      </div>`;
    this._bindEvents();
    this._renderColHeaders();
    this._renderGrid();
    this._renderTabs();
  }

  _renderColHeaders() {
    const tr = $('ssColHead', this.root);
    tr.innerHTML = '<th class="ss-corner"></th>' +
      COL_LETTERS.map((l) => `<th class="ss-col-h">${l}</th>`).join('');
  }

  _renderGrid() {
    const body = $('ssBody', this.root);
    const sd = this.sheets[this.activeSheet];
    const rows = sd.data ? sd.data.length : 0;
    const rowCount = Math.max(rows + 5, 20);
    let html = '';
    for (let r = 0; r < rowCount; r++) {
      html += `<tr><th class="ss-row-h">${r + 1}</th>`;
      for (let c = 0; c < COLS; c++) {
        const val = this.getCellValue(r, c);
        const fmt = this.getCellFormat(r, c);
        const display = val === null ? '' : String(val);
        const cls = ['ss-cell'];
        if (this._isSelected(r, c)) cls.push('ss-sel');
        if (fmt && fmt.bold) cls.push('ss-bold');
        if (fmt && fmt.italic) cls.push('ss-italic');
        if (fmt && fmt.align) cls.push('ss-align-' + fmt.align);
        const style = [];
        if (fmt && fmt.color) style.push('color:' + fmt.color);
        if (fmt && fmt.bg) style.push('background:' + fmt.bg);
        if (fmt && fmt.numFmt === 'currency') {
          const n = Number(val);
          display = Number.isFinite(n) ? '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : display;
        } else if (fmt && fmt.numFmt === 'percent') {
          const n = Number(val);
          display = Number.isFinite(n) ? (n * 100).toFixed(1) + '%' : display;
        } else if (fmt && fmt.numFmt === 'number') {
          const n = Number(val);
          display = Number.isFinite(n) ? n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : display;
        }
        html += `<td class="${cls.join(' ')}" data-r="${r}" data-c="${c}"${style.length ? ' style="' + style.join(';') + '"' : ''}>${esc(display)}</td>`;
      }
      html += '</tr>';
    }
    body.innerHTML = html;
    this._updateStatus();
  }

  _renderTabs() {
    const tabs = $('ssTabs', this.root);
    let html = '';
    this.sheets.forEach((s, i) => {
      html += `<button class="ss-tab ${i === this.activeSheet ? 'active' : ''}" data-i="${i}">${esc(s.name)}</button>`;
    });
    html += `<button class="ss-tab ss-tab-add" id="ssAddSheet">+</button>`;
    tabs.innerHTML = html;
  }

  /* ---------- 事件绑定 ---------- */
  _bindEvents() {
    const wrap = this.root;
    const grid = $('ssGrid', wrap);
    const formula = $('ssFormula', wrap);

    // 单元格点击选中
    grid.addEventListener('click', (e) => {
      const td = e.target.closest('.ss-cell');
      if (!td) return;
      const r = +td.dataset.r, c = +td.dataset.c;
      this.selection = { row: r, col: c, row2: r, col2: c };
      this._updateCellRef();
      this._renderGrid();
      formula.value = this.getCellRaw(r, c);
    });

    // 双击编辑
    grid.addEventListener('dblclick', (e) => {
      const td = e.target.closest('.ss-cell');
      if (!td) return;
      this._startEdit(td);
    });

    // 公式栏回车提交
    formula.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.setCellValue(this.selection.row, this.selection.col, formula.value);
        this._renderGrid();
        this._focusCell(this.selection.row, this.selection.col);
      } else if (e.key === 'Escape') {
        formula.value = this.getCellRaw(this.selection.row, this.selection.col);
        this._renderGrid();
      }
    });

    // 键盘
    wrap.addEventListener('keydown', (e) => {
      if (this.editing) return; // 编辑中由 contenteditable 处理
      const { row: r, col: c } = this.selection;
      switch (e.key) {
        case 'ArrowUp': case 'ArrowDown': case 'ArrowLeft': case 'ArrowRight':
          e.preventDefault();
          this._moveCursor(e.key, e.shiftKey);
          break;
        case 'Tab':
          e.preventDefault();
          this.selection = { row: r, col: Math.min(c + 1, COLS - 1), row2: r, col2: Math.min(c + 1, COLS - 1) };
          this._afterMove();
          break;
        case 'Enter':
          e.preventDefault();
          this.selection = { row: Math.min(r + 1, MAX_ROWS - 1), col: c, row2: Math.min(r + 1, MAX_ROWS - 1), col2: c };
          this._afterMove();
          break;
        case 'Delete': case 'Backspace':
          e.preventDefault();
          this._deleteSelection();
          break;
        case 'F2':
          e.preventDefault();
          this._startEdit(this._getCell(r, c));
          break;
        case 'b': if (e.ctrlKey || e.metaKey) { e.preventDefault(); this._toggleFormat('bold'); } break;
        case 'i': if (e.ctrlKey || e.metaKey) { e.preventDefault(); this._toggleFormat('italic'); } break;
        case 'u': if (e.ctrlKey || e.metaKey) { e.preventDefault(); this._toggleFormat('underline'); } break;
        case 'c': if (e.ctrlKey || e.metaKey) { e.preventDefault(); this._copy(false); } break;
        case 'x': if (e.ctrlKey || e.metaKey) { e.preventDefault(); this._copy(true); } break;
        case 'v': if (e.ctrlKey || e.metaKey) { e.preventDefault(); this._paste(); } break;
        case 'z': if (e.ctrlKey || e.metaKey) { e.preventDefault(); this._undo(); } break;
        case 'y': if (e.ctrlKey || e.metaKey) { e.preventDefault(); this._redo(); } break;
        case 'a': if (e.ctrlKey || e.metaKey) { e.preventDefault(); this._selectAll(); } break;
        default:
          // 开始编辑（非功能键时）
          if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            this._startEdit(this._getCell(r, c), e.key);
          }
          break;
      }
    });

    // 工具栏
    $('ssTb', wrap).addEventListener('click', (e) => {
      const btn = e.target.closest('.ss-btn');
      if (!btn) return;
      if (btn.classList.contains('ss-tb-bold')) this._toggleFormat('bold');
      if (btn.classList.contains('ss-tb-italic')) this._toggleFormat('italic');
      if (btn.classList.contains('ss-tb-underline')) this._toggleFormat('underline');
      if (btn.classList.contains('ss-tb-al')) this._applyAlign(btn.dataset.align);
      if (btn.classList.contains('ss-tb-fmt')) this._applyNumFmt(btn.dataset.fmt);
      if (btn.id === 'ssUndo') this._undo();
      if (btn.id === 'ssRedo') this._redo();
      if (btn.id === 'ssExportXlsx') this._exportXlsx();
      if (btn.id === 'ssImportXlsx') $('ssFileInput', wrap).click();
    });

    // 颜色
    $('ssFontColor', wrap).addEventListener('input', (e) => this._applyFormat({ color: e.target.value }));
    $('ssBgColor', wrap).addEventListener('input', (e) => this._applyFormat({ bg: e.target.value }));

    // Sheet 标签
    $('ssTabs', wrap).addEventListener('click', (e) => {
      const tab = e.target.closest('.ss-tab');
      if (!tab) return;
      if (tab.id === 'ssAddSheet') { this._addSheet(); return; }
      this._switchSheet(+tab.dataset.i);
    });
    $('ssTabs', wrap).addEventListener('dblclick', (e) => {
      const tab = e.target.closest('.ss-tab:not(.ss-tab-add)');
      if (!tab) return;
      const idx = +tab.dataset.i;
      const name = prompt('重命名 Sheet:', this.sheets[idx].name);
      if (name && name.trim()) {
        this.sheets[idx].name = name.trim().slice(0, 31);
        this.hf.renameSheet(idx, name.trim().slice(0, 31));
        this._renderTabs();
        this._scheduleSave();
      }
    });

    // 导入
    $('ssFileInput', wrap).addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this._importXlsx(file);
      e.target.value = '';
    });

    // 右键菜单
    grid.addEventListener('contextmenu', (e) => {
      const td = e.target.closest('.ss-cell');
      if (!td) return;
      e.preventDefault();
      this._showContextMenu(e.clientX, e.clientY);
    });
    document.addEventListener('click', () => this._hideContextMenu());
  }

  /* ---------- 编辑 ---------- */
  _startEdit(td, initialKey) {
    if (!td) return;
    this.editing = true;
    this.editingCell = td;
    td.contentEditable = 'true';
    td.focus();
    if (initialKey !== undefined) {
      td.textContent = initialKey;
      // 选中全部以便继续输入
      const range = document.createRange();
      range.selectNodeContents(td);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } else {
      // 选中全部内容
      const range = document.createRange();
      range.selectNodeContents(td);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    td.addEventListener('blur', () => this._commitEdit(td), { once: true });
    td.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); td.blur(); }
      if (e.key === 'Escape') { td.textContent = this.getCellRaw(+td.dataset.r, +td.dataset.c); td.blur(); }
      if (e.key === 'Tab') { e.preventDefault(); td.blur(); }
    }, { once: true });
  }
  _commitEdit(td) {
    const r = +td.dataset.r, c = +td.dataset.c;
    const val = td.textContent.trim();
    this.setCellValue(r, c, val);
    td.contentEditable = 'false';
    this.editing = false;
    this.editingCell = null;
    this._renderGrid();
    this._focusCell(r, c);
  }

  /* ---------- 选区 ---------- */
  _isSelected(r, c) {
    const s = this.selection;
    const minR = Math.min(s.row, s.row2), maxR = Math.max(s.row, s.row2);
    const minC = Math.min(s.col, s.col2), maxC = Math.max(s.col, s.col2);
    return r >= minR && r <= maxR && c >= minC && c <= maxC;
  }
  _moveCursor(key, shift) {
    const s = this.selection;
    let { row: r, col: c, row2, col2 } = s;
    switch (key) {
      case 'ArrowUp': r = Math.max(0, r - 1); break;
      case 'ArrowDown': r = Math.min(MAX_ROWS - 1, r + 1); break;
      case 'ArrowLeft': c = Math.max(0, c - 1); break;
      case 'ArrowRight': c = Math.min(COLS - 1, c + 1); break;
    }
    if (shift) {
      this.selection = { row: s.row, col: s.col, row2: r, col2: c };
    } else {
      this.selection = { row: r, col: c, row2: r, col2: c };
    }
    this._afterMove();
  }
  _afterMove() {
    this._updateCellRef();
    this._renderGrid();
    this._focusCell(this.selection.row, this.selection.col);
    this._scrollIntoView();
    $('ssFormula', this.root).value = this.getCellRaw(this.selection.row, this.selection.col);
  }
  _focusCell(r, c) {
    const td = this._getCell(r, c);
    if (td) { td.tabIndex = 0; td.focus(); }
  }
  _getCell(r, c) {
    return this.root.querySelector(`td.ss-cell[data-r="${r}"][data-c="${c}"]`);
  }
  _updateCellRef() {
    const s = this.selection;
    const minR = Math.min(s.row, s.row2), maxR = Math.max(s.row, s.row2);
    const minC = Math.min(s.col, s.col2), maxC = Math.max(s.col, s.col2);
    let ref = cellRef(minR, minC);
    if (minR !== maxR || minC !== maxC) ref += ':' + cellRef(maxR, maxC);
    $('ssCellRef', this.root).textContent = ref;
  }
  _scrollIntoView() {
    const td = this._getCell(this.selection.row, this.selection.col);
    if (td) td.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  /* ---------- 格式化 ---------- */
  _toggleFormat(key) {
    const { row: r1, col: c1, row2: r2, col2: c2 } = this.selection;
    const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
    const minC = Math.min(c1, c2), maxC = Math.max(c1, c2);
    const first = this.getCellFormat(minR, minC);
    const currentVal = first ? first[key] : false;
    const newVal = !currentVal;
    for (let r = minR; r <= maxR; r++)
      for (let c = minC; c <= maxC; c++)
        this.setCellFormat(r, c, { [key]: newVal });
    this._renderGrid();
  }
  _applyFormat(fmt) {
    const { row: r1, col: c1, row2: r2, col2: c2 } = this.selection;
    const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
    const minC = Math.min(c1, c2), maxC = Math.max(c1, c2);
    for (let r = minR; r <= maxR; r++)
      for (let c = minC; c <= maxC; c++)
        this.setCellFormat(r, c, fmt);
    this._renderGrid();
  }
  _applyAlign(align) {
    this._applyFormat({ align });
  }
  _applyNumFmt(fmt) {
    this._applyFormat({ numFmt: fmt });
  }

  /* ---------- 删除 ---------- */
  _deleteSelection() {
    const { row: r1, col: c1, row2: r2, col2: c2 } = this.selection;
    this._pushUndo();
    this.clearCells(Math.min(r1, r2), Math.min(c1, c2), Math.max(r1, r2), Math.max(c1, c2));
    this._renderGrid();
  }

  /* ---------- 复制粘贴 ---------- */
  _copy(cut) {
    const { row: r1, col: c1, row2: r2, col2: c2 } = this.selection;
    const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
    const minC = Math.min(c1, c2), maxC = Math.max(c1, c2);
    const data = [];
    for (let r = minR; r <= maxR; r++) {
      const row = [];
      for (let c = minC; c <= maxC; c++) {
        row.push({ raw: this.getCellRaw(r, c), format: { ...(this.getCellFormat(r, c) || {}) } });
      }
      data.push(row);
    }
    this.clipboard = data;
    this.clipboardCut = cut;
    if (cut) this._pushUndo();
    // 系统剪贴板
    const text = data.map((row) => row.map((cell) => cell.raw).join('\t')).join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
    $('ssStatus', this.root).textContent = cut ? '已剪切' : '已复制';
  }
  _paste() {
    const { row: r, col: c } = this.selection;
    if (!this.clipboard) return;
    this._pushUndo();
    this.clipboard.forEach((row, ri) => {
      row.forEach((cell, ci) => {
        this._ensureGrid(r + ri, c + ci);
        this.setCellValue(r + ri, c + ci, cell.raw);
        this.sheets[this.activeSheet].formats[r + ri][c + ci] = { ...cell.format };
      });
    });
    if (this.clipboardCut) {
      const { row: r1, col: c1, row2: r2, col2: c2 } = this.selection;
      // don't clear source if cut from another position
      this.clipboardCut = false;
      this.clipboard = null;
    }
    this.selection.row2 = r + this.clipboard.length - 1;
    this.selection.col2 = c + (this.clipboard[0] || []).length - 1;
    this._renderGrid();
    this._renderTabs(); // in case formulas changed
    this._updateStatus();
    $('ssStatus', this.root).textContent = '已粘贴';
  }

  /* ---------- 撤销/重做 ---------- */
  _pushUndo() {
    this.undoStack.push(JSON.stringify(this.sheets));
    if (this.undoStack.length > 50) this.undoStack.shift();
    this.redoStack = [];
  }
  _undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(JSON.stringify(this.sheets));
    const prev = JSON.parse(this.undoStack.pop());
    this.sheets = prev;
    this._syncHF();
    this._renderGrid();
    this._renderTabs();
    $('ssStatus', this.root).textContent = '已撤销';
  }
  _redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(JSON.stringify(this.sheets));
    const next = JSON.parse(this.redoStack.pop());
    this.sheets = next;
    this._syncHF();
    this._renderGrid();
    this._renderTabs();
    $('ssStatus', this.root).textContent = '已重做';
  }
  _syncHF() {
    // 完全重建 HyperFormula 与当前 sheets 同步
    while (this.hf.getSheetIds().length > 0) this.hf.removeSheet(0);
    this.sheets.forEach((sd) => {
      this.hf.addSheet(sd.name);
      const sid = this.hf.getSheetIds().length - 1;
      const maxR = sd.data ? sd.data.length : 0;
      const maxC = sd.data && sd.data[0] ? sd.data[0].length : 0;
      if (maxR && maxC) {
        const vals = [];
        for (let r = 0; r < maxR; r++) {
          vals.push(sd.data[r] || []);
        }
        this.hf.setCellContents({ sheet: sid, row: 0, col: 0 }, vals);
      }
    });
  }

  /* ---------- Sheet 管理 ---------- */
  _addSheet() {
    const n = this.sheets.length + 1;
    const name = 'Sheet' + n;
    this.sheets.push({ name, data: [], formats: [] });
    this.hf.addSheet(name);
    this._switchSheet(this.sheets.length - 1);
    this._scheduleSave();
  }
  _switchSheet(idx) {
    if (idx === this.activeSheet) return;
    this.activeSheet = idx;
    this.selection = { row: 0, col: 0, row2: 0, col2: 0 };
    this._renderGrid();
    this._renderTabs();
    this._updateCellRef();
    this._updateStatus();
    $('ssFormula', this.root).value = '';
  }

  /* ---------- 状态栏 ---------- */
  _updateStatus() {
    const { row: r1, col: c1, row2: r2, col2: c2 } = this.selection;
    const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
    const minC = Math.min(c1, c2), maxC = Math.max(c1, c2);
    const vals = [];
    for (let r = minR; r <= maxR; r++)
      for (let c = minC; c <= maxC; c++) {
        const v = this.getCellValue(r, c);
        const n = Number(v);
        if (Number.isFinite(n)) vals.push(n);
      }
    let status = '';
    if (vals.length > 1) {
      const sum = vals.reduce((a, b) => a + b, 0);
      const avg = sum / vals.length;
      status = `求和: ${sum.toLocaleString('zh-CN')}    平均: ${avg.toLocaleString('zh-CN')}    计数: ${vals.length}`;
    } else if (vals.length === 1) {
      status = `值: ${vals[0].toLocaleString('zh-CN')}`;
    }
    const sd = this.sheets[this.activeSheet];
    const maxUsed = sd.data ? sd.data.length : 0;
    status += `    |    Sheet: ${sd.name}    行: ${maxUsed}`;
    $('ssStatus', this.root).textContent = status || '就绪';
  }

  /* ---------- 右键菜单 ---------- */
  _showContextMenu(x, y) {
    this._hideContextMenu();
    const menu = document.createElement('div');
    menu.className = 'ss-ctx-menu';
    menu.innerHTML = `
      <div class="ss-ctx-item" data-act="cut">✂ 剪切</div>
      <div class="ss-ctx-item" data-act="copy">📋 复制</div>
      <div class="ss-ctx-item" data-act="paste">📌 粘贴</div>
      <div class="ss-ctx-sep"></div>
      <div class="ss-ctx-item" data-act="insRow">插入选行 ▾</div>
      <div class="ss-ctx-item" data-act="insCol">插入选列 ▸</div>
      <div class="ss-ctx-sep"></div>
      <div class="ss-ctx-item" data-act="delRow">删除选行</div>
      <div class="ss-ctx-item" data-act="delCol">删除选列</div>
      <div class="ss-ctx-sep"></div>
      <div class="ss-ctx-item" data-act="clear">🗑 清除内容</div>
    `;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    document.body.appendChild(menu);
    menu.addEventListener('click', (e) => {
      const item = e.target.closest('.ss-ctx-item');
      if (!item) return;
      const act = item.dataset.act;
      switch (act) {
        case 'cut': this._copy(true); break;
        case 'copy': this._copy(false); break;
        case 'paste': this._paste(); break;
        case 'insRow': this.insertRow(this.selection.row2); break;
        case 'insCol': this.insertCol(this.selection.col2); break;
        case 'delRow': this.deleteRow(this.selection.row); break;
        case 'delCol': this.deleteCol(this.selection.col); break;
        case 'clear': this._deleteSelection(); break;
      }
      this._hideContextMenu();
    });
  }
  _hideContextMenu() {
    document.querySelectorAll('.ss-ctx-menu').forEach((m) => m.remove());
  }

  /* ---------- 导入导出 ---------- */
  _exportXlsx() {
    const sheets = {};
    this.sheets.forEach((sd) => {
      const data = [];
      const maxR = sd.data ? sd.data.length : 0;
      const maxC = sd.data && sd.data[0] ? sd.data[0].length : 0;
      for (let r = 0; r < maxR; r++) {
        const row = [];
        for (let c = 0; c < maxC; c++) {
          const raw = (sd.data[r] && sd.data[r][c]) || '';
          // HyperFormula 值 → 纯值
          const val = this.hf ? this._hfGetVal(this.sheets.indexOf(sd), r, c) : raw;
          row.push(val);
        }
        data.push(row);
      }
      sheets[sd.name] = XLSX.utils.aoa_to_sheet(data);
    });
    const wb = XLSX.utils.book_new();
    Object.entries(sheets).forEach(([name, ws]) => XLSX.utils.book_append_sheet(wb, ws, name));
    XLSX.writeFile(wb, 'workbook.xlsx');
    $('ssStatus', this.root).textContent = '已导出 workbook.xlsx';
  }
  _hfGetVal(sheetIdx, r, c) {
    try { const v = this.hf.getCellValue({ sheet: sheetIdx, row: r, col: c }); return v; } catch { return ''; }
  }
  _importXlsx(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        this.sheets = [];
        while (this.hf.getSheetIds().length) this.hf.removeSheet(0);
        wb.SheetNames.forEach((name) => {
          const ws = wb.Sheets[name];
          const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          const maxR = Math.min(aoa.length, MAX_ROWS);
          const maxC = Math.min(Math.max(...aoa.map((r) => r.length)), COLS);
          const data = [];
          const formats = [];
          for (let r = 0; r < maxR; r++) {
            const row = [];
            const fRow = [];
            for (let c = 0; c < maxC; c++) {
              let val = (aoa[r] && aoa[r][c]) || '';
              // 数字自动转为数字
              if (typeof val === 'number') val = String(val);
              row.push(val);
              fRow.push(null);
            }
            data.push(row);
            formats.push(fRow);
          }
          this.sheets.push({ name, data, formats });
          this.hf.addSheet(name);
          const sid = this.hf.getSheetIds().length - 1;
          if (data.length && data[0].length) {
            this.hf.setCellContents({ sheet: sid, row: 0, col: 0 }, data);
          }
        });
        this.activeSheet = 0;
        this.selection = { row: 0, col: 0, row2: 0, col2: 0 };
        this._renderGrid();
        this._renderTabs();
        toast(`已导入 ${wb.SheetNames.length} 个工作表`, 'success');
        this._scheduleSave();
      } catch (err) {
        toast('导入失败: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  /* ---------- 持久化 ---------- */
  async save() {
    const data = { sheets: this.sheets, activeSheet: this.activeSheet };
    try {
      const rows = await fetchEntity('setting');
      const existing = rows.find((r) => r.key === SAVE_KEY);
      if (existing) {
        await updateRow('setting', existing.id, { value: data });
      } else {
        await addRow('setting', { key: SAVE_KEY, value: data });
      }
      $('ssStatus', this.root).textContent = '已自动保存';
    } catch (err) {
      $('ssStatus', this.root).textContent = '保存失败: ' + err.message;
    }
  }
  _scheduleSave() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.save(), SAVE_DEBOUNCE);
  }
  async load() {
    try {
      const rows = await fetchEntity('setting');
      const saved = rows.find((r) => r.key === SAVE_KEY);
      if (saved && saved.value) {
        const data = typeof saved.value === 'string' ? JSON.parse(saved.value) : saved.value;
        if (data && data.sheets && data.sheets.length) {
          this.sheets = data.sheets;
          this.activeSheet = data.activeSheet || 0;
          // 重建 HyperFormula
          this._syncHF();
          this._renderGrid();
          this._renderTabs();
        }
      }
    } catch { /* 首次加载无数据 */ }
  }

  /* ---------- 全选 ---------- */
  _selectAll() {
    const sd = this.sheets[this.activeSheet];
    const maxR = sd.data ? sd.data.length - 1 : 0;
    const maxC = COLS - 1;
    this.selection = { row: 0, col: 0, row2: maxR, col2: maxC };
    this._renderGrid();
    this._updateCellRef();
  }
}

function $(id, root) { return (root || document).getElementById(id); }

/* ==================== 页面入口 ==================== */
export const spreadsheetPage = {
  id: 'spreadsheet',
  title: 'Excel 工作簿',
  subtitle: '完整电子表格 · 公式计算 · 多 Sheet · 导入导出',
  icon: '📊',
  render: async (container) => {
    if (!window.HyperFormula) {
      container.innerHTML = '<div class="glass-card"><div class="empty-state"><div class="empty-ic">⚠️</div><div>HyperFormula 公式引擎加载失败</div></div></div>';
      return;
    }
    container.innerHTML = '<div id="ssContainer" class="glass-card" style="padding:0;overflow:hidden;"></div>';
    const ss = new Spreadsheet($('ssContainer', container));
    await ss.init();
    spreadsheetPage._instance = ss;
  },
};
