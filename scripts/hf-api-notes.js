/**
 * Excel 工作簿 —— HyperFormula v2 API 适配层
 * 所有与 HyperFormula 交互的函数集中在此修正
 *
 * HyperFormula v2 关键 API 规范：
 *  - addSheet(name)  → 返回 name（字符串），需要 getSheetId(name) 获取数字 ID
 *  - 所有 sheetId 参数必须是 number
 *  - addRows(sheetId, [startRow, count])   （不是 insertRows）
 *  - removeRows(sheetId, [startRow, count])
 *  - addColumns(sheetId, [startCol, count])
 *  - removeColumns(sheetId, [startCol, count])
 *  - renameSheet(sheetId, newName)
 *  - removeSheet(sheetId)
 *  - getSheetNames() → string[]
 *  - getSheetId(name) → number
 *  - setCellContents({sheet:number,row:number,col:number}, data[][]) 
 *  - getCellValue({sheet:number,row:number,col:number})
 *  - getCellFormula({sheet:number,row:number,col:number})
 *
 * 以下是需要在 spreadsheet.js 中替换的对应代码
 */

// ============================================================
// 以下是在 spreadsheet.js 中需要替换的函数/代码块（对照表）
// ============================================================

/*
--- spreadsheet.js 修改对照 ---

1. constructor 中添加 this._hfIds = [];

2. init() 修正：
   async init() {
     this.hf = HyperFormula.buildEmpty({ licenseKey: 'gpl-v3', language: 'enGB' });
     this._hfIds = [];
     const name = this.hf.addSheet(this.sheets[0].name);
     this._hfIds.push(this.hf.getSheetId(name));
     this.render();
     await this.load();
     this._mounted = true;
   }

3. _hfSheet() 修正：
   _hfSheet() { return this._hfIds[this.activeSheet] ?? 0; }

4. insertRow 修正：
   insertRow(afterRow) {
     this._pushUndo();
     this.hf.addRows(this._hfSheet(), [afterRow + 1, 1]);
     const sd = this.sheets[this.activeSheet];
     sd.formats.splice(afterRow + 1, 0, Array(COLS).fill(null));
     this._renderGrid();
     this._scheduleSave();
   }

5. insertCol 修正：
   insertCol(afterCol) {
     this._pushUndo();
     this.hf.addColumns(this._hfSheet(), [afterCol + 1, 1]);
     for (let r = 0; r < this.sheets[this.activeSheet].formats.length; r++) {
       this.sheets[this.activeSheet].formats[r].splice(afterCol + 1, 0, null);
     }
     this._renderGrid();
     this._scheduleSave();
   }

6. deleteRow 修正：
   deleteRow(row) {
     this._pushUndo();
     this.hf.removeRows(this._hfSheet(), [row, 1]);
     this.sheets[this.activeSheet].formats.splice(row, 1);
     this._renderGrid();
     this._scheduleSave();
   }

7. deleteCol 修正：
   deleteCol(col) {
     this._pushUndo();
     this.hf.removeColumns(this._hfSheet(), [col, 1]);
     for (const row of this.sheets[this.activeSheet].formats) row.splice(col, 1);
     this._renderGrid();
     this._scheduleSave();
   }

8. _syncHF() 修正：
   _syncHF() {
     this._hfIds = [];
     for (const name of [...this.hf.getSheetNames()]) {
       this.hf.removeSheet(this.hf.getSheetId(name));
     }
     this.sheets.forEach((sd) => {
       const addedName = this.hf.addSheet(sd.name);
       const hfId = this.hf.getSheetId(addedName);
       this._hfIds.push(hfId);
       const maxR = sd.data ? sd.data.length : 0;
       const maxC = sd.data && sd.data[0] ? sd.data[0].length : 0;
       if (maxR && maxC) {
         const vals = [];
         for (let r = 0; r < maxR; r++) vals.push(sd.data[r] || []);
         this.hf.setCellContents({ sheet: hfId, row: 0, col: 0 }, vals);
       }
     });
   }

9. _addSheet() 修正：
   _addSheet() {
     const n = this.sheets.length + 1;
     const name = 'Sheet' + n;
     this.sheets.push({ name, data: [], formats: [] });
     const addedName = this.hf.addSheet(name);
     this._hfIds.push(this.hf.getSheetId(addedName));
     this._switchSheet(this.sheets.length - 1);
     this._scheduleSave();
   }

10. _renderTabs rename 修正：
    this.hf.renameSheet(this._hfIds[idx], name.trim().slice(0, 31));

11. _importXlsx 修正：
    // 替换所有 getSheetIds 为 getSheetNames + getSheetId
    // 替换所有 addSheet 返回值使用 getSheetId
    // 替换 setCellContents 的 sheet 参数

12. _hfGetVal 修正：
    _hfGetVal(sheetIdx, r, c) {
      try { return this.hf.getCellValue({ sheet: sheetIdx, row: r, col: c }); }
      catch { return ''; }
    }

13. _exportXlsx 修正：
    // 调用 _hfGetVal 时传 this._hfIds[idx] 而不是 idx
*/
