// check-sline.cjs
const fs = require('fs');
const src = fs.readFileSync('admin/quoteBuilder.js', 'utf8');
const lines = src.split('\n');

console.log('========== sLine references ==========\n');
lines.forEach(function(line, i) {
  if (line.includes('sLine') || line.includes('@ltt') || line.includes("'ltt'")) {
    console.log('L' + (i+1) + ': ' + line);
  }
});

console.log('\n========== Lines 500-570 (around the patch) ==========\n');
for (let i = 499; i < Math.min(575, lines.length); i++) {
  console.log('L' + (i+1) + ': ' + lines[i]);
}
