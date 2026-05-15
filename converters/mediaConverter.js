'use strict';

/**
 * converters/mediaConverter.js
 *
 * Converts video files to an HTML5 player with FFmpeg thumbnail.
 * Supports: .mp4 .mov .m2t
 *
 * Requires: npm install fluent-ffmpeg
 * System:   ffmpeg must be installed (sudo apt install ffmpeg)
 */

const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const PREVIEW_DIR = path.join(__dirname, '../tmp/previews');
fs.mkdirSync(PREVIEW_DIR, { recursive: true });

async function mediaToHTML(inputPath, originalName, ext) {
  const filename = path.basename(inputPath); // UUID filename on disk e.g. "abc-123.mp4"
  const thumbName = `${uuidv4()}.jpg`;
  const thumbPath = path.join(PREVIEW_DIR, thumbName);

  // ── Try to generate a thumbnail via FFmpeg ──────────────────────────────
  let thumbExists = false;
  try {
    let ffmpeg;
    try {
      ffmpeg = require('fluent-ffmpeg');
    } catch {
      console.warn('[Media] fluent-ffmpeg not installed — thumbnails will be skipped.');
    }
    await new Promise((resolve, reject) =>
      ffmpeg(inputPath)
        .screenshots({
          count: 1,
          filename: thumbName,
          folder: PREVIEW_DIR,
          size: '640x?',          // width 640, height auto
          timemarks: ['10%'],     // grab frame at 10% of duration
        })
        .on('end', resolve)
        .on('error', reject)
    );
    thumbExists = fs.existsSync(thumbPath);
  } catch (e) {
    console.warn('[Media] FFmpeg thumbnail failed:', e.message);
  }

  const posterAttr = thumbExists
    ? `poster="/api/upload/preview/${thumbName}"`
    : '';

  // ── Get file size for display ───────────────────────────────────────────
  const fileSize = (() => {
    try {
      const bytes = fs.statSync(inputPath).size;
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    } catch { return 'unknown'; }
  })();

  // ── Determine MIME type ─────────────────────────────────────────────────
  const MIME_TYPES = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.m2t': 'video/mp2t',
  };
  const mimeType = MIME_TYPES[ext] || 'video/mp4';

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
      background: #0a0a0a;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .toolbar {
      background: #111;
      border-bottom: 1px solid #2a2a2a;
      padding: 8px 16px;
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .filename {
      font-size: 13px;
      font-weight: 600;
      color: #e0e0e0;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .meta {
      font-size: 11px;
      color: #666;
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 4px;
      padding: 2px 8px;
    }

    .player-wrap {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    video {
      max-width: 100%;
      max-height: calc(100vh - 80px);
      border-radius: 8px;
      box-shadow: 0 8px 40px rgba(0, 0, 0, 0.8);
      outline: none;
      background: #000;
    }

    .no-support {
      text-align: center;
      color: #888;
      padding: 2rem;
    }
  </style>
</head>
<body>

  <div class="toolbar">
    <span class="filename">${escapeHTML(originalName)}</span>
    <span class="meta">${ext.toUpperCase().replace('.', '')}</span>
    <span class="meta">${fileSize}</span>
    ${thumbExists ? `<span class="meta">🖼 Thumbnail generated</span>` : ''}
  </div>

  <div class="player-wrap">
    <video
      controls
      autoplay
      muted
      playsinline
      ${posterAttr}
    >
      <source src="/api/upload/stream/${filename}" type="${mimeType}"/>
      <div class="no-support">
        <p>Your browser does not support this video format (${ext}).</p>
      </div>
    </video>
  </div>

</body>
</html>`,
  };
}

function escapeHTML(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = { mediaToHTML };