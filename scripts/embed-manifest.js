// Regenerates js/manifest-data.js from assets/manifest.json + assets/landscape/manifest.json.
// The embedded copies are only a fallback for file:// usage (fetch is blocked there).
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const data = {
  portrait: read('assets/manifest.json'),
  landscape: fs.existsSync(path.join(root, 'assets/landscape/manifest.json')) ? read('assets/landscape/manifest.json') : null,
};
const out =
  '// Embedded copies of assets/manifest.json (portrait) and assets/landscape/manifest.json (landscape).\n' +
  '// Used only as a fallback when fetch() is unavailable (e.g. opening index.html via file://).\n' +
  '// Regenerate with: npm run manifest:embed\n' +
  'window.TORNADO_MANIFESTS = ' + JSON.stringify(data, null, 2) + ';\n' +
  'window.TORNADO_MANIFEST = window.TORNADO_MANIFESTS.portrait;\n';
fs.writeFileSync(path.join(root, 'js/manifest-data.js'), out);
console.log('js/manifest-data.js updated');
