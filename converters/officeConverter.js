'use strict';

/**
 * converters/officeConverter.js
 *
 * Converts Office files to PDF using LibreOffice headless.
 * Supports: .docx .doc .xlsx .xls .xlsm .xlsb .xla .pptx .odt .rtf .vsdx
 */

const { exec } = require('child_process');
const path = require('path');
const fs   = require('fs');
const { v4: uuidv4 } = require('uuid');

// __dirname = server/converters/
// ../tmp/previews → server/tmp/previews  ✅
const PREVIEW_DIR = path.join(__dirname, '../tmp/previews');

// ─── Locate LibreOffice binary ────────────────────────────────────────────────
function getLibreOfficeBin() {
  if (process.platform === 'darwin') {
    return '/Applications/LibreOffice.app/Contents/MacOS/soffice';
  }
  if (process.platform === 'win32') {
    const winPaths = [
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    ];
    for (const p of winPaths) {
      if (fs.existsSync(p)) return p;
    }
    return 'soffice';
  }
  return 'soffice'; // Linux — must be on $PATH
}

/**
 * convertOfficeToPDF(inputPath, originalName)
 *
 * Flow:
 *   1. LibreOffice converts inputPath → workDir/something.pdf  (subdir, temp)
 *   2. We rename it to PREVIEW_DIR/<uuid>.pdf                  (flat, permanent)
 *   3. We delete the now-empty workDir
 *
 * Result URL:  /api/upload/preview/<uuid>.pdf
 * File on disk: server/tmp/previews/<uuid>.pdf   ← route finds it directly ✅
 */
async function convertOfficeToPDF(inputPath, originalName) {
  return new Promise((resolve, reject) => {
    const bin = getLibreOfficeBin();

    // Temp subdir for LibreOffice output (it names the file after the input)
    const workDir = path.join(PREVIEW_DIR, `work-${uuidv4()}`);
    fs.mkdirSync(workDir, { recursive: true });

    const ext = path.extname(inputPath).toLowerCase();
    const convertFilter =
      ext === '.ppt' || ext === '.pptx'
        ? 'pdf:impress_pdf_Export'
        : 'pdf';

    const cmd = [
      `"${bin}"`,
      '--headless',
      '--norestore',
      '--nofirststartwizard',
      '--invisible',
      '--nodefault',
      '--nolockcheck',
      '--convert-to', `"${convertFilter}"`,
      `--outdir "${workDir}"`,
      `"${inputPath}"`,
    ].join(' ');

    exec(cmd, { timeout: 60_000 }, (err, stdout, stderr) => {
      console.log('[LibreOffice] stdout:', stdout);
      if (stderr) console.warn('[LibreOffice] stderr:', stderr);

      if (err) {
        try { fs.rmSync(workDir, { recursive: true }); } catch { /* ignore */ }
        return reject(new Error(
          err.killed
            ? 'LibreOffice conversion timed out (60s).'
            : `LibreOffice conversion failed.\nstdout: ${stdout}\nstderr: ${stderr}`
        ));
      }

      // Find the PDF LibreOffice wrote inside workDir
      const files = fs.readdirSync(workDir).filter(f => f.toLowerCase().endsWith('.pdf'));

      if (!files.length) {
        try { fs.rmSync(workDir, { recursive: true }); } catch { /* ignore */ }
        return reject(new Error(
          `LibreOffice ran but produced no PDF.\nstdout: ${stdout}\nstderr: ${stderr}`
        ));
      }

      // ── Move PDF to a flat UUID path directly in PREVIEW_DIR ──────────────
      // BEFORE: server/tmp/previews/work-<uuid>/originalname.pdf  (nested, unreachable by route)
      // AFTER:  server/tmp/previews/<uuid>.pdf                     (flat, route finds it ✅)
      const finalName = `${uuidv4()}.pdf`;
      const finalPath = path.join(PREVIEW_DIR, finalName);

      try {
        fs.renameSync(path.join(workDir, files[0]), finalPath);
        fs.rmSync(workDir, { recursive: true }); // delete now-empty workDir
      } catch (moveErr) {
        try { fs.rmSync(workDir, { recursive: true }); } catch { /* ignore */ }
        return reject(new Error(`Failed to move PDF: ${moveErr.message}`));
      }

      console.log(`[LibreOffice] PDF ready at: ${finalPath}`);
      resolve({ type: 'pdf', filePath: finalPath });
    });
  });
}

module.exports = { convertOfficeToPDF };