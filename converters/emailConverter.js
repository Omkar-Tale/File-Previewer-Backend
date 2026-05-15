'use strict';

/**
 * converters/emailConverter.js
 *
 * Converts email files to a clean HTML preview.
 *   .eml → mailparser
 *   .msg → msgreader (Outlook format)
 *
 * npm install mailparser msgreader
 */

const fs = require('fs');
const path = require('path');

// ─── EML ──────────────────────────────────────────────────────────────────────
async function emlToHTML(inputPath, originalName) {
  let simpleParser;
  try {
    ({ simpleParser } = require('mailparser'));
  } catch {
    return missingLibHTML('mailparser', 'npm install mailparser', originalName);
  }

  const raw = fs.readFileSync(inputPath);
  let parsed;
  try {
    parsed = await simpleParser(raw, { skipHtmlToText: false });
  } catch (e) {
    return errorHTML('Failed to parse EML', e.message);
  }

  return buildEmailHTML({
    subject:  parsed.subject   || '(No subject)',
    from:     formatAddress(parsed.from),
    to:       formatAddress(parsed.to),
    cc:       formatAddress(parsed.cc),
    date:     parsed.date ? parsed.date.toLocaleString() : '',
    body:     parsed.html  || textToHTML(parsed.text || ''),
    attachments: (parsed.attachments || []).map((a) => ({
      filename: a.filename || 'attachment',
      size:     a.size || 0,
      type:     a.contentType || 'application/octet-stream',
    })),
  });
}

// ─── MSG (Outlook) ────────────────────────────────────────────────────────────
async function msgToHTML(inputPath, originalName) {
  let MsgReader;
  try {
    ({ default: MsgReader } = require('@kenjiuno/msgreader'));
  } catch {
    // Try alternate package name
    try {
      MsgReader = require('msgreader');
    } catch {
      return missingLibHTML('msgreader', 'npm install @kenjiuno/msgreader', originalName);
    }
  }

  const buffer = fs.readFileSync(inputPath);
  let msg;
  try {
    const reader = new MsgReader(buffer);
    msg = reader.getFileData();
  } catch (e) {
    return errorHTML('Failed to parse MSG', e.message);
  }

  const attachments = (msg.attachments || []).map((a) => ({
    filename: a.fileName || 'attachment',
    size: 0,
    type: 'application/octet-stream',
  }));

  return buildEmailHTML({
    subject:     msg.subject      || '(No subject)',
    from:        msg.senderName
                   ? `${msg.senderName} <${msg.senderEmail || ''}>`
                   : (msg.senderEmail || ''),
    to:          (msg.recipients || []).map((r) => r.name || r.email).join(', '),
    cc:          '',
    date:        msg.messageDeliveryTime || '',
    body:        msg.bodyHTML || textToHTML(msg.body || ''),
    attachments,
  });
}

// ─── Shared HTML builder ──────────────────────────────────────────────────────
function buildEmailHTML({ subject, from, to, cc, date, body, attachments }) {
  const attachHTML =
    attachments.length > 0
      ? `<div class="attachments">
          <div class="attach-label">📎 ${attachments.length} Attachment${attachments.length > 1 ? 's' : ''}</div>
          ${attachments.map((a) => `
            <div class="attach-item">
              <span class="attach-icon">${fileIcon(a.type)}</span>
              <span class="attach-name">${escapeHTML(a.filename)}</span>
              ${a.size ? `<span class="attach-size">${formatBytes(a.size)}</span>` : ''}
            </div>`).join('')}
        </div>`
      : '';

  const metaRow = (label, value) =>
    value
      ? `<tr>
          <td class="meta-label">${label}</td>
          <td class="meta-value">${escapeHTML(value)}</td>
        </tr>`
      : '';

  return {
    type: 'html',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f0f2f5;
      padding: 24px 16px;
      color: #1a1a1a;
    }

    .email-card {
      max-width: 760px;
      margin: 0 auto;
      background: #fff;
      border-radius: 12px;
      border: 1px solid #e0e0e0;
      overflow: hidden;
    }

    .email-header {
      padding: 20px 24px;
      border-bottom: 1px solid #eeeeee;
    }

    .subject {
      font-size: 18px;
      font-weight: 600;
      color: #1a1a1a;
      margin-bottom: 14px;
      line-height: 1.4;
    }

    .meta-table {
      border-collapse: collapse;
      width: 100%;
    }

    .meta-label {
      font-size: 12px;
      font-weight: 600;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 4px 12px 4px 0;
      width: 60px;
      vertical-align: top;
      white-space: nowrap;
    }

    .meta-value {
      font-size: 13px;
      color: #444;
      padding: 4px 0;
    }

    .attachments {
      border-top: 1px solid #eee;
      padding: 12px 24px;
      background: #fafafa;
    }

    .attach-label {
      font-size: 12px;
      font-weight: 600;
      color: #666;
      margin-bottom: 8px;
    }

    .attach-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      background: #fff;
      border: 1px solid #e8e8e8;
      border-radius: 6px;
      margin-bottom: 6px;
      font-size: 13px;
    }

    .attach-icon { font-size: 16px; }
    .attach-name { flex: 1; color: #333; }
    .attach-size { font-size: 11px; color: #999; }

    .email-body {
      padding: 24px;
      font-size: 14px;
      line-height: 1.7;
      color: #2a2a2a;
      overflow-x: auto;
    }

    /* Scope body styles */
    .email-body a { color: #1976d2; }
    .email-body img { max-width: 100%; height: auto; }
    .email-body table { max-width: 100%; border-collapse: collapse; }
    .email-body blockquote {
      border-left: 3px solid #e0e0e0;
      margin: 8px 0;
      padding: 4px 0 4px 16px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="email-card">

    <div class="email-header">
      <div class="subject">${escapeHTML(subject)}</div>
      <table class="meta-table">
        ${metaRow('From',    from)}
        ${metaRow('To',      to)}
        ${metaRow('CC',      cc)}
        ${metaRow('Date',    date)}
      </table>
    </div>

    ${attachHTML}

    <div class="email-body">
      ${body}
    </div>

  </div>
</body>
</html>`,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatAddress(addr) {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  if (addr.text) return addr.text;
  if (Array.isArray(addr.value)) {
    return addr.value
      .map((v) => (v.name ? `${v.name} <${v.address}>` : v.address))
      .join(', ');
  }
  return '';
}

function textToHTML(text) {
  return `<pre style="white-space:pre-wrap;font-family:inherit;font-size:14px">${escapeHTML(text)}</pre>`;
}

function fileIcon(mimeType) {
  if (mimeType.startsWith('image/'))       return '🖼️';
  if (mimeType.includes('pdf'))            return '📄';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
  if (mimeType.includes('word') || mimeType.includes('document'))     return '📝';
  if (mimeType.includes('zip') || mimeType.includes('compressed'))    return '📦';
  return '📎';
}

function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(2) + ' MB';
}

function escapeHTML(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function errorHTML(title, message) {
  return {
    type: 'html',
    content: `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;color:#c62828">
      <h2>⚠ ${escapeHTML(title)}</h2>
      <p style="margin-top:0.5rem;color:#555">${escapeHTML(message)}</p>
    </body></html>`,
  };
}

function missingLibHTML(lib, installCmd, filename) {
  return {
    type: 'html',
    content: `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;background:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh">
      <div style="background:#fff;border:1px solid #e0e0e0;border-radius:12px;padding:2rem;max-width:420px">
        <h2 style="font-size:1rem;color:#c62828;margin-bottom:0.5rem">⚠ Missing: ${lib}</h2>
        <p style="color:#555;font-size:0.9rem;margin-bottom:1rem">Install to preview ${escapeHTML(filename)}:</p>
        <code style="display:block;background:#1a1a1a;color:#a8ff78;padding:10px 14px;border-radius:6px;font-size:13px">${installCmd}</code>
      </div>
    </body></html>`,
  };
}

module.exports = { emlToHTML, msgToHTML };