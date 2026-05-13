// check-create-pos.cjs
const fs = require('fs');

console.log('========== POST /orders/:id/create-supplier-pos-from-order (full) ==========\n');
const src = fs.readFileSync('admin/orderRoutes.js', 'utf8');
const lines = src.split('\n');
let start = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("/create-supplier-pos-from-order")) { start = i; break; }
}
if (start < 0) { console.log('not found'); process.exit(0); }
let depth = 0, started = false;
for (let i = start; i < lines.length; i++) {
  console.log((i+1) + ': ' + lines[i]);
  for (const c of lines[i]) {
    if (c === '{') { depth++; started = true; }
    if (c === '}') depth--;
  }
  if (started && depth === 0 && lines[i].includes('});')) break;
}

console.log('\n\n========== quote ACCEPT handler (routes/quotes.js) ==========\n');
console.log('(this is where quote_line_sources -> order_line_sources happens)\n');
const qsrc = fs.readFileSync('routes/quotes.js', 'utf8');
const qlines = qsrc.split('\n');
let qstart = -1;
for (let i = 0; i < qlines.length; i++) {
  if (qlines[i].includes("router.post('/:id/accept'")) { qstart = i; break; }
}
if (qstart >= 0) {
  let depth = 0, started = false;
  for (let i = qstart; i < qlines.length; i++) {
    console.log((i+1) + ': ' + qlines[i]);
    for (const c of qlines[i]) {
      if (c === '{') { depth++; started = true; }
      if (c === '}') depth--;
    }
    if (started && depth === 0 && qlines[i].includes('});')) break;
  }
}

console.log('\n========== SQL: latest order + its lines + sources ==========');
console.log(`
-- Run these in SSMS to see what's actually in the latest order:

-- Q1: latest 3 orders
SELECT TOP 3 id, order_number, status, total, created_at
FROM orders ORDER BY id DESC;

-- Q2: order lines + source data for newest order
DECLARE @oid BIGINT = (SELECT TOP 1 id FROM orders ORDER BY id DESC);
SELECT 'Order Lines' AS section, id, line_number, nsn, part_number, quantity_ordered,
       customer_unit_price, supplier_cost, supplier_id, lead_time_text
FROM order_lines WHERE order_id = @oid;

SELECT 'Order Line Sources' AS section, ols.order_line_id, ols.supplier_id,
       ols.allocated_qty, ols.unit_cost, ols.supplier_lead_time_days,
       ols.supplier_po_line_id, ols.is_selected,
       s.company_name AS supplier_name
FROM order_line_sources ols
LEFT JOIN suppliers s ON s.id = ols.supplier_id
INNER JOIN order_lines ol ON ol.id = ols.order_line_id
WHERE ol.order_id = @oid;

-- Q3: most recent PO + its lines
SELECT TOP 1 * FROM supplier_pos ORDER BY id DESC;
DECLARE @pid BIGINT = (SELECT TOP 1 id FROM supplier_pos ORDER BY id DESC);
SELECT id, line_number, order_line_id, nsn, part_number, quantity, unit_cost,
       expected_lead_time_days, line_total
FROM supplier_po_lines WHERE supplier_po_id = @pid;
`);
