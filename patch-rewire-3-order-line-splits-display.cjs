// patch-rewire-3-order-line-splits-display.cjs
// Patches admin/orderLinesBlock.js to display source splits inline (admin only).
// Each order line now shows "Sourced from N supplier(s)" with expandable detail rows.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/orderLinesBlock.js';
const BACKUP = 'admin/orderLinesBlock.js.rewire3.bak';

console.log('Rewire 3: Order detail Lines tab - show source splits');
console.log('=====================================================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('order_line_sources')) {
  console.log('- Already patched.');
  process.exit(0);
}

// Find the renderLinesTab signature so we can add a sources fetch
const sigAnchor = "export async function renderLinesTab(o, oLines, suppliers, pool";
let foundSig = src.includes(sigAnchor);
let sigVariant = sigAnchor;

if (!foundSig) {
  // Try alternate signature without pool (older)
  const altSig = "export async function renderLinesTab(o, oLines, suppliers";
  if (src.includes(altSig)) {
    foundSig = true;
    sigVariant = altSig;
    // We need pool for queries - we'll use getPool import
  }
}

if (!foundSig) {
  // Try sync version
  const syncSig = "export function renderLinesTab(o, oLines, suppliers";
  if (src.includes(syncSig)) {
    console.log('- Found sync renderLinesTab. Will convert to async.');
    foundSig = true;
    sigVariant = syncSig;
  }
}

if (!foundSig) {
  console.error('! Could not find renderLinesTab signature. Dumping first 2000 chars for inspection:');
  console.error(src.substring(0, 2000));
  process.exit(1);
}

// We'll inject a "load sources for these lines" step at the start of the function,
// and modify the per-line rendering to show split info.

// Strategy: rather than rewrite the whole function (risky), we add a 
// helper script tag at the END of the rendered output that fetches sources via API
// and injects them inline. This requires a new admin API endpoint.
// 
// SAFER approach: just add a small visual indicator on each line showing the 
// linked supplier_pos count. We already have supplier_id on order_lines from Step 5.
// Lines with order_line_sources will be shown via the new endpoint.

// Simpler strategy: Add a fetch at the top of the function (make it async if not),
// then for each line we display source breakdown right under the line card.

// Find the existing import block at top
const importBlockMatch = src.match(/^import[^;]+;[\r\n]+/m);
if (!importBlockMatch) {
  console.error('! Could not find import block');
  process.exit(1);
}

// Add getPool/sql imports if not present
let needsPoolImport = !src.includes('getPool') && !src.includes("from '../db/connect.js'");
if (needsPoolImport) {
  src = src.replace(importBlockMatch[0], importBlockMatch[0] + "import { getPool, sql } from '../db/connect.js';\n");
}

// Convert sync to async if needed
if (sigVariant.startsWith('export function')) {
  src = src.replace(sigVariant, "export async function renderLinesTab(o, oLines, suppliers");
}

// Now find where the line cards get rendered. Look for "oLines.recordset.forEach" or similar
// Most likely pattern: oLines.recordset.forEach(function(l, i) { ... html += ... })
// We'll add a sources lookup BEFORE the forEach and pass it in.

// Find the start of the function body
const funcStart = src.indexOf(sigVariant);
const openBraceIdx = src.indexOf('{', funcStart);
const insertAfter = src.indexOf('\n', openBraceIdx) + 1;

// Inject: load all sources for these order lines into a Map
const sourcesLoader = 
"  // [Rewire 3] Load order_line_sources for split-display\n" +
"  let _sourcesMap = {};\n" +
"  try {\n" +
"    const _pool = await getPool();\n" +
"    const _ids = (oLines.recordset || oLines).map(function(l){ return l.id; }).filter(Boolean);\n" +
"    if (_ids.length) {\n" +
"      const _r = await _pool.request().query(\n" +
"        \"SELECT ols.*, s.company_name AS supplier_name FROM order_line_sources ols JOIN suppliers s ON s.id = ols.supplier_id WHERE ols.order_line_id IN (\" + _ids.join(',') + \") ORDER BY ols.order_line_id, ols.sort_order\"\n" +
"      );\n" +
"      _r.recordset.forEach(function(s) {\n" +
"        if (!_sourcesMap[s.order_line_id]) _sourcesMap[s.order_line_id] = [];\n" +
"        _sourcesMap[s.order_line_id].push(s);\n" +
"      });\n" +
"    }\n" +
"  } catch(e) { console.error('Sources load error:', e.message); }\n";

src = src.substring(0, insertAfter) + sourcesLoader + src.substring(insertAfter);
console.log('+ Sources loader added');

// Now find where each line is being rendered. We'll add a sources display block.
// Look for the closing of the per-line card so we can inject right before it.
// Common pattern: html += '</div></div>';  (closing line card)
// 
// We'll search for a unique anchor inside the per-line render. Most likely:
// "Compliance" or similar section text. Let's try several anchors.

// Find the forEach loop body
const forEachMatch = src.match(/(\(oLines\.recordset \|\| oLines\)\.forEach|oLines\.recordset\.forEach|oLines\.forEach)\(function\((\w+)/);
if (!forEachMatch) {
  console.error('! Could not find forEach loop over order lines');
  console.log('  Sources loader was added but split display not injected.');
  console.log('  Will write file and continue - splits visible via direct DB query but not in UI yet.');
} else {
  const lVar = forEachMatch[2];  // variable name (probably 'l')
  
  // Inject inside the forEach: at the start of each iteration, prepend a sources display
  // We'll find the opening brace of the function body
  const forEachStart = src.indexOf(forEachMatch[0]);
  const forEachBraceIdx = src.indexOf('{', forEachStart + forEachMatch[0].length);
  const forEachInsertIdx = src.indexOf('\n', forEachBraceIdx) + 1;
  
  const sourcesDisplay = 
"      // [Rewire 3] Render source splits for this order line\n" +
"      const _lineSources = _sourcesMap[" + lVar + ".id] || [];\n" +
"      let _srcHtml = '';\n" +
"      if (_lineSources.length > 0) {\n" +
"        const _isSplit = _lineSources.length > 1;\n" +
"        _srcHtml += '<div style=\"background:#0a1628;border-top:1px solid #1e2d42;padding:10px 14px;margin-top:-1px;\">';\n" +
"        _srcHtml += '<div style=\"font-size:.65rem;letter-spacing:.12em;text-transform:uppercase;color:#c8932a;margin-bottom:6px;font-weight:700;\">';\n" +
"        _srcHtml += '\\uD83D\\uDD12 INTERNAL SOURCES ' + (_isSplit ? '(SPLIT: ' + _lineSources.length + ' suppliers)' : '') + '</div>';\n" +
"        _srcHtml += '<table style=\"width:100%;font-size:.78rem;color:#cfd5dc;\"><thead><tr style=\"text-align:left;\">';\n" +
"        _srcHtml += '<th style=\"padding:3px 6px;color:#7a8a9a;font-size:.65rem;\">SUPPLIER</th>';\n" +
"        _srcHtml += '<th style=\"padding:3px 6px;color:#7a8a9a;font-size:.65rem;\">QTY</th>';\n" +
"        _srcHtml += '<th style=\"padding:3px 6px;color:#7a8a9a;font-size:.65rem;\">RECVD</th>';\n" +
"        _srcHtml += '<th style=\"padding:3px 6px;color:#7a8a9a;font-size:.65rem;\">UNIT COST</th>';\n" +
"        _srcHtml += '<th style=\"padding:3px 6px;color:#7a8a9a;font-size:.65rem;\">LINE COST</th>';\n" +
"        _srcHtml += '<th style=\"padding:3px 6px;color:#7a8a9a;font-size:.65rem;text-align:center;\">8130</th>';\n" +
"        _srcHtml += '<th style=\"padding:3px 6px;color:#7a8a9a;font-size:.65rem;text-align:center;\">CoC</th>';\n" +
"        _srcHtml += '<th style=\"padding:3px 6px;color:#7a8a9a;font-size:.65rem;\">PO</th>';\n" +
"        _srcHtml += '</tr></thead><tbody>';\n" +
"        _lineSources.forEach(function(_s) {\n" +
"          const _full = _s.received_qty >= _s.allocated_qty;\n" +
"          _srcHtml += '<tr>';\n" +
"          _srcHtml += '<td style=\"padding:3px 6px;\"><a href=\"/admin/suppliers/' + _s.supplier_id + '\" style=\"color:#c8932a;\">' + _s.supplier_name + '</a></td>';\n" +
"          _srcHtml += '<td style=\"padding:3px 6px;font-weight:700;\">' + _s.allocated_qty + '</td>';\n" +
"          _srcHtml += '<td style=\"padding:3px 6px;color:' + (_full ? '#4caf50' : '#7a8a9a') + ';\">' + (_s.received_qty || 0) + '/' + _s.allocated_qty + (_full ? ' \\u2713' : '') + '</td>';\n" +
"          _srcHtml += '<td style=\"padding:3px 6px;\">$' + parseFloat(_s.unit_cost || 0).toFixed(2) + '</td>';\n" +
"          _srcHtml += '<td style=\"padding:3px 6px;\">$' + parseFloat(_s.line_cost || (_s.allocated_qty * _s.unit_cost) || 0).toFixed(2) + '</td>';\n" +
"          _srcHtml += '<td style=\"padding:3px 6px;text-align:center;\">' + (_s.has_8130_required ? (_s.has_8130_received ? '<span style=\"color:#4caf50;\">\\u2713</span>' : '<span style=\"color:#e05050;\">!</span>') : '\\u2014') + '</td>';\n" +
"          _srcHtml += '<td style=\"padding:3px 6px;text-align:center;\">' + (_s.has_coc_required ? (_s.has_coc_received ? '<span style=\"color:#4caf50;\">\\u2713</span>' : '<span style=\"color:#e05050;\">!</span>') : '\\u2014') + '</td>';\n" +
"          _srcHtml += '<td style=\"padding:3px 6px;\">' + (_s.supplier_po_line_id ? '<a href=\"/admin/supplier-pos\" style=\"color:#c8932a;\">View PO</a>' : '<span style=\"color:#7a8a9a;\">Not yet</span>') + '</td>';\n" +
"          _srcHtml += '</tr>';\n" +
"        });\n" +
"        _srcHtml += '</tbody></table></div>';\n" +
"      }\n";
  
  src = src.substring(0, forEachInsertIdx) + sourcesDisplay + src.substring(forEachInsertIdx);
  console.log('+ Source splits display injected into forEach');
  
  // Now we need to find where each line's HTML gets appended and add _srcHtml after it.
  // Most reliable anchor: end of the line card, just before the closing </div> of the line wrapper.
  // We'll look for "html += '</div>" inside the forEach... actually simpler:
  // we just append _srcHtml at the END of each line's html, by appending after the line card closes.
  // 
  // Find the LAST html += ... within this forEach, before the closing }
  // We'll just append _srcHtml right before the closing of the forEach callback body.
  
  // Find the closing of the forEach callback. Walk forward from forEachBraceIdx counting braces.
  let depth = 1;
  let i = forEachInsertIdx;
  let inString = null;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    const next = src[i+1] || '';
    if (inString) {
      if (ch === '\\') { i += 2; continue; }
      if (ch === inString) inString = null;
      i++; continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { inString = ch; i++; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) break; }
    i++;
  }
  
  if (depth === 0) {
    // i is at the closing brace. Insert before it.
    const appendSrc = "      html += _srcHtml;\n      ";
    src = src.substring(0, i) + appendSrc + src.substring(i);
    console.log('+ _srcHtml appended at end of forEach');
  } else {
    console.log('  (warning: could not find end of forEach - splits loaded but not appended visually)');
  }
}

fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);

try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ Patched + syntax OK');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! Syntax error - reverted');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
