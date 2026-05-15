'use strict';

/**
 * converters/dataConverter.js
 *
 * Converts structured data files to a searchable, paginated HTML table.
 * Supports: .csv  .xml  .json  (extensible)
 *
 * npm install papaparse fast-xml-parser
 */

const fs = require('fs');
const path = require('path');

const ROW_LIMIT = 1000; // max rows rendered (performance cap)

// ─── CSV ──────────────────────────────────────────────────────────────────────
async function csvToHTML(inputPath) {
  const Papa = require('papaparse');
  const raw = fs.readFileSync(inputPath, 'utf-8');

  const { data, meta, errors } = Papa.parse(raw, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  const fields = meta.fields || [];
  const rows = data.slice(0, ROW_LIMIT);
  const truncated = data.length > ROW_LIMIT;

  return buildTableHTML({
    title: path.basename(inputPath),
    fields,
    rows,
    totalRows: data.length,
    truncated,
    parseErrors: errors.slice(0, 3),
    format: 'CSV',
  });
}

// ─── JSON ─────────────────────────────────────────────────────────────────────
async function jsonToHTML(inputPath) {
  const raw = fs.readFileSync(inputPath, 'utf-8');
  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return errorHTML('Invalid JSON', e.message);
  }

  // If it's an array of objects — render as table
  if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
    const fields = [...new Set(parsed.flatMap(Object.keys))];
    const rows = parsed.slice(0, ROW_LIMIT).map((row) =>
      fields.reduce((acc, f) => {
        acc[f] = row[f] !== undefined ? String(row[f]) : '';
        return acc;
      }, {})
    );

    return buildTableHTML({
      title: path.basename(inputPath),
      fields,
      rows,
      totalRows: parsed.length,
      truncated: parsed.length > ROW_LIMIT,
      parseErrors: [],
      format: 'JSON',
    });
  }

  // Otherwise — pretty-print the JSON
  const pretty = JSON.stringify(parsed, null, 2);
  return buildCodeHTML(path.basename(inputPath), pretty, 'json');
}

// ─── XML ──────────────────────────────────────────────────────────────────────
async function xmlToHTML(inputPath) {
  const { XMLParser } = require('fast-xml-parser');
  const raw = fs.readFileSync(inputPath, 'utf-8');

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
  });

  let parsed;
  try {
    parsed = parser.parse(raw);
  } catch (e) {
    return errorHTML('Invalid XML', e.message);
  }

  // Find first array in the parsed object to try table rendering
  const tableData = findFirstArray(parsed);

  if (tableData && tableData.length > 0 && typeof tableData[0] === 'object') {
    const fields = [...new Set(tableData.flatMap(Object.keys))];
    const rows = tableData.slice(0, ROW_LIMIT).map((row) =>
      fields.reduce((acc, f) => {
        const val = row[f];
        acc[f] = val !== undefined && val !== null ? String(val) : '';
        return acc;
      }, {})
    );

    return buildTableHTML({
      title: path.basename(inputPath),
      fields,
      rows,
      totalRows: tableData.length,
      truncated: tableData.length > ROW_LIMIT,
      parseErrors: [],
      format: 'XML',
    });
  }

  // No array found — pretty-print XML as code
  return buildCodeHTML(path.basename(inputPath), raw, 'xml');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findFirstArray(obj, depth = 0) {
  if (depth > 4) return null;
  if (!obj || typeof obj !== 'object') return null;
  for (const val of Object.values(obj)) {
    if (Array.isArray(val) && val.length > 0) return val;
    const found = findFirstArray(val, depth + 1);
    if (found) return found;
  }
  return null;
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Shared table HTML builder ────────────────────────────────────────────────
function buildTableHTML({ title, fields, rows, totalRows, truncated, parseErrors, format }) {
  const headerCells = fields.map((f) => `<th>${escapeHTML(f)}</th>`).join('');

  const bodyRows = rows
    .map(
      (row) =>
        `<tr>${fields.map((f) => `<td>${escapeHTML(row[f] ?? '')}</td>`).join('')}</tr>`
    )
    .join('');

  const warningBar =
    truncated
      ? `<div class="warning">Showing first ${ROW_LIMIT.toLocaleString()} of ${totalRows.toLocaleString()} rows.</div>`
      : '';

  const errorBar =
    parseErrors.length > 0
      ? `<div class="warning">Parse warnings: ${parseErrors.map((e) => escapeHTML(e.message)).join(' | ')}</div>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      background: #fff;
      color: #1a1a1a;
    }

    .topbar {
      position: sticky;
      top: 0;
      z-index: 10;
      background: #fff;
      border-bottom: 1px solid #e0e0e0;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .topbar h1 {
      font-size: 14px;
      font-weight: 600;
      color: #1a1a1a;
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .badge {
      background: #e8f4fd;
      color: #1565c0;
      border-radius: 4px;
      padding: 2px 8px;
      font-size: 11px;
      font-weight: 600;
    }

    .stats {
      font-size: 12px;
      color: #666;
    }

    #search {
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 5px 10px;
      font-size: 12px;
      width: 200px;
      outline: none;
    }

    #search:focus { border-color: #1976d2; }

    .warning {
      background: #fff8e1;
      border-bottom: 1px solid #ffe082;
      color: #6d4c00;
      padding: 6px 16px;
      font-size: 12px;
    }

    .table-wrap {
      overflow: auto;
      max-height: calc(100vh - 60px);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      white-space: nowrap;
    }

    thead th {
      position: sticky;
      top: 0;
      background: #f5f5f5;
      border-bottom: 2px solid #ddd;
      border-right: 1px solid #e0e0e0;
      padding: 7px 12px;
      font-weight: 600;
      text-align: left;
      font-size: 12px;
      color: #333;
      cursor: pointer;
      user-select: none;
    }

    thead th:hover { background: #ebebeb; }

    thead th::after { content: ' ↕'; color: #bbb; font-size: 10px; }
    thead th.asc::after  { content: ' ↑'; color: #1976d2; }
    thead th.desc::after { content: ' ↓'; color: #1976d2; }

    tbody tr:nth-child(even) { background: #fafafa; }
    tbody tr:hover { background: #e8f4fd; }

    tbody td {
      border-right: 1px solid #eeeeee;
      border-bottom: 1px solid #eeeeee;
      padding: 5px 12px;
      max-width: 320px;
      overflow: hidden;
      text-overflow: ellipsis;
      color: #2a2a2a;
    }

    .no-results {
      text-align: center;
      padding: 2rem;
      color: #999;
    }
  </style>
</head>
<body>

  <div class="topbar">
    <h1>${escapeHTML(title)}</h1>
    <span class="badge">${format}</span>
    <span class="stats" id="row-count">${rows.length} rows · ${fields.length} columns</span>
    <input id="search" type="search" placeholder="Search…" oninput="filterTable(this.value)"/>
  </div>

  ${warningBar}
  ${errorBar}

  <div class="table-wrap">
    <table id="data-table">
      <thead>
        <tr id="header-row">${headerCells}</tr>
      </thead>
      <tbody id="tbody"></tbody>
    </table>
    <div class="no-results" id="no-results" style="display:none">No matching rows.</div>
  </div>

  <script>
    const rawData = ${JSON.stringify(rows)};
    const fields  = ${JSON.stringify(fields)};
    let filtered  = rawData.slice();
    let sortCol   = null;
    let sortDir   = 1; // 1=asc, -1=desc

    function esc(s) {
      return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function render(data) {
      const tbody = document.getElementById('tbody');
      if (data.length === 0) {
        tbody.innerHTML = '';
        document.getElementById('no-results').style.display = 'block';
      } else {
        document.getElementById('no-results').style.display = 'none';
        tbody.innerHTML = data.map(row =>
          '<tr>' + fields.map(f => '<td title="' + esc(row[f]) + '">' + esc(row[f]) + '</td>').join('') + '</tr>'
        ).join('');
      }
      document.getElementById('row-count').textContent =
        data.length + ' of ' + rawData.length + ' rows · ' + fields.length + ' columns';
    }

    function filterTable(q) {
      const term = q.toLowerCase().trim();
      filtered = term
        ? rawData.filter(row => fields.some(f => String(row[f] ?? '').toLowerCase().includes(term)))
        : rawData.slice();
      if (sortCol !== null) sortData();
      else render(filtered);
    }

    function sortData() {
      const col = fields[sortCol];
      filtered.sort((a, b) => {
        const av = a[col] ?? '', bv = b[col] ?? '';
        const an = parseFloat(av), bn = parseFloat(bv);
        if (!isNaN(an) && !isNaN(bn)) return (an - bn) * sortDir;
        return String(av).localeCompare(String(bv)) * sortDir;
      });
      render(filtered);
    }

    // Column header click → sort
    document.getElementById('header-row').querySelectorAll('th').forEach((th, i) => {
      th.addEventListener('click', () => {
        document.querySelectorAll('thead th').forEach(t => t.classList.remove('asc','desc'));
        if (sortCol === i) {
          sortDir *= -1;
        } else {
          sortCol = i;
          sortDir = 1;
        }
        th.classList.add(sortDir === 1 ? 'asc' : 'desc');
        sortData();
      });
    });

    render(filtered);
  </script>
</body>
</html>`;
}

// ─── Code block viewer (for non-tabular JSON/XML) ─────────────────────────────
function buildCodeHTML(title, content, lang) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, sans-serif; background: #fff; }
    .topbar {
      padding: 10px 16px;
      border-bottom: 1px solid #e0e0e0;
      font-size: 14px;
      font-weight: 600;
      background: #f5f5f5;
    }
    pre {
      padding: 16px;
      overflow: auto;
      font-family: 'Fira Mono', 'Consolas', monospace;
      font-size: 13px;
      line-height: 1.6;
      color: #1a1a1a;
      max-height: calc(100vh - 50px);
      white-space: pre-wrap;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <div class="topbar">${escapeHTML(title)} <span style="font-weight:400;color:#888;font-size:12px">(${lang.toUpperCase()})</span></div>
  <pre>${escapeHTML(content.slice(0, 200_000))}</pre>
</body>
</html>`;
}

function errorHTML(title, message) {
  return `<!DOCTYPE html>
<html><body style="font-family:sans-serif;padding:2rem;color:#c62828">
  <h2>⚠ ${escapeHTML(title)}</h2>
  <p style="margin-top:0.5rem;color:#555">${escapeHTML(message)}</p>
</body></html>`;
}

module.exports = { csvToHTML, xmlToHTML, jsonToHTML };