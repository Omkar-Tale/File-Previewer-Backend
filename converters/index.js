'use strict';

/**
 * converters/index.js
 *
 * Central registry — every converter is wired in here.
 * run(converterType, filePath, originalName, ext) → ConversionResult
 *
 *   { type: 'pdf',  filePath: '/tmp/previews/xxx.pdf' }
 *   { type: 'html', content: '<html>…</html>'         }
 */

const path = require('path');
const fs   = require('fs');

// ─── Import all real converter modules ───────────────────────────────────────
const { convertOfficeToPDF }                   = require('./officeConverter');
const { convertImage }                         = require('./imageConverter');
const { csvToHTML, jsonToHTML, xmlToHTML, cfrToHTML }     = require('./dataConverter');
const { emlToHTML, msgToHTML }                 = require('./emailConverter');
const { dxfToHTML, dwgToHTML }                 = require('./cadConverter');
const { textToHTML }                           = require('./textConverter');
const { archiveToHTML }                        = require('./archiveConverter');
const { sqliteToHTML, sqlToHTML }              = require('./databaseConverter');
const { kmlToHTML }                            = require('./gisConverter');
const { mediaToHTML }                          = require('./mediaConverter');
const { spreadsheetToHTML } = require('./spreadsheetConverter');

// ─── Shared stub (binary / unsupported types) ─────────────────────────────────
function stubHTML(label, ext, filePath) {
  const size = (() => {
    try {
      const bytes = fs.statSync(filePath).size;
      if (bytes < 1024)            return `${bytes} B`;
      if (bytes < 1024 * 1024)     return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    } catch {
      return 'unknown';
    }
  })();

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
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 2rem;
    }
    .card {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      padding: 2rem 2.5rem;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h2   { font-size: 1.2rem; font-weight: 600; color: #1a1a1a; margin-bottom: 0.5rem; }
    p    { font-size: 0.9rem; color: #666; line-height: 1.6; }
    .meta {
      margin-top: 1.5rem;
      background: #f9f9f9;
      border: 1px solid #e8e8e8;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      font-size: 0.8rem;
      color: #888;
      text-align: left;
    }
    .meta span { display: block; margin-bottom: 2px; }
    .badge {
      display: inline-block;
      margin-top: 1rem;
      background: #fff3cd;
      color: #856404;
      border: 1px solid #ffc107;
      border-radius: 6px;
      padding: 4px 12px;
      font-size: 0.75rem;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📄</div>
    <h2>${label} File</h2>
    <p>No rich preview is available for <strong>${ext}</strong> files.<br/>
       The file was uploaded and validated successfully.</p>
    <div class="meta">
      <span>Extension: ${ext}</span>
      <span>Size: ${size}</span>
      <span>Type: ${label}</span>
    </div>
    <span class="badge">⚠ No preview available</span>
  </div>
</body>
</html>`,
  };
}

// ─── Individual converter wrappers ────────────────────────────────────────────

async function convertOffice(filePath, originalName, _ext) {
  return convertOfficeToPDF(filePath, originalName);
}

async function convertPassthrough(filePath, _originalName, _ext) {
  // PDF already — serve the file directly
  return { type: 'pdf', filePath };
}

async function convertImageFile(filePath, _originalName, ext) {
  return convertImage(filePath, ext);
}

async function convertText(filePath, originalName, _ext) {
  return textToHTML(filePath, originalName);
}

async function convertHtml(filePath, _originalName, _ext) {
  // Already HTML — read and pass through (sandboxed iframe on client)
  const content = fs.readFileSync(filePath, 'utf-8');
  return { type: 'html', content };
}

async function convertData(filePath, originalName, ext) {
  switch (ext) {
    case '.csv':  return { type: 'html', content: await csvToHTML(filePath) };
    case '.json': return { type: 'html', content: await jsonToHTML(filePath) };
    case '.xml':  return { type: 'html', content: await xmlToHTML(filePath) };
    case '.cfr':
  return {
    type: 'html',
    content: await cfrToHTML(filePath)
  };
    default:      return stubHTML('Data', ext, filePath);
  }
}

async function convertCAD(filePath, originalName, ext) {
  switch (ext) {
    case '.dxf':  return dxfToHTML(filePath, originalName);
    case '.dwg':  return dwgToHTML(filePath, originalName);
    default:      return stubHTML('CAD', ext, filePath);
  }
}

async function convertGIS(filePath, originalName, ext) {
  switch (ext) {
    case '.kml':
    case '.kmz':
      return kmlToHTML(filePath, originalName);
    default:
      return stubHTML('GIS / Map', ext, filePath);
  }
}

async function convertMedia(filePath, originalName, ext) {
  return mediaToHTML(filePath, originalName, ext);
}

async function convertEmail(filePath, originalName, ext) {
  switch (ext) {
    case '.eml': return emlToHTML(filePath, originalName);
    case '.msg': return msgToHTML(filePath, originalName);
    default:     return stubHTML('Email', ext, filePath);
  }
}

async function convertArchive(filePath, originalName, ext) {
  return archiveToHTML(filePath, originalName, ext);
}

async function convertDatabase(filePath, originalName, ext) {
  switch (ext) {
    case '.sqlite':
    case '.db':
      return sqliteToHTML(filePath, originalName);
    case '.sql':
      return sqlToHTML(filePath, originalName);
    default:
      return stubHTML('Database', ext, filePath);
  }
}
async function convertBinary(filePath, _originalName, ext) {
  return stubHTML('Binary / Proprietary', ext, filePath);
}

async function convertSpreadsheet(filePath, originalName, _ext) {
  return spreadsheetToHTML(filePath, originalName);
}

// ─── Dispatch map ─────────────────────────────────────────────────────────────
const CONVERTERS = {
  office:      convertOffice,
  passthrough: convertPassthrough,
  image:       convertImageFile,
  text:        convertText,
  html:        convertHtml,
  data:        convertData,
  cad:         convertCAD,
  gis:         convertGIS,
  media:       convertMedia,
  email:       convertEmail,
  archive:     convertArchive,
  database:    convertDatabase,
  binary:      convertBinary,
  spreadsheet: convertSpreadsheet,
};

// ─── Main entry point ─────────────────────────────────────────────────────────
/**
 * run(converterType, filePath, originalName, ext)
 *
 * @param {string} converterType  — key from extensionRouter (e.g. 'office')
 * @param {string} filePath       — absolute path to uploaded file on disk
 * @param {string} originalName   — original filename from the client
 * @param {string} ext            — lowercase extension including dot (e.g. '.xlsx')
 * @returns {Promise<{ type: string, content?: string, filePath?: string }>}
 */
async function run(converterType, filePath, originalName, ext) {
  const converter = CONVERTERS[converterType];

  if (!converter) {
    console.warn(`[index.js] No converter registered for type: "${converterType}" (${ext})`);
    return stubHTML('Unsupported', ext, filePath);
  }

  try {
    return await converter(filePath, originalName, ext);
  } catch (err) {
    console.error(`[index.js] Converter "${converterType}" threw for ${originalName}:`, err.message);

    // Return a user-friendly error card instead of crashing the request
    return {
      type: 'html',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, sans-serif;
      background: #fef2f2;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh; padding: 2rem;
    }
    .card {
      background: #fff; border: 1px solid #fca5a5; border-radius: 12px;
      padding: 2rem 2.5rem; max-width: 500px; width: 100%;
    }
    h2   { color: #b91c1c; font-size: 1rem; margin-bottom: 0.5rem; }
    p    { color: #555; font-size: 0.9rem; line-height: 1.6; margin-bottom: 1rem; }
    code {
      display: block; background: #1a1a1a; color: #f87171;
      padding: 10px 14px; border-radius: 6px; font-size: 12px;
      white-space: pre-wrap; word-break: break-word;
    }
  </style>
</head>
<body>
  <div class="card">
    <h2>⚠ Preview Failed — ${ext.toUpperCase()}</h2>
    <p>File: <strong>${originalName}</strong></p>
    <p>The converter encountered an error:</p>
    <code>${err.message}</code>
  </div>
</body>
</html>`,
    };
  }
}

module.exports = { run, CONVERTERS };