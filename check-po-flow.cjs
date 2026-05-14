// check-po-flow.cjs
const fs = require('fs');

console.log('========== admin/orderRoutes.js : create-supplier-pos-from-order (full) ==========\n');
const or = fs.readFileSync('admin/orderRoutes.js', 'utf8');
const orLines = or.split('\n');
let start = -1;
for (let i = 0; i < orLines.length; i++) {
  if (orLines[i].includes("router.post('/orders/:id/create-supplier-pos-from-order'")) { start = i; break; }
}
if (start >= 0) {
  let depth = 0, started = false;
  for (let i = start; i < orLines.length; i++) {
    console.log((i+1) + ': ' + orLines[i]);
    for (const c of orLines[i]) {
      if (c === '{') { depth++; started = true; }
      if (c === '}') depth--;
    }
    if (started && depth === 0 && orLines[i].includes('});')) break;
  }
}

console.log('\n\n========== admin/supplierPoRoutes.js (full first 200 lines) ==========\n');
if (fs.existsSync('admin/supplierPoRoutes.js')) {
  const sp = fs.readFileSync('admin/supplierPoRoutes.js', 'utf8');
  const spl = sp.split('\n');
  for (let i = 0; i < Math.min(220, spl.length); i++) {
    console.log((i+1) + ': ' + spl[i]);
  }
  console.log('... (truncated at 220 lines, total: ' + spl.length + ')');
}
