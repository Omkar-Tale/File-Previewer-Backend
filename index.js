'use strict';

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const fs        = require('fs');
const path      = require('path');
const rateLimit = require('express-rate-limit');
const { setInterval } = require('timers');

const uploadRouter = require('./routes/upload');
require('dotenv').config();


// ─── Import UPLOAD_DIR from middleware — ONE definition, no duplication ───────
const { UPLOAD_DIR } = require('./middleware/upload');
const PREVIEW_DIR    = path.join(__dirname, 'tmp/previews');

// Ensure preview dir exists (upload dir is guaranteed by middleware/upload.js)
if (!fs.existsSync(PREVIEW_DIR)) fs.mkdirSync(PREVIEW_DIR, { recursive: true });

// ─── App setup ────────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Cleanup: delete files older than 1 hour ──────────────────────────────────
function cleanupTmp() {
  const THIRTY_MIN = 30 * 60 * 1000;'use strict';

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const fs        = require('fs');
const path      = require('path');
const rateLimit = require('express-rate-limit');
const { setInterval } = require('timers');

const uploadRouter = require('./routes/upload');

// ─── Import UPLOAD_DIR from middleware (single definition) ────────────────────
const { UPLOAD_DIR } = require('./middleware/upload');

// __dirname = server/
// ./tmp/previews → server/tmp/previews  ✅  (matches converters & routes)
const PREVIEW_DIR = path.join(__dirname, 'tmp/previews');

// Ensure preview dir exists at startup
// (UPLOAD_DIR is already guaranteed inside middleware/upload.js)
if (!fs.existsSync(PREVIEW_DIR)) fs.mkdirSync(PREVIEW_DIR, { recursive: true });

// ─── App setup ────────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Cleanup: delete files older than 1 hour from both tmp dirs ───────────────
function cleanupTmp() {
  const THIRTY_MIN = 30 * 60 * 1000;

  for (const dir of [UPLOAD_DIR, PREVIEW_DIR]) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      const filePath = path.join(dir, file);
      try {
        const stat = fs.statSync(filePath);
        if (Date.now() - stat.mtimeMs > THIRTY_MIN) {
          fs.rmSync(filePath, { recursive: true, force: true });
          console.log(`[cleanup] Deleted: ${filePath}`);
        }
      } catch { /* ignore locked files */ }
    }
  }
}

setInterval(cleanupTmp, 30 * 60 * 1000);
cleanupTmp();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      frameAncestors: ["'self'", process.env.CLIENT_ORIGIN || "http://localhost:5173"],
    },
  },
}));
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST'],
}));
app.use(morgan('dev'));
app.use(express.json());

// ─── Rate limiting ────────────────────────────────────────────────────────────
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_PER_MINUTE, 10) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many uploads. Please wait a minute and try again.' },
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/upload', uploadLimiter, uploadRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ─── Startup ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  File Preview Server running on http://localhost:${PORT}`);
  console.log(`    Upload directory : ${UPLOAD_DIR}`);
  console.log(`    Preview directory: ${PREVIEW_DIR}\n`);
});

module.exports = app;

  for (const dir of [UPLOAD_DIR, PREVIEW_DIR]) {
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      const filePath = path.join(dir, file);
      try {
        const stat = fs.statSync(filePath);
        if (Date.now() - stat.mtimeMs > THIRTY_MIN) {
          fs.rmSync(filePath, { recursive: true, force: true });
          console.log(`[cleanup] Deleted: ${filePath}`);
        }
      } catch { /* ignore locked files */ }
    }
  }
}

setInterval(cleanupTmp, 30 * 60 * 1000);
cleanupTmp();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      frameAncestors: ["'self'", "http://localhost:5173"],
    },
  },
}));
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST'],
}));
app.use(morgan('dev'));
app.use(express.json());

// ─── Rate limiting ────────────────────────────────────────────────────────────
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_PER_MINUTE, 10) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many uploads. Please wait a minute and try again.' },
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/upload', uploadLimiter, uploadRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ─── Startup ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  File Preview Server running on http://localhost:${PORT}`);
  console.log(`    Upload directory : ${UPLOAD_DIR}`);
  console.log(`    Preview directory: ${PREVIEW_DIR}\n`);
});

module.exports = app;