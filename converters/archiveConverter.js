'use strict';
const path = require('path');

async function archiveToHTML(inputPath, originalName, ext) {
  let entries = [];

  if (ext === '.zip') {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(inputPath);
    entries = zip.getEntries().map(e => ({
      name: e.entryName,
      size: e.header.size,
      isDir: e.isDirectory
    }));
  } else {
    // RAR / 7z — show info card, full extraction needs native binaries
    return {
      type: 'html', content: `<html><body style="font-family:sans-serif;padding:2rem">
        <h2>📦 ${ext.toUpperCase()} Archive</h2>
        <p>Install <code>7-zip</code> system binary for full RAR/7z support.</p>
      </body></html>`
    };
  }

  const rows = entries.map(e => `
    <tr>
      <td>${e.isDir ? '📁' : '📄'}</td>
      <td style="font-family:monospace">${escapeHTML(e.name)}</td>
      <td style="color:#888;text-align:right">${e.isDir ? '—' : formatBytes(e.size)}</td>
    </tr>`).join('');

  return {
    type: 'html',
    content: `<!DOCTYPE html><html><head><style>
      body{font-family:-apple-system,sans-serif;padding:16px;background:#fff}
      h2{font-size:1rem;margin-bottom:1rem}
      table{border-collapse:collapse;width:100%;font-size:13px}
      td{padding:5px 10px;border-bottom:1px solid #eee}
      tr:hover{background:#f5f5f5}
    </style></head><body>
      <h2>📦 ${escapeHTML(originalName)} — ${entries.length} entries</h2>
      <table><tbody>${rows}</tbody></table>
    </body></html>`
  };
}

function escapeHTML(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function formatBytes(b){ return b < 1024 ? b+' B' : b < 1048576 ? (b/1024).toFixed(1)+' KB' : (b/1048576).toFixed(2)+' MB'; }

module.exports = { archiveToHTML };