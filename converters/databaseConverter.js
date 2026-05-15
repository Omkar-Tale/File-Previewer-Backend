'use strict';

async function sqliteToHTML(inputPath, originalName) {
  const Database = require('better-sqlite3');
  let db;
  try { db = new Database(inputPath, { readonly: true }); }
  catch(e) { return errorHTML('Cannot open database', e.message); }

  const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all();
  if (!tables.length) return errorHTML('Empty database', 'No tables found.');

  let html = `<!DOCTYPE html><html><head><style>
    body{font-family:-apple-system,sans-serif;padding:16px}
    h3{margin:1.5rem 0 0.5rem;font-size:14px}
    table{border-collapse:collapse;width:100%;font-size:12px;margin-bottom:1rem}
    th{background:#f5f5f5;padding:5px 10px;border:1px solid #ddd;text-align:left}
    td{padding:4px 10px;border:1px solid #eee}
  </style></head><body><h2 style="font-size:1rem">🗄️ ${escapeHTML(originalName)}</h2>`;

  for (const { name } of tables.slice(0, 10)) {
    const cols = db.prepare(`PRAGMA table_info("${name}")`).all();
    const rows = db.prepare(`SELECT * FROM "${name}" LIMIT 100`).all();

    const headers = cols.map(c => `<th>${escapeHTML(c.name)}</th>`).join('');
    const body = rows.map(r =>
      `<tr>${cols.map(c => `<td>${escapeHTML(String(r[c.name] ?? ''))}</td>`).join('')}</tr>`
    ).join('');

    html += `<h3>Table: ${escapeHTML(name)} (${rows.length} rows shown)</h3>
      <table><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table>`;
  }

  db.close();
  return { type: 'html', content: html + '</body></html>' };
}

async function sqlToHTML(inputPath, originalName) {
  const fs = require('fs');
  const content = fs.readFileSync(inputPath, 'utf-8');
  const lines = content.split('\n');

  const highlighted = lines.map(line => {
    const escaped = escapeHTML(line);
    // Highlight keywords
    return escaped.replace(
      /\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|TABLE|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|IN|IS|NULL|PRIMARY|KEY|FOREIGN|REFERENCES|INDEX|UNIQUE|DEFAULT|VALUES|INTO|SET|AS|LIMIT|ORDER|BY|GROUP|HAVING|DISTINCT|COUNT|SUM|AVG|MIN|MAX|BEGIN|COMMIT|ROLLBACK|CONSTRAINT|AUTO_INCREMENT|IF|EXISTS|DATABASE|USE)\b/gi,
      '<span style="color:#0000ff;font-weight:600">$1</span>'
    ).replace(
      /'[^']*'/g,
      '<span style="color:#c41a16">$&</span>'  // strings in red
    ).replace(
      /--[^\n]*/g,
      '<span style="color:#008000">$&</span>'  // comments in green
    );
  }).join('\n');

  return {
    type: 'html',
    content: `<!DOCTYPE html>
<html><head><style>
  body { font-family: monospace; background: #1e1e1e; color: #d4d4d4; padding: 16px; margin: 0; }
  .toolbar { background: #111; padding: 8px 16px; margin: -16px -16px 16px; border-bottom: 1px solid #333; font-family: sans-serif; font-size: 13px; color: #999; }
  pre { white-space: pre-wrap; word-break: break-word; line-height: 1.6; font-size: 13px; }
  .line-numbers { color: #555; user-select: none; display: inline-block; min-width: 40px; margin-right: 12px; text-align: right; }
</style></head>
<body>
  <div class="toolbar">📄 ${escapeHTML(originalName)} — ${lines.length} lines</div>
  <pre>${lines.map((_, i) => `<span class="line-numbers">${i + 1}</span>`).join('\n').split('\n').map((num, i) => num + highlighted.split('\n')[i]).join('\n')}</pre>
</body></html>`
  };
}

function escapeHTML(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function errorHTML(t,m){ return { type:'html', content:`<html><body style="padding:2rem;color:#c62828"><h2>${t}</h2><p>${m}</p></body></html>` }; }

module.exports = { sqliteToHTML, sqlToHTML };