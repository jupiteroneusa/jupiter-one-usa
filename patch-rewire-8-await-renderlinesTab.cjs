// patch-rewire-8-await-renderlinesTab.cjs
// One-line fix: renderLinesTab() is now async (since patcher 3) but caller
// isn't awaiting it, causing "[object Promise]" to render.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/orderRoutes.js';
const BACKUP = 'admin/orderRoutes.js.rewire8.bak';

console.log('Rewire 8: await renderLinesTab');
console.log('==============================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('await renderLinesTab')) {
  console.log('- Already patched.');
  process.exit(0);
}

const oldText = 'html += renderLinesTab(o, oLines, suppliers);';
const newText = 'html += await renderLinesTab(o, oLines, suppliers);';

if (!src.includes(oldText)) {
  console.error('! Cannot find renderLinesTab call');
  process.exit(1);
}

src = src.replace(oldText, function() { return newText; });
console.log('+ Added await');

fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);

try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ syntax OK');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! syntax error - REVERTED');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
