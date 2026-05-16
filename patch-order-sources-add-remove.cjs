// patch-order-sources-add-remove.cjs
// Order Lines tab > Edit Sources panel: allow Add new source + Remove existing
// sources, with a warning if a source already has a PO. Mirrors the Edit Quote
// sources combobox pattern.

const fs = require('fs');
const { execSync } = require('child_process');

function compile(file) {
  try { execSync('node -c "' + file + '"', { stdio: 'pipe' }); return true; }
  catch (err) { return err.stderr ? err.stderr.toString() : err.message; }
}

// ============================================================
// PIECE 1: orderLinesBlock.js — load suppliers list + render combobox per source
// (replace the read-only text supplier input with a combo) + Add Source button
// + Remove (x) button per row with warning if PO'd.
// ============================================================
{
  const f = 'admin/orderLinesBlock.js';
  const orig = fs.readFileSync(f, 'utf8');
  let s = orig;

  if (s.includes('ORDER_SOURCES_ADDREMOVE_V1')) {
    console.log('- orderLinesBlock already patched');
  } else {
    // Add supplier loading at top of function (after _sourcesMap loading)
    const sourcesMapEnd = "} catch (err) { console.error('Sources load error:', err.message); }";
    if (!s.includes(sourcesMapEnd)) {
      console.error('! sourcesMap end anchor not found');
      process.exit(1);
    }

    const supplierLoad = sourcesMapEnd + "\r\n  // ORDER_SOURCES_ADDREMOVE_V1: load suppliers for combobox\r\n  let _supplierList = [];\r\n  try {\r\n    const _pool2 = await getPool();\r\n    const _supR = await _pool2.request().query(\"SELECT id, company_name FROM suppliers WHERE status='Active' ORDER BY company_name ASC\");\r\n    _supplierList = _supR.recordset;\r\n  } catch (err) { console.error('Supplier list error:', err.message); }";
    s = s.replace(sourcesMapEnd, function() { return supplierLoad; });

    // ============================================================
    // Now rewrite the Edit Sources panel block. Find the existing
    // form block and replace it with the new combobox + add/remove version.
    // Anchor: `<form method="POST" action="/admin/orders/' + o.id + '/lines/' + l.id + '/sources-update">`
    // ============================================================
    // We'll find the start of the panel block and the end (the closing </div></div>
    // for the Edit Sources section, just before the action bar).

    const panelStart = "html += '<div id=\"srcedit-' + l.id + '\" style=\"display:none;margin-top:10px;padding-top:10px;border-top:1px dashed #1e2d42;\">';";
    const panelStartIdx = s.indexOf(panelStart);
    if (panelStartIdx < 0) {
      console.error('! Edit Sources panel start not found');
      process.exit(1);
    }

    // Find the panel end - look for "html += '</form></div></div>';" after panelStart
    const panelEndMarker = "html += '</form></div></div>';";
    const panelEndIdx = s.indexOf(panelEndMarker, panelStartIdx);
    if (panelEndIdx < 0) {
      console.error('! Edit Sources panel end not found');
      process.exit(1);
    }
    const panelEndAbs = panelEndIdx + panelEndMarker.length;

    // Build replacement. Render with combobox, Add Source button, Remove buttons.
    const replacement = [
      "html += '<div id=\"srcedit-' + l.id + '\" style=\"display:none;margin-top:10px;padding-top:10px;border-top:1px dashed #1e2d42;\">';",
      "      html += '<form method=\"POST\" action=\"/admin/orders/' + o.id + '/lines/' + l.id + '/sources-update\">';",
      "      html += '<div id=\"src-rows-' + l.id + '\">';",
      "      lineSources.forEach(function(src, idx) {",
      "        const poBadge = src.supplier_po_line_id ? '<span style=\"display:inline-block;padding:1px 6px;background:rgba(76,175,80,0.15);color:#4caf50;border-radius:2px;font-size:.6rem;margin-left:6px;\">\\u2713 PO\\'d</span>' : '';",
      "        const removeWarn = src.supplier_po_line_id ? 'if (!confirm(\\'This source has already been PO\\\\\\'d. Remove anyway?\\')) return false;' : '';",
      "        html += '<div data-srcrow=\"' + l.id + '_' + idx + '\" style=\"display:grid;grid-template-columns:1.5fr 0.5fr 0.7fr 1fr 0.4fr 0.4fr 0.4fr 0.3fr;gap:6px;margin-bottom:6px;align-items:end;\">';",
      "        html += '<input type=\"hidden\" name=\"src_' + idx + '_id\" value=\"' + src.id + '\"/>';",
      "        html += '<input type=\"hidden\" name=\"src_' + idx + '_pold\" value=\"' + (src.supplier_po_line_id ? '1' : '0') + '\"/>';",
      "        html += '<div style=\"position:relative;\"><div style=\"font-size:.6rem;color:#7a8a9a;\">Supplier' + poBadge + '</div><input type=\"text\" class=\"src-combo\" data-target=\"sup_' + l.id + '_' + idx + '\" value=\"' + (src.supplier_name || '').replace(/\"/g, '&quot;') + '\" placeholder=\"Type to search...\" autocomplete=\"off\" style=\"width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 22px 5px 8px;font-size:.76rem;\"/><div style=\"position:absolute;right:6px;top:22px;color:#c8932a;pointer-events:none;font-size:.65rem;\">\\u25BC</div><div class=\"src-dropdown\" style=\"display:none;position:absolute;top:100%;left:0;right:0;background:#0a1628;border:1px solid #c8932a;border-top:none;max-height:180px;overflow-y:auto;z-index:1000;\"></div><input type=\"hidden\" id=\"sup_' + l.id + '_' + idx + '\" name=\"src_' + idx + '_supplier_id\" value=\"' + src.supplier_id + '\" required/></div>';",
      "        html += '<div><div style=\"font-size:.6rem;color:#7a8a9a;\">Qty</div><input type=\"number\" min=\"1\" name=\"src_' + idx + '_qty\" value=\"' + src.allocated_qty + '\" style=\"width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 6px;font-size:.76rem;\"/></div>';",
      "        html += '<div><div style=\"font-size:.6rem;color:#7a8a9a;\">Unit Cost</div><input type=\"number\" step=\"0.01\" name=\"src_' + idx + '_cost\" value=\"' + parseFloat(src.unit_cost || 0).toFixed(2) + '\" style=\"width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 6px;font-size:.76rem;\"/></div>';",
      "        html += '<div><div style=\"font-size:.6rem;color:#7a8a9a;\">Lead</div><input type=\"text\" name=\"src_' + idx + '_lead\" value=\"' + ((src.lead_time_text || '').toString().replace(/\"/g, '&quot;')) + '\" placeholder=\"5 days\" style=\"width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 6px;font-size:.76rem;\"/></div>';",
      "        html += '<div><div style=\"font-size:.6rem;color:#7a8a9a;\">8130</div><input type=\"checkbox\" name=\"src_' + idx + '_8130\" value=\"1\"' + (src.has_8130_required ? ' checked' : '') + '/></div>';",
      "        html += '<div><div style=\"font-size:.6rem;color:#7a8a9a;\">CoC</div><input type=\"checkbox\" name=\"src_' + idx + '_coc\" value=\"1\"' + (src.has_coc_required ? ' checked' : '') + '/></div>';",
      "        html += '<div><div style=\"font-size:.6rem;color:#7a8a9a;\">Trace</div><input type=\"checkbox\" name=\"src_' + idx + '_trace\" value=\"1\"' + (src.has_trace_required ? ' checked' : '') + '/></div>';",
      "        html += '<div><button type=\"button\" onclick=\"' + removeWarn + ' this.closest(&quot;[data-srcrow]&quot;).remove();\" style=\"background:#3b1d1d;border:1px solid #5a2828;color:#e05050;padding:4px 8px;cursor:pointer;border-radius:3px;\">\\u2716</button></div>';",
      "        html += '</div>';",
      "      });",
      "      html += '</div>';",
      "      html += '<input type=\"hidden\" name=\"src_count_initial\" value=\"' + lineSources.length + '\"/>';",
      "      html += '<button type=\"button\" onclick=\"addOrderSrcRow(' + l.id + ')\" style=\"background:rgba(200,147,42,0.1);border:1px solid #c8932a;color:#c8932a;padding:5px 12px;cursor:pointer;border-radius:3px;font-size:.75rem;margin-top:4px;\">+ Add Source</button>';",
      "      html += '<div style=\"display:flex;justify-content:flex-end;gap:8px;margin-top:8px;\"><button type=\"button\" onclick=\"document.getElementById(\\\\'srcedit-' + l.id + '\\\\').style.display=\\\\'none\\\\';\" class=\"btn btn-outline btn-sm\">Cancel</button><button type=\"submit\" class=\"btn btn-gold btn-sm\">Save Source Changes</button></div>';",
      "      html += '</form></div></div>';"
    ].join('\r\n      ');

    s = s.slice(0, panelStartIdx) + replacement + s.slice(panelEndAbs);

    // ============================================================
    // Add inline <script> at the very end of renderLinesTab — before final return
    // ============================================================
    const returnAnchor = "  return html;\r\n}";
    if (!s.includes(returnAnchor)) {
      // try LF
      const altReturn = "  return html;\n}";
      if (!s.includes(altReturn)) {
        console.error('! return anchor not found');
        process.exit(1);
      }
    }

    // Build the script (injected as a static string into html)
    // We use the same datalist-free combobox pattern from Edit Quote.
    const scriptInject = [
      "  // ORDER_SOURCES_ADDREMOVE_V1: inject combobox + add row script",
      "  html += '<script>';",
      "  html += 'window.__OSUPPLIERS = ' + JSON.stringify(_supplierList) + ';';",
      "  html += [",
      "    'function renderOSrcDropdown(combo, query) {',",
      "    '  var dd = combo.parentElement.querySelector(\".src-dropdown\");',",
      "    '  if (!dd) return;',",
      "    '  var q = (query || \"\").toLowerCase();',",
      "    '  var matches = window.__OSUPPLIERS.filter(function(s) { return !q || (s.company_name||\"\").toLowerCase().indexOf(q) !== -1; }).slice(0, 50);',",
      "    '  if (!matches.length) { dd.innerHTML = \\'<div style=\"padding:8px;color:#7a8a9a;font-size:.75rem;\">No suppliers match</div>\\'; dd.style.display = \"block\"; return; }',",
      "    '  dd.innerHTML = matches.map(function(s) { var name = (s.company_name||\"\").replace(/</g,\"&lt;\"); return \\'<div class=\"src-opt\" data-id=\"\\' + s.id + \\'\" data-name=\"\\' + name.replace(/\"/g, \"&quot;\") + \\'\" style=\"padding:5px 10px;cursor:pointer;font-size:.78rem;color:#eef1f5;border-bottom:1px solid #1e2d42;\">\\' + name + \\'</div>\\'; }).join(\"\");',",
      "    '  dd.style.display = \"block\";',",
      "    '}',",
      "    'document.addEventListener(\"focus\", function(e) {',",
      "    '  if (!e.target.classList || !e.target.classList.contains(\"src-combo\")) return;',",
      "    '  renderOSrcDropdown(e.target, e.target.value);',",
      "    '}, true);',",
      "    'document.addEventListener(\"input\", function(e) {',",
      "    '  if (!e.target.classList || !e.target.classList.contains(\"src-combo\")) return;',",
      "    '  var hid = document.getElementById(e.target.getAttribute(\"data-target\"));',",
      "    '  var match = window.__OSUPPLIERS.find(function(s) { return (s.company_name||\"\").toLowerCase() === e.target.value.trim().toLowerCase(); });',",
      "    '  if (hid) hid.value = match ? match.id : \"\";',",
      "    '  e.target.style.borderColor = match ? \"#4caf50\" : (e.target.value ? \"#e05050\" : \"#1e2d42\");',",
      "    '  renderOSrcDropdown(e.target, e.target.value);',",
      "    '});',",
      "    'document.addEventListener(\"click\", function(e) {',",
      "    '  var opt = e.target.closest && e.target.closest(\".src-opt\");',",
      "    '  if (opt) {',",
      "    '    var dd = opt.parentElement; var wrap = dd.parentElement;',",
      "    '    var input = wrap.querySelector(\".src-combo\");',",
      "    '    var hid = document.getElementById(input.getAttribute(\"data-target\"));',",
      "    '    input.value = opt.getAttribute(\"data-name\");',",
      "    '    if (hid) hid.value = opt.getAttribute(\"data-id\");',",
      "    '    input.style.borderColor = \"#4caf50\";',",
      "    '    dd.style.display = \"none\";',",
      "    '    return;',",
      "    '  }',",
      "    '  if (!e.target.classList || !e.target.classList.contains(\"src-combo\")) {',",
      "    '    document.querySelectorAll(\".src-dropdown\").forEach(function(dd) { dd.style.display = \"none\"; });',",
      "    '  }',",
      "    '});',",
      "    'window.addOrderSrcRow = function(lineId) {',",
      "    '  var container = document.getElementById(\"src-rows-\" + lineId);',",
      "    '  if (!container) return;',",
      "    '  var existing = container.querySelectorAll(\"[data-srcrow]\");',",
      "    '  var nextIdx = existing.length;',",
      "    '  var hidId = \"sup_\" + lineId + \"_\" + nextIdx + \"_new\";',",
      "    '  var div = document.createElement(\"div\");',",
      "    '  div.setAttribute(\"data-srcrow\", lineId + \"_\" + nextIdx);',",
      "    '  div.style.cssText = \"display:grid;grid-template-columns:1.5fr 0.5fr 0.7fr 1fr 0.4fr 0.4fr 0.4fr 0.3fr;gap:6px;margin-bottom:6px;align-items:end;\";',",
      "    '  div.innerHTML =',",
      "    '    \\'<input type=\"hidden\" name=\"src_\\' + nextIdx + \\'_id\" value=\"\"/>\\' +',",
      "    '    \\'<input type=\"hidden\" name=\"src_\\' + nextIdx + \\'_pold\" value=\"0\"/>\\' +',",
      "    '    \\'<div style=\"position:relative;\"><div style=\"font-size:.6rem;color:#7a8a9a;\">Supplier</div><input type=\"text\" class=\"src-combo\" data-target=\"\\' + hidId + \\'\" placeholder=\"Type to search...\" autocomplete=\"off\" style=\"width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 22px 5px 8px;font-size:.76rem;\"/><div style=\"position:absolute;right:6px;top:22px;color:#c8932a;pointer-events:none;font-size:.65rem;\">\\\\u25BC</div><div class=\"src-dropdown\" style=\"display:none;position:absolute;top:100%;left:0;right:0;background:#0a1628;border:1px solid #c8932a;border-top:none;max-height:180px;overflow-y:auto;z-index:1000;\"></div><input type=\"hidden\" id=\"\\' + hidId + \\'\" name=\"src_\\' + nextIdx + \\'_supplier_id\" required/></div>\\' +',",
      "    '    \\'<div><div style=\"font-size:.6rem;color:#7a8a9a;\">Qty</div><input type=\"number\" min=\"1\" name=\"src_\\' + nextIdx + \\'_qty\" value=\"1\" required style=\"width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 6px;font-size:.76rem;\"/></div>\\' +',",
      "    '    \\'<div><div style=\"font-size:.6rem;color:#7a8a9a;\">Unit Cost</div><input type=\"number\" step=\"0.01\" name=\"src_\\' + nextIdx + \\'_cost\" required style=\"width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 6px;font-size:.76rem;\"/></div>\\' +',",
      "    '    \\'<div><div style=\"font-size:.6rem;color:#7a8a9a;\">Lead</div><input type=\"text\" name=\"src_\\' + nextIdx + \\'_lead\" placeholder=\"5 days\" style=\"width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 6px;font-size:.76rem;\"/></div>\\' +',",
      "    '    \\'<div><div style=\"font-size:.6rem;color:#7a8a9a;\">8130</div><input type=\"checkbox\" name=\"src_\\' + nextIdx + \\'_8130\" value=\"1\"/></div>\\' +',",
      "    '    \\'<div><div style=\"font-size:.6rem;color:#7a8a9a;\">CoC</div><input type=\"checkbox\" name=\"src_\\' + nextIdx + \\'_coc\" value=\"1\"/></div>\\' +',",
      "    '    \\'<div><div style=\"font-size:.6rem;color:#7a8a9a;\">Trace</div><input type=\"checkbox\" name=\"src_\\' + nextIdx + \\'_trace\" value=\"1\"/></div>\\' +',",
      "    '    \\'<div><button type=\"button\" onclick=\"this.closest(\\\\\\'[data-srcrow]\\\\\\').remove();\" style=\"background:#3b1d1d;border:1px solid #5a2828;color:#e05050;padding:4px 8px;cursor:pointer;border-radius:3px;\">\\\\u2716</button></div>\\';',",
      "    '  container.appendChild(div);',",
      "    '};'",
      "  ].join(\"\\n\");",
      "  html += '<\\\\/script>';"
    ].join('\r\n');

    // Inject script before "return html;"
    const retIdx = s.indexOf("  return html;");
    if (retIdx < 0) {
      console.error('! return html anchor not found');
      process.exit(1);
    }
    s = s.slice(0, retIdx) + scriptInject + '\r\n\r\n' + s.slice(retIdx);

    fs.writeFileSync(f + '.osar.bak', orig);
    fs.writeFileSync(f, s);
    const r = compile(f);
    if (r !== true) {
      fs.writeFileSync(f, orig);
      console.error('! orderLinesBlock syntax: ' + r);
      process.exit(1);
    }
    console.log('+ orderLinesBlock: supplier combobox, Add Source, Remove buttons with PO warn');
  }
}

// ============================================================
// PIECE 2: Update POST /sources-update handler to also handle NEW rows
// (existing src_N_id can be empty for new rows; we INSERT instead of UPDATE)
// AND handle removals (existing src ids not in form = DELETE).
// ============================================================
{
  const f = 'admin/orderRoutes.js';
  const orig = fs.readFileSync(f, 'utf8');
  let s = orig;

  if (s.includes('SOURCES_ADDREM_V1')) {
    console.log('- orderRoutes already handles add/remove');
  } else {
    // Find the sources-update handler we built earlier and replace its body
    const handlerStart = "router.post('/orders/:id/lines/:lineId/sources-update'";
    const sIdx = s.indexOf(handlerStart);
    if (sIdx < 0) {
      console.error('! sources-update handler not found');
      process.exit(1);
    }
    // Walk to find handler end
    let depth = 0, started = false, eIdx = -1;
    for (let i = sIdx; i < s.length; i++) {
      const c = s[i];
      if (c === '{') { depth++; started = true; }
      else if (c === '}') { depth--; if (started && depth === 0) {
        while (i < s.length && s[i] !== '\n') i++;
        eIdx = i + 1; break;
      }}
    }
    if (eIdx < 0) {
      console.error('! could not find sources-update handler end');
      process.exit(1);
    }

    const newHandler = [
      "router.post('/orders/:id/lines/:lineId/sources-update', async (req, res) => {",
      "    if (!requireAuth(req, res)) return;",
      "    try {",
      "      // SOURCES_ADDREM_V1: handle add/edit/remove",
      "      const pool = await getPool();",
      "      const b = req.body;",
      "      const orderId = parseInt(req.params.id);",
      "      const lineId = parseInt(req.params.lineId);",
      "",
      "      // Collect all src_N_* form entries grouped by N",
      "      const groups = {};",
      "      Object.keys(b).forEach(function(key) {",
      "        const m = key.match(/^src_(\\d+)_(.+)$/);",
      "        if (!m) return;",
      "        const n = m[1];",
      "        if (!groups[n]) groups[n] = {};",
      "        groups[n][m[2]] = b[key];",
      "      });",
      "",
      "      // Track which existing source IDs were submitted",
      "      const submittedIds = new Set();",
      "      let totalQty = 0, totalCost = 0;",
      "",
      "      for (const n of Object.keys(groups)) {",
      "        const g = groups[n];",
      "        const existingId = g.id ? parseInt(g.id) : null;",
      "        const supId = g.supplier_id ? parseInt(g.supplier_id) : null;",
      "        const qty = parseInt(g.qty) || 0;",
      "        const cost = parseFloat(g.cost) || 0;",
      "        const lead = g.lead || null;",
      "        const h8 = g['8130'] === '1' ? 1 : 0;",
      "        const hc = g.coc === '1' ? 1 : 0;",
      "        const ht = g.trace === '1' ? 1 : 0;",
      "",
      "        if (!supId) continue;  // skip rows with no supplier picked",
      "",
      "        totalQty += qty;",
      "        totalCost += qty * cost;",
      "",
      "        if (existingId) {",
      "          // UPDATE existing source",
      "          submittedIds.add(existingId);",
      "          await pool.request()",
      "            .input('id', sql.BigInt, existingId)",
      "            .input('supId', sql.BigInt, supId)",
      "            .input('qty', sql.Int, qty)",
      "            .input('cost', sql.Decimal(10,2), cost)",
      "            .input('lead', sql.NVarChar(sql.MAX), lead)",
      "            .input('h8', sql.Bit, h8)",
      "            .input('hc', sql.Bit, hc)",
      "            .input('ht', sql.Bit, ht)",
      "            .query('UPDATE order_line_sources SET supplier_id=@supId, allocated_qty=@qty, unit_cost=@cost, lead_time_text=@lead, has_8130_required=@h8, has_coc_required=@hc, has_trace_required=@ht, updated_at=GETDATE() WHERE id=@id');",
      "        } else {",
      "          // INSERT new source",
      "          await pool.request()",
      "            .input('olid', sql.BigInt, lineId)",
      "            .input('supId', sql.BigInt, supId)",
      "            .input('qty', sql.Int, qty)",
      "            .input('cost', sql.Decimal(10,2), cost)",
      "            .input('lead', sql.NVarChar(sql.MAX), lead)",
      "            .input('h8', sql.Bit, h8)",
      "            .input('hc', sql.Bit, hc)",
      "            .input('ht', sql.Bit, ht)",
      "            .input('so', sql.Int, parseInt(n))",
      "            .query('INSERT INTO order_line_sources (order_line_id, supplier_id, allocated_qty, unit_cost, lead_time_text, has_8130_required, has_coc_required, has_trace_required, sort_order, created_at) VALUES (@olid, @supId, @qty, @cost, @lead, @h8, @hc, @ht, @so, GETDATE())');",
      "        }",
      "      }",
      "",
      "      // Delete sources that existed before but weren't submitted (user clicked X)",
      "      // BUT only if they don't have a supplier_po_line_id (to keep historical accuracy)",
      "      // Actually: per user spec - allow remove with warning. Frontend already warned.",
      "      // So we DO delete even PO'd ones if removed.",
      "      const existingR = await pool.request().input('olid', sql.BigInt, lineId)",
      "        .query('SELECT id FROM order_line_sources WHERE order_line_id=@olid');",
      "      for (const row of existingR.recordset) {",
      "        if (!submittedIds.has(row.id)) {",
      "          await pool.request().input('id', sql.BigInt, row.id)",
      "            .query('DELETE FROM order_line_sources WHERE id=@id');",
      "        }",
      "      }",
      "",
      "      // Recompute line cost as weighted avg",
      "      const newLineUnitCost = totalQty > 0 ? totalCost / totalQty : 0;",
      "      await pool.request()",
      "        .input('id', sql.BigInt, lineId)",
      "        .input('uc', sql.Decimal(10,2), newLineUnitCost)",
      "        .query('UPDATE order_lines SET supplier_cost=@uc WHERE id=@id');",
      "",
      "      res.redirect('/admin/orders/' + orderId + '?tab=lines&saved=Sources+updated');",
      "    } catch (err) {",
      "      console.error('Sources update error:', err);",
      "      res.redirect('/admin/orders/' + req.params.id + '?tab=lines&error=' + encodeURIComponent(err.message));",
      "    }",
      "  });",
      ""
    ].join('\r\n  ');

    s = s.slice(0, sIdx) + newHandler + s.slice(eIdx);

    fs.writeFileSync(f + '.osar.bak', orig);
    fs.writeFileSync(f, s);
    const r = compile(f);
    if (r !== true) {
      fs.writeFileSync(f, orig);
      console.error('! orderRoutes syntax: ' + r);
      process.exit(1);
    }
    console.log('+ orderRoutes: sources-update handles INSERT new, UPDATE existing, DELETE removed');
  }
}

console.log('SUCCESS');
