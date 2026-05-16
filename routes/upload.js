'use strict';

const express = require('express');
const path    = require('path');
const fs      = require('fs');

const { upload, UPLOAD_DIR }               = require('../middleware/upload');
const { validateMime, multerErrorHandler } = require('../middleware/security');
const { getConverterType, getConverterSummary } = require('../utils/extensionRouter');
const converters                           = require('../converters/index');

const router = express.Router();

// __dirname = server/routes/
// ../tmp/previews → server/tmp/previews  
// BUG WAS: '../tmp/uploads' — pointed at uploads folder instead of previews
const UPLOAD_DIR_RESOLVED  = path.join(__dirname, '../tmp/uploads');
const PREVIEW_DIR_RESOLVED = path.join(__dirname, '../tmp/previews');



// ─── POST /api/upload ─────────────────────────────────────────────────────────
router.post(
  '/',
  upload.single('file'),
  async (req, res, next) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file received. Send the file as form-data field "file".' });
    }

    const { path: filePath, originalname } = req.file;
    const ext = path.extname(originalname).toLowerCase();

    try {
      await validateMime(filePath, ext);

      const converterType = getConverterType(ext);
      console.log(`[UPLOAD] ${originalname} → converter: "${converterType}" (${ext})`);

      const result = await converters.run(converterType, filePath, originalname, ext);
      if (result.type === 'pdf') {
        return res.json({
          success: true,
          originalName: originalname,
          ext,
          converterType,
          preview: {
            type: 'pdf',
            url: `/api/upload/preview/${path.basename(result.filePath)}`,
          },
        });
      }

      if (result.type === 'html') {
        return res.json({
          success: true,
          originalName: originalname,
          ext,
          converterType,
          preview: {
            type: 'html',
            content: result.content,
          },
        });
      }

      return res.json({
        success: true,
        originalName: originalname,
        ext,
        converterType,
        preview: { type: 'unsupported' },
      });

    } catch (err) {
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
      err.status = err.status || 500;
      next(err);
    }
  }
);

// ─── GET /api/upload/preview/:filename ────────────────────────────────────────
router.get('/preview/:filename', (req, res) => {
  const safeName = path.basename(req.params.filename);

  // Check previews/ first, then uploads/ (passthrough PDFs land in uploads)
  let filePath = path.join(PREVIEW_DIR_RESOLVED, safeName);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(UPLOAD_DIR_RESOLVED, safeName);
  }

  console.log(`[PREVIEW] Serving: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Preview file not found or has expired.' });
  }

  const ext = path.extname(safeName).toLowerCase();
  if (ext === '.pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
  } else if (['.jpg', '.jpeg'].includes(ext)) {
    res.setHeader('Content-Type', 'image/jpeg');
  } else if (ext === '.png') {
    res.setHeader('Content-Type', 'image/png');
  }

  res.sendFile(filePath);
});

// ─── GET /api/upload/stream/:filename ─────────────────────────────────────────
router.get('/stream/:filename', (req, res) => {
  const safeName = path.basename(req.params.filename);
  const filePath = path.join(UPLOAD_DIR, safeName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found.' });
  }

  const stat     = fs.statSync(filePath);
  const fileSize = stat.size;
  const range    = req.headers.range;

  const MIME = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.m2t': 'video/mp2t' };
  const ext2 = path.extname(safeName).toLowerCase();
  const mime = MIME[ext2] || 'video/mp4';

  if (range) {
    const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
    const start     = parseInt(startStr, 10);
    const end       = endStr ? parseInt(endStr, 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      'Content-Range':  `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges':  'bytes',
      'Content-Length': chunkSize,
      'Content-Type':   mime,
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type':   mime,
      'Accept-Ranges':  'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// ─── GET /api/upload/supported-formats ────────────────────────────────────────
router.get('/supported-formats', (_req, res) => {
  const summary = getConverterSummary();
  const allExtensions = Object.entries(summary).flatMap(([type, exts]) =>
    exts.map((ext) => ({ ext, converterType: type }))
  );
  res.json({
    totalExtensions: allExtensions.length,
    byConverterType: summary,
    all: allExtensions,
  });
});

// ─── Multer error handler (must be last) ──────────────────────────────────────
router.use(multerErrorHandler);

module.exports = router;