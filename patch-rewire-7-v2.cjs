// patch-rewire-7-v2-quote-builder-as-bid-sheet.cjs
// Option B: Quote builder acts like a bid sheet.
// 
// Changes to admin/quoteBuilder.js:
//   1. Add "USE?" column header
//   2. Add USE checkbox to server-rendered rows (renderSourceRow)
//   3. Add USE checkbox to client-side dynamic rows (addSource JS)
//   4. recalcLine only counts checked sources
//   5. Submit validation only counts checked sources
//   6. Server saveQuote validates only checked sources
//   7. INSERT writes is_selected based on checkbox state

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/quoteBuilder.js';
const BACKUP = 'admin/quoteBuilder.js.rewire7v2.bak';

console.log('Rewire 7 v2: Quote builder as bid sheet');
console.log('=======================================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('src-use') || src.includes('[Rewire 7]')) {
  console.log('- Already patched.');
  process.exit(0);
}

// Track if all anchors were found before writing
const checks = [];

function tryReplace(label, oldStr, newStr) {
  if (!src.includes(oldStr)) {
    return { ok: false, label: label, oldStr: oldStr.substring(0, 100) };
  }
  src = src.replace(oldStr, function() { return newStr; });
  return { ok: true, label: label };
}

// ============================================================================
// CHANGE 1: Add USE? column header
// ============================================================================
// Look for the trace header followed by NOTES header - need to inject USE? after NOTES.
// Anchor: the NOTES header followed by the empty header for X button column.
const c1 = tryReplace('CHANGE 1: USE? column header',
  '<th style="padding:4px 6px;color:#7a8a9a;font-size:.65rem;">NOTES</th>\' +\n      \'<th style="padding:4px 6px;width:30px;"></th>\'',
  '<th style="padding:4px 6px;color:#7a8a9a;font-size:.65rem;">NOTES</th>\' +\n      \'<th style="padding:4px 6px;color:#c8932a;font-size:.65rem;width:50px;text-align:center;font-weight:700;">USE?</th>\' +\n      \'<th style="padding:4px 6px;width:30px;"></th>\''
);
checks.push(c1);

// ============================================================================
// CHANGE 2: Server-side row - add USE checkbox before X button
// ============================================================================
// Anchor: the line that creates notes input followed by the X button line.
const c2 = tryReplace('CHANGE 2: server row USE checkbox',
  '  html += \'<td style="padding:4px 6px;"><input type="text" name="lines[\' + lineIdx + \'][sources][\' + sIdx + \'][notes]" value="\' + escAttr(notes) + \'" style="width:100%;font-size:.78rem;" placeholder="optional"/></td>\';\n  html += \'<td style="padding:4px 6px;text-align:center;"><button type="button" onclick="removeSource(this, \' + lineIdx + \')" class="btn btn-outline btn-sm" style="color:#e05050;font-size:.7rem;padding:2px 6px;">X</button></td>\';',
  '  html += \'<td style="padding:4px 6px;"><input type="text" name="lines[\' + lineIdx + \'][sources][\' + sIdx + \'][notes]" value="\' + escAttr(notes) + \'" style="width:100%;font-size:.78rem;" placeholder="optional"/></td>\';\n  // [Rewire 7] USE checkbox - default checked\n  const _isUsed = (s.is_selected === undefined || s.is_selected === null) ? true : !!s.is_selected;\n  html += \'<td style="padding:4px 6px;text-align:center;"><input type="checkbox" name="lines[\' + lineIdx + \'][sources][\' + sIdx + \'][is_selected]" value="1" \' + (_isUsed ? \'checked\' : \'\') + \' class="src-use" data-line-idx="\' + lineIdx + \'" onchange="recalcLine(\' + lineIdx + \')" style="accent-color:#4caf50;width:18px;height:18px;"/></td>\';\n  html += \'<td style="padding:4px 6px;text-align:center;"><button type="button" onclick="removeSource(this, \' + lineIdx + \')" class="btn btn-outline btn-sm" style="color:#e05050;font-size:.7rem;padding:2px 6px;">X</button></td>\';'
);
checks.push(c2);

// ============================================================================
// CHANGE 3: Client-side dynamic row (in addSource JS string)
// Anchor: the notes input string followed by removeSource button string.
// ============================================================================
const c3old = "'        \\'<td style=\"padding:4px 6px;\"><input type=\"text\" name=\"lines[\\'+lineIdx+\\'][sources][\\'+sIdx+\\'][notes]\" style=\"width:100%;font-size:.78rem;\" placeholder=\"optional\"/></td>\\' +\\n' +\n'        \\'<td style=\"padding:4px 6px;text-align:center;\"><button type=\"button\" onclick=\"removeSource(this, \\'+lineIdx+\\')\" class=\"btn btn-outline btn-sm\" style=\"color:#e05050;font-size:.7rem;padding:2px 6px;\">X</button></td>\\';";

const c3new = "'        \\'<td style=\"padding:4px 6px;\"><input type=\"text\" name=\"lines[\\'+lineIdx+\\'][sources][\\'+sIdx+\\'][notes]\" style=\"width:100%;font-size:.78rem;\" placeholder=\"optional\"/></td>\\' +\\n' +\n'        \\'<td style=\"padding:4px 6px;text-align:center;\"><input type=\"checkbox\" name=\"lines[\\'+lineIdx+\\'][sources][\\'+sIdx+\\'][is_selected]\" value=\"1\" checked class=\"src-use\" data-line-idx=\"\\'+lineIdx+\\'\" onchange=\"recalcLine(\\'+lineIdx+\\')\" style=\"accent-color:#4caf50;width:18px;height:18px;\"/></td>\\' +\\n' +\n'        \\'<td style=\"padding:4px 6px;text-align:center;\"><button type=\"button\" onclick=\"removeSource(this, \\'+lineIdx+\\')\" class=\"btn btn-outline btn-sm\" style=\"color:#e05050;font-size:.7rem;padding:2px 6px;\">X</button></td>\\';";

const c3 = tryReplace('CHANGE 3: client row USE checkbox', c3old, c3new);
checks.push(c3);

// ============================================================================
// CHANGE 4: recalcLine only counts checked sources
// ============================================================================
const c4old = "'      var srcQtys = document.querySelectorAll(\".src-qty[data-line-idx=\\\\\"\"+lineIdx+\"\\\\\"]\");\\n' +\n'      var srcCosts = document.querySelectorAll(\".src-cost[data-line-idx=\\\\\"\"+lineIdx+\"\\\\\"]\");\\n' +\n'      var totalAlloc = 0, totalCost = 0;\\n' +\n'      for (var i=0; i<srcQtys.length; i++) {\\n' +\n'        var q = parseFloat(srcQtys[i].value) || 0;\\n' +\n'        var c = parseFloat(srcCosts[i].value) || 0;\\n' +\n'        totalAlloc += q;\\n' +\n'        totalCost += q * c;\\n' +\n'      }\\n' +";

const c4new = "'      var srcQtys = document.querySelectorAll(\".src-qty[data-line-idx=\\\\\"\"+lineIdx+\"\\\\\"]\");\\n' +\n'      var srcCosts = document.querySelectorAll(\".src-cost[data-line-idx=\\\\\"\"+lineIdx+\"\\\\\"]\");\\n' +\n'      var srcUses = document.querySelectorAll(\".src-use[data-line-idx=\\\\\"\"+lineIdx+\"\\\\\"]\");\\n' +\n'      var totalAlloc = 0, totalCost = 0;\\n' +\n'      for (var i=0; i<srcQtys.length; i++) {\\n' +\n'        var isUsed = srcUses[i] ? srcUses[i].checked : true;\\n' +\n'        if (!isUsed) continue;\\n' +\n'        var q = parseFloat(srcQtys[i].value) || 0;\\n' +\n'        var c = parseFloat(srcCosts[i].value) || 0;\\n' +\n'        totalAlloc += q;\\n' +\n'        totalCost += q * c;\\n' +\n'      }\\n' +";

const c4 = tryReplace('CHANGE 4: recalcLine checked-only', c4old, c4new);
checks.push(c4);

// ============================================================================
// CHANGE 5: Submit validation - only checked sources count
// ============================================================================
const c5old = "'          var srcQtys = document.querySelectorAll(\".src-qty[data-line-idx=\\\\\"\"+lineIdx+\"\\\\\"]\");\\n' +\n'          var totalAlloc = 0;\\n' +\n'          for (var j=0; j<srcQtys.length; j++) totalAlloc += parseFloat(srcQtys[j].value) || 0;\\n' +";

const c5new = "'          var srcQtys = document.querySelectorAll(\".src-qty[data-line-idx=\\\\\"\"+lineIdx+\"\\\\\"]\");\\n' +\n'          var srcUses = document.querySelectorAll(\".src-use[data-line-idx=\\\\\"\"+lineIdx+\"\\\\\"]\");\\n' +\n'          var totalAlloc = 0;\\n' +\n'          for (var j=0; j<srcQtys.length; j++) {\\n' +\n'            var isUsed = srcUses[j] ? srcUses[j].checked : true;\\n' +\n'            if (isUsed) totalAlloc += parseFloat(srcQtys[j].value) || 0;\\n' +\n'          }\\n' +";

const c5 = tryReplace('CHANGE 5: submit validation checked-only', c5old, c5new);
checks.push(c5);

// ============================================================================
// CHANGE 6: Server saveQuote validation
// ============================================================================
const c6old = "    let allocSum = 0, costSum = 0;\n    sources.forEach(function(s, sIdx) {\n      const sq = parseInt(s.allocated_qty || 0);\n      const sc = parseFloat(s.unit_cost || 0);\n      if (!s.supplier_id) throw new Error('Line ' + lineNum + ' source ' + (sIdx + 1) + ': supplier required');\n      if (sq <= 0) throw new Error('Line ' + lineNum + ' source ' + (sIdx + 1) + ': allocated qty must be > 0');\n      if (sc < 0) throw new Error('Line ' + lineNum + ' source ' + (sIdx + 1) + ': cost cannot be negative');\n      allocSum += sq;\n      costSum += sq * sc;\n    });\n    if (allocSum !== lineQty) throw new Error('Line ' + lineNum + ': sources allocate ' + allocSum + ' but line qty is ' + lineQty);";

const c6new = "    // [Rewire 7] Only checked sources count toward allocation\n    let allocSum = 0, costSum = 0, selectedCount = 0;\n    sources.forEach(function(s, sIdx) {\n      const sq = parseInt(s.allocated_qty || 0);\n      const sc = parseFloat(s.unit_cost || 0);\n      const isUsed = s.is_selected === '1' || s.is_selected === 1 || s.is_selected === true;\n      if (!s.supplier_id) throw new Error('Line ' + lineNum + ' source ' + (sIdx + 1) + ': supplier required');\n      if (sq <= 0) throw new Error('Line ' + lineNum + ' source ' + (sIdx + 1) + ': allocated qty must be > 0');\n      if (sc < 0) throw new Error('Line ' + lineNum + ' source ' + (sIdx + 1) + ': cost cannot be negative');\n      if (isUsed) {\n        allocSum += sq;\n        costSum += sq * sc;\n        selectedCount++;\n      }\n    });\n    if (selectedCount === 0) throw new Error('Line ' + lineNum + ': at least one supplier must be checked (USE)');\n    if (allocSum !== lineQty) throw new Error('Line ' + lineNum + ': checked sources allocate ' + allocSum + ' but line qty is ' + lineQty);";

const c6 = tryReplace('CHANGE 6: server validation checked-only', c6old, c6new);
checks.push(c6);

// ============================================================================
// CHANGE 7a: Auto-add is_selected column to quote_line_sources at save time
// ============================================================================
const c7aOld = "    let sortOrder = 1;\n    for (const s of pl.sources) {";
const c7aNew = "    // [Rewire 7] Ensure is_selected column exists\n    try {\n      await pool.request().query(\"IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('quote_line_sources') AND name='is_selected') ALTER TABLE quote_line_sources ADD is_selected BIT NOT NULL DEFAULT 1\");\n    } catch(e) { console.error('is_selected col check:', e.message); }\n    let sortOrder = 1;\n    for (const s of pl.sources) {";

const c7a = tryReplace('CHANGE 7a: auto-add is_selected column', c7aOld, c7aNew);
checks.push(c7a);

// ============================================================================
// CHANGE 7b: INSERT now includes is_selected
// ============================================================================
const c7bOld = "        .input('so', sql.Int, sortOrder++)\n        .query(\"INSERT INTO quote_line_sources (quote_line_id, supplier_id, allocated_qty, unit_cost, supplier_lead_time_days, has_8130, has_coc, has_trace, notes, sort_order) VALUES (@qli, @sid, @aq, @uc, @ld, @h81, @hcoc, @htr, @nt, @so)\");";

const c7bNew = "        .input('so', sql.Int, sortOrder++)\n        .input('issel', sql.Bit, (s.is_selected === '1' || s.is_selected === 1 || s.is_selected === true) ? 1 : 0)\n        .query(\"INSERT INTO quote_line_sources (quote_line_id, supplier_id, allocated_qty, unit_cost, supplier_lead_time_days, has_8130, has_coc, has_trace, notes, sort_order, is_selected) VALUES (@qli, @sid, @aq, @uc, @ld, @h81, @hcoc, @htr, @nt, @so, @issel)\");";

const c7b = tryReplace('CHANGE 7b: INSERT with is_selected', c7bOld, c7bNew);
checks.push(c7b);

// ============================================================================
// VERIFY all changes applied
// ============================================================================
const failed = checks.filter(function(c){ return !c.ok; });
if (failed.length > 0) {
  console.log('');
  console.log('FAILURES:');
  failed.forEach(function(f){
    console.log('  ! ' + f.label);
    console.log('    Anchor: ' + f.oldStr.substring(0, 80) + '...');
  });
  console.log('');
  console.log('No changes written - file untouched.');
  process.exit(1);
}

checks.forEach(function(c){ console.log('+ ' + c.label); });

// ============================================================================
// Write + verify
// ============================================================================
fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);

try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ admin/quoteBuilder.js syntax OK');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! syntax error - REVERTED');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}

console.log('');
console.log('SUCCESS');
