// patch-step6c-supplier-select-fix.cjs
// Targeted fix: SELECT in suppliers list still has bare `name`.
// Now we know the EXACT text from cmd output.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/index.js';
const BACKUP = 'admin/index.js.step6c.bak';

console.log('Step 6c: Final supplier SELECT fix');
console.log('==================================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

const oldQ = "SELECT id, name, contact_name, email, phone, country, status, created_at";
const newQ = "SELECT id, company_name AS name, contact_name, email, phone, country, status, created_at";

if (src.includes(newQ)) { console.log('- Already patched.'); process.exit(0); }
if (!src.includes(oldQ)) {
  console.error('! Could not find: ' + oldQ);
  process.exit(1);
}

src = src.replace(oldQ, function() { return newQ; });

fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);
console.log('+ Backup saved: ' + BACKUP);
console.log('+ Patched');

try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ Syntax OK');
  console.log('SUCCESS - safe to push');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! Syntax error - reverted');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
