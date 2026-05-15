'use strict';

/**
 * converters/imageConverter.js
 *
 * Converts image files to a responsive HTML preview using Sharp.
 * Supports: .png .jpg .jpeg .jfif .bmp .dng .emf .tiff .webp
 *
 * npm install sharp
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

/**
 * convertImage(inputPath, ext)
 * Returns: { type: 'html', content: '<html>…</html>' }
 */
async function convertImage(inputPath, ext) {
  let metadata = {};
  let base64 = '';
  let mimeType = 'image/webp';
  let warning = '';

  try {
    // Read metadata first
    metadata = await sharp(inputPath).metadata();

    // DNG / RAW files: Sharp can read but output as JPEG for better compat
    const isRaw = ['.dng', '.tiff', '.tif'].includes(ext.toLowerCase());

    const pipeline = sharp(inputPath).rotate(); // auto-rotate via EXIF

    // Resize if very large (cap at 2400px wide to keep base64 reasonable)
    if (metadata.width && metadata.width > 2400) {
      pipeline.resize({ width: 2400, withoutEnlargement: true });
    }

    if (isRaw) {
      const jpegBuf = await pipeline.jpeg({ quality: 88 }).toBuffer();
      base64 = jpegBuf.toString('base64');
      mimeType = 'image/jpeg';
    } else {
      const webpBuf = await pipeline.webp({ quality: 88 }).toBuffer();
      base64 = webpBuf.toString('base64');
      mimeType = 'image/webp';
    }

  } catch (err) {
    // EMF and some proprietary formats Sharp can't decode
    if (err.message.includes('unsupported image format') || err.message.includes('Input file is missing')) {
      warning = `Sharp cannot decode ${ext} files directly. Install ImageMagick for full support.`;
      return { type: 'html', content: unsupportedImageHTML(ext, warning) };
    }
    throw err;
  }

  const fileSize = fs.statSync(inputPath).size;

  const content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #1a1a1a;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .toolbar {
      width: 100%;
      background: #111;
      border-bottom: 1px solid #333;
      padding: 8px 16px;
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .meta-item {
      font-size: 12px;
      color: #999;
    }

    .meta-item strong {
      color: #ccc;
    }

    .zoom-controls {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-left: auto;
    }

    .btn {
      background: #2a2a2a;
      border: 1px solid #444;
      color: #ccc;
      padding: 4px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      user-select: none;
    }

    .btn:hover { background: #3a3a3a; }

    #zoom-label {
      font-size: 12px;
      color: #999;
      min-width: 40px;
      text-align: center;
    }

    .canvas-wrap {
      flex: 1;
      width: 100%;
      overflow: auto;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 24px;
    }

    #preview-img {
      max-width: 100%;
      display: block;
      border: 1px solid #333;
      box-shadow: 0 4px 32px rgba(0,0,0,0.6);
      cursor: zoom-in;
      transform-origin: top left;
      transition: transform 0.15s ease;
    }

    #preview-img.zoomed { cursor: zoom-out; }
  </style>
</head>
<body>

  <div class="toolbar">
    <span class="meta-item"><strong>${path.basename(inputPath)}</strong></span>
    ${metadata.width ? `<span class="meta-item"><strong>Dimensions:</strong> ${metadata.width} × ${metadata.height}px</span>` : ''}
    ${metadata.density ? `<span class="meta-item"><strong>DPI:</strong> ${metadata.density}</span>` : ''}
    <span class="meta-item"><strong>Format:</strong> ${(metadata.format || ext).toUpperCase()}</span>
    <span class="meta-item"><strong>Size:</strong> ${formatBytes(fileSize)}</span>
    ${metadata.space ? `<span class="meta-item"><strong>Color space:</strong> ${metadata.space}</span>` : ''}

    <div class="zoom-controls">
      <button class="btn" onclick="zoomOut()">−</button>
      <span id="zoom-label">100%</span>
      <button class="btn" onclick="zoomIn()">+</button>
      <button class="btn" onclick="resetZoom()">Reset</button>
    </div>
  </div>

  <div class="canvas-wrap" id="canvas-wrap">
    <img
      id="preview-img"
      src="data:${mimeType};base64,${base64}"
      alt="Image preview"
      onclick="toggleZoom()"
    />
  </div>

  <script>
    let zoomLevel = 1;
    const img = document.getElementById('preview-img');
    const label = document.getElementById('zoom-label');

    function applyZoom() {
      img.style.transform = 'scale(' + zoomLevel + ')';
      img.style.transformOrigin = 'top center';
      label.textContent = Math.round(zoomLevel * 100) + '%';
      img.classList.toggle('zoomed', zoomLevel > 1);
    }

    function zoomIn()    { zoomLevel = Math.min(zoomLevel + 0.25, 4); applyZoom(); }
    function zoomOut()   { zoomLevel = Math.max(zoomLevel - 0.25, 0.25); applyZoom(); }
    function resetZoom() { zoomLevel = 1; applyZoom(); }

    function toggleZoom() {
      zoomLevel = zoomLevel === 1 ? 2 : 1;
      applyZoom();
    }

    // Mouse-wheel zoom
    document.getElementById('canvas-wrap').addEventListener('wheel', (e) => {
      e.preventDefault();
      e.deltaY < 0 ? zoomIn() : zoomOut();
    }, { passive: false });
  </script>
</body>
</html>`;

  return { type: 'html', content };
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function unsupportedImageHTML(ext, message) {
  return `<!DOCTYPE html>
<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#1a1a1a;color:#ccc;text-align:center;padding:2rem">
  <div>
    <div style="font-size:3rem;margin-bottom:1rem">🖼️</div>
    <h2>${ext.toUpperCase()} Preview</h2>
    <p style="color:#888;margin-top:0.5rem">${message}</p>
  </div>
</body></html>`;
}

module.exports = { convertImage };