// patch-step3b-fix-mark-paid.cjs
// Updates /mark-paid route to populate paid_at, paid_amount, payment_method,
// payment_reference on the orders table.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/orderRoutes.js';
const BACKUP = 'admin/orderRoutes.js.step3b.bak';

console.log('Step 3b: Fix /mark-paid to populate new fields');
console.log('==============================================');

if (!fs.existsSync(TARGET)) { console.error('! Missing: ' + TARGET); process.exit(1); }

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('paid_at=@paidAt')) {
  console.log('- Already patched.');
  process.exit(0);
}

// Find the existing UPDATE in /mark-paid that sets status='Paid'
const oldQuery = "query(\"UPDATE orders SET status='Paid',updated_at=GETDATE() WHERE id=@id\");";

if (!src.includes(oldQuery)) {
  console.error('! Could not find /mark-paid UPDATE statement');
  process.exit(1);
}

// Replace it with full version that populates all the new fields
// We need to find the .input chain leading up to it and add new inputs
// The current code is:
//   const note = 'Paid via '+(b.payment_method||'')+(b.payment_notes ? ' - '+b.payment_notes : '');
//   await pool.request().input('id', sql.BigInt, req.params.id).query("UPDATE orders SET status='Paid',updated_at=GETDATE() WHERE id=@id");
//
// Replace the whole .request().input(...).query(...) chain with the expanded version.

const oldChain = "await pool.request().input('id', sql.BigInt, req.params.id).query(\"UPDATE orders SET status='Paid',updated_at=GETDATE() WHERE id=@id\");";

const newChain =
  "const paidAt = b.payment_date ? new Date(b.payment_date) : new Date();\n" +
  "      const orderTotal = await pool.request().input('idT', sql.BigInt, req.params.id).query('SELECT total_amount FROM orders WHERE id=@idT');\n" +
  "      const totalAmount = parseFloat(orderTotal.recordset[0] && orderTotal.recordset[0].total_amount || 0);\n" +
  "      await pool.request()\n" +
  "        .input('id', sql.BigInt, req.params.id)\n" +
  "        .input('paidAt', sql.DateTime, paidAt)\n" +
  "        .input('paidAmount', sql.Decimal(12,2), totalAmount)\n" +
  "        .input('payMethod', sql.NVarChar(50), b.payment_method||null)\n" +
  "        .input('payRef', sql.NVarChar(100), b.payment_notes||null)\n" +
  "        .query(\"UPDATE orders SET status='Paid', paid_at=@paidAt, paid_amount=@paidAmount, payment_method=@payMethod, payment_reference=@payRef, updated_at=GETDATE() WHERE id=@id\");\n" +
  "      // Also insert into payments table\n" +
  "      try {\n" +
  "        const custR = await pool.request().input('idC', sql.BigInt, req.params.id).query('SELECT customer_id FROM orders WHERE id=@idC');\n" +
  "        const cid = custR.recordset[0] && custR.recordset[0].customer_id;\n" +
  "        const invR = await pool.request().input('idI', sql.BigInt, req.params.id).query('SELECT TOP 1 id FROM invoices WHERE order_id=@idI');\n" +
  "        const iid = invR.recordset[0] && invR.recordset[0].id;\n" +
  "        if (cid) {\n" +
  "          await pool.request()\n" +
  "            .input('oid', sql.BigInt, req.params.id)\n" +
  "            .input('iidP', sql.BigInt, iid || null)\n" +
  "            .input('cid', sql.BigInt, cid)\n" +
  "            .input('amt', sql.Decimal(12,2), totalAmount)\n" +
  "            .input('pm', sql.NVarChar(50), b.payment_method||'Other')\n" +
  "            .input('pref', sql.NVarChar(100), b.payment_notes||null)\n" +
  "            .input('pAt', sql.DateTime, paidAt)\n" +
  "            .query('INSERT INTO payments (order_id,invoice_id,customer_id,amount,payment_method,payment_reference,received_at) VALUES (@oid,@iidP,@cid,@amt,@pm,@pref,@pAt)');\n" +
  "        }\n" +
  "      } catch(payErr) { console.error('Payment insert error:', payErr.message); }";

if (!src.includes(oldChain)) {
  console.error('! Could not find /mark-paid full chain');
  process.exit(1);
}
src = src.replace(oldChain, function() { return newChain; });

// Backup, write, syntax-check
fs.writeFileSync(BACKUP, original);
console.log('+ Backup saved: ' + BACKUP);

fs.writeFileSync(TARGET, src);
console.log('+ Wrote patched ' + TARGET);

console.log('  Running syntax check...');
try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ Syntax check PASSED');
  console.log('');
  console.log('==============================================');
  console.log('SUCCESS - safe to commit and push.');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('');
  console.error('==============================================');
  console.error('! SYNTAX ERROR - changes REVERTED.');
  console.error('');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
