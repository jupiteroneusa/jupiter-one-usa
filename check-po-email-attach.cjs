// check-po-email-attach.cjs
const fs = require('fs');

console.log('========== Existing PO send logic ==========\n');

const files = ['admin/supplierPoRoutes.js', 'admin/orderRoutes.js', 'services/poPdfService.js', 'services/poEmailService.js'];

files.forEach(function(f) {
  if (!fs.existsSync(f)) return;
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  let inSend = false;
  let depth = 0;
  let started = false;
  let printing = false;
  let startLine = -1;
  
  lines.forEach(function(line, i) {
    if (/sendMail|generatePoPdf|attachment/i.test(line)) {
      console.log(f + ' L' + (i+1) + ': ' + line.trim().substring(0, 200));
    }
  });
});

console.log('\n========== ORD-2026-00012 POs - SQL to run in SSMS ==========');
console.log(`
USE jupiteroneusa;

PRINT '----- Order 12 POs -----';
SELECT id, po_number, supplier_id, status, total, issued_at, expected_delivery, notes
FROM supplier_pos WHERE order_id = 12 ORDER BY id;

PRINT '----- PO lines -----';
SELECT spl.id, spl.supplier_po_id, sp.po_number, s.company_name, spl.line_number, spl.nsn, spl.part_number,
       spl.item_name, spl.quantity, spl.unit_cost, spl.line_total
FROM supplier_po_lines spl
INNER JOIN supplier_pos sp ON sp.id = spl.supplier_po_id
INNER JOIN suppliers s ON s.id = sp.supplier_id
WHERE sp.order_id = 12
ORDER BY sp.id, spl.line_number;
`);
