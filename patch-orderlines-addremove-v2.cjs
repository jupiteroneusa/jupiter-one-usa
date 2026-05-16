// patch-orderlines-addremove-v2.cjs
// Take 2: Add Add/Remove sources to orderLinesBlock.js.
// Avoid escape-hell by using single concatenation tricks.

const fs = require('fs');
const { execSync } = require('child_process');

function compile(file) {
  try { execSync('node -c "' + file + '"', { stdio: 'pipe' }); return true; }
  catch (err) { return err.stderr ? err.stderr.toString() : err.message; }
}

const f = 'admin/orderLinesBlock.js';
const orig = fs.readFileSync(f, 'utf8');
let s = orig;

if (s.includes('ORDER_SOURCES_ADDREMOVE_V2')) {
  console.log('- already patched');
  process.exit(0);
}

// 1. Add supplier list loading at top of function
const sourcesMapEnd = "} catch (err) { console.error('Sources load error:', err.message); }";
if (!s.includes(sourcesMapEnd)) {
  console.error('! sourcesMap anchor missing');
  process.exit(1);
}
const supplierLoad = sourcesMapEnd + "\r\n  // ORDER_SOURCES_ADDREMOVE_V2: load suppliers for combobox\r\n  let _supplierList = [];\r\n  try {\r\n    const _pool2 = await getPool();\r\n    const _supR = await _pool2.request().query(\"SELECT id, company_name FROM suppliers WHERE status='Active' ORDER BY company_name ASC\");\r\n    _supplierList = _supR.recordset;\r\n  } catch (err) { console.error('Supplier list error:', err.message); }";
s = s.replace(sourcesMapEnd, function() { return supplierLoad; });

// 2. Replace the Edit Sources panel block.
// Find from "html += '<div id=\"srcedit-' + l.id" up to "html += '</form></div></div>';"
const startAnchor = "html += '<div id=\"srcedit-' + l.id + '\"";
const endAnchor = "html += '</form></div></div>';";

let startIdx = s.indexOf(startAnchor);
if (startIdx < 0) {
  console.error('! panel start not found');
  process.exit(1);
}
// Walk to find the line start
while (startIdx > 0 && s[startIdx-1] !== '\n') startIdx--;

let endIdx = s.indexOf(endAnchor, startIdx);
if (endIdx < 0) {
  console.error('! panel end not found');
  process.exit(1);
}
endIdx = endIdx + endAnchor.length;
// Include the newline after
while (endIdx < s.length && s[endIdx] !== '\n') endIdx++;
endIdx++;

// Build replacement. Use Q for single-quote char in inline JS strings to avoid escape mess.
const Q = "String.fromCharCode(39)";

const lines = [
  '      // ORDER_SOURCES_ADDREMOVE_V2 panel',
  '      html += \'<div id="srcedit-\' + l.id + \'" style="display:none;margin-top:10px;padding-top:10px;border-top:1px dashed #1e2d42;">\';',
  '      html += \'<form method="POST" action="/admin/orders/\' + o.id + \'/lines/\' + l.id + \'/sources-update">\';',
  '      html += \'<div id="src-rows-\' + l.id + \'">\';',
  '      lineSources.forEach(function(src, idx) {',
  '        const poBadge = src.supplier_po_line_id ? \'<span style="display:inline-block;padding:1px 6px;background:rgba(76,175,80,0.15);color:#4caf50;border-radius:2px;font-size:.6rem;margin-left:6px;">&#10003; PO\' + String.fromCharCode(39) + \'d</span>\' : \'\';',
  '        const removeOnclick = src.supplier_po_line_id',
  '          ? \'if (!confirm(&quot;This source has been PO\' + String.fromCharCode(39) + \'d. Remove anyway?&quot;)) return false; this.closest(&quot;[data-srcrow]&quot;).remove();\'',
  '          : \'this.closest(&quot;[data-srcrow]&quot;).remove();\';',
  '        const supEsc = (src.supplier_name || \'\').replace(/"/g, \'&quot;\');',
  '        const leadEsc = (src.lead_time_text || \'\').toString().replace(/"/g, \'&quot;\');',
  '        html += \'<div data-srcrow="\' + l.id + \'_\' + idx + \'" style="display:grid;grid-template-columns:1.5fr 0.5fr 0.7fr 1fr 0.4fr 0.4fr 0.4fr 0.3fr;gap:6px;margin-bottom:6px;align-items:end;">\';',
  '        html += \'<input type="hidden" name="src_\' + idx + \'_id" value="\' + src.id + \'"/>\';',
  '        html += \'<div style="position:relative;"><div style="font-size:.6rem;color:#7a8a9a;">Supplier\' + poBadge + \'</div>\';',
  '        html += \'<input type="text" class="src-combo" data-target="sup_\' + l.id + \'_\' + idx + \'" value="\' + supEsc + \'" placeholder="Type to search..." autocomplete="off" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 22px 5px 8px;font-size:.76rem;"/>\';',
  '        html += \'<div style="position:absolute;right:6px;top:22px;color:#c8932a;pointer-events:none;font-size:.65rem;">&#9660;</div>\';',
  '        html += \'<div class="src-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:#0a1628;border:1px solid #c8932a;border-top:none;max-height:180px;overflow-y:auto;z-index:1000;"></div>\';',
  '        html += \'<input type="hidden" id="sup_\' + l.id + \'_\' + idx + \'" name="src_\' + idx + \'_supplier_id" value="\' + src.supplier_id + \'" required/></div>\';',
  '        html += \'<div><div style="font-size:.6rem;color:#7a8a9a;">Qty</div><input type="number" min="1" name="src_\' + idx + \'_qty" value="\' + src.allocated_qty + \'" style="width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 6px;font-size:.76rem;"/></div>\';',
  '        html += \'<div><div style="font-size:.6rem;color:#7a8a9a;">Unit Cost</div><input type="number" step="0.01" name="src_\' + idx + \'_cost" value="\' + parseFloat(src.unit_cost || 0).toFixed(2) + \'" style="width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 6px;font-size:.76rem;"/></div>\';',
  '        html += \'<div><div style="font-size:.6rem;color:#7a8a9a;">Lead</div><input type="text" name="src_\' + idx + \'_lead" value="\' + leadEsc + \'" placeholder="5 days" style="width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 6px;font-size:.76rem;"/></div>\';',
  '        html += \'<div><div style="font-size:.6rem;color:#7a8a9a;">8130</div><input type="checkbox" name="src_\' + idx + \'_8130" value="1"\' + (src.has_8130_required ? \' checked\' : \'\') + \'/></div>\';',
  '        html += \'<div><div style="font-size:.6rem;color:#7a8a9a;">CoC</div><input type="checkbox" name="src_\' + idx + \'_coc" value="1"\' + (src.has_coc_required ? \' checked\' : \'\') + \'/></div>\';',
  '        html += \'<div><div style="font-size:.6rem;color:#7a8a9a;">Trace</div><input type="checkbox" name="src_\' + idx + \'_trace" value="1"\' + (src.has_trace_required ? \' checked\' : \'\') + \'/></div>\';',
  '        html += \'<div><button type="button" onclick="\' + removeOnclick + \'" style="background:#3b1d1d;border:1px solid #5a2828;color:#e05050;padding:4px 8px;cursor:pointer;border-radius:3px;">&#10006;</button></div>\';',
  '        html += \'</div>\';',
  '      });',
  '      html += \'</div>\';',
  '      html += \'<button type="button" onclick="window.addOrderSrcRow(\' + l.id + \')" style="background:rgba(200,147,42,0.1);border:1px solid #c8932a;color:#c8932a;padding:5px 12px;cursor:pointer;border-radius:3px;font-size:.75rem;margin-top:4px;">+ Add Source</button>\';',
  '      html += \'<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">\';',
  '      html += \'<button type="button" onclick="document.getElementById(&quot;srcedit-\' + l.id + \'&quot;).style.display=&quot;none&quot;;" class="btn btn-outline btn-sm">Cancel</button>\';',
  '      html += \'<button type="submit" class="btn btn-gold btn-sm">Save Source Changes</button>\';',
  '      html += \'</div>\';',
  '      html += \'</form></div></div>\';',
  ''
].join('\r\n');

s = s.slice(0, startIdx) + lines + s.slice(endIdx);

// 3. Inject the JS script before "return html;"
const scriptBlock = [
  '  // ORDER_SOURCES_ADDREMOVE_V2: inject combobox + add row script',
  '  html += \'<script>\';',
  '  html += \'window.__OSUPPLIERS = \' + JSON.stringify(_supplierList) + \';\';',
  '  html += \'\\n\';',
  '  html += [',
  '    \'function renderOSrcDropdown(combo, query) {\',',
  '    \'  var dd = combo.parentElement.querySelector(".src-dropdown");\',',
  '    \'  if (!dd) return;\',',
  '    \'  var q = (query || "").toLowerCase();\',',
  '    \'  var matches = window.__OSUPPLIERS.filter(function(s) { return !q || (s.company_name||"").toLowerCase().indexOf(q) !== -1; }).slice(0, 50);\',',
  '    \'  if (!matches.length) { dd.innerHTML = "<div style=\\"padding:8px;color:#7a8a9a;font-size:.75rem;\\">No suppliers match</div>"; dd.style.display = "block"; return; }\',',
  '    \'  var parts = matches.map(function(sup) { var name = (sup.company_name||"").replace(/</g,"&lt;").replace(/\\"/g,"&quot;"); return "<div class=\\"src-opt\\" data-id=\\"" + sup.id + "\\" data-name=\\"" + name + "\\" style=\\"padding:5px 10px;cursor:pointer;font-size:.78rem;color:#eef1f5;border-bottom:1px solid #1e2d42;\\">" + name + "</div>"; });\',',
  '    \'  dd.innerHTML = parts.join("");\',',
  '    \'  dd.style.display = "block";\',',
  '    \'}\',',
  '    \'document.addEventListener("focus", function(e) {\',',
  '    \'  if (!e.target.classList || !e.target.classList.contains("src-combo")) return;\',',
  '    \'  renderOSrcDropdown(e.target, e.target.value);\',',
  '    \'}, true);\',',
  '    \'document.addEventListener("input", function(e) {\',',
  '    \'  if (!e.target.classList || !e.target.classList.contains("src-combo")) return;\',',
  '    \'  var hid = document.getElementById(e.target.getAttribute("data-target"));\',',
  '    \'  var val = e.target.value.trim().toLowerCase();\',',
  '    \'  var match = window.__OSUPPLIERS.find(function(sup) { return (sup.company_name||"").toLowerCase() === val; });\',',
  '    \'  if (hid) hid.value = match ? match.id : "";\',',
  '    \'  e.target.style.borderColor = match ? "#4caf50" : (e.target.value ? "#e05050" : "#1e2d42");\',',
  '    \'  renderOSrcDropdown(e.target, e.target.value);\',',
  '    \'});\',',
  '    \'document.addEventListener("click", function(e) {\',',
  '    \'  var opt = e.target.closest && e.target.closest(".src-opt");\',',
  '    \'  if (opt) {\',',
  '    \'    var dd = opt.parentElement; var wrap = dd.parentElement;\',',
  '    \'    var input = wrap.querySelector(".src-combo");\',',
  '    \'    var hid = document.getElementById(input.getAttribute("data-target"));\',',
  '    \'    input.value = opt.getAttribute("data-name");\',',
  '    \'    if (hid) hid.value = opt.getAttribute("data-id");\',',
  '    \'    input.style.borderColor = "#4caf50";\',',
  '    \'    dd.style.display = "none";\',',
  '    \'    return;\',',
  '    \'  }\',',
  '    \'  if (!e.target.classList || !e.target.classList.contains("src-combo")) {\',',
  '    \'    document.querySelectorAll(".src-dropdown").forEach(function(dd) { dd.style.display = "none"; });\',',
  '    \'  }\',',
  '    \'});\',',
  '    \'window.addOrderSrcRow = function(lineId) {\',',
  '    \'  var container = document.getElementById("src-rows-" + lineId);\',',
  '    \'  if (!container) return;\',',
  '    \'  var existing = container.querySelectorAll("[data-srcrow]");\',',
  '    \'  var nextIdx = existing.length;\',',
  '    \'  while (container.querySelector("[data-srcrow=\\"" + lineId + "_" + nextIdx + "\\"]")) nextIdx++;\',',
  '    \'  var hidId = "sup_" + lineId + "_" + nextIdx + "_new";\',',
  '    \'  var div = document.createElement("div");\',',
  '    \'  div.setAttribute("data-srcrow", lineId + "_" + nextIdx);\',',
  '    \'  div.style.cssText = "display:grid;grid-template-columns:1.5fr 0.5fr 0.7fr 1fr 0.4fr 0.4fr 0.4fr 0.3fr;gap:6px;margin-bottom:6px;align-items:end;";\',',
  '    \'  var rowHtml = "";\',',
  '    \'  rowHtml += "<input type=\\"hidden\\" name=\\"src_" + nextIdx + "_id\\" value=\\"\\"/>";\',',
  '    \'  rowHtml += "<div style=\\"position:relative;\\"><div style=\\"font-size:.6rem;color:#7a8a9a;\\">Supplier</div>";\',',
  '    \'  rowHtml += "<input type=\\"text\\" class=\\"src-combo\\" data-target=\\"" + hidId + "\\" placeholder=\\"Type to search...\\" autocomplete=\\"off\\" style=\\"width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 22px 5px 8px;font-size:.76rem;\\"/>";\',',
  '    \'  rowHtml += "<div style=\\"position:absolute;right:6px;top:22px;color:#c8932a;pointer-events:none;font-size:.65rem;\\">&#9660;</div>";\',',
  '    \'  rowHtml += "<div class=\\"src-dropdown\\" style=\\"display:none;position:absolute;top:100%;left:0;right:0;background:#0a1628;border:1px solid #c8932a;border-top:none;max-height:180px;overflow-y:auto;z-index:1000;\\"></div>";\',',
  '    \'  rowHtml += "<input type=\\"hidden\\" id=\\"" + hidId + "\\" name=\\"src_" + nextIdx + "_supplier_id\\" required/></div>";\',',
  '    \'  rowHtml += "<div><div style=\\"font-size:.6rem;color:#7a8a9a;\\">Qty</div><input type=\\"number\\" min=\\"1\\" name=\\"src_" + nextIdx + "_qty\\" value=\\"1\\" required style=\\"width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 6px;font-size:.76rem;\\"/></div>";\',',
  '    \'  rowHtml += "<div><div style=\\"font-size:.6rem;color:#7a8a9a;\\">Unit Cost</div><input type=\\"number\\" step=\\"0.01\\" name=\\"src_" + nextIdx + "_cost\\" required style=\\"width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 6px;font-size:.76rem;\\"/></div>";\',',
  '    \'  rowHtml += "<div><div style=\\"font-size:.6rem;color:#7a8a9a;\\">Lead</div><input type=\\"text\\" name=\\"src_" + nextIdx + "_lead\\" placeholder=\\"5 days\\" style=\\"width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 6px;font-size:.76rem;\\"/></div>";\',',
  '    \'  rowHtml += "<div><div style=\\"font-size:.6rem;color:#7a8a9a;\\">8130</div><input type=\\"checkbox\\" name=\\"src_" + nextIdx + "_8130\\" value=\\"1\\"/></div>";\',',
  '    \'  rowHtml += "<div><div style=\\"font-size:.6rem;color:#7a8a9a;\\">CoC</div><input type=\\"checkbox\\" name=\\"src_" + nextIdx + "_coc\\" value=\\"1\\"/></div>";\',',
  '    \'  rowHtml += "<div><div style=\\"font-size:.6rem;color:#7a8a9a;\\">Trace</div><input type=\\"checkbox\\" name=\\"src_" + nextIdx + "_trace\\" value=\\"1\\"/></div>";\',',
  '    \'  rowHtml += "<div><button type=\\"button\\" onclick=\\"this.closest(&quot;[data-srcrow]&quot;).remove();\\" style=\\"background:#3b1d1d;border:1px solid #5a2828;color:#e05050;padding:4px 8px;cursor:pointer;border-radius:3px;\\">&#10006;</button></div>";\',',
  '    \'  div.innerHTML = rowHtml;\',',
  '    \'  container.appendChild(div);\',',
  '    \'};\'',
  '  ].join("\\n");',
  '  html += \'<\' + \'/script>\';',
  ''
].join('\r\n');

const retIdx = s.indexOf('  return html;');
if (retIdx < 0) {
  console.error('! return anchor not found');
  process.exit(1);
}
s = s.slice(0, retIdx) + scriptBlock + '\r\n' + s.slice(retIdx);

fs.writeFileSync(f + '.v2.bak', orig);
fs.writeFileSync(f, s);

const r = compile(f);
if (r !== true) {
  fs.writeFileSync(f, orig);
  console.error('! syntax: ' + r);
  process.exit(1);
}

console.log('+ orderLinesBlock: Add/Remove sources with searchable combobox');
console.log('SUCCESS');
