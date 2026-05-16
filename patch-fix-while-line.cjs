// patch-fix-while-line.cjs
// Remove the broken `while (container.querySelector(...))` line.
// `nextIdx = existing.length` is already unique, the while is paranoid and broken.

const fs = require('fs');
const { execSync } = require('child_process');

const f = 'admin/orderLinesBlock.js';
const orig = fs.readFileSync(f, 'utf8');
const lines = orig.split('\n');

let removed = 0;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].indexOf('while (container.querySelector') >= 0) {
    console.log('Removing line ' + (i+1) + ': ' + lines[i].trim().substring(0, 80));
    lines.splice(i, 1);
    removed++;
    break;
  }
}

if (!removed) {
  console.error('! while line not found');
  process.exit(1);
}

const out = lines.join('\n');
fs.writeFileSync(f + '.whilefix.bak', orig);
fs.writeFileSync(f, out);

try {
  execSync('node -c "' + f + '"', { stdio: 'pipe' });
  console.log('+ Broken while line removed; addOrderSrcRow will parse cleanly now');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(f, orig);
  console.error('! syntax - REVERTED');
  console.error(err.stderr.toString());
  process.exit(1);
}
