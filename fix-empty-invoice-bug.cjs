// fix-empty-invoice-bug.cjs
// Adds a guard so /generate-invoice refuses to run on orders with no line items.
// Backs up, syntax-checks, auto-reverts on failure.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/orderRoutes.js';
const BACKUP = 'admin/orderRoutes.js.bak';

console.log('Empty-Invoice Guard Patch');
console.log('=========================');

if (!fs.existsSync(TARGET)) { console.error('! Missing: ' + TARGET); process.exit(1); }

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

// Marker: we add a `// EMPTY_GUARD` comment to detect re-runs
if (src.includes('// EMPTY_GUARD')) {
  console.log('- Already patched. Nothing to do.');
  process.exit(0);
}

// Find the existing-invoice check, insert our empty-lines guard right after it.
// Existing line in your file:
//   const existing = await pool.request().input('oid', sql.BigInt, req.params.id).query('SELECT id FROM invoices WHERE order_id=@oid');
//   if (existing.recordset.length) return res.redirect('/admin/orders/'+req.params.id+'?tab=payment&error=Invoice+already+exists');
//
// We'll inject our check on the line AFTER the "Invoice+already+exists" redirect.

const anchor = "if (existing.recordset.length) return res.redirect('/admin/orders/'+req.params.id+'?tab=payment&error=Invoice+already+exists');";

if (!src.includes(anchor)) {
  console.error('! Could not find anchor (existing-invoice check). File may have changed.');
  process.exit(1);
}

const guard =
  "if (existing.recordset.length) return res.redirect('/admin/orders/'+req.params.id+'?tab=payment&error=Invoice+already+exists');\n" +
  "      // EMPTY_GUARD - refuse to make invoice from order with no lines\n" +
  "      const orderLineCount = await pool.request().input('oidCheck', sql.BigInt, req.params.id).query('SELECT COUNT(*) AS cnt FROM order_lines WHERE order_id=@oidCheck');\n" +
  "      if (!orderLineCount.recordset[0].cnt) return res.redirect('/admin/orders/'+req.params.id+'?tab=payment&error=' + encodeURIComponent('Cannot generate invoice: this order has no line items. Add lines from the source quote first.'));";

// Use replacement function so $ chars don't trigger substitution
src = src.replace(anchor, function() { return guard; });

// Backup, write, syntax-check
fs.writeFileSync(BACKUP, original);
console.log('+ Backup saved: ' + BACKUP);

fs.writeFileSync(TARGET, src);
console.log('+ Guard injected');

console.log('  Running syntax check...');
try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ Syntax check PASSED');
  console.log('');
  console.log('=========================');
  console.log('SUCCESS - safe to commit and push.');
  console.log('Backup at: ' + BACKUP);
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('');
  console.error('=========================');
  console.error('! SYNTAX ERROR - changes REVERTED. File restored.');
  console.error('');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
