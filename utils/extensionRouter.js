'use strict';

/**
 * extensionRouter.js — Phase 2
 *
 * Maps every supported file extension to a converter type string.
 * The upload route uses this string to select the correct converter module.
 *
 * Converter types:
 *   'office'      → LibreOffice headless → PDF
 *   'passthrough' → already PDF, serve directly
 *   'image'       → Sharp → resized WebP embedded in HTML
 *   'text'        → plain text → syntax-highlighted HTML
 *   'html'        → already HTML, sanitise and pass through
 *   'data'        → CSV / XML / JSON → HTML table
 *   'cad'         → DWG / DXF / DGN → SVG or image via ODA / dxf-parser
 *   'gis'         → KML / KMZ / SHP → Leaflet.js HTML map
 *   'media'       → MP4 / MOV → FFmpeg thumbnail + HTML5 player
 *   'email'       → EML / MSG → parsed HTML
 *   'archive'     → ZIP / RAR / 7Z → HTML file-tree listing
 *   'database'    → SQLite / DB / DBF → HTML table (schema + first rows)
 *   'binary'      → known binary with no rich preview → hex dump / info card
 *   'unsupported' → extension accepted but no converter implemented yet
 */

const EXTENSION_MAP = {
  // ── Office / Documents ──────────────────────────────────────────────────────
  '.xla': 'spreadsheet',
  '.xls': 'spreadsheet',
  '.xlsb': 'spreadsheet',
  '.xlsm': 'spreadsheet',
  '.xlsx': 'spreadsheet',
  '.doc': 'office',
  '.docx': 'office',
  '.odt': 'office',
  '.rtf': 'office',
  '.pptx': 'office',
  '.ppt': 'office',
  '.vsdx': 'office',   // Visio — LibreOffice Draw can open it

  // ── PDF ─────────────────────────────────────────────────────────────────────
  '.pdf': 'passthrough',

  // ── Images ──────────────────────────────────────────────────────────────────
  '.png': 'image',
  '.jpg': 'image',
  '.jpeg': 'image',
  '.jfif': 'image',
  '.bmp': 'image',
  '.dng': 'image',    // Adobe Digital Negative — Sharp supports it
  '.emf': 'image',    // Windows Enhanced Metafile — convert via Sharp/Inkscape

  // ── Plain text / config / logs ──────────────────────────────────────────────
  '.txt': 'text',
  '.tmp': 'text',
  '.log': 'text',
  '.ini': 'text',
  '.cfg': 'text',
  '.err': 'text',
  '.std': 'text',
  '.cod': 'text',
  '.out': 'text',
  '.mout': 'text',
  '.fil': 'text',
  '.day': 'text',

  // ── Already HTML ─────────────────────────────────────────────────────────────
  '.html': 'html',
  '.htm': 'html',

  // ── Structured data ──────────────────────────────────────────────────────────
  '.csv': 'data',
  '.xml': 'data',
  '.json': 'data',

  // ── CAD / Drawing ────────────────────────────────────────────────────────────
  '.dwg': 'cad',
  '.dxf': 'cad',
  '.dwl': 'cad',
  '.dwl2': 'cad',
  '.dwh': 'cad',
  '.dgn': 'cad',
  '.dsp': 'cad',
  '.dswksp': 'cad',
  '.nwd': 'cad',      // Navisworks — requires Autodesk SDK or pass-through

  // ── GIS / Maps ───────────────────────────────────────────────────────────────
  '.kml': 'gis',
  '.kmz': 'gis',
  '.shp': 'gis',
  '.shx': 'gis',
  '.prj': 'gis',
  '.cpg': 'gis',
  '.osm': 'gis',

  // ── Media ────────────────────────────────────────────────────────────────────
  '.mp4': 'media',
  '.mov': 'media',
  '.m2t': 'media',

  // ── Email ────────────────────────────────────────────────────────────────────
  '.eml': 'email',
  '.msg': 'email',

  // ── Archives ─────────────────────────────────────────────────────────────────
  '.zip': 'archive',
  '.rar': 'archive',
  '.7z': 'archive',

  // ── Database ─────────────────────────────────────────────────────────────────
  '.db': 'database',
  '.sqlite': 'database',
  '.sql': 'database',
  '.dbf': 'database',   // dBase — used by shapefiles
  '.dbs': 'database',
  '.dbi': 'database',

  // ── Engineering / simulation (binary blobs, no rich preview yet) ─────────────
  '.wtg': 'binary',
  '.scn': 'binary',
  '.scm': 'binary',
  '.slg': 'binary',
  '.slv': 'binary',
  '.sbk': 'binary',
  '.mcb': 'binary',
  '.lbf': 'binary',
  '.rpc': 'binary',
  '.rea': 'binary',
  '.rcps': 'binary',
  '.rcnx': 'binary',
  '.rcdx': 'binary',
  '.rcbu': 'binary',
  '.pcp': 'binary',
  '.pc3': 'binary',
  '.ctb': 'binary',
  '.anl': 'binary',
  '.eql': 'binary',
  '.cfr': 'data',
  '.hpl': 'binary',
  '.hed': 'binary',
  '.gsp': 'binary',
  '.fvu': 'binary',
  '.evo': 'binary',
  '.num': 'binary',
  '.cut': 'binary',
  '.idx': 'binary',
  '.uid': 'binary',
  '.ashx': 'binary',
  '.ads': 'binary',
  '.metadata': 'binary',
  '.ideacon': 'binary',
  '.dto_in': 'binary',

  // ── Reports (RPT = Crystal Reports, REI = custom) ────────────────────────────
  '.rpt': 'binary',

  // ── CA/C2 simulation files ────────────────────────────────────────────────────
  '.ca3': 'binary',
  '.ca6': 'binary',
  '.c2': 'binary',

  // ── Ink (shortcut files on some systems) ─────────────────────────────────────
  '.lnk': 'binary',
};

/**
 * Returns the converter type for a given extension.
 *
 * @param {string} extension — e.g. '.xlsx'  (lowercase, includes the dot)
 * @returns {string}  converter type key
 */
function getConverterType(extension) {
  const ext = extension.toLowerCase();
  return EXTENSION_MAP[ext] || 'unsupported';
}

/**
 * Returns every extension that maps to a given converter type.
 * Useful for displaying "supported formats" in the UI.
 *
 * @param {string} converterType — e.g. 'office'
 * @returns {string[]}
 */
function getExtensionsByType(converterType) {
  return Object.entries(EXTENSION_MAP)
    .filter(([, type]) => type === converterType)
    .map(([ext]) => ext);
}

/**
 * Returns a summary of all converter types and their extension counts.
 * Handy for /api/health or a /api/supported-formats endpoint.
 */
function getConverterSummary() {
  const summary = {};
  for (const [ext, type] of Object.entries(EXTENSION_MAP)) {
    if (!summary[type]) summary[type] = [];
    summary[type].push(ext);
  }
  return summary;
}

module.exports = { getConverterType, getExtensionsByType, getConverterSummary };