// check-order-detail.cjs
const fs = require('fs');

console.log('========== admin/orderLinesBlock.js (full) ==========\n');
if (fs.existsSync('admin/orderLinesBlock.js')) {
  const src = fs.readFileSync('admin/orderLinesBlock.js', 'utf8');
  const lines = src.split('\n');
  console.log('Total lines: ' + lines.length);
  for (let i = 0; i < lines.length; i++) {
    console.log('L' + (i+1) + ': ' + lines[i]);
  }
}

console.log('\n\n========== Where "Create Supplier POs" button lives ==========');
const files = ['admin/orderRoutes.js', 'admin/orderShippingBlock.js', 'admin/index.js'];
files.forEach(function(f) {
  if (!fs.existsSync(f)) return;
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  lines.forEach(function(line, i) {
    if (/Create Supplier PO/i.test(line) || /create-supplier-pos/i.test(line) || /create-pos/i.test(line)) {
      console.log(f + ' L' + (i+1) + ': ' + line.trim().substring(0, 200));
    }
  });
});
