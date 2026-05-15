// diagnose-sources.cjs
// Run two queries to understand why sources don't render on order 12.

console.log('=== Run this in SSMS ===');
console.log('');
console.log('-- Q1: Confirm sources exist for order 12');
console.log("SELECT ols.id, ols.order_line_id, ol.line_number, ols.supplier_id,");
console.log("       s.company_name, ols.allocated_qty, ols.unit_cost,");
console.log("       ols.supplier_po_line_id");
console.log("FROM order_line_sources ols");
console.log("INNER JOIN order_lines ol ON ol.id = ols.order_line_id");
console.log("LEFT JOIN suppliers s ON s.id = ols.supplier_id");
console.log("WHERE ol.order_id = 12");
console.log("ORDER BY ol.line_number, ols.sort_order;");
console.log('');
console.log('-- If Q1 returns rows, sources are there. The bug is in the render.');
console.log('-- If Q1 returns 0 rows, sources didn\\'t copy from quote on accept.');

const fs = require('fs');

console.log('');
console.log('=== Inspect render code ===');
const src = fs.readFileSync('admin/orderLinesBlock.js', 'utf8');
const lines = src.split('\n');

// Confirm the order-loading code is wired right
// The _sourcesMap loading is at top of file (lines 7-20)
// The _srcHtml usage is in the forEach loop
console.log('');
console.log('First 25 lines of orderLinesBlock (where sources are loaded):');
for (let i = 0; i < 25; i++) {
  console.log('L' + (i+1) + ': ' + lines[i]);
}

// Now check orderRoutes.js to see how renderLinesTab is called and what `oLines` is
console.log('');
console.log('=== Check how renderLinesTab is called ===');
const r = fs.readFileSync('admin/orderRoutes.js', 'utf8');
const rLines = r.split('\n');
rLines.forEach(function(line, i) {
  if (/renderLinesTab/.test(line)) {
    console.log('orderRoutes L' + (i+1) + ': ' + line.trim().substring(0, 200));
  }
});
