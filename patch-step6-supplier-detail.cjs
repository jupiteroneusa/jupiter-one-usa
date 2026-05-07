// patch-step6-supplier-detail.cjs
// Wires supplierRoutes.js into admin/index.js, makes supplier list clickable,
// adds "+ New Supplier" button. Safety-first: backup, syntax-check, auto-revert.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/index.js';
const BACKUP = 'admin/index.js.step6.bak';

console.log('Step 6: Supplier Detail Page');
console.log('============================');

if (!fs.existsSync(TARGET)) { console.error('! Missing: ' + TARGET); process.exit(1); }
if (!fs.existsSync('admin/supplierRoutes.js')) {
  console.error('! Missing: admin/supplierRoutes.js (move it to admin/ first)');
  process.exit(1);
}

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('mountSupplierRoutes')) {
  console.log('- Already patched.');
  process.exit(0);
}

// PATCH 1: Add the import near the existing mountOrderRoutes import
const importAnchor = "import { mountOrderRoutes } from './orderRoutes.js';";
src = src.replace(importAnchor, importAnchor + "\nimport { mountSupplierRoutes } from './supplierRoutes.js';");

// PATCH 2: Call mountSupplierRoutes near mountOrderRoutes call
const mountAnchor = "mountOrderRoutes(router, requireAuth, page);";
src = src.replace(mountAnchor, mountAnchor + "\n  mountSupplierRoutes(router, requireAuth, page);");

// PATCH 3: Make supplier list rows clickable + add "+ New Supplier" button
// Find the supplier row template and the page-title block
const oldRowOpen = "<tr>\n        <td style=\"font-weight:600;\">${s.name}</td>";
const newRowOpen = "<tr>\n        <td style=\"font-weight:600;\"><a href=\"/admin/suppliers/${s.id}\" style=\"color:#c8932a;\">${s.name}</a></td>";

if (src.includes(oldRowOpen)) {
  src = src.replace(oldRowOpen, newRowOpen);
}

// Also fix the SELECT to use company_name AS name (similar to step 5b for orderRoutes)
const oldSelect = "SELECT id, name, contact_name, email, phone, country, status, created_at\n        FROM suppliers ORDER BY name ASC";
const newSelect = "SELECT id, company_name AS name, contact_name, email, phone, country, status, created_at\n        FROM suppliers ORDER BY company_name ASC";

if (src.includes(oldSelect)) {
  src = src.replace(oldSelect, newSelect);
} else {
  // Try alternate form (single line)
  const altOld = "SELECT id, name, contact_name, email, phone, country, status, created_at\n        FROM suppliers ORDER BY name ASC";
  if (!src.includes(altOld)) {
    console.log('  (note: supplier list query already updated or different)');
  }
}

// PATCH 4: Add "+ New Supplier" button by injecting it into the page title row
const titleAnchor = "<div class=\"page-title\">Suppliers</div>";
const newTitleBlock = "<div style=\"display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;\"><div class=\"page-title\">Suppliers</div><a href=\"/admin/suppliers/new\" class=\"btn btn-gold\">+ New Supplier</a></div>";

if (src.includes(titleAnchor)) {
  src = src.replace(titleAnchor, newTitleBlock);
}

// Backup, write, syntax-check
fs.writeFileSync(BACKUP, original);
console.log('+ Backup saved: ' + BACKUP);

fs.writeFileSync(TARGET, src);
console.log('+ Wrote patched ' + TARGET);

console.log('  Running syntax check...');
try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  execSync('node -c "admin/supplierRoutes.js"', { stdio: 'pipe' });
  console.log('+ Syntax check PASSED on both files');
  console.log('');
  console.log('============================');
  console.log('SUCCESS - safe to commit and push.');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('');
  console.error('============================');
  console.error('! SYNTAX ERROR - changes REVERTED.');
  console.error('');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
