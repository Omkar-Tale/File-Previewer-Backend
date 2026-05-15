'use strict';
const { fileTypeFromFile } = require('file-type'); // npm install file-type

// Extensions that are plain text — file-type can't detect them, skip check
const PLAIN_TEXT_EXTS = new Set([
  '.txt', '.log', '.ini', '.cfg', '.err', '.csv', '.xml',
  '.html', '.htm', '.kml', '.eml', '.std', '.cod', '.out',
  '.mout', '.fil', '.day', '.tmp', '.osm', '.dxf', '.gsp',
]);

// Known binary engineering files with no magic bytes signature — skip check
const SKIP_MAGIC_EXTS = new Set([
  '.wtg', '.scn', '.slg', '.slv', '.sbk', '.mcb', '.lbf',
  '.rpc', '.rea', '.rcps', '.rcnx', '.rcdx', '.rcbu',
  '.pcp', '.pc3', '.ctb', '.anl', '.eql', '.cfr', '.hpl',
  '.hed', '.fvu', '.evo', '.num', '.cut', '.idx', '.uid',
  '.ca3', '.ca6', '.c2', '.rpt', '.dto_in', '.metadata',
  '.dwl', '.dwl2', '.dwh', '.dsp', '.dswksp', '.shx',
  '.prj', '.cpg', '.dbf', '.dbi', '.dbs', '.ads', '.ashx',
]);

async function validateMime(filePath, ext) {
  if (PLAIN_TEXT_EXTS.has(ext) || SKIP_MAGIC_EXTS.has(ext)) return; // skip

  let detected;
  try {
    detected = await fileTypeFromFile(filePath);
  } catch {
    return; // can't detect — allow through
  }

  if (!detected) return; // unknown binary — allow through

  // Build expected mime prefix from extension
  const MIME_MAP = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.zip': 'application/zip',
    '.rar': 'application/x-rar-compressed',
    '.7z': 'application/x-7z-compressed',
    '.xlsx': 'application/vnd.openxmlformats-officedocument',
    '.docx': 'application/vnd.openxmlformats-officedocument',
    '.pptx': 'application/vnd.openxmlformats-officedocument',
    '.xls': 'application/vnd.ms-excel',
    '.doc': 'application/msword',
    '.sqlite': 'application/x-sqlite3',
    '.db': 'application/x-sqlite3',
  };

  const expected = MIME_MAP[ext];
  if (!expected) return; // no rule for this ext — allow through

  if (!detected.mime.startsWith(expected)) {
    const err = new Error(
      `MIME mismatch: file appears to be "${detected.mime}" but extension is "${ext}"`
    );
    err.status = 415;
    throw err;
  }
}

function multerErrorHandler(err, _req, res, next) {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 100 MB.' });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Unexpected field. Use "file" as the form field name.' });
  }
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }
  next(err);
}

module.exports = { validateMime, multerErrorHandler };