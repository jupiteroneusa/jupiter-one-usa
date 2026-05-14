// check-quote-detail.cjs
const fs = require('fs');
const path = require('path');

// Look in admin files for quote detail rendering
const files = [
  'admin/index.js',
  'admin/quoteRoutes.js',
  'admin/quoteDetail.js',
  'admin/quoteBuilder.js'
];

files.forEach(function(f) {
  if (!fs.existsSync(f)) return;
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');

  console.log('### ' + f);
  lines.forEach(function(line, i) {
    // Hits in line items rendering of quote detail
    if (
      /router\.get\(.*\/quotes\/:id/.test(line) ||
      /quote detail/i.test(line) ||
      /Line Items.*\d/.test(line) ||
      /quote_line_sources/.test(line) ||
      (/quote_lines/.test(line) && /SELECT/i.test(line))
    ) {
      console.log('  L' + (i+1) + ': ' + line.trim().substring(0, 160));
    }
  });
  console.log('');
});

// Show admin/index.js context where quotes route is defined
const idx = fs.readFileSync('admin/index.js', 'utf8');
const ilines = idx.split('\n');
let q1 = -1;
for (let i = 0; i < ilines.length; i++) {
  if (/router\.get\(['"]\/quotes\/:id['"]/.test(ilines[i])) { q1 = i; break; }
}
if (q1 >= 0) {
  console.log('\n========== admin/index.js GET /quotes/:id (lines ' + (q1+1) + ' to ' + (q1+150) + ') ==========\n');
  for (let i = q1; i < Math.min(q1 + 150, ilines.length); i++) {
    console.log('L' + (i+1) + ': ' + ilines[i]);
  }
}
