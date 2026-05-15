// converters/gisConverter.js
'use strict';
const fs = require('fs');

async function kmlToHTML(inputPath, originalName) {
  const raw = fs.readFileSync(inputPath, 'utf-8');
  const escaped = raw.replace(/`/g, '\\`').replace(/\$/g, '\\$');

  return {
    type: 'html',
    content: `<!DOCTYPE html><html><head>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <script src="https://unpkg.com/leaflet-omnivore@0.3.4/leaflet-omnivore.min.js"></script>
      <style>* { margin:0; padding:0; } #map { height:100vh; }</style>
    </head><body>
      <div id="map"></div>
      <script>
        const map = L.map('map').setView([20, 0], 2);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          { attribution: '© OpenStreetMap' }).addTo(map);
        const layer = omnivore.kml.parse(\`${escaped}\`).addTo(map);
        layer.on('ready', () => { try { map.fitBounds(layer.getBounds()); } catch(e){} });
        layer.on('error', (e) => console.error('KML parse error', e));
      </script>
    </body></html>`
  };
}

module.exports = { kmlToHTML };