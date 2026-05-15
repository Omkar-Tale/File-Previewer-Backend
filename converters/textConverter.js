'use strict';
const fs = require('fs');
const path = require('path');

async function textToHTML(inputPath, originalName) {
  const content = fs.readFileSync(inputPath, 'utf-8');
  const escaped = content
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return {
    type: 'html',
    content: `<!DOCTYPE html><html><head><style>
      body { margin: 0; background: #1e1e1e; color: #d4d4d4; }
      pre  { padding: 20px; font: 13px/1.6 'Fira Mono', monospace;
             white-space: pre-wrap; word-break: break-word; }
      .topbar { background: #111; color: #888; padding: 8px 16px;
                font: 12px sans-serif; border-bottom: 1px solid #333; }
    </style></head><body>
      <div class="topbar">${path.basename(inputPath)} — ${content.split('\n').length} lines</div>
      <pre>${escaped.slice(0, 500_000)}</pre>
    </body></html>`
  };
}

module.exports = { textToHTML };