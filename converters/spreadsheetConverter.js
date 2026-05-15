'use strict';

/**
 * converters/spreadsheetConverter.js
 *
 * Converts Excel files to an interactive Google-Sheets-style HTML grid.
 * Supports: .xlsx .xls .xlsm .xlsb .xla
 *
 * npm install xlsx
 */

const XLSX = require('xlsx');
const fs   = require('fs');

function escapeHTML(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function spreadsheetToHTML(inputPath, originalName) {
  const workbook = XLSX.readFile(inputPath, { cellStyles: true, cellFormula: true });
  const sheetNames = workbook.SheetNames;

  // Build HTML for each sheet
  const sheetsHTML = sheetNames.map((name, idx) => {
    const ws = workbook.Sheets[name];
    if (!ws || !ws['!ref']) {
      return `<div class="sheet" id="sheet-${idx}" style="display:${idx===0?'block':'none'}">
        <div class="empty-sheet">This sheet is empty</div>
      </div>`;
    }

    const range = XLSX.utils.decode_range(ws['!ref']);
    const rows  = [];

    // Header row — column letters (A, B, C...)
    const colHeaders = ['<th class="row-num"></th>'];
    for (let c = range.s.c; c <= range.e.c; c++) {
      colHeaders.push(`<th class="col-header">${XLSX.utils.encode_col(c)}</th>`);
    }
    rows.push(`<tr>${colHeaders.join('')}</tr>`);

    // Data rows
    for (let r = range.s.r; r <= range.e.r; r++) {
      const cells = [`<td class="row-num">${r + 1}</td>`];
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellAddr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[cellAddr];
        let val = '';
        let cls = 'cell';

        if (cell) {
          val = cell.w !== undefined ? cell.w : (cell.v !== undefined ? String(cell.v) : '');
          // Detect type for alignment
          if (cell.t === 'n') cls += ' cell-num';
          else if (cell.t === 'b') cls += ' cell-bool';
        }

        cells.push(`<td class="${cls}" title="${escapeHTML(val)}">${escapeHTML(val)}</td>`);
      }
      rows.push(`<tr>${cells.join('')}</tr>`);
    }

    return `<div class="sheet" id="sheet-${idx}" style="display:${idx===0?'block':'none'}">
      <div class="table-wrap">
        <table><thead>${rows[0]}</thead><tbody>${rows.slice(1).join('')}</tbody></table>
      </div>
    </div>`;
  }).join('');

  // Sheet tabs
  const tabs = sheetNames.map((name, idx) =>
    `<button class="tab ${idx===0?'active':''}" onclick="switchSheet(${idx})">${escapeHTML(name)}</button>`
  ).join('');

  const content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: Arial, sans-serif;
      font-size: 13px;
      background: #fff;
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    /* ── Toolbar ── */
    .toolbar {
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
      padding: 6px 12px;
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }
    .filename {
      font-size: 13px;
      font-weight: 600;
      color: #1a1a1a;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sheet-count {
      font-size: 11px;
      color: #888;
    }

    /* ── Sheet tabs ── */
    .tabs-bar {
      background: #fff;
      border-bottom: 1px solid #e0e0e0;
      padding: 0 12px;
      display: flex;
      align-items: flex-end;
      gap: 2px;
      flex-shrink: 0;
      overflow-x: auto;
    }
    .tab {
      padding: 6px 16px;
      font-size: 12px;
      border: 1px solid transparent;
      border-bottom: none;
      border-radius: 4px 4px 0 0;
      cursor: pointer;
      background: #f1f3f4;
      color: #444;
      white-space: nowrap;
      transition: background 0.1s;
    }
    .tab:hover { background: #e8eaed; }
    .tab.active {
      background: #fff;
      border-color: #e0e0e0;
      color: #1a73e8;
      font-weight: 600;
      border-bottom: 2px solid #1a73e8;
    }

    /* ── Grid ── */
    .sheet { flex: 1; overflow: hidden; display: none; }
    .sheet[style*="block"] { display: flex !important; flex-direction: column; }

    .table-wrap {
      flex: 1;
      overflow: auto;
      position: relative;
    }

    table {
      border-collapse: collapse;
      table-layout: fixed;
      min-width: 100%;
    }

    thead { position: sticky; top: 0; z-index: 2; }

    .col-header {
      background: #f8f9fa;
      border: 1px solid #e0e0e0;
      padding: 4px 8px;
      text-align: center;
      font-weight: 500;
      font-size: 11px;
      color: #666;
      min-width: 100px;
      user-select: none;
    }
    .row-num {
      background: #f8f9fa;
      border: 1px solid #e0e0e0;
      padding: 4px 8px;
      text-align: center;
      font-size: 11px;
      color: #888;
      min-width: 48px;
      width: 48px;
      position: sticky;
      left: 0;
      z-index: 1;
      user-select: none;
    }
    thead .row-num { z-index: 3; }

    .cell {
      border: 1px solid #e0e0e0;
      padding: 3px 8px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 200px;
      min-width: 100px;
      cursor: cell;
      color: #1a1a1a;
      transition: background 0.05s;
    }
    .cell-num { text-align: right; color: #1a1a1a; }
    .cell-bool { text-align: center; color: #1558d6; font-weight: 500; }

    /* Selected cell highlight */
    .cell.selected {
      background: #e8f0fe !important;
      outline: 2px solid #1a73e8;
      outline-offset: -2px;
      z-index: 1;
      position: relative;
    }

    tr:hover .cell { background: #f8f9ff; }

    /* Formula bar */
    .formula-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 12px;
      background: #fff;
      border-bottom: 1px solid #e0e0e0;
      flex-shrink: 0;
    }
    .cell-ref {
      font-size: 12px;
      font-family: monospace;
      color: #1558d6;
      min-width: 48px;
      font-weight: 600;
    }
    .formula-input {
      flex: 1;
      font-size: 13px;
      font-family: monospace;
      border: none;
      outline: none;
      color: #1a1a1a;
      background: transparent;
    }

    .empty-sheet {
      display: flex; align-items: center; justify-content: center;
      height: 200px; color: #aaa; font-size: 13px;
    }
  </style>
</head>
<body>

  <div class="toolbar">
    <span class="filename">📊 ${escapeHTML(originalName)}</span>
    <span class="sheet-count">${sheetNames.length} sheet${sheetNames.length > 1 ? 's' : ''}</span>
  </div>

  <div class="formula-bar">
    <span class="cell-ref" id="cellRef">A1</span>
    <span style="color:#ccc">fx</span>
    <input class="formula-input" id="formulaInput" readonly placeholder="Select a cell"/>
  </div>

  <div class="tabs-bar">${tabs}</div>

  ${sheetsHTML}

  <script>
    let activeSheet = 0;
    let selectedCell = null;

    function switchSheet(idx) {
      document.querySelectorAll('.sheet').forEach((s, i) => {
        s.style.display = i === idx ? 'block' : 'none';
      });
      document.querySelectorAll('.tab').forEach((t, i) => {
        t.classList.toggle('active', i === idx);
      });
      activeSheet = idx;
      clearSelection();
    }

    function clearSelection() {
      if (selectedCell) selectedCell.classList.remove('selected');
      selectedCell = null;
      document.getElementById('cellRef').textContent = '';
      document.getElementById('formulaInput').value = '';
    }

    // Cell click — show in formula bar
    document.addEventListener('click', (e) => {
      const cell = e.target.closest('.cell:not(.row-num)');
      if (!cell) { clearSelection(); return; }

      if (selectedCell) selectedCell.classList.remove('selected');
      cell.classList.add('selected');
      selectedCell = cell;

      // Get column/row reference
      const row = cell.parentElement;
      const tbody = row.parentElement;
      const table = tbody.closest('table');
      const thead = table.querySelector('thead tr');

      const colIdx  = Array.from(row.children).indexOf(cell);
      const rowIdx  = Array.from(tbody.children).indexOf(row);
      const colHeader = thead.children[colIdx]?.textContent || '';
      const rowNum    = row.querySelector('.row-num')?.textContent || '';

      document.getElementById('cellRef').textContent = colHeader + rowNum;
      document.getElementById('formulaInput').value  = cell.title || cell.textContent;
    });
  </script>

</body>
</html>`;

  return { type: 'html', content };
}

module.exports = { spreadsheetToHTML };