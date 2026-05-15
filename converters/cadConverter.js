'use strict';

const fs   = require('fs');
const path = require('path');
const https = require('https');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const PREVIEW_DIR = path.join(__dirname, '../tmp/previews');

// ─── DXF Converter ────────────────────────────────────────────────────────────
async function dxfToHTML(inputPath, originalName) {
  let DxfParser;
  try {
    DxfParser = require('dxf-parser');
  } catch {
    return missingLibHTML('dxf-parser', 'npm install dxf-parser', originalName);
  }

  const raw = fs.readFileSync(inputPath, 'utf-8');
  const parser = new DxfParser();

  let dxf;
  try {
    dxf = parser.parseSync(raw);
  } catch (e) {
    return errorHTML('DXF Parse Error', e.message, originalName);
  }

  const entities  = dxf.entities || [];
  const lines     = [];
  const circles   = [];
  const arcs      = [];
  const polylines = [];

  for (const e of entities) {
    switch (e.type) {
      case 'LINE':                          lines.push(e);     break;
      case 'CIRCLE':                        circles.push(e);   break;
      case 'ARC':                           arcs.push(e);      break;
      case 'LWPOLYLINE': case 'POLYLINE':   polylines.push(e); break;
    }
  }

  const allX = [], allY = [];

  for (const l of lines) {
    allX.push(l.vertices[0].x, l.vertices[1].x);
    allY.push(l.vertices[0].y, l.vertices[1].y);
  }
  for (const c of circles) {
    allX.push(c.center.x - c.radius, c.center.x + c.radius);
    allY.push(c.center.y - c.radius, c.center.y + c.radius);
  }
  for (const p of polylines) {
    for (const v of (p.vertices || [])) { allX.push(v.x); allY.push(v.y); }
  }

  if (allX.length === 0) {
    return infoHTML(originalName, 'DXF file parsed successfully but contains no drawable geometry.', {
      entities: entities.length,
      layers: Object.keys(dxf.tables?.layer?.layers || {}).length,
    });
  }

  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);
  const W    = maxX - minX || 1;
  const H    = maxY - minY || 1;

  const PAD   = 40;
  const SVG_W = 900;
  const SVG_H = 660;
  const scale = Math.min((SVG_W - PAD * 2) / W, (SVG_H - PAD * 2) / H);

  const tx = (x) => PAD + (x - minX) * scale;
  const ty = (y) => SVG_H - PAD - (y - minY) * scale;

  const svgParts = [];

  for (const l of lines) {
    svgParts.push(`<line x1="${tx(l.vertices[0].x).toFixed(2)}" y1="${ty(l.vertices[0].y).toFixed(2)}" x2="${tx(l.vertices[1].x).toFixed(2)}" y2="${ty(l.vertices[1].y).toFixed(2)}" stroke="#1a1a1a" stroke-width="0.8" vector-effect="non-scaling-stroke"/>`);
  }

  for (const c of circles) {
    svgParts.push(`<circle cx="${tx(c.center.x).toFixed(2)}" cy="${ty(c.center.y).toFixed(2)}" r="${(c.radius * scale).toFixed(2)}" fill="none" stroke="#1a1a1a" stroke-width="0.8" vector-effect="non-scaling-stroke"/>`);
  }

  for (const a of arcs) {
    const startA  = (a.startAngle * Math.PI) / 180;
    const endA    = (a.endAngle   * Math.PI) / 180;
    const x1      = tx(a.center.x + a.radius * Math.cos(startA)).toFixed(2);
    const y1      = ty(a.center.y + a.radius * Math.sin(startA)).toFixed(2);
    const x2      = tx(a.center.x + a.radius * Math.cos(endA)).toFixed(2);
    const y2      = ty(a.center.y + a.radius * Math.sin(endA)).toFixed(2);
    const large   = (a.endAngle - a.startAngle + 360) % 360 > 180 ? 1 : 0;
    const rSvg    = (a.radius * scale).toFixed(2);
    svgParts.push(`<path d="M ${x1} ${y1} A ${rSvg} ${rSvg} 0 ${large} 1 ${x2} ${y2}" fill="none" stroke="#1a1a1a" stroke-width="0.8" vector-effect="non-scaling-stroke"/>`);
  }

  for (const p of polylines) {
    if (!p.vertices || p.vertices.length < 2) continue;
    const pts    = p.vertices.map(v => `${tx(v.x).toFixed(2)},${ty(v.y).toFixed(2)}`).join(' ');
    const tag    = p.shape ? 'polygon' : 'polyline';
    svgParts.push(`<${tag} points="${pts}" fill="none" stroke="#1a1a1a" stroke-width="0.8" vector-effect="non-scaling-stroke"/>`);
  }

  const layers = Object.keys(dxf.tables?.layer?.layers || {});

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, sans-serif; background: #f0f0f0; }
    .topbar {
      position: sticky; top: 0; z-index: 10;
      background: #fff; border-bottom: 1px solid #ddd;
      padding: 8px 16px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    }
    .topbar h1 { font-size: 13px; font-weight: 600; flex: 1; }
    .stat { font-size: 11px; color: #666; background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 4px; padding: 2px 8px; }
    .zoom-controls { display: flex; gap: 6px; margin-left: auto; }
    .btn { background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; padding: 4px 10px; cursor: pointer; font-size: 12px; }
    .btn:hover { background: #e8e8e8; }
    .canvas-wrap { overflow: auto; height: calc(100vh - 50px); display: flex; align-items: flex-start; justify-content: center; padding: 16px; }
    svg { background: #fff; border: 1px solid #ccc; box-shadow: 0 2px 16px rgba(0,0,0,0.12); cursor: grab; }
    svg:active { cursor: grabbing; }
  </style>
</head>
<body>
  <div class="topbar">
    <h1>${escapeHTML(originalName)}</h1>
    <span class="stat">Entities: ${entities.length}</span>
    <span class="stat">Lines: ${lines.length}</span>
    <span class="stat">Circles: ${circles.length}</span>
    <span class="stat">Layers: ${layers.length}</span>
    <div class="zoom-controls">
      <button class="btn" onclick="zoom(-0.2)">−</button>
      <button class="btn" onclick="zoom(0.2)">+</button>
      <button class="btn" onclick="resetView()">Reset</button>
    </div>
  </div>
  <div class="canvas-wrap" id="wrap">
    <svg id="svg" width="${SVG_W}" height="${SVG_H}" viewBox="0 0 ${SVG_W} ${SVG_H}" xmlns="http://www.w3.org/2000/svg">
      ${svgParts.join('\n      ')}
    </svg>
  </div>
  <script>
    let scale = 1;
    const svg = document.getElementById('svg');
    function zoom(delta) {
      scale = Math.max(0.2, Math.min(scale + delta, 8));
      svg.style.transform = 'scale(' + scale + ')';
      svg.style.transformOrigin = 'top left';
    }
    function resetView() { scale = 1; svg.style.transform = ''; }
    document.getElementById('wrap').addEventListener('wheel', (e) => {
      e.preventDefault();
      zoom(e.deltaY < 0 ? 0.15 : -0.15);
    }, { passive: false });
  </script>
</body>
</html>`;

  return { type: 'html', content: html };
}

// ─── DWG Converter — CloudConvert ─────────────────────────────────────────────
async function dwgToHTML(inputPath, originalName) {
  const apiKey = process.env.CLOUDCONVERT_API_KEY;

  if (!apiKey) {
    return errorHTML(
      'CloudConvert API key missing',
      'Add CLOUDCONVERT_API_KEY to your .env file to enable DWG preview.',
      originalName
    );
  }

  let CloudConvert;
  try {
    CloudConvert = require('cloudconvert');
  } catch {
    return missingLibHTML('cloudconvert', 'npm install cloudconvert', originalName);
  }

  const cloudConvert = new CloudConvert(apiKey);

  try {
    // Step 1 — Create job
    const job = await cloudConvert.jobs.create({
      tasks: {
        'upload-file': {
          operation: 'import/upload',
        },
        'convert-file': {
          operation: 'convert',
          input: 'upload-file',
          input_format: 'dwg',
          output_format: 'pdf',
          width: 1600,
          height: 1200,
        },
        'export-file': {
          operation: 'export/url',
          input: 'convert-file',
        },
      },
    });

    // Step 2 — Upload DWG
    const uploadTask = job.tasks.find(t => t.name === 'upload-file');
    await cloudConvert.tasks.upload(
      uploadTask,
      fs.createReadStream(inputPath),
      originalName
    );

    // Step 3 — Wait for completion
    const finished = await cloudConvert.jobs.wait(job.id);

    // Step 4 — Get output URL
    const exportTask = finished.tasks.find(t => t.name === 'export-file');
    if (!exportTask?.result?.files?.length) {
      return errorHTML('Conversion Failed', 'CloudConvert returned no output file.', originalName);
    }

    const fileUrl = exportTask.result.files[0].url;

    // Step 5 — Download PDF locally and serve via your own preview route
    if (!fs.existsSync(PREVIEW_DIR)) {
      fs.mkdirSync(PREVIEW_DIR, { recursive: true });
    }

    const outputFilename = `${uuidv4()}.pdf`;
    const outputPath = path.join(PREVIEW_DIR, outputFilename);

    await new Promise((resolve, reject) => {
      const file = fs.createWriteStream(outputPath);
      https.get(fileUrl, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          https.get(response.headers.location, (redirected) => {
            redirected.pipe(file);
            file.on('finish', () => { file.close(); resolve(); });
            file.on('error', reject);
          }).on('error', reject);
          return;
        }
        response.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
        file.on('error', reject);
      }).on('error', (err) => {
        fs.unlink(outputPath, () => {});
        reject(err);
      });
    });

    return {
      type: 'pdf',
      filePath: outputPath,
    };

  } catch (err) {
    return errorHTML('CloudConvert Error', err.message, originalName);
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
function escapeHTML(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(2) + ' MB';
}

function errorHTML(title, message, filename) {
  return {
    type: 'html',
    content: `<!DOCTYPE html>
<html><body style="font-family:sans-serif;padding:2rem;background:#fef2f2;display:flex;align-items:center;justify-content:center;min-height:100vh">
  <div style="background:#fff;border:1px solid #fca5a5;border-radius:12px;padding:2rem;max-width:500px;width:100%">
    <h2 style="color:#b91c1c;font-size:1rem;margin-bottom:0.5rem">⚠ ${escapeHTML(title)}</h2>
    <p style="color:#555;font-size:0.9rem;margin-bottom:0.5rem">File: <strong>${escapeHTML(filename)}</strong></p>
    <p style="color:#555;font-size:0.9rem">${escapeHTML(message)}</p>
  </div>
</body></html>`,
  };
}

function infoHTML(filename, message, stats) {
  const statRows = Object.entries(stats).map(([k, v]) => `<div>${k}: <strong>${v}</strong></div>`).join('');
  return {
    type: 'html',
    content: `<!DOCTYPE html>
<html><body style="font-family:sans-serif;padding:2rem;background:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh">
  <div style="background:#fff;border:1px solid #e0e0e0;border-radius:12px;padding:2rem;max-width:400px;width:100%">
    <h2 style="font-size:1rem;margin-bottom:0.5rem">${escapeHTML(filename)}</h2>
    <p style="color:#555;font-size:0.9rem;margin-bottom:1rem">${escapeHTML(message)}</p>
    <div style="background:#f9f9f9;border:1px solid #eee;border-radius:8px;padding:0.75rem 1rem;font-size:12px;color:#666">${statRows}</div>
  </div>
</body></html>`,
  };
}

function missingLibHTML(lib, installCmd, filename) {
  return {
    type: 'html',
    content: `<!DOCTYPE html>
<html><body style="font-family:sans-serif;padding:2rem;background:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh">
  <div style="background:#fff;border:1px solid #e0e0e0;border-radius:12px;padding:2rem;max-width:420px">
    <h2 style="font-size:1rem;color:#c62828;margin-bottom:0.5rem">⚠ Missing dependency: ${lib}</h2>
    <p style="color:#555;font-size:0.9rem;margin-bottom:1rem">Install it to enable CAD preview for ${escapeHTML(filename)}:</p>
    <code style="display:block;background:#1a1a1a;color:#a8ff78;padding:10px 14px;border-radius:6px;font-size:13px">${installCmd}</code>
  </div>
</body></html>`,
  };
}

module.exports = { dxfToHTML, dwgToHTML };