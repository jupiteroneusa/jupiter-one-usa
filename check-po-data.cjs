// check-po-data.cjs
const fs = require('fs');

// Dump current poPdfService.js to see what it queries
console.log('========== services/poPdfService.js (current) ==========\n');
console.log(fs.readFileSync('services/poPdfService.js', 'utf8'));

console.log('\n\n========== SQL queries to run ==========');
console.log(`
-- Q1: Does PO-2026-00005 have lines?
SELECT id, po_number, supplier_id, order_id, status, subtotal, total
FROM supplier_pos WHERE po_number = 'PO-2026-00005';

-- Q2: Get its lines
SELECT line_number, nsn, part_number, item_name, condition_code,
       quantity, unit_cost, line_total
FROM supplier_po_lines
WHERE supplier_po_id = (SELECT id FROM supplier_pos WHERE po_number = 'PO-2026-00005');

-- Q3: Latest 3 POs and how many lines each
SELECT p.id, p.po_number, p.status, p.subtotal, p.total,
       (SELECT COUNT(*) FROM supplier_po_lines WHERE supplier_po_id = p.id) AS line_count
FROM supplier_pos p
ORDER BY p.id DESC;

-- Q4: When orders are converted to POs via Create Supplier POs, are
-- order_line_sources populated for the source order?
-- Find the source order for PO-2026-00005:
SELECT TOP 5 ols.*
FROM order_line_sources ols
INNER JOIN order_lines ol ON ol.id = ols.order_line_id
INNER JOIN supplier_pos sp ON sp.order_id = ol.order_id
WHERE sp.po_number = 'PO-2026-00005';
`);
