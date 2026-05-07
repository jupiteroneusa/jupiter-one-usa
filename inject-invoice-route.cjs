// inject-invoice-route.cjs (v2)
// Reads invoice-detail-route.txt and injects it into admin/index.js.
// Uses a replacement FUNCTION instead of a string to avoid $-substitution bug.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/index.js';
const ROUTE_FILE = 'invoice-detail-route.txt';
const BACKUP = 'admin/index.js.bak';

console.log('Invoice Detail Route Injector v2');
console.log('================================');

if (!fs.existsSync(TARGET)) { console.error('! Missing: ' + TARGET); process.exit(1); }
if (!fs.existsSync(ROUTE_FILE)) { console.error('! Missing: ' + ROUTE_FILE); process.exit(1); }

let src = fs.readFileSync(TARGET, 'utf8');
const routeCode = fs.readFileSync(ROUTE_FILE, 'utf8');

if (src.includes("router.get('/invoices/:id'")) {
  console.log('- Already has /admin/invoices/:id route. Nothing to do.');
  process.exit(0);
}

const anchorRe = /(\r?\n)(\s*\/\/ Suppliers\r?\n\s*router\.get\('\/suppliers')/;
const m = src.match(anchorRe);
if (!m) { console.error('! Could not find Suppliers anchor'); process.exit(1); }

const newline = m[1];
let routeFixed = (newline === '\r\n')
  ? routeCode.replace(/\r?\n/g, '\r\n')
  : routeCode.replace(/\r\n/g, '\n');

// Backup
fs.writeFileSync(BACKUP, src);
console.log('+ Backup saved: ' + BACKUP);

// CRITICAL FIX: use function as replacement so $ chars in routeFixed are NOT
// interpreted as $&, $1, etc. by String.prototype.replace.
const newSrc = src.replace(anchorRe, function(match, p1, p2) {
  return p1 + routeFixed + p2;
});

fs.writeFileSync(TARGET, newSrc);
console.log('+ Injected detail route');

// Syntax check
console.log('  Running syntax check...');
try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ Syntax check PASSED');
  console.log('');
  console.log('================================');
  console.log('SUCCESS - safe to commit and push.');
  console.log('Backup: ' + BACKUP);
} catch (err) {
  fs.writeFileSync(TARGET, src);
  console.error('');
  console.error('================================');
  console.error('! SYNTAX ERROR - changes REVERTED automatically.');
  console.error('');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
