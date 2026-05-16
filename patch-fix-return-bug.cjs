const fs = require('fs');
const { execSync } = require('child_process');

const f = 'admin/orderLinesBlock.js';
const orig = fs.readFileSync(f, 'utf8');
const lines = orig.split('\n');

let firstReturn = -1, secondReturn = -1;
for (let i = 0; i < lines.length; i++) {
  if (/^\s*return html;\s*$/.test(lines[i])) {
    if (firstReturn < 0) firstReturn = i;
    else if (secondReturn < 0) { secondReturn = i; break; }
  }
}

if (firstReturn < 0 || secondReturn < 0) {
  console.error('! could not find two return statements');
  process.exit(1);
}

console.log('First return at line ' + (firstReturn+1) + ' — REMOVING');
console.log('Second return at line ' + (secondReturn+1) + ' — KEEPING');

// Remove the line at firstReturn
lines.splice(firstReturn, 1);
const out = lines.join('\n');

fs.writeFileSync(f + '.fixret.bak', orig);
fs.writeFileSync(f, out);

try {
  execSync('node -c "' + f + '"', { stdio: 'pipe' });
  console.log('+ Removed bogus first return');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(f, orig);
  console.error('! syntax - REVERTED');
  console.error(err.stderr.toString());
  process.exit(1);
}
