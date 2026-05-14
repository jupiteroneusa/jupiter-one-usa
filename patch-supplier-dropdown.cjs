// patch-supplier-dropdown.cjs
// Replace the "Supplier ID" number input on Edit Quote source rows with a
// real dropdown of suppliers (loaded server-side, embedded in the page).

const fs = require('fs');
const { execSync } = require('child_process');

const f = 'admin/index.js';
const orig = fs.readFileSync(f, 'utf8');
let s = orig;

if (s.includes('SUPPLIER_DROPDOWN_V1')) {
  console.log('- already patched');
  process.exit(0);
}

// =================================================================
// PART A: Load suppliers list in the GET /quotes/:id/edit handler.
// Insert right after the srcsByLine forEach (before "var html = '';" line).
// =================================================================
const srcsByLineEnd = "srcsR.recordset.forEach(function(src) { if (!srcsByLine[src.quote_line_id]) srcsByLine[src.quote_line_id] = []; srcsByLine[src.quote_line_id].push(src); });";
if (!s.includes(srcsByLineEnd)) {
  console.error('! srcsByLine anchor not found');
  process.exit(1);
}

const loadSuppliers = srcsByLineEnd + "\r\n      // SUPPLIER_DROPDOWN_V1: load suppliers for dropdown\r\n      const _suppliersR = await pool.request().query(\"SELECT id, company_name FROM suppliers WHERE status='Active' ORDER BY company_name ASC\");\r\n      const _supplierOptions = _suppliersR.recordset.map(function(s2) { return '<option value=\"' + s2.id + '\">' + (s2.company_name || ('Supplier ' + s2.id)).replace(/</g,'&lt;') + '</option>'; }).join('');";

s = s.replace(srcsByLineEnd, function() { return loadSuppliers; });

// =================================================================
// PART B: Replace the existing Supplier ID input on existing rows.
// Old pattern is one big concatenated line; find it and replace.
// =================================================================
const oldSupplierInput = "html += '<div><div style=\"font-size:.6rem;color:#7a8a9a;margin-bottom:2px;\">Supplier ID</div><input type=\"number\" name=\"line_' + l.id + '_src_' + sIdx + '[supplier_id]\" value=\"' + src.supplier_id + '\" required title=\"' + (src.supplier_name || '') + '\" style=\"width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;\"/><div style=\"font-size:.65rem;color:#7a8a9a;margin-top:2px;\">' + (src.supplier_name || 'unknown') + '</div></div>';";

const newSupplierInput = "html += '<div><div style=\"font-size:.6rem;color:#7a8a9a;margin-bottom:2px;\">Supplier</div><select name=\"line_' + l.id + '_src_' + sIdx + '[supplier_id]\" required style=\"width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;\">' + _supplierOptions.replace(\"value=\\\"\" + src.supplier_id + \"\\\"\", \"value=\\\"\" + src.supplier_id + \"\\\" selected\") + '</select></div>';";

if (!s.includes(oldSupplierInput)) {
  console.error('! existing supplier ID input anchor not found');
  process.exit(1);
}
s = s.replace(oldSupplierInput, function() { return newSupplierInput; });

// =================================================================
// PART C: Swap the JS addSrcRow new-row template's supplier input
// from <input type="number"> to a <select> built from a JSON list.
// First, inject the supplier list JSON as a JS global.
// =================================================================
const scriptOpenAnchor = "html += '<script>';\r\n      html += 'window.addSrcRow = function(lineId) {';";

if (!s.includes(scriptOpenAnchor)) {
  console.error('! script open anchor not found');
  process.exit(1);
}

const newScriptOpen = "html += '<script>';\r\n      html += 'window.__SUPPLIERS = ' + JSON.stringify(_suppliersR.recordset) + ';';\r\n      html += 'window.__supplierOptionsHTML = function(sel) { return window.__SUPPLIERS.map(function(s) { var name = (s.company_name||\"\").replace(/</g,\"&lt;\"); return \"<option value=\\\\\"\" + s.id + \"\\\\\"\" + (sel == s.id ? \" selected\" : \"\") + \">\" + name + \"</option>\"; }).join(\"\"); };';\r\n      html += 'window.addSrcRow = function(lineId) {';";

s = s.replace(scriptOpenAnchor, function() { return newScriptOpen; });

// =================================================================
// PART D: Inside addSrcRow, swap the supplier number input for a select
// built from window.__supplierOptionsHTML().
// =================================================================
const oldAddRowSupplierLine = "html += '    \\'<div><div style=\"font-size:.6rem;color:#7a8a9a;margin-bottom:2px;\">Supplier ID</div><input type=\"number\" name=\"\\' + prefix + \\'[supplier_id]\" required placeholder=\"id\" style=\"width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;\"/></div>\\' +';";

const newAddRowSupplierLine = "html += '    \\'<div><div style=\"font-size:.6rem;color:#7a8a9a;margin-bottom:2px;\">Supplier</div><select name=\"\\' + prefix + \\'[supplier_id]\" required style=\"width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;\">\\' + window.__supplierOptionsHTML() + \\'</select></div>\\' +';";

if (!s.includes(oldAddRowSupplierLine)) {
  console.error('! addSrcRow supplier line anchor not found');
  process.exit(1);
}
s = s.replace(oldAddRowSupplierLine, function() { return newAddRowSupplierLine; });

// Marker
s = '// SUPPLIER_DROPDOWN_V1\r\n' + s;

fs.writeFileSync(f + '.supdd.bak', orig);
fs.writeFileSync(f, s);

try {
  execSync('node -c "' + f + '"', { stdio: 'pipe' });
  console.log('+ Supplier dropdown on existing source rows');
  console.log('+ Supplier dropdown on Add Source button (new rows)');
  console.log('+ Shows real supplier names instead of IDs');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(f, orig);
  console.error('! syntax error - REVERTED');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
