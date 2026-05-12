// check-supplier-list.cjs
const fs = require('fs');
const f = 'admin/index.js';
const src = fs.readFileSync(f, 'utf8');
const lines = src.split('\n');
let start = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("router.get('/suppliers'")) {
    start = i;
    break;
  }
}
if (start < 0) {
  console.log('Not in admin/index.js. Checking supplierRoutes.js...');
  const src2 = fs.readFileSync('admin/supplierRoutes.js', 'utf8');
  const lines2 = src2.split('\n');
  for (let i = 0; i < lines2.length; i++) {
    if (lines2[i].includes("router.get('/suppliers'") && !lines2[i].includes(':id') && !lines2[i].includes('/new')) {
      start = i;
      break;
    }
  }
  if (start < 0) { console.log('Not found anywhere.'); process.exit(0); }
  console.log('=== FOUND in admin/supplierRoutes.js at line ' + (start+1) + ' ===\n');
  let depth = 0, started = false;
  for (let i = start; i < lines2.length; i++) {
    console.log((i+1) + ': ' + lines2[i]);
    for (const c of lines2[i]) {
      if (c === '{') { depth++; started = true; }
      if (c === '}') depth--;
    }
    if (started && depth === 0 && lines2[i].includes('});')) break;
  }
} else {
  console.log('=== FOUND in admin/index.js at line ' + (start+1) + ' ===\n');
  let depth = 0, started = false;
  for (let i = start; i < lines.length; i++) {
    console.log((i+1) + ': ' + lines[i]);
    for (const c of lines[i]) {
      if (c === '{') { depth++; started = true; }
      if (c === '}') depth--;
    }
    if (started && depth === 0 && lines[i].includes('});')) break;
  }
}
