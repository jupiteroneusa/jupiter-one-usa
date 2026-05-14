// patch-supplier-search.cjs
// Turn supplier <select> into a searchable input bound to a <datalist>.
// User can type to filter, or click dropdown arrow for full list.
// Works on existing rows and on dynamically-added rows.

const fs = require('fs');
const { execSync } = require('child_process');

const f = 'admin/index.js';
const orig = fs.readFileSync(f, 'utf8');
let s = orig;

if (s.includes('SUPPLIER_SEARCH_V1')) {
  console.log('- already patched');
  process.exit(0);
}

// =================================================================
// PART A: Inject a single shared <datalist> with all supplier options
// and a hidden script that maps display-name -> id for form submit.
//
// Strategy: input shows the supplier name. A bound hidden input stores
// the supplier_id (which is what the server expects). When the user
// types/picks, JS resolves name->id from window.__SUPPLIERS.
// =================================================================

// Insert datalist render right after window.__SUPPLIERS is assigned in inline script
const supplierJsAnchor = "html += 'window.__SUPPLIERS = ' + JSON.stringify(_suppliersR.recordset) + ';';";
if (!s.includes(supplierJsAnchor)) {
  console.error('! __SUPPLIERS anchor not found');
  process.exit(1);
}

const newSupplierJs = supplierJsAnchor + "\r\n      html += '<datalist id=\"supplier-list\">' + _suppliersR.recordset.map(function(s2) { return '<option value=\"' + (s2.company_name||'').replace(/\"/g, '&quot;') + '\" data-id=\"' + s2.id + '\"></option>'; }).join('') + '</datalist>';";
s = s.replace(supplierJsAnchor, function() { return newSupplierJs; });

// =================================================================
// PART B: Replace the existing-row <select> with searchable input + hidden id
// =================================================================
const oldExistingSelect = "html += '<div><div style=\"font-size:.6rem;color:#7a8a9a;margin-bottom:2px;\">Supplier</div><select name=\"line_' + l.id + '_src_' + sIdx + '[supplier_id]\" required style=\"width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;\">' + _supplierOptions.replace(\"value=\\\"\" + src.supplier_id + \"\\\"\", \"value=\\\"\" + src.supplier_id + \"\\\" selected\") + '</select></div>';";

const newExistingSelect = "html += '<div><div style=\"font-size:.6rem;color:#7a8a9a;margin-bottom:2px;\">Supplier</div><input type=\"text\" list=\"supplier-list\" class=\"sup-search\" data-target-id=\"sup_' + l.id + '_' + sIdx + '\" value=\"' + ((src.supplier_name || '').toString().replace(/\"/g, '&quot;')) + '\" placeholder=\"Type to search...\" style=\"width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;\"/><input type=\"hidden\" id=\"sup_' + l.id + '_' + sIdx + '\" name=\"line_' + l.id + '_src_' + sIdx + '[supplier_id]\" value=\"' + src.supplier_id + '\" required/></div>';";

if (!s.includes(oldExistingSelect)) {
  console.error('! existing-row select anchor not found');
  process.exit(1);
}
s = s.replace(oldExistingSelect, function() { return newExistingSelect; });

// =================================================================
// PART C: Replace the addSrcRow new-row select with the same pattern
// =================================================================
const oldAddRowSelect = "html += '    \\'<div><div style=\"font-size:.6rem;color:#7a8a9a;margin-bottom:2px;\">Supplier</div><select name=\"\\' + prefix + \\'[supplier_id]\" required style=\"width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;\">\\' + window.__supplierOptionsHTML() + \\'</select></div>\\' +';";

const newAddRowSelect = "html += '    \\'<div><div style=\"font-size:.6rem;color:#7a8a9a;margin-bottom:2px;\">Supplier</div><input type=\"text\" list=\"supplier-list\" class=\"sup-search\" data-target-id=\"sup_new_\\' + Date.now() + \\'_\\' + nextIdx + \\'\" placeholder=\"Type to search...\" style=\"width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;\"/><input type=\"hidden\" id=\"sup_new_\\' + Date.now() + \\'_\\' + nextIdx + \\'\" name=\"\\' + prefix + \\'[supplier_id]\" required/></div>\\' +';";

if (!s.includes(oldAddRowSelect)) {
  console.error('! addSrcRow select anchor not found');
  process.exit(1);
}
s = s.replace(oldAddRowSelect, function() { return newAddRowSelect; });

// =================================================================
// PART D: Add the binding script — listens for input change on .sup-search,
// looks up the name in window.__SUPPLIERS, populates the hidden id input.
// Insert just before the </script> close in addSrcRow JS block.
// =================================================================
const scriptCloseAnchor = "html += '<\\\\/script>';";
if (!s.includes(scriptCloseAnchor)) {
  console.error('! script close anchor not found');
  process.exit(1);
}

const bindingScript = "html += 'document.addEventListener(\"input\", function(e) {';" +
  "\r\n      html += '  if (!e.target.classList || !e.target.classList.contains(\"sup-search\")) return;';" +
  "\r\n      html += '  var name = e.target.value.trim().toLowerCase();';" +
  "\r\n      html += '  var hidId = e.target.getAttribute(\"data-target-id\");';" +
  "\r\n      html += '  var hid = document.getElementById(hidId);';" +
  "\r\n      html += '  if (!hid) return;';" +
  "\r\n      html += '  var match = window.__SUPPLIERS.find(function(s) { return (s.company_name||\"\").toLowerCase() === name; });';" +
  "\r\n      html += '  hid.value = match ? match.id : \"\";';" +
  "\r\n      html += '  e.target.style.borderColor = match ? \"#4caf50\" : (name ? \"#e05050\" : \"#1e2d42\");';" +
  "\r\n      html += '});';" +
  "\r\n      " + scriptCloseAnchor;

s = s.replace(scriptCloseAnchor, function() { return bindingScript; });

// Marker
s = '// SUPPLIER_SEARCH_V1\r\n' + s;

fs.writeFileSync(f + '.supsrch.bak', orig);
fs.writeFileSync(f, s);

try {
  execSync('node -c "' + f + '"', { stdio: 'pipe' });
  console.log('+ Supplier field is now searchable: type to filter, or click for full list');
  console.log('+ Green border = valid match, red border = no match yet');
  console.log('+ Works on existing rows AND new rows added via "+ Add Source"');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(f, orig);
  console.error('! syntax error - REVERTED');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
