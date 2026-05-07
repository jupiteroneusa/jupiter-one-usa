// patch-step5b-suppliers-fix.cjs
// Fix: suppliers table column is 'company_name', not 'name'.
const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/orderRoutes.js';
const BACKUP = 'admin/orderRoutes.js.step5b.bak';

console.log('Step 5b: Fix suppliers column name');
console.log('==================================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

const oldQ = "\"SELECT id, name, country FROM suppliers WHERE status='Active' ORDER BY name ASC\"";
const newQ = "\"SELECT id, company_name AS name, country FROM suppliers WHERE status='Active' ORDER BY company_name ASC\"";

if (src.includes(newQ)) { console.log('- Already patched.'); process.exit(0); }
if (!src.includes(oldQ)) {
  console.error('! Could not find suppliers query to fix');
  process.exit(1);
}

src = src.replace(oldQ, function() { return newQ; });
fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);

try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ Patched and syntax-checked');
  console.log('SUCCESS - safe to push');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! Syntax error - reverted');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
