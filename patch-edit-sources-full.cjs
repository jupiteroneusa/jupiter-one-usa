// patch-edit-sources-full.cjs
// On the Edit Quote page: make sources fully editable (edit/add/remove)
// On save: rebuild sources, recompute line unit_cost as weighted average from sources.

const fs = require('fs');
const { execSync } = require('child_process');

const f = 'admin/index.js';
const orig = fs.readFileSync(f, 'utf8');
let s = orig;

if (s.includes('SOURCES_FULL_EDIT_V1')) {
  console.log('- already patched');
  process.exit(0);
}

// ========================================================================
// PART A: Replace the read-only sources display in the edit form with
// editable rows + an "Add Source" button.
// ========================================================================

// The current block starts with a fixed string. Find it and replace via function.
const oldReadOnlyBlockStart = "        if (srcs.length) {";
const oldReadOnlyBlockEnd = "          html += '</div>';\r\n        }";

// Match the whole read-only block. We need to find ONE occurrence inside the edit handler.
// Anchor more precisely by looking for the comment containing "read-only here":
const probe = "Sources (read-only here";
const probeIdx = s.indexOf(probe);
if (probeIdx < 0) {
  console.error('! could not find "Sources (read-only" probe in edit form');
  process.exit(1);
}
// Walk backward to find "if (srcs.length) {" before this point
const blockStartIdx = s.lastIndexOf("if (srcs.length) {", probeIdx);
if (blockStartIdx < 0) {
  console.error('! could not find srcs.length guard before probe');
  process.exit(1);
}
// Walk forward from probeIdx to find the closing "});\r\n        }" structure.
// The block is: forEach loop, then html += '</div>' close-tag, then `}`.
// Let's find the unique end marker: the next "});" after probeIdx + ~300 chars,
// followed by "html += '</div>';" then "}".
const forEachEnd = s.indexOf("});", probeIdx);
if (forEachEnd < 0) {
  console.error('! could not find forEach close');
  process.exit(1);
}
// After forEachEnd, find the next html += '</div>' that closes the sources wrapper:
const closeDivIdx = s.indexOf("html += '</div>';", forEachEnd);
if (closeDivIdx < 0) {
  console.error('! could not find close </div>');
  process.exit(1);
}
// Then find the next standalone "}" that closes the if block
const ifCloseIdx = s.indexOf("}", closeDivIdx + 17);
if (ifCloseIdx < 0) {
  console.error('! could not find if-block close');
  process.exit(1);
}
const blockEndIdx = ifCloseIdx + 1; // include the }

// Build replacement: editable sources block. Each existing source becomes editable.
// Also show an "Add Source" button. Removed rows just won't be submitted.
const replacement = [
  "// SOURCES_FULL_EDIT_V1",
  "        html += '<div style=\"margin-top:10px;padding-top:8px;border-top:1px dashed #1e2d42;\"><div style=\"font-size:.65rem;color:#c8932a;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px;\">Sources (editable)</div>';",
  "        html += '<div id=\"srcs-line-' + l.id + '\">';",
  "        var srcs = srcsByLine[l.id] || [];",
  "        srcs.forEach(function(src, sIdx) {",
  "          var rk = l.id + '_' + sIdx;",
  "          html += '<div data-srcrow=\"' + rk + '\" style=\"display:grid;grid-template-columns:1.5fr 0.5fr 0.7fr 1fr 0.5fr 0.5fr 0.5fr 0.3fr;gap:6px;align-items:end;margin-bottom:6px;padding:6px;background:#0e1828;border:1px solid #1e2d42;border-radius:3px;\">';",
  "          html += '<input type=\"hidden\" name=\"line_' + l.id + '_src_' + sIdx + '[id]\" value=\"' + src.id + '\"/>';",
  "          html += '<div><div style=\"font-size:.6rem;color:#7a8a9a;margin-bottom:2px;\">Supplier ID</div><input type=\"number\" name=\"line_' + l.id + '_src_' + sIdx + '[supplier_id]\" value=\"' + src.supplier_id + '\" required title=\"' + (src.supplier_name || '') + '\" style=\"width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;\"/><div style=\"font-size:.65rem;color:#7a8a9a;margin-top:2px;\">' + (src.supplier_name || 'unknown') + '</div></div>';",
  "          html += '<div><div style=\"font-size:.6rem;color:#7a8a9a;margin-bottom:2px;\">Qty</div><input type=\"number\" min=\"1\" name=\"line_' + l.id + '_src_' + sIdx + '[allocated_qty]\" value=\"' + (src.allocated_qty || 1) + '\" required style=\"width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;\"/></div>';",
  "          html += '<div><div style=\"font-size:.6rem;color:#7a8a9a;margin-bottom:2px;\">Unit Cost</div><input type=\"number\" step=\"0.01\" name=\"line_' + l.id + '_src_' + sIdx + '[unit_cost]\" value=\"' + parseFloat(src.unit_cost || 0).toFixed(2) + '\" required style=\"width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;\"/></div>';",
  "          html += '<div><div style=\"font-size:.6rem;color:#7a8a9a;margin-bottom:2px;\">Lead Time</div><input type=\"text\" name=\"line_' + l.id + '_src_' + sIdx + '[lead_time_text]\" value=\"' + ((src.lead_time_text || '').toString().replace(/\"/g, '&quot;')) + '\" placeholder=\"e.g. 5 days\" style=\"width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;\"/></div>';",
  "          html += '<div><div style=\"font-size:.6rem;color:#7a8a9a;margin-bottom:2px;\">8130</div><input type=\"checkbox\" name=\"line_' + l.id + '_src_' + sIdx + '[has_8130]\" value=\"1\"' + (src.has_8130 ? ' checked' : '') + '/></div>';",
  "          html += '<div><div style=\"font-size:.6rem;color:#7a8a9a;margin-bottom:2px;\">CoC</div><input type=\"checkbox\" name=\"line_' + l.id + '_src_' + sIdx + '[has_coc]\" value=\"1\"' + (src.has_coc ? ' checked' : '') + '/></div>';",
  "          html += '<div><div style=\"font-size:.6rem;color:#7a8a9a;margin-bottom:2px;\">Trace</div><input type=\"checkbox\" name=\"line_' + l.id + '_src_' + sIdx + '[has_trace]\" value=\"1\"' + (src.has_trace ? ' checked' : '') + '/></div>';",
  "          html += '<div><button type=\"button\" onclick=\"this.closest(&quot;[data-srcrow]&quot;).remove();\" style=\"background:#3b1d1d;border:1px solid #5a2828;color:#e05050;padding:5px 8px;cursor:pointer;border-radius:3px;\">&#x2716;</button></div>';",
  "          html += '</div>';",
  "        });",
  "        html += '</div>';",
  "        html += '<button type=\"button\" onclick=\"addSrcRow(' + l.id + ')\" style=\"background:rgba(200,147,42,0.1);border:1px solid #c8932a;color:#c8932a;padding:5px 12px;cursor:pointer;border-radius:3px;font-size:.78rem;\">+ Add Source</button>';",
  "        html += '</div>';",
  "        var srcCount = srcs.length;",
  "        html += '<input type=\"hidden\" name=\"line_' + l.id + '_src_count_initial\" value=\"' + srcCount + '\"/>';"
].join('\r\n');

s = s.slice(0, blockStartIdx) + replacement + s.slice(blockEndIdx);

// ========================================================================
// PART B: Add JS for addSrcRow + supplier dropdown loading.
// Inject just before the </form> close in the edit form.
// ========================================================================
const formCloseAnchor = "html += '</div></form>';";
if (!s.includes(formCloseAnchor)) {
  console.error('! form close anchor not found');
  process.exit(1);
}

const jsBlock = [
  "// SOURCES_FULL_EDIT_V1 - JS for adding new source rows",
  "      html += '<script>';",
  "      html += 'window.addSrcRow = function(lineId) {';",
  "      html += '  var container = document.getElementById(\"srcs-line-\" + lineId);';",
  "      html += '  if (!container) return;';",
  "      html += '  var existing = container.querySelectorAll(\"[data-srcrow]\");';",
  "      html += '  var nextIdx = existing.length;';",
  "      html += '  while (document.querySelector(\"[data-srcrow=\\\\\\\"\" + lineId + \"_\" + nextIdx + \"\\\\\\\"]\")) nextIdx++;';",
  "      html += '  var prefix = \"line_\" + lineId + \"_src_\" + nextIdx;';",
  "      html += '  var div = document.createElement(\"div\");';",
  "      html += '  div.setAttribute(\"data-srcrow\", lineId + \"_\" + nextIdx);';",
  "      html += '  div.style.cssText = \"display:grid;grid-template-columns:1.5fr 0.5fr 0.7fr 1fr 0.5fr 0.5fr 0.5fr 0.3fr;gap:6px;align-items:end;margin-bottom:6px;padding:6px;background:#0e1828;border:1px solid #1e2d42;border-radius:3px;\";';",
  "      html += '  div.innerHTML =';",
  "      html += '    \\'<input type=\"hidden\" name=\"\\' + prefix + \\'[id]\" value=\"\"/>\\' +';",
  "      html += '    \\'<div><div style=\"font-size:.6rem;color:#7a8a9a;margin-bottom:2px;\">Supplier ID</div><input type=\"number\" name=\"\\' + prefix + \\'[supplier_id]\" required placeholder=\"id\" style=\"width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;\"/></div>\\' +';",
  "      html += '    \\'<div><div style=\"font-size:.6rem;color:#7a8a9a;margin-bottom:2px;\">Qty</div><input type=\"number\" min=\"1\" name=\"\\' + prefix + \\'[allocated_qty]\" value=\"1\" required style=\"width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;\"/></div>\\' +';",
  "      html += '    \\'<div><div style=\"font-size:.6rem;color:#7a8a9a;margin-bottom:2px;\">Unit Cost</div><input type=\"number\" step=\"0.01\" name=\"\\' + prefix + \\'[unit_cost]\" required style=\"width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;\"/></div>\\' +';",
  "      html += '    \\'<div><div style=\"font-size:.6rem;color:#7a8a9a;margin-bottom:2px;\">Lead Time</div><input type=\"text\" name=\"\\' + prefix + \\'[lead_time_text]\" placeholder=\"5 days\" style=\"width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;\"/></div>\\' +';",
  "      html += '    \\'<div><div style=\"font-size:.6rem;color:#7a8a9a;margin-bottom:2px;\">8130</div><input type=\"checkbox\" name=\"\\' + prefix + \\'[has_8130]\" value=\"1\"/></div>\\' +';",
  "      html += '    \\'<div><div style=\"font-size:.6rem;color:#7a8a9a;margin-bottom:2px;\">CoC</div><input type=\"checkbox\" name=\"\\' + prefix + \\'[has_coc]\" value=\"1\"/></div>\\' +';",
  "      html += '    \\'<div><div style=\"font-size:.6rem;color:#7a8a9a;margin-bottom:2px;\">Trace</div><input type=\"checkbox\" name=\"\\' + prefix + \\'[has_trace]\" value=\"1\"/></div>\\' +';",
  "      html += '    \\'<div><button type=\"button\" onclick=\"this.closest(\\\\\\'[data-srcrow]\\\\\\').remove();\" style=\"background:#3b1d1d;border:1px solid #5a2828;color:#e05050;padding:5px 8px;cursor:pointer;border-radius:3px;\">\\\\u2716</button></div>\\';';",
  "      html += '  container.appendChild(div);';",
  "      html += '};';",
  "      html += '<\\\\/script>';",
  "      "
].join('\r\n');

s = s.replace(formCloseAnchor, function() { return jsBlock + formCloseAnchor; });

// ========================================================================
// PART C: In POST /quotes/:id/edit-save, rebuild sources from form data.
// Insert source rebuild logic right BEFORE the line-loop's UPDATE quote_lines,
// or after the loop. Easiest: in the line-loop, parse line_<lid>_src_<i> rows,
// compute weighted avg unit_cost, then use that as the line uc.
// ========================================================================
const oldLineLoopHeader = "      for (const ln of editLines) {";
const newLineLoopHeader = [
  "      // SOURCES_FULL_EDIT_V1: collect submitted sources keyed by line id",
  "      const _srcsByLine = {};",
  "      Object.keys(b).forEach(function(k) {",
  "        var m = k.match(/^line_(\\d+)_src_(\\d+)$/);",
  "        if (!m) return;",
  "        var lid = parseInt(m[1]);",
  "        if (!_srcsByLine[lid]) _srcsByLine[lid] = [];",
  "        var data = b[k];",
  "        if (!data || typeof data !== 'object') return;",
  "        _srcsByLine[lid].push({",
  "          id: data.id ? parseInt(data.id) : null,",
  "          supplier_id: data.supplier_id ? parseInt(data.supplier_id) : null,",
  "          allocated_qty: data.allocated_qty ? parseInt(data.allocated_qty) : 0,",
  "          unit_cost: data.unit_cost ? parseFloat(data.unit_cost) : 0,",
  "          lead_time_text: data.lead_time_text || null,",
  "          has_8130: data.has_8130 === '1' ? 1 : 0,",
  "          has_coc: data.has_coc === '1' ? 1 : 0,",
  "          has_trace: data.has_trace === '1' ? 1 : 0",
  "        });",
  "      });",
  "      for (const ln of editLines) {"
].join('\r\n');

if (!s.includes(oldLineLoopHeader)) {
  console.error('! edit-save line loop header not found');
  process.exit(1);
}
s = s.replace(oldLineLoopHeader, function() { return newLineLoopHeader; });

// Then inside the loop, before computing lineTotal, override `uc` with weighted avg
// from submitted sources for that line.
const oldUcAssign = "        const uc = parseFloat(ln.unit_cost) || 0;";
const newUcAssign = [
  "        var uc = parseFloat(ln.unit_cost) || 0;",
  "        // SOURCES_FULL_EDIT_V1: recompute uc from sources if any submitted",
  "        var _srcs = _srcsByLine[parseInt(ln.id)] || [];",
  "        if (_srcs.length) {",
  "          var totalQty = 0, totalCost = 0;",
  "          _srcs.forEach(function(s2) { totalQty += s2.allocated_qty; totalCost += s2.allocated_qty * s2.unit_cost; });",
  "          if (totalQty > 0) uc = totalCost / totalQty;",
  "        }"
].join('\r\n');

if (!s.includes(oldUcAssign)) {
  console.error('! uc assignment line not found');
  process.exit(1);
}
s = s.replace(oldUcAssign, function() { return newUcAssign; });

// Then after the UPDATE quote_lines query inside the loop, rebuild sources.
// Find the .query('UPDATE quote_lines SET ... WHERE id=@id'); line, add source rebuild AFTER it.
const oldUpdateQuoteLine = ".query('UPDATE quote_lines SET nsn=@nsn, part_number=@pn, item_name=@iname, condition_code=@cond, quantity=@qty, unit_cost=@uc, unit_price=@up, line_total=@lt, line_cost=@lc, line_margin=@lm, margin_pct=@mpct, markup_pct=@mkp, lead_time_text=@ltt WHERE id=@id');";
const sourceRebuild = [
  oldUpdateQuoteLine,
  "        // SOURCES_FULL_EDIT_V1: rebuild quote_line_sources for this line",
  "        await pool.request().input('qlid', sql.BigInt, parseInt(ln.id))",
  "          .query('DELETE FROM quote_line_sources WHERE quote_line_id=@qlid');",
  "        var _sortOrder = 1;",
  "        for (const src of _srcs) {",
  "          if (!src.supplier_id) continue;",
  "          await pool.request()",
  "            .input('qlid2', sql.BigInt, parseInt(ln.id))",
  "            .input('sid', sql.BigInt, src.supplier_id)",
  "            .input('aq', sql.Int, src.allocated_qty)",
  "            .input('uc2', sql.Decimal(10,2), src.unit_cost)",
  "            .input('ltt2', sql.NVarChar(sql.MAX), src.lead_time_text)",
  "            .input('h81', sql.Bit, src.has_8130)",
  "            .input('hcoc', sql.Bit, src.has_coc)",
  "            .input('htr', sql.Bit, src.has_trace)",
  "            .input('so', sql.Int, _sortOrder++)",
  "            .query('INSERT INTO quote_line_sources (quote_line_id, supplier_id, allocated_qty, unit_cost, lead_time_text, has_8130, has_coc, has_trace, sort_order, is_selected) VALUES (@qlid2, @sid, @aq, @uc2, @ltt2, @h81, @hcoc, @htr, @so, 1)');",
  "        }"
].join('\r\n');

if (!s.includes(oldUpdateQuoteLine)) {
  console.error('! UPDATE quote_lines anchor not found');
  process.exit(1);
}
s = s.replace(oldUpdateQuoteLine, function() { return sourceRebuild; });

fs.writeFileSync(f + '.srcedit.bak', orig);
fs.writeFileSync(f, s);

try {
  execSync('node -c "' + f + '"', { stdio: 'pipe' });
  console.log('+ Sources fully editable: edit, add, remove on Edit Quote page');
  console.log('+ Source-cost changes recompute line unit_cost as weighted avg');
  console.log('+ JS adds "Add Source" button per line');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(f, orig);
  console.error('! syntax error - REVERTED');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
