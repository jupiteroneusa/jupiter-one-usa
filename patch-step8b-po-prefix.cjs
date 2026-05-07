// patch-step8b-po-prefix.cjs
// Quick fix: use 'PO' as the numbering prefix instead of 'supplier_po'
// so we get PO-2026-00001 instead of supplier_po-2026-00001.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/supplierPoRoutes.js';
const BACKUP = 'admin/supplierPoRoutes.js.step8b.bak';

console.log('Step 8b: PO prefix fix');
console.log('======================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

const oldLine = "const poNumber = await generateNumber('supplier_po');";
const newLine = "const poNumber = await generateNumber('PO');";

if (src.includes(newLine)) { console.log('- Already patched.'); process.exit(0); }
if (!src.includes(oldLine)) {
  console.error('! Could not find generateNumber line');
  process.exit(1);
}

src = src.replace(oldLine, function() { return newLine; });
fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);

try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ Patched + syntax OK. Push along with Step 8.');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! Syntax error - reverted');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
