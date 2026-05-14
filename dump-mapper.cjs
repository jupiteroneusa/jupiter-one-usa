// dump-mapper.cjs
const fs = require('fs');
const src = fs.readFileSync('admin/index.js', 'utf8');
const lines = src.split('\n');

// Find lineRows mapper
let idx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const lineRows = lines.recordset.map')) { idx = i; break; }
}

if (idx < 0) {
  console.log('lineRows not found');
  process.exit(0);
}

console.log('lineRows mapper region (line ' + (idx+1) + ' onward):');
console.log('');
for (let i = idx; i < Math.min(idx + 25, lines.length); i++) {
  console.log('L' + (i+1) + ': [' + lines[i] + ']');
}
