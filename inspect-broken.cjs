// Look at what node thinks line 1717 is, and also check line endings
const fs = require('fs');
const buf = fs.readFileSync('admin/index.js');
const s = buf.toString('utf8');

// Detect line endings
const crlf = (s.match(/\r\n/g) || []).length;
const lfOnly = (s.match(/(?<!\r)\n/g) || []).length;
console.log('Line endings: CRLF=' + crlf + '  LF-only=' + lfOnly);

// Show line 1717 +/- 5
const lines = s.split(/\r?\n/);
console.log('Total lines: ' + lines.length);
console.log('');
console.log('Around L1717:');
for (let i = Math.max(0, 1710); i < Math.min(1725, lines.length); i++) {
  console.log('L' + (i+1) + ': [' + lines[i] + ']');
}

// Also show the chars at that exact position
console.log('');
console.log('Raw bytes around the unit_cost line area (after first patch fail):');
const idx = s.indexOf('parseFloat(l.unit_cost||0)');
if (idx >= 0) {
  // Print line before and after with raw escapes visible
  let start = idx;
  // back up two lines
  for (let i = 0; i < 3; i++) {
    const p = s.lastIndexOf('\n', start - 1);
    if (p < 0) break;
    start = p;
  }
  let end = idx;
  for (let i = 0; i < 5; i++) {
    const p = s.indexOf('\n', end + 1);
    if (p < 0) break;
    end = p;
  }
  const snippet = s.substring(start, end);
  console.log(JSON.stringify(snippet));
}
