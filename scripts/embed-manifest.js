// Regenerates js/manifest-data.js from assets/manifest.json.
// The embedded copy is only a fallback for file:// usage (fetch is blocked there).
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/manifest.json'), 'utf8'));
const out =
  '// Embedded copy of assets/manifest.json.\n' +
  '// Used only as a fallback when fetch() is unavailable (e.g. opening index.html via file://).\n' +
  '// Regenerate with: npm run manifest:embed\n' +
  'window.TORNADO_MANIFEST = ' + JSON.stringify(manifest, null, 2) + ';\n';
fs.writeFileSync(path.join(root, 'js/manifest-data.js'), out);
console.log('js/manifest-data.js updated');
