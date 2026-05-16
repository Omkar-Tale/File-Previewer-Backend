'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');

const uploadRouter = require('./routes/upload');
const { UPLOAD_DIR } = require('./middleware/upload');

// ─── Directories ──────────────────────────────────────────────────────────────
const PREVIEW_DIR = path.join(__dirname, 'tmp/previews');

// Ensure preview directory exists
if (!fs.existsSync(PREVIEW_DIR)) {
  fs.mkdirSync(PREVIEW_DIR, { recursive: true });
}

// ─── App Setup ────────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3001;

// IMPORTANT: Fix Railway/Vercel proxy issue
app.set('trust proxy', 1);

// ─── Cleanup Old Files ────────────────────────────────────────────────────────
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
      } catch (err) {
        console.error('[cleanup error]', err.message);
      }
    }
  }
}

// Run cleanup every 30 mins
setInterval(cleanupTmp, 30 * 60 * 1000);
cleanupTmp();

// ─── Security Middleware ─────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },

    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],

        frameAncestors: [
          "'self'",
          'http://localhost:5173',
          'https://file-previewer-frontend.vercel.app',
        ],
      },
    },
  })
);

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'https://file-previewer-frontend.vercel.app',
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  })
);

// ─── Other Middleware ────────────────────────────────────────────────────────
app.use(morgan('dev'));
app.use(express.json());

// ─── Rate Limiter ────────────────────────────────────────────────────────────
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_PER_MINUTE, 10) || 10,

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    error: 'Too many uploads. Please wait a minute and try again.',
  },
});

// ─── Routes ──────────────────────────────────────────────────────────────────

// Upload APIs
app.use('/api/upload', uploadLimiter, uploadRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// Root route
app.get('/', (_req, res) => {
  res.send('File Preview Backend Running');
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err);

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// ─── Start Server ────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 File Preview Server running on port ${PORT}`);
  console.log(`📁 Upload directory : ${UPLOAD_DIR}`);
  console.log(`📁 Preview directory: ${PREVIEW_DIR}\n`);
});

module.exports = app;