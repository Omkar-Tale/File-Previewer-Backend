'use strict';

const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// __dirname = file-preview-server/server/middleware/
// ../       = file-preview-server/server/              ← stay inside server/
// ../tmp/uploads = file-preview-server/server/tmp/uploads  ✅
const UPLOAD_DIR = path.join(__dirname, '../tmp/uploads');

// ─── All supported file extensions ────────────────────────────────────────────
const ALLOWED_EXTENSIONS = new Set([
  // Office / Documents
  '.xla', '.xls', '.xlsb', '.xlsm', '.xlsx',
  '.doc', '.docx', '.odt', '.rtf',
  '.pptx','.ppt',

  // PDF / XML / structured text
  '.pdf', '.xml', '.html', '.htm', '.json',

  // Plain text / config / logs
  '.txt', '.tmp', '.log', '.ini', '.cfg', '.err',
  '.std', '.scm', '.sgm', '.sdf', '.cod',

  // Images
  '.png', '.jpg', '.jpeg', '.jfif',
  '.bmp', '.dng', '.emf',

  // CAD / GIS / Engineering
  '.dwg', '.dxf', '.dwl', '.dwl2', '.dwh',
  '.dgn', '.dsp', '.dswksp', '.nwd', '.vsdx',
  '.kml', '.kmz', '.shp', '.shx', '.prj', '.cpg',

  // Data / Database
  '.csv', '.dbf', '.db', '.sqlite', '.sql', '.dbs', '.dbi',

  // Archives
  '.zip', '.rar', '.7z',

  // Email
  '.eml', '.msg',

  // Media
  '.mp4', '.mov', '.m2t',

  // Geospatial / simulation
  '.osm', '.wtg', '.scn', '.slg', '.slv',

  // Reports / misc binary
  '.rpt', '.rpc', '.rea',
  '.rcps', '.rcnx', '.rcdx', '.rcbu',
  '.pcp', '.pc3', '.ctb',
  '.anl', '.eql', '.cfr', '.hpl', '.hed',
  '.gsp', '.fvu', '.evo',
  '.lbf', '.mcb', '.sbk',
  '.idx', '.num', '.day', '.cut',
  '.ca3', '.ca6', '.c2',
  '.dto_in', '.metadata', '.ideacon',
  '.uid', '.out', '.mout', '.fil',
  '.ashx', '.ads',
]);

// Maximum file size: 100 MB
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '100', 10) * 1024 * 1024;

// ─── Multer disk storage ───────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    // Guarantee the directory exists at runtime (defensive — index.js also creates it)
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // UUID-based name — never expose original filename on disk
    cb(null, `${uuidv4()}${ext}`);
  },
});

// ─── Extension filter ─────────────────────────────────────────────────────────
function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ext) {
    const err = new Error('File has no extension.');
    err.status = 400;
    return cb(err, false);
  }

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    const err = new Error(`Unsupported file extension: "${ext}"`);
    err.status = 415;
    return cb(err, false);
  }

  cb(null, true);
}

// ─── Export configured multer instance ────────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,                 // one file per request
  },
});

module.exports = { upload, UPLOAD_DIR, ALLOWED_EXTENSIONS };