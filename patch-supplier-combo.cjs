// patch-supplier-combo.cjs
// Replace the datalist approach with a custom searchable combobox that
// always shows a clickable dropdown of matching suppliers when focused.
// Built with plain JS — no datalist quirks.

const fs = require('fs');
const { execSync } = require('child_process');

const f = 'admin/index.js';
const orig = fs.readFileSync(f, 'utf8');
let s = orig;

if (s.includes('SUPPLIER_COMBO_V1')) {
  console.log('- already patched');
  process.exit(0);
}

// =================================================================
// PART A: Remove the datalist block (we'll build dropdown ourselves)
// =================================================================
const oldDatalist = "\r\n      html += '<datalist id=\"supplier-list\">' + _suppliersR.recordset.map(function(s2) { return '<option value=\"' + (s2.company_name||'').replace(/\"/g, '&quot;') + '\" data-id=\"' + s2.id + '\"></option>'; }).join('') + '</datalist>';";
if (s.includes(oldDatalist)) {
  s = s.replace(oldDatalist, function() { return ''; });
}

// =================================================================
// PART B: Replace existing-row supplier input — datalist-style → combo-style
// (a wrapper div with text input + hidden dropdown ul that JS populates)
// =================================================================
const oldExistingInput = "html += '<div><div style=\"font-size:.6rem;color:#7a8a9a;margin-bottom:2px;\">Supplier</div><input type=\"text\" list=\"supplier-list\" class=\"sup-search\" data-target-id=\"sup_' + l.id + '_' + sIdx + '\" value=\"' + ((src.supplier_name || '').toString().replace(/\"/g, '&quot;')) + '\" placeholder=\"Type to search...\" style=\"width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;\"/><input type=\"hidden\" id=\"sup_' + l.id + '_' + sIdx + '\" name=\"line_' + l.id + '_src_' + sIdx + '[supplier_id]\" value=\"' + src.supplier_id + '\" required/></div>';";

const newExistingInput = "html += '<div style=\"position:relative;\"><div style=\"font-size:.6rem;color:#7a8a9a;margin-bottom:2px;\">Supplier</div><input type=\"text\" class=\"sup-combo\" data-target-id=\"sup_' + l.id + '_' + sIdx + '\" value=\"' + ((src.supplier_name || '').toString().replace(/\"/g, '&quot;')) + '\" placeholder=\"Type to search suppliers...\" autocomplete=\"off\" style=\"width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 24px 5px 8px;\"/><div class=\"sup-arrow\" style=\"position:absolute;right:8px;top:24px;color:#c8932a;pointer-events:none;font-size:.7rem;\">\\u25BC</div><div class=\"sup-dropdown\" style=\"display:none;position:absolute;top:100%;left:0;right:0;background:#0a1628;border:1px solid #c8932a;border-top:none;max-height:200px;overflow-y:auto;z-index:1000;\"></div><input type=\"hidden\" id=\"sup_' + l.id + '_' + sIdx + '\" name=\"line_' + l.id + '_src_' + sIdx + '[supplier_id]\" value=\"' + src.supplier_id + '\" required/></div>';";

if (!s.includes(oldExistingInput)) {
  console.error('! existing-row anchor not found');
  process.exit(1);
}
s = s.replace(oldExistingInput, function() { return newExistingInput; });

// =================================================================
// PART C: Replace addSrcRow new-row supplier input
// =================================================================
const oldAddRowInput = "html += '    \\'<div><div style=\"font-size:.6rem;color:#7a8a9a;margin-bottom:2px;\">Supplier</div><input type=\"text\" list=\"supplier-list\" class=\"sup-search\" data-target-id=\"sup_new_\\' + Date.now() + \\'_\\' + nextIdx + \\'\" placeholder=\"Type to search...\" style=\"width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;\"/><input type=\"hidden\" id=\"sup_new_\\' + Date.now() + \\'_\\' + nextIdx + \\'\" name=\"\\' + prefix + \\'[supplier_id]\" required/></div>\\' +';";

const newAddRowInput = "html += '    \\'<div style=\"position:relative;\"><div style=\"font-size:.6rem;color:#7a8a9a;margin-bottom:2px;\">Supplier</div><input type=\"text\" class=\"sup-combo\" data-target-id=\"sup_new_\\' + Date.now() + \\'_\\' + nextIdx + \\'\" placeholder=\"Type to search suppliers...\" autocomplete=\"off\" style=\"width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 24px 5px 8px;\"/><div style=\"position:absolute;right:8px;top:24px;color:#c8932a;pointer-events:none;font-size:.7rem;\">\\\\u25BC</div><div class=\"sup-dropdown\" style=\"display:none;position:absolute;top:100%;left:0;right:0;background:#0a1628;border:1px solid #c8932a;border-top:none;max-height:200px;overflow-y:auto;z-index:1000;\"></div><input type=\"hidden\" id=\"sup_new_\\' + Date.now() + \\'_\\' + nextIdx + \\'\" name=\"\\' + prefix + \\'[supplier_id]\" required/></div>\\' +';";

if (!s.includes(oldAddRowInput)) {
  console.error('! addSrcRow anchor not found');
  process.exit(1);
}
s = s.replace(oldAddRowInput, function() { return newAddRowInput; });

// =================================================================
// PART D: Replace the old sup-search binding with combobox JS.
// The whole old script block handling .sup-search needs new logic.
// =================================================================
const oldBindingStart = "html += 'document.addEventListener(\"input\", function(e) {';";
const oldBindingEnd = "html += '});';";

const bindIdx = s.indexOf(oldBindingStart);
if (bindIdx < 0) {
  console.error('! binding script start not found');
  process.exit(1);
}
const bindEnd = s.indexOf(oldBindingEnd, bindIdx);
if (bindEnd < 0) {
  console.error('! binding script end not found');
  process.exit(1);
}
const fullEnd = bindEnd + oldBindingEnd.length;

const newBindingScript = [
  "html += 'function renderSupOptions(combo, query) {';",
  "      html += '  var dd = combo.parentElement.querySelector(\".sup-dropdown\");';",
  "      html += '  if (!dd) return;';",
  "      html += '  var q = (query || \"\").toLowerCase();';",
  "      html += '  var matches = window.__SUPPLIERS.filter(function(s) { return !q || (s.company_name||\"\").toLowerCase().includes(q); }).slice(0, 50);';",
  "      html += '  if (!matches.length) { dd.innerHTML = \"<div style=\\\\\"padding:8px;color:#7a8a9a;font-size:.78rem;\\\\\">No suppliers match</div>\"; dd.style.display = \"block\"; return; }';",
  "      html += '  dd.innerHTML = matches.map(function(s) { var name = (s.company_name||\"\").replace(/</g,\"&lt;\"); return \"<div class=\\\\\"sup-opt\\\\\" data-id=\\\\\"\" + s.id + \"\\\\\" data-name=\\\\\"\" + name.replace(/\\\\\"/g, \"&quot;\") + \"\\\\\" style=\\\\\"padding:6px 10px;cursor:pointer;font-size:.82rem;color:#eef1f5;border-bottom:1px solid #1e2d42;\\\\\">\" + name + \"</div>\"; }).join(\"\");';",
  "      html += '  dd.style.display = \"block\";';",
  "      html += '}';",
  "      html += 'document.addEventListener(\"focus\", function(e) {',",
  "      html += '  if (!e.target.classList || !e.target.classList.contains(\"sup-combo\")) return;';",
  "      html += '  renderSupOptions(e.target, e.target.value);';",
  "      html += '}, true);';",
  "      html += 'document.addEventListener(\"input\", function(e) {';",
  "      html += '  if (!e.target.classList || !e.target.classList.contains(\"sup-combo\")) return;';",
  "      html += '  var hid = document.getElementById(e.target.getAttribute(\"data-target-id\"));';",
  "      html += '  var match = window.__SUPPLIERS.find(function(s) { return (s.company_name||\"\").toLowerCase() === e.target.value.trim().toLowerCase(); });';",
  "      html += '  if (hid) hid.value = match ? match.id : \"\";';",
  "      html += '  e.target.style.borderColor = match ? \"#4caf50\" : (e.target.value ? \"#e05050\" : \"#1e2d42\");';",
  "      html += '  renderSupOptions(e.target, e.target.value);';",
  "      html += '});';",
  "      html += 'document.addEventListener(\"click\", function(e) {';",
  "      html += '  var opt = e.target.closest && e.target.closest(\".sup-opt\");';",
  "      html += '  if (opt) {';",
  "      html += '    var dd = opt.parentElement;';",
  "      html += '    var wrap = dd.parentElement;';",
  "      html += '    var input = wrap.querySelector(\".sup-combo\");';",
  "      html += '    var hid = document.getElementById(input.getAttribute(\"data-target-id\"));';",
  "      html += '    input.value = opt.getAttribute(\"data-name\");';",
  "      html += '    if (hid) hid.value = opt.getAttribute(\"data-id\");';",
  "      html += '    input.style.borderColor = \"#4caf50\";';",
  "      html += '    dd.style.display = \"none\";';",
  "      html += '    return;';",
  "      html += '  }';",
  "      html += '  if (!e.target.classList || !e.target.classList.contains(\"sup-combo\")) {';",
  "      html += '    document.querySelectorAll(\".sup-dropdown\").forEach(function(dd) { dd.style.display = \"none\"; });';",
  "      html += '  }';",
  "      html += '});';"
].join('\r\n      ');

s = s.slice(0, bindIdx) + newBindingScript + s.slice(fullEnd);

// Marker
s = '// SUPPLIER_COMBO_V1\r\n' + s;

fs.writeFileSync(f + '.supcombo.bak', orig);
fs.writeFileSync(f, s);

try {
  execSync('node -c "' + f + '"', { stdio: 'pipe' });
  console.log('+ Supplier field is now a real searchable combobox');
  console.log('+ Click to see all suppliers, type to filter, click one to select');
  console.log('+ Gold dropdown arrow shows visible');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(f, orig);
  console.error('! syntax error - REVERTED');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
