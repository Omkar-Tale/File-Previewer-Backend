'use strict';

const fs       = require('fs');
const path     = require('path');
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const axios    = require('axios');
const FormData = require('form-data');

const PREVIEW_DIR   = path.join(__dirname, '../tmp/previews');
const PYTHON_SERVER = process.env.PYTHON_SERVER_URL || 'http://localhost:8000';

// ─────────────────────────────────────
// QUEUE (process one DWG at a time)
// ─────────────────────────────────────

const queue   = [];
let isRunning = false;

function enqueue(inputPath, originalName) {
  return new Promise((resolve, reject) => {
    queue.push({ inputPath, originalName, resolve, reject });
    console.log(`[CAD Queue] Added: ${originalName} | Queue size: ${queue.length}`);
    if (!isRunning) processNext();
  });
}

async function processNext() {
  if (!queue.length) {
    isRunning = false;
    return;
  }

  isRunning = true;

  const { inputPath, originalName, resolve, reject } = queue.shift();

  console.log(`[CAD Queue] Processing: ${originalName} | Remaining: ${queue.length}`);

  try {
    const result = await runDWGConversion(inputPath, originalName);
    resolve(result);
  } catch (e) {
    reject(e);
  } finally {
    processNext();
  }
}

// ─────────────────────────────────────
// DWG → (Python server) → DXF → (LibreOffice) → PDF
// ─────────────────────────────────────

async function runDWGConversion(inputPath, originalName) {

  const workDir = path.join(PREVIEW_DIR, `cad-${uuidv4()}`);
  fs.mkdirSync(workDir, { recursive: true });

  // ── Step 1: Send DWG to Python server → get DXF back ──
  console.log('[CAD] Sending DWG to Python server...');

  let dxfPath;

  try {

    const form = new FormData();
    form.append('file', fs.createReadStream(inputPath), originalName);

    const response = await axios.post(
      `${PYTHON_SERVER}/convert/dwg-to-dxf`,
      form,
      {
        headers:      { ...form.getHeaders() },
        responseType: 'arraybuffer',
        timeout:      120000,
      }
    );

    dxfPath = path.join(workDir, 'converted.dxf');
    fs.writeFileSync(dxfPath, Buffer.from(response.data));

    console.log('[CAD] DXF received:', dxfPath);

  } catch (e) {
    try { fs.rmSync(workDir, { recursive: true }); } catch { }

    const msg = e.response
      ? `Python server error ${e.response.status}: ${Buffer.from(e.response.data).toString()}`
      : `Python server unreachable: ${e.message}`;

    throw new Error(msg);
  }

  // ── Step 2: DXF → PDF via LibreOffice ──
  return dxfToPDFFile(dxfPath, workDir);
}

// ─────────────────────────────────────
// DXF → PDF via LibreOffice
// ─────────────────────────────────────

function dxfToPDFFile(dxfPath, workDir) {
  return new Promise((resolve, reject) => {

    const cmd = `soffice --headless --convert-to pdf --outdir "${workDir}" "${dxfPath}"`;
    console.log('[CAD] DXF→PDF:', cmd);

    exec(cmd, { timeout: 60000 }, (err, stdout, stderr) => {

      console.log('[CAD] LibreOffice stdout:', stdout);
      if (stderr) console.log('[CAD] LibreOffice stderr:', stderr);

      if (err) {
        try { fs.rmSync(workDir, { recursive: true }); } catch { }
        return reject(new Error(`LibreOffice failed: ${stderr || err.message}`));
      }

      const pdfFiles = fs
        .readdirSync(workDir)
        .filter(f => f.toLowerCase().endsWith('.pdf'));

      if (!pdfFiles.length) {
        try { fs.rmSync(workDir, { recursive: true }); } catch { }
        return reject(new Error('LibreOffice ran but produced no PDF'));
      }

      // ── Move PDF to flat PREVIEW_DIR (same as officeConverter) ──
      const finalName = `${uuidv4()}.pdf`;
      const finalPath = path.join(PREVIEW_DIR, finalName);

      try {
        fs.renameSync(path.join(workDir, pdfFiles[0]), finalPath);
        fs.rmSync(workDir, { recursive: true });
      } catch (moveErr) {
        return reject(new Error(`Failed to move PDF: ${moveErr.message}`));
      }

      console.log('[CAD] PDF ready at:', finalPath);
      resolve({ type: 'pdf', filePath: finalPath });
    });
  });
}

// ─────────────────────────────────────
// DXF uploaded directly → PDF
// (no queue, no Python needed)
// ─────────────────────────────────────

async function convertDXFToPDF(inputPath, originalName) {

  const workDir = path.join(PREVIEW_DIR, `cad-${uuidv4()}`);
  fs.mkdirSync(workDir, { recursive: true });

  return dxfToPDFFile(inputPath, workDir);
}

// ─────────────────────────────────────
// EXPORTS  (named same as index.js expects)
// ─────────────────────────────────────

module.exports = {
  dwgToHTML: (inputPath, originalName) => enqueue(inputPath, originalName),
  dxfToHTML: (inputPath, originalName) => convertDXFToPDF(inputPath, originalName),
};