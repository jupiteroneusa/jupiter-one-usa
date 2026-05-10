// patch-rewire-7-quote-builder-as-bid-sheet.cjs
// Option B: Quote builder acts like a bid sheet.
// 
// Changes:
//   1. Add "USE?" checkbox column to source row table
//   2. Default checkbox = checked (winner) for backward compat
//   3. Validation: SUM(checked rows allocated_qty) == line.quantity
//   4. Recalc only counts CHECKED rows in margin/cost
//   5. Save writes ALL rows to quote_line_sources, but is_selected=1 only on checked

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/quoteBuilder.js';
const BACKUP = 'admin/quoteBuilder.js.rewire7.bak';

console.log('Rewire 7: Quote builder as bid sheet');
console.log('====================================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

// Idempotency
if (src.includes('[Rewire 7]') || src.includes('is_selected')) {
  console.log('- Already patched.');
  process.exit(0);
}

// =============================================================================
// CHANGE 1: Add "USE?" column header to the sources table
// =============================================================================
const oldHeaderRow = "<th style=\"padding:4px 6px;color:#7a8a9a;font-size:.65rem;width:60px;text-align:center;\">Trace</th>' +\n      '<th style=\"padding:4px 6px;color:#7a8a9a;font-size:.65rem;\">NOTES</th>' +\n      '<th style=\"padding:4px 6px;width:30px;\"></th>' +";

const newHeaderRow = "<th style=\"padding:4px 6px;color:#7a8a9a;font-size:.65rem;width:60px;text-align:center;\">Trace</th>' +\n      '<th style=\"padding:4px 6px;color:#7a8a9a;font-size:.65rem;\">NOTES</th>' +\n      '<th style=\"padding:4px 6px;color:#c8932a;font-size:.65rem;width:50px;text-align:center;font-weight:700;\">USE?</th>' +\n      '<th style=\"padding:4px 6px;width:30px;\"></th>' +";

if (!src.includes(oldHeaderRow)) {
  console.error('! Could not find sources table header anchor (CHANGE 1)');
  process.exit(1);
}
src = src.replace(oldHeaderRow, function(){ return newHeaderRow; });
console.log('+ CHANGE 1: USE? column header added');

// =============================================================================
// CHANGE 2: Add Use? checkbox to renderSourceRow (server-side row rendering)
// =============================================================================
// Before the X button cell. Anchor:
const oldRowEnd = "  html += '<td style=\"padding:4px 6px;\"><input type=\"text\" name=\"lines[' + lineIdx + '][sources][' + sIdx + '][notes]\" value=\"' + escAttr(notes) + '\" style=\"width:100%;font-size:.78rem;\" placeholder=\"optional\"/></td>';\n  html += '<td style=\"padding:4px 6px;text-align:center;\"><button type=\"button\" onclick=\"removeSource(this, ' + lineIdx + ')\" class=\"btn btn-outline btn-sm\" style=\"color:#e05050;font-size:.7rem;padding:2px 6px;\">X</button></td>';";

const newRowEnd = "  html += '<td style=\"padding:4px 6px;\"><input type=\"text\" name=\"lines[' + lineIdx + '][sources][' + sIdx + '][notes]\" value=\"' + escAttr(notes) + '\" style=\"width:100%;font-size:.78rem;\" placeholder=\"optional\"/></td>';\n  // [Rewire 7] USE? checkbox - default checked\n  const isUsed = s.is_selected === undefined ? true : !!s.is_selected;\n  html += '<td style=\"padding:4px 6px;text-align:center;\"><input type=\"checkbox\" name=\"lines[' + lineIdx + '][sources][' + sIdx + '][is_selected]\" value=\"1\" ' + (isUsed ? 'checked' : '') + ' class=\"src-use\" data-line-idx=\"' + lineIdx + '\" onchange=\"recalcLine(' + lineIdx + ')\" style=\"accent-color:#4caf50;width:18px;height:18px;\"/></td>';\n  html += '<td style=\"padding:4px 6px;text-align:center;\"><button type=\"button\" onclick=\"removeSource(this, ' + lineIdx + ')\" class=\"btn btn-outline btn-sm\" style=\"color:#e05050;font-size:.7rem;padding:2px 6px;\">X</button></td>';";

if (!src.includes(oldRowEnd)) {
  console.error('! Could not find row end anchor (CHANGE 2)');
  process.exit(1);
}
src = src.replace(oldRowEnd, function(){ return newRowEnd; });
console.log('+ CHANGE 2: USE? checkbox added to server-rendered rows');

// =============================================================================
// CHANGE 3: Add Use? checkbox to client-side addSource (when user clicks +Split)
// =============================================================================
// Find the dynamic JS row builder. Anchor:
const oldClientRow = "'<td style=\"padding:4px 6px;\"><input type=\"text\" name=\"lines[\\'+lineIdx+\\'][sources][\\'+sIdx+\\'][notes]\" style=\"width:100%;font-size:.78rem;\" placeholder=\"optional\"/></td>' +\n        '<td style=\"padding:4px 6px;text-align:center;\"><button type=\"button\" onclick=\"removeSource(this, \\'+lineIdx+\\')\" class=\"btn btn-outline btn-sm\" style=\"color:#e05050;font-size:.7rem;padding:2px 6px;\">X</button></td>';";

const newClientRow = "'<td style=\"padding:4px 6px;\"><input type=\"text\" name=\"lines[\\'+lineIdx+\\'][sources][\\'+sIdx+\\'][notes]\" style=\"width:100%;font-size:.78rem;\" placeholder=\"optional\"/></td>' +\n        '<td style=\"padding:4px 6px;text-align:center;\"><input type=\"checkbox\" name=\"lines[\\'+lineIdx+\\'][sources][\\'+sIdx+\\'][is_selected]\" value=\"1\" checked class=\"src-use\" data-line-idx=\"\\'+lineIdx+\\'\" onchange=\"recalcLine(\\'+lineIdx+\\')\" style=\"accent-color:#4caf50;width:18px;height:18px;\"/></td>' +\n        '<td style=\"padding:4px 6px;text-align:center;\"><button type=\"button\" onclick=\"removeSource(this, \\'+lineIdx+\\')\" class=\"btn btn-outline btn-sm\" style=\"color:#e05050;font-size:.7rem;padding:2px 6px;\">X</button></td>';";

if (!src.includes(oldClientRow)) {
  console.error('! Could not find client-side row anchor (CHANGE 3)');
  process.exit(1);
}
src = src.replace(oldClientRow, function(){ return newClientRow; });
console.log('+ CHANGE 3: USE? checkbox added to dynamic addSource() client builder');

// =============================================================================
// CHANGE 4: Update recalcLine() to only count CHECKED sources
// =============================================================================
const oldRecalcLoop = "      var srcQtys = document.querySelectorAll(\".src-qty[data-line-idx=\\\\\"\"+lineIdx+\"\\\\\"]\");\\n' +\n'      var srcCosts = document.querySelectorAll(\".src-cost[data-line-idx=\\\\\"\"+lineIdx+\"\\\\\"]\");\\n' +\n'      var totalAlloc = 0, totalCost = 0;\\n' +\n'      for (var i=0; i<srcQtys.length; i++) {\\n' +\n'        var q = parseFloat(srcQtys[i].value) || 0;\\n' +\n'        var c = parseFloat(srcCosts[i].value) || 0;\\n' +\n'        totalAlloc += q;\\n' +\n'        totalCost += q * c;\\n' +\n'      }\\n'";

const newRecalcLoop = "      var srcQtys = document.querySelectorAll(\".src-qty[data-line-idx=\\\\\"\"+lineIdx+\"\\\\\"]\");\\n' +\n'      var srcCosts = document.querySelectorAll(\".src-cost[data-line-idx=\\\\\"\"+lineIdx+\"\\\\\"]\");\\n' +\n'      var srcUses = document.querySelectorAll(\".src-use[data-line-idx=\\\\\"\"+lineIdx+\"\\\\\"]\");\\n' +\n'      var totalAlloc = 0, totalCost = 0;\\n' +\n'      // [Rewire 7] Only checked sources count toward allocation/cost\\n' +\n'      for (var i=0; i<srcQtys.length; i++) {\\n' +\n'        var isUsed = srcUses[i] ? srcUses[i].checked : true;\\n' +\n'        if (!isUsed) continue;\\n' +\n'        var q = parseFloat(srcQtys[i].value) || 0;\\n' +\n'        var c = parseFloat(srcCosts[i].value) || 0;\\n' +\n'        totalAlloc += q;\\n' +\n'        totalCost += q * c;\\n' +\n'      }\\n'";

if (!src.includes(oldRecalcLoop)) {
  console.error('! Could not find recalcLine loop anchor (CHANGE 4)');
  process.exit(1);
}
src = src.replace(oldRecalcLoop, function(){ return newRecalcLoop; });
console.log('+ CHANGE 4: recalcLine only counts checked sources');

// =============================================================================
// CHANGE 5: Update submit-validation to only count CHECKED sources
// =============================================================================
const oldSubmitVal = "          var srcQtys = document.querySelectorAll(\".src-qty[data-line-idx=\\\\\"\"+lineIdx+\"\\\\\"]\");\\n' +\n'          var totalAlloc = 0;\\n' +\n'          for (var j=0; j<srcQtys.length; j++) totalAlloc += parseFloat(srcQtys[j].value) || 0;\\n'";

const newSubmitVal = "          var srcQtys = document.querySelectorAll(\".src-qty[data-line-idx=\\\\\"\"+lineIdx+\"\\\\\"]\");\\n' +\n'          var srcUses = document.querySelectorAll(\".src-use[data-line-idx=\\\\\"\"+lineIdx+\"\\\\\"]\");\\n' +\n'          var totalAlloc = 0;\\n' +\n'          // [Rewire 7] Only checked sources count\\n' +\n'          for (var j=0; j<srcQtys.length; j++) {\\n' +\n'            var isUsed = srcUses[j] ? srcUses[j].checked : true;\\n' +\n'            if (isUsed) totalAlloc += parseFloat(srcQtys[j].value) || 0;\\n' +\n'          }\\n'";

if (!src.includes(oldSubmitVal)) {
  console.error('! Could not find submit validation anchor (CHANGE 5)');
  process.exit(1);
}
src = src.replace(oldSubmitVal, function(){ return newSubmitVal; });
console.log('+ CHANGE 5: Submit validation only counts checked sources');

// =============================================================================
// CHANGE 6: Update saveQuote() server-side validation
// =============================================================================
// We need to:
//   - Validate only CHECKED sources sum to line qty
//   - Allow unchecked rows (alternates) to have any qty
//   - Calculate cost from CHECKED only
//   - Write all rows but mark is_selected based on checkbox
const oldSaveValidation = "    let allocSum = 0, costSum = 0;\n    sources.forEach(function(s, sIdx) {\n      const sq = parseInt(s.allocated_qty || 0);\n      const sc = parseFloat(s.unit_cost || 0);\n      if (!s.supplier_id) throw new Error('Line ' + lineNum + ' source ' + (sIdx + 1) + ': supplier required');\n      if (sq <= 0) throw new Error('Line ' + lineNum + ' source ' + (sIdx + 1) + ': allocated qty must be > 0');\n      if (sc < 0) throw new Error('Line ' + lineNum + ' source ' + (sIdx + 1) + ': cost cannot be negative');\n      allocSum += sq;\n      costSum += sq * sc;\n    });\n    if (allocSum !== lineQty) throw new Error('Line ' + lineNum + ': sources allocate ' + allocSum + ' but line qty is ' + lineQty);";

const newSaveValidation = "    // [Rewire 7] Validate only CHECKED (selected) sources sum to line qty\n    let allocSum = 0, costSum = 0, selectedCount = 0;\n    sources.forEach(function(s, sIdx) {\n      const sq = parseInt(s.allocated_qty || 0);\n      const sc = parseFloat(s.unit_cost || 0);\n      const isUsed = s.is_selected === '1' || s.is_selected === 1 || s.is_selected === true;\n      if (!s.supplier_id) throw new Error('Line ' + lineNum + ' source ' + (sIdx + 1) + ': supplier required');\n      if (sq <= 0) throw new Error('Line ' + lineNum + ' source ' + (sIdx + 1) + ': allocated qty must be > 0');\n      if (sc < 0) throw new Error('Line ' + lineNum + ' source ' + (sIdx + 1) + ': cost cannot be negative');\n      if (isUsed) {\n        allocSum += sq;\n        costSum += sq * sc;\n        selectedCount++;\n      }\n    });\n    if (selectedCount === 0) throw new Error('Line ' + lineNum + ': at least one supplier must be marked Use (checked)');\n    if (allocSum !== lineQty) throw new Error('Line ' + lineNum + ': checked sources allocate ' + allocSum + ' but line qty is ' + lineQty);";

if (!src.includes(oldSaveValidation)) {
  console.error('! Could not find save validation anchor (CHANGE 6)');
  process.exit(1);
}
src = src.replace(oldSaveValidation, function(){ return newSaveValidation; });
console.log('+ CHANGE 6: Server save validates only checked sources');

// =============================================================================
// CHANGE 7: Update INSERT INTO quote_line_sources to set is_selected based on checkbox
// =============================================================================
const oldInsert = "        .input('so', sql.Int, sortOrder++)\n        .query(\"INSERT INTO quote_line_sources (quote_line_id, supplier_id, allocated_qty, unit_cost, supplier_lead_time_days, has_8130, has_coc, has_trace, notes, sort_order) VALUES (@qli, @sid, @aq, @uc, @ld, @h81, @hcoc, @htr, @nt, @so)\");";

// Note: quote_line_sources table doesn't have is_selected column - we add via migration in CHANGE 8 below.
// For now, we add it to the table via a separate migration script that user runs.
// Here we just insert as before; "alternate" rows will be visible in DB but not used in cost.
// Actually let's just write all rows - the validation already excluded unchecked from totals.

// Even simpler: add is_selected as a new column to quote_line_sources OR use an existing field.
// Looking at sourcing_quotes table, it has is_selected BIT. Let's add same to quote_line_sources.

// We'll inject column add via runtime ALTER (idempotent) before inserts.

const oldSourcesLoopStart = "    let sortOrder = 1;\n    for (const s of pl.sources) {";
const newSourcesLoopStart = "    // [Rewire 7] Ensure is_selected column exists on quote_line_sources\n    try {\n      await pool.request().query(\"IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('quote_line_sources') AND name='is_selected') ALTER TABLE quote_line_sources ADD is_selected BIT NOT NULL DEFAULT 1\");\n    } catch(e) { console.error('is_selected col check:', e.message); }\n    let sortOrder = 1;\n    for (const s of pl.sources) {";

if (!src.includes(oldSourcesLoopStart)) {
  console.error('! Could not find sources loop start anchor (CHANGE 7a)');
  process.exit(1);
}
src = src.replace(oldSourcesLoopStart, function(){ return newSourcesLoopStart; });
console.log('+ CHANGE 7a: is_selected column auto-add at save time');

// Now update the INSERT to include is_selected
const oldInsertFull = ".query(\"INSERT INTO quote_line_sources (quote_line_id, supplier_id, allocated_qty, unit_cost, supplier_lead_time_days, has_8130, has_coc, has_trace, notes, sort_order) VALUES (@qli, @sid, @aq, @uc, @ld, @h81, @hcoc, @htr, @nt, @so)\");";

const newInsertFull = ".input('issel', sql.Bit, (s.is_selected === '1' || s.is_selected === 1 || s.is_selected === true) ? 1 : 0)\n        .query(\"INSERT INTO quote_line_sources (quote_line_id, supplier_id, allocated_qty, unit_cost, supplier_lead_time_days, has_8130, has_coc, has_trace, notes, sort_order, is_selected) VALUES (@qli, @sid, @aq, @uc, @ld, @h81, @hcoc, @htr, @nt, @so, @issel)\");";

if (!src.includes(oldInsertFull)) {
  console.error('! Could not find INSERT statement anchor (CHANGE 7b)');
  process.exit(1);
}
src = src.replace(oldInsertFull, function(){ return newInsertFull; });
console.log('+ CHANGE 7b: INSERT now includes is_selected');

// =============================================================================
// CHANGE 8: Add visual hint at top of sources section about bid behavior
// =============================================================================
const oldHint = "lineGroupsHtml += '<div style=\"font-size:.7rem;color:#7a8a9a;\">Sum allocated qty must equal line qty <span class=\"alloc-status\" data-line-idx=\"' + lineIdx + '\"></span></div>';";
const newHint = "lineGroupsHtml += '<div style=\"font-size:.7rem;color:#7a8a9a;\">Add all bids you got. Check USE for the winners. Sum of USED qty must equal line qty <span class=\"alloc-status\" data-line-idx=\"' + lineIdx + '\"></span></div>';";

if (src.includes(oldHint)) {
  src = src.replace(oldHint, function(){ return newHint; });
  console.log('+ CHANGE 8: Updated hint text');
}

// =============================================================================
// Write + verify
// =============================================================================
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
console.log('Now: git add -A && git commit -m "Rewire 7: ..." && git push');
