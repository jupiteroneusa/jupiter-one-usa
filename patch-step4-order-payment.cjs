// patch-step4-order-payment.cjs
// Wires renderPaymentTab, loads payments query, adds /record-payment POST.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/orderRoutes.js';
const BACKUP = 'admin/orderRoutes.js.step4.bak';

console.log('Step 4: Order Payment Tab Enhancement');
console.log('=====================================');

if (!fs.existsSync(TARGET)) { console.error('! Missing: ' + TARGET); process.exit(1); }
if (!fs.existsSync('admin/orderPaymentBlock.js')) {
  console.error('! Missing: admin/orderPaymentBlock.js');
  process.exit(1);
}

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('renderPaymentTab')) {
  console.log('- Already patched.');
  process.exit(0);
}

// PATCH 1: Add import
const importAnchor = "import { renderShippingTab } from './orderShippingBlock.js';";
src = src.replace(importAnchor, importAnchor + "\nimport { renderPaymentTab } from './orderPaymentBlock.js';");

// PATCH 2: Add payments query right after invoices query
const queryAnchor = "const invoices = await pool.request().input('id', sql.BigInt, req.params.id).query('SELECT id, invoice_number, status, total_amount, due_date FROM invoices WHERE order_id=@id ORDER BY created_at DESC');";
const newQuery = queryAnchor + "\n      const payments = await pool.request().input('idP', sql.BigInt, req.params.id).query('SELECT id, amount, payment_method, payment_reference, received_at, notes FROM payments WHERE order_id=@idP ORDER BY received_at DESC');";

if (!src.includes(queryAnchor)) {
  console.error('! Could not find invoices query anchor');
  process.exit(1);
}
src = src.replace(queryAnchor, function() { return newQuery; });

// PATCH 3: Replace payment block content
const startMarker = "} else if (activeTab === 'payment') {";
const endMarker = "}\n      html += '</div></div>';";

const startIdx = src.indexOf(startMarker);
const endIdx = src.indexOf(endMarker, startIdx);

if (startIdx === -1 || endIdx === -1) {
  console.error('! Could not locate payment block boundaries');
  process.exit(1);
}

src = src.substring(0, startIdx) +
      "} else if (activeTab === 'payment') {\n        html += renderPaymentTab(o, invoices, payments);\n      " +
      src.substring(endIdx);

// PATCH 4: Add /record-payment route before /mark-paid
const routeAnchor = "router.post('/orders/:id/mark-paid', async (req, res) => {";
if (!src.includes(routeAnchor)) {
  console.error('! Could not find /mark-paid anchor');
  process.exit(1);
}

const newRoute =
  "router.post('/orders/:id/record-payment', async (req, res) => {\n" +
  "    if (!requireAuth(req, res)) return;\n" +
  "    try {\n" +
  "      const pool = await getPool();\n" +
  "      const b = req.body;\n" +
  "      const amount = parseFloat(b.amount);\n" +
  "      if (!amount || amount <= 0) return res.redirect('/admin/orders/'+req.params.id+'?tab=payment&error=Invalid+amount');\n" +
  "      const receivedAt = b.received_at ? new Date(b.received_at) : new Date();\n" +
  "      const ord = await pool.request().input('id', sql.BigInt, req.params.id).query('SELECT customer_id, total_amount FROM orders WHERE id=@id');\n" +
  "      if (!ord.recordset.length) return res.redirect('/admin/orders/'+req.params.id+'?error=Order+not+found');\n" +
  "      const cid = ord.recordset[0].customer_id;\n" +
  "      const orderTotal = parseFloat(ord.recordset[0].total_amount || 0);\n" +
  "      const invR = await pool.request().input('idI', sql.BigInt, req.params.id).query('SELECT TOP 1 id FROM invoices WHERE order_id=@idI');\n" +
  "      const iid = invR.recordset[0] ? invR.recordset[0].id : null;\n" +
  "      // Insert payment record\n" +
  "      await pool.request()\n" +
  "        .input('oid', sql.BigInt, req.params.id)\n" +
  "        .input('iid', sql.BigInt, iid)\n" +
  "        .input('cid', sql.BigInt, cid)\n" +
  "        .input('amt', sql.Decimal(12,2), amount)\n" +
  "        .input('pm', sql.NVarChar(50), b.payment_method || 'Other')\n" +
  "        .input('pref', sql.NVarChar(100), b.payment_reference || null)\n" +
  "        .input('rcv', sql.DateTime, receivedAt)\n" +
  "        .input('notes', sql.NVarChar(500), b.notes || null)\n" +
  "        .query('INSERT INTO payments (order_id,invoice_id,customer_id,amount,payment_method,payment_reference,received_at,notes) VALUES (@oid,@iid,@cid,@amt,@pm,@pref,@rcv,@notes)');\n" +
  "      // Recalculate paid total\n" +
  "      const sumR = await pool.request().input('idS', sql.BigInt, req.params.id).query('SELECT ISNULL(SUM(amount),0) AS total_paid FROM payments WHERE order_id=@idS');\n" +
  "      const totalPaid = parseFloat(sumR.recordset[0].total_paid || 0);\n" +
  "      const isPaid = totalPaid >= orderTotal - 0.01;\n" +
  "      const newStatus = isPaid ? 'Paid' : 'Partially Paid';\n" +
  "      await pool.request()\n" +
  "        .input('id', sql.BigInt, req.params.id)\n" +
  "        .input('paidAmt', sql.Decimal(12,2), totalPaid)\n" +
  "        .input('newStatus', sql.NVarChar(50), newStatus)\n" +
  "        .input('paidAt', sql.DateTime, isPaid ? receivedAt : null)\n" +
  "        .input('payMethod', sql.NVarChar(50), b.payment_method || null)\n" +
  "        .input('payRef', sql.NVarChar(100), b.payment_reference || null)\n" +
  "        .query(\"UPDATE orders SET paid_amount=@paidAmt, status=@newStatus, paid_at=ISNULL(paid_at,@paidAt), payment_method=ISNULL(payment_method,@payMethod), payment_reference=ISNULL(payment_reference,@payRef), updated_at=GETDATE() WHERE id=@id\");\n" +
  "      await pool.request().input('id', sql.BigInt, req.params.id).input('s', sql.NVarChar(50), newStatus).input('n', sql.NVarChar(500), 'Payment of $'+amount.toFixed(2)+' recorded ('+(b.payment_method||'')+')').query('INSERT INTO order_status_log (order_id,new_status,note) VALUES (@id,@s,@n)');\n" +
  "      // If fully paid, mark invoices paid too\n" +
  "      if (isPaid) {\n" +
  "        await pool.request().input('id', sql.BigInt, req.params.id).query(\"UPDATE invoices SET status='Paid', paid_date=CAST(GETDATE() AS DATE), balance_due=0, updated_at=GETDATE() WHERE order_id=@id AND status<>'Paid'\");\n" +
  "      }\n" +
  "      res.redirect('/admin/orders/'+req.params.id+'?tab=payment&saved=1');\n" +
  "    } catch(err) { console.error('Record payment error:', err); res.redirect('/admin/orders/'+req.params.id+'?tab=payment&error='+encodeURIComponent(err.message)); }\n" +
  "  });\n\n" +
  "  ";

src = src.replace(routeAnchor, function() { return newRoute + routeAnchor; });

// Backup, write, syntax-check
fs.writeFileSync(BACKUP, original);
console.log('+ Backup saved: ' + BACKUP);

fs.writeFileSync(TARGET, src);
console.log('+ Wrote patched ' + TARGET);

console.log('  Running syntax check...');
try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  execSync('node -c "admin/orderPaymentBlock.js"', { stdio: 'pipe' });
  console.log('+ Syntax check PASSED on both files');
  console.log('');
  console.log('=====================================');
  console.log('SUCCESS - safe to commit and push.');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('');
  console.error('=====================================');
  console.error('! SYNTAX ERROR - changes REVERTED.');
  console.error('');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
