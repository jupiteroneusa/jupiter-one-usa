// patch-phaseG-suppliers-filters.cjs
// Phase G: Force cache bust + add filters to supplier list page.
// Filters: All / Active / Preferred / 8130 Certified / Inactive

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/index.js';
const BACKUP = 'admin/index.js.phaseG.bak';

console.log('Phase G: Supplier list filters');
console.log('==============================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('supplierFilters')) { console.log('- Already patched.'); process.exit(0); }

// Modify the suppliers route to support a query param filter
// Original: SELECT id, company_name AS name, contact_name, email, phone, country, status, created_at FROM suppliers ORDER BY company_name ASC
const oldSelect = "const result = await pool.request().query(`\r\n        SELECT id, company_name AS name, contact_name, email, phone, country, status, created_at\r\n        FROM suppliers ORDER BY company_name ASC\r\n      `);";

const newSelect =
  "const filterMode = (req.query.filter || 'all').toLowerCase();\n" +
  "      let whereClause = '';\n" +
  "      if (filterMode === 'active') whereClause = \"WHERE status='Active'\";\n" +
  "      else if (filterMode === 'preferred') whereClause = \"WHERE status='Active' AND is_preferred=1\";\n" +
  "      else if (filterMode === 'cert8130') whereClause = \"WHERE status='Active' AND is_certified_8130=1\";\n" +
  "      else if (filterMode === 'inactive') whereClause = \"WHERE status<>'Active'\";\n" +
  "      const result = await pool.request().query(`\n" +
  "        SELECT id, company_name AS name, contact_name, email, phone, country, status, is_preferred, is_certified_8130, created_at\n" +
  "        FROM suppliers ${whereClause} ORDER BY company_name ASC\n" +
  "      `);";

// Try CRLF version first
let patch1Done = false;
if (src.includes(oldSelect)) {
  src = src.replace(oldSelect, function() { return newSelect; });
  patch1Done = true;
  console.log('+ Supplier query patched (CRLF)');
} else {
  const oldSelectLF = oldSelect.replace(/\r\n/g, '\n');
  if (src.includes(oldSelectLF)) {
    src = src.replace(oldSelectLF, function() { return newSelect; });
    patch1Done = true;
    console.log('+ Supplier query patched (LF)');
  }
}

if (!patch1Done) {
  console.error('! Could not find supplier query');
  process.exit(1);
}

// Now inject filter buttons into the page-sub line.
// Find: <div class="page-sub">Verified supplier network</div>
const oldSubAnchor = '<div class="page-sub">Verified supplier network</div>';
const newSubAnchor = '<div class="page-sub">Verified supplier network</div>\n        <div id="supplierFilters" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;">${[\'all\',\'active\',\'preferred\',\'cert8130\',\'inactive\'].map(f=>{const labels={all:\'All\',active:\'Active\',preferred:\'Preferred\',cert8130:\'8130 Certified\',inactive:\'Inactive\'};return \'<a href="/admin/suppliers\'+(f===\'all\'?\'\':\'?filter=\'+f)+\'" class="btn btn-sm \'+(filterMode===f?\'btn-gold\':\'btn-outline\')+\'" style="font-size:.7rem;">\'+labels[f]+\'</a>\'}).join(\'\')}</div>';

if (!src.includes(oldSubAnchor)) {
  console.error('! Could not find page-sub anchor');
  process.exit(1);
}
src = src.replace(oldSubAnchor, function() { return newSubAnchor; });

fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);

try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ Patched + syntax OK');
  console.log('SUCCESS - safe to push');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! Syntax error - reverted');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
