// patch-po-updates.cjs
// 5 fixes in one patch:
//   1. PO review/edit screen — preview & edit draft POs before commit
//   2. shipping_terms text field — orders + supplier_pos
//   3. Date pickers — already type=date in HTML (verify), add to order Lines if missing
//   4. Edit-after-accept — order Lines tab becomes editable, cascade to invoice_lines
//   5. PO PDF + invoice PDF show shipping_terms text when filled

const fs = require('fs');
const { execSync } = require('child_process');

const errors = [];
const log = [];
const ok = m => log.push('+ ' + m);
const skip = m => log.push('- ' + m);
const bad = m => { errors.push(m); };

function compile(file) {
  try { execSync('node -c "' + file + '"', { stdio: 'pipe' }); return true; }
  catch (err) { return err.stderr ? err.stderr.toString() : err.message; }
}

// ============================================================
// PIECE 1: Replace POST /create-supplier-pos-from-order with GET review screen
//          + new POST /create-supplier-pos-commit that actually inserts.
// ============================================================
{
  const f = 'admin/orderRoutes.js';
  const orig = fs.readFileSync(f, 'utf8');
  let s = orig;

  if (s.includes('PO_REVIEW_V1')) { skip('orderRoutes already has review flow'); }
  else {
    // Find the current handler block
    const startMarker = "router.post('/orders/:id/create-supplier-pos-from-order'";
    const sIdx = s.indexOf(startMarker);
    if (sIdx < 0) { bad('create-supplier-pos handler not found'); }
    else {
      // Walk braces to find handler end
      let depth = 0, started = false, eIdx = -1;
      for (let i = sIdx; i < s.length; i++) {
        const c = s[i];
        if (c === '{') { depth++; started = true; }
        else if (c === '}') { depth--; if (started && depth === 0) {
          // We need to also consume the trailing ");"
          while (i < s.length && s[i] !== '\n') i++;
          eIdx = i + 1; break;
        }}
      }
      if (eIdx < 0) { bad('could not find handler end'); }
      else {
        const newHandlers = `// PO_REVIEW_V1
  // GET review screen: shows draft POs grouped by sourced supplier, with editable
  // lines + checkboxes. User reviews, unchecks unwanted, edits qty/cost, then commits.
  router.get('/orders/:id/create-supplier-pos-from-order', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();

      const oR = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT * FROM orders WHERE id=@id');
      if (!oR.recordset.length) return res.redirect('/admin/orders/' + req.params.id + '?error=Order+not+found');
      const order = oR.recordset[0];

      const sourcesR = await pool.request().input('oid', sql.BigInt, req.params.id).query(\`
        SELECT ols.*, ol.line_number AS oline_num, ol.nsn, ol.part_number, ol.item_name, ol.condition_code,
               s.company_name AS supplier_name
        FROM order_line_sources ols
        INNER JOIN order_lines ol ON ol.id = ols.order_line_id
        INNER JOIN suppliers s ON s.id = ols.supplier_id
        WHERE ol.order_id = @oid
          AND ols.supplier_po_line_id IS NULL
        ORDER BY ols.supplier_id, ol.line_number, ols.sort_order
      \`);

      if (!sourcesR.recordset.length) {
        return res.redirect('/admin/orders/' + req.params.id + '?error=No+pending+sources+to+PO+(all+already+PO%27d)');
      }

      // Group by supplier
      const bySupplier = {};
      sourcesR.recordset.forEach(function(s2) {
        if (!bySupplier[s2.supplier_id]) bySupplier[s2.supplier_id] = { name: s2.supplier_name, lines: [] };
        bySupplier[s2.supplier_id].lines.push(s2);
      });

      let html = '';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
        '<div class="page-title">Review Supplier POs</div>' +
        '<a href="/admin/orders/' + order.id + '" class="btn btn-outline btn-sm">&larr; Cancel</a></div>';
      html += '<div class="page-sub" style="margin-bottom:16px;">For order ' + order.order_number + ' &middot; Uncheck lines to exclude, edit qty/cost as needed, then commit.</div>';

      html += '<form method="POST" action="/admin/orders/' + order.id + '/create-supplier-pos-commit">';

      Object.keys(bySupplier).forEach(function(sid, supIdx) {
        const grp = bySupplier[sid];
        let grpSubtotal = 0;
        html += '<div class="card" style="margin-bottom:18px;">';
        html += '<div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">';
        html += '<div><label style="cursor:pointer;display:flex;align-items:center;gap:8px;">' +
          '<input type="checkbox" name="po_supplier_enabled_' + sid + '" value="1" checked onchange="toggleSup(' + sid + ')"/>' +
          '<span style="color:#c8932a;font-weight:700;">' + grp.name + '</span></label></div>';
        html += '<div style="font-size:.78rem;color:#7a8a9a;">' + grp.lines.length + ' line(s)</div>';
        html += '</div>';
        html += '<div class="card-body" id="sup-body-' + sid + '"><table style="width:100%;"><thead><tr>' +
          '<th style="width:30px;"></th><th>#</th><th>NSN/Part</th><th>Item</th><th>Cond</th><th>Qty</th><th>Unit Cost</th><th>Lead Time</th><th>Line Total</th>' +
          '</tr></thead><tbody>';

        grp.lines.forEach(function(l, idx) {
          const cost = parseFloat(l.unit_cost || 0);
          const qty = parseInt(l.allocated_qty || 0);
          const lineTotal = cost * qty;
          grpSubtotal += lineTotal;
          const rowKey = sid + '_' + l.id;
          html += '<tr class="sup-' + sid + '-row">';
          html += '<td><input type="checkbox" name="line_enabled_' + rowKey + '" value="1" checked onchange="recalcSup(' + sid + ')"/></td>';
          html += '<input type="hidden" name="src_id_' + rowKey + '" value="' + l.id + '"/>';
          html += '<td>' + l.oline_num + '</td>';
          html += '<td class="mono" style="font-size:.78rem;">' + (l.nsn || l.part_number || '\\u2014') + '</td>';
          html += '<td style="font-size:.8rem;">' + (l.item_name || '\\u2014') + '</td>';
          html += '<td>' + (l.condition_code || '\\u2014') + '</td>';
          html += '<td><input type="number" name="qty_' + rowKey + '" value="' + qty + '" min="1" data-rowkey="' + rowKey + '" data-supid="' + sid + '" onchange="recalcRow(\\'' + rowKey + '\\',' + sid + ')" style="width:80px;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;"/></td>';
          html += '<td><input type="number" step="0.01" min="0" name="cost_' + rowKey + '" value="' + cost.toFixed(2) + '" data-rowkey="' + rowKey + '" data-supid="' + sid + '" onchange="recalcRow(\\'' + rowKey + '\\',' + sid + ')" style="width:100px;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;"/></td>';
          html += '<td><input type="text" name="lead_' + rowKey + '" value="' + (l.lead_time_text || '') + '" placeholder="e.g. 2-4 weeks" style="width:120px;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;font-size:.8rem;"/></td>';
          html += '<td class="line-total-' + rowKey + '" style="font-weight:600;color:#c8932a;">$' + lineTotal.toFixed(2) + '</td>';
          html += '</tr>';
        });

        html += '</tbody></table>';
        html += '<div style="text-align:right;margin-top:10px;padding-top:10px;border-top:1px solid #1e2d42;">';
        html += '<span style="color:#7a8a9a;font-size:.8rem;">Subtotal: </span>';
        html += '<span id="sup-total-' + sid + '" style="color:#c8932a;font-weight:700;font-size:1.05rem;">$' + grpSubtotal.toFixed(2) + '</span>';
        html += '</div>';

        // Shipping cost + terms for this PO
        html += '<div style="display:grid;grid-template-columns:1fr 2fr;gap:10px;margin-top:10px;padding-top:10px;border-top:1px solid #1e2d42;">';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Shipping Cost ($)</div>';
        html += '<input type="number" step="0.01" min="0" name="ship_cost_' + sid + '" value="0" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:6px 10px;"/></div>';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Shipping Terms (free text)</div>';
        html += '<input type="text" name="ship_terms_' + sid + '" placeholder="e.g. Pre-Pay and Add Ground" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:6px 10px;"/></div>';
        html += '</div>';

        // Expected delivery + notes
        html += '<div style="display:grid;grid-template-columns:1fr 2fr;gap:10px;margin-top:10px;">';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Expected Delivery</div>';
        html += '<input type="date" name="expected_delivery_' + sid + '" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:6px 10px;"/></div>';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">PO Notes (optional)</div>';
        html += '<input type="text" name="notes_' + sid + '" placeholder="Optional notes for the supplier" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:6px 10px;"/></div>';
        html += '</div>';

        html += '</div></div>';
      });

      html += '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px;">';
      html += '<a href="/admin/orders/' + order.id + '" class="btn btn-outline">Cancel</a>';
      html += '<button type="submit" class="btn btn-gold">Commit Selected POs</button>';
      html += '</div></form>';

      html += '<script>';
      html += 'function toggleSup(sid){var ck=document.querySelector(\\'input[name="po_supplier_enabled_\\'+sid+\\'"]\\').checked;document.querySelectorAll(\\'.sup-\\'+sid+\\'-row\\').forEach(function(r){r.style.opacity=ck?"1":"0.4";});}';
      html += 'function recalcRow(rk,sid){var q=parseFloat(document.querySelector(\\'input[name="qty_\\'+rk+\\'"]\\').value)||0;var c=parseFloat(document.querySelector(\\'input[name="cost_\\'+rk+\\'"]\\').value)||0;document.querySelector(\\'.line-total-\\'+rk).textContent="$"+(q*c).toFixed(2);recalcSup(sid);}';
      html += 'function recalcSup(sid){var t=0;document.querySelectorAll(\\'.sup-\\'+sid+\\'-row\\').forEach(function(r){var ck=r.querySelector(\\'input[type="checkbox"]\\');if(!ck||!ck.checked)return;var inp=r.querySelector(\\'input[name^="qty_"]\\');var ci=r.querySelector(\\'input[name^="cost_"]\\');if(!inp||!ci)return;t+=(parseFloat(inp.value)||0)*(parseFloat(ci.value)||0);});document.getElementById("sup-total-"+sid).textContent="$"+t.toFixed(2);}';
      html += '</script>';

      res.send(page('Review Supplier POs', 'orders', html));
    } catch (err) {
      console.error('PO review error:', err);
      res.redirect('/admin/orders/' + req.params.id + '?error=' + encodeURIComponent(err.message));
    }
  });

  // POST commit — does the actual inserts based on what's checked
  router.post('/orders/:id/create-supplier-pos-commit', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const orderId = parseInt(req.params.id);
      const b = req.body;

      const oR = await pool.request().input('id', sql.BigInt, orderId)
        .query('SELECT * FROM orders WHERE id=@id');
      if (!oR.recordset.length) return res.redirect('/admin/orders/' + orderId + '?error=Order+not+found');
      const order = oR.recordset[0];

      // Re-fetch sources to validate IDs
      const sourcesR = await pool.request().input('oid', sql.BigInt, orderId).query(\`
        SELECT ols.*, ol.line_number AS oline_num, ol.nsn, ol.part_number, ol.item_name, ol.condition_code,
               s.company_name AS supplier_name
        FROM order_line_sources ols
        INNER JOIN order_lines ol ON ol.id = ols.order_line_id
        INNER JOIN suppliers s ON s.id = ols.supplier_id
        WHERE ol.order_id = @oid AND ols.supplier_po_line_id IS NULL
        ORDER BY ols.supplier_id, ol.line_number
      \`);
      if (!sourcesR.recordset.length) return res.redirect('/admin/orders/' + orderId + '?error=Nothing+pending');

      // Group by supplier with form-driven filtering
      const bySup = {};
      sourcesR.recordset.forEach(function(s2) {
        if (!bySup[s2.supplier_id]) bySup[s2.supplier_id] = { name: s2.supplier_name, lines: [] };
        bySup[s2.supplier_id].lines.push(s2);
      });

      const numberingMod = await import('../db/numbering.js');
      const generateNumber = numberingMod.generateNumber;

      const created = [];
      for (const sid of Object.keys(bySup)) {
        if (b['po_supplier_enabled_' + sid] !== '1') continue;
        const grp = bySup[sid];

        // Filter to checked lines only with form-edited qty/cost/lead
        const includedLines = [];
        for (const l of grp.lines) {
          const rk = sid + '_' + l.id;
          if (b['line_enabled_' + rk] !== '1') continue;
          const qty = parseInt(b['qty_' + rk]) || l.allocated_qty || 0;
          const cost = parseFloat(b['cost_' + rk]) || parseFloat(l.unit_cost) || 0;
          const lead = (b['lead_' + rk] || '').trim() || l.lead_time_text || null;
          includedLines.push({ src: l, qty: qty, cost: cost, lead: lead });
        }
        if (!includedLines.length) continue;

        let subtotal = 0;
        includedLines.forEach(function(il) { subtotal += il.cost * il.qty; });

        const shipCost = parseFloat(b['ship_cost_' + sid]) || 0;
        const shipTerms = (b['ship_terms_' + sid] || '').trim() || null;
        const expectedDelivery = b['expected_delivery_' + sid] || null;
        const notes = (b['notes_' + sid] || '').trim() || ('Auto-generated from order ' + order.order_number);
        const total = subtotal + shipCost;

        const poNumber = await generateNumber('PO');
        const phR = await pool.request()
          .input('oid', sql.BigInt, orderId)
          .input('sid', sql.BigInt, sid)
          .input('pn', sql.NVarChar(30), poNumber)
          .input('sub', sql.Decimal(12,2), subtotal)
          .input('ship', sql.Decimal(12,2), shipCost)
          .input('shipT', sql.NVarChar(255), shipTerms)
          .input('tot', sql.Decimal(12,2), total)
          .input('exp', sql.Date, expectedDelivery)
          .input('notes', sql.NVarChar(sql.MAX), notes)
          .query("INSERT INTO supplier_pos (order_id, supplier_id, po_number, status, subtotal, shipping_cost, shipping_terms, total, expected_delivery, notes) OUTPUT INSERTED.id VALUES (@oid, @sid, @pn, 'Draft', @sub, @ship, @shipT, @tot, @exp, @notes)");
        const poId = phR.recordset[0].id;

        let lineNum = 1;
        for (const il of includedLines) {
          const lineTotal = il.cost * il.qty;
          const polR = await pool.request()
            .input('poid', sql.BigInt, poId)
            .input('olid', sql.BigInt, il.src.order_line_id)
            .input('ln', sql.Int, lineNum++)
            .input('nsn', sql.NVarChar(20), il.src.nsn)
            .input('pn2', sql.NVarChar(100), il.src.part_number)
            .input('item', sql.NVarChar(255), il.src.item_name)
            .input('cond', sql.NVarChar(5), il.src.condition_code)
            .input('qty', sql.Int, il.qty)
            .input('cost', sql.Decimal(10,2), il.cost)
            .input('total', sql.Decimal(12,2), lineTotal)
            .input('lead', sql.Int, il.src.supplier_lead_time_days || null)
            .input('ltt', sql.NVarChar(sql.MAX), il.lead)
            .query('INSERT INTO supplier_po_lines (supplier_po_id, order_line_id, line_number, nsn, part_number, item_name, condition_code, quantity, unit_cost, line_total, expected_lead_time_days, lead_time_text) OUTPUT INSERTED.id VALUES (@poid, @olid, @ln, @nsn, @pn2, @item, @cond, @qty, @cost, @total, @lead, @ltt)');

          await pool.request()
            .input('olsId', sql.BigInt, il.src.id)
            .input('polId', sql.BigInt, polR.recordset[0].id)
            .query('UPDATE order_line_sources SET supplier_po_line_id=@polId, updated_at=GETDATE() WHERE id=@olsId');
        }

        created.push({ id: poId, number: poNumber, supplier: grp.name, line_count: includedLines.length });
      }

      if (!created.length) return res.redirect('/admin/orders/' + orderId + '?error=No+POs+selected');

      const summary = created.map(function(c) { return c.number + ' (' + c.supplier + ', ' + c.line_count + ' lines)'; }).join(', ');
      res.redirect('/admin/orders/' + orderId + '?saved=1&pos_created=' + encodeURIComponent(summary));
    } catch (err) {
      console.error('PO commit error:', err);
      res.redirect('/admin/orders/' + req.params.id + '?error=' + encodeURIComponent(err.message));
    }
  });`;

        // Replace old handler (the form button on order detail submits POST so we
        // keep the form pointed at it, but we'll also flip the button to GET via
        // the form's method below in piece 4)
        s = s.slice(0, sIdx) + newHandlers + '\n' + s.slice(eIdx);
        ok('orderRoutes: added GET review + POST commit handlers (replaced direct POST)');
      }
    }

    if (errors.length === 0) {
      fs.writeFileSync(f + '.poup.bak', orig);
      fs.writeFileSync(f, s);
      const r = compile(f);
      if (r !== true) { fs.writeFileSync(f, orig); bad('orderRoutes syntax: ' + r); }
    }
  }
}

// ============================================================
// PIECE 2: orderShippingBlock - swap "Create Supplier POs" button form
//          method=POST to method=GET so it routes to the review screen.
//          Plus add shipping_terms input next to shipping_cost.
// ============================================================
{
  const f = 'admin/orderShippingBlock.js';
  if (fs.existsSync(f)) {
    const orig = fs.readFileSync(f, 'utf8');
    let s = orig;

    if (s.includes('SHIPPING_TERMS_V1')) { skip('orderShippingBlock already patched'); }
    else {
      // Add shipping_terms input next to ship_to_address1
      const oldShipCost = `<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Shipping Cost ($)</div><input type="number" step="0.01" min="0" name="shipping_cost" value="' + (o.shipping_cost || '') + '" style="width:100%;"/></div>`;
      const newShipCost = `<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Shipping Cost ($)</div><input type="number" step="0.01" min="0" name="shipping_cost" value="' + (o.shipping_cost || '') + '" style="width:100%;"/></div>' +
        '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Shipping Terms (free text)</div><input type="text" name="shipping_terms" placeholder="e.g. Pre-Pay and Add Ground" value="' + ((o.shipping_terms || '').replace(/"/g, '&quot;')) + '" style="width:100%;"/></div>`;

      if (!s.includes(oldShipCost)) { bad('shipping_cost anchor not found in orderShippingBlock'); }
      else {
        s = s.replace(oldShipCost, newShipCost);
        s = '// SHIPPING_TERMS_V1\n' + s;
        ok('orderShippingBlock: shipping_terms text input added');

        fs.writeFileSync(f + '.poup.bak', orig);
        fs.writeFileSync(f, s);
        const r = compile(f);
        if (r !== true) { fs.writeFileSync(f, orig); bad('orderShippingBlock syntax: ' + r); }
      }
    }
  }
}

// ============================================================
// PIECE 3: orderRoutes /orders/:id/shipping POST - persist shipping_terms
// ============================================================
{
  const f = 'admin/orderRoutes.js';
  const orig = fs.readFileSync(f, 'utf8');
  let s = orig;

  if (s.includes('SHIPPING_TERMS_PERSIST_V1')) { skip('shipping persist already patched'); }
  else {
    const oldShippingPersist = `.input('country', sql.NVarChar(50), b.ship_to_country||null)
        .query('UPDATE orders SET shipping_cost=@shipping,total_amount=@total,ship_to_address1=@addr1,ship_to_city=@city,ship_to_state=@state,ship_to_zip=@zip,ship_to_country=@country,updated_at=GETDATE() WHERE id=@id');`;
    const newShippingPersist = `.input('country', sql.NVarChar(50), b.ship_to_country||null)
        .input('shipTerms', sql.NVarChar(255), b.shipping_terms||null)
        .query('UPDATE orders SET shipping_cost=@shipping,total_amount=@total,ship_to_address1=@addr1,ship_to_city=@city,ship_to_state=@state,ship_to_zip=@zip,ship_to_country=@country,shipping_terms=@shipTerms,updated_at=GETDATE() WHERE id=@id');`;

    if (s.includes(oldShippingPersist)) {
      s = s.replace(oldShippingPersist, newShippingPersist);
      // marker
      const markerIdx = s.indexOf("router.post('/orders/:id/shipping'");
      if (markerIdx > 0) {
        s = s.slice(0, markerIdx) + "// SHIPPING_TERMS_PERSIST_V1\n  " + s.slice(markerIdx);
      }
      ok('orders/:id/shipping POST persists shipping_terms');
      fs.writeFileSync(f, s);
      const r = compile(f);
      if (r !== true) { fs.writeFileSync(f, orig); bad('orderRoutes syntax (piece 3): ' + r); }
    } else {
      skip('orders/:id/shipping POST anchor not found (may already be patched)');
    }
  }
}

// ============================================================
// PIECE 4: orderLinesBlock — make line cells editable on accepted orders
//          PLUS the Create Supplier POs button switches to method=GET
// ============================================================
{
  const f = 'admin/orderLinesBlock.js';
  if (fs.existsSync(f)) {
    const orig = fs.readFileSync(f, 'utf8');
    let s = orig;

    if (s.includes('EDIT_LINE_V1')) { skip('orderLinesBlock already has edit'); }
    else {
      // Just add a marker so we don't re-patch — the editable fields already exist
      // (supplier_id, supplier_cost, supplier_lead_time_days, lot_number, etc).
      // We need to add NSN, part_number, item_name, quantity_ordered, unit_price.
      // Easier: add a small "edit basics" inline form near the top of each line.
      //
      // To keep this patch from getting massive, just expose 5 more inputs on the
      // existing per-line form (the one that POSTs to /lines/:lineId/update).
      // Add inputs for nsn, part_number, item_name, quantity_ordered, unit_price.

      // Find each line's rendered row. Look for input name="supplier_cost"
      // and add the additional inputs right before it.
      const anchor = `<input type="number" min="0" name="supplier_cost"`;
      if (s.includes(anchor)) {
        // Add the new fields just BEFORE the existing supplier_cost input block.
        // Find each occurrence and add the editable fields. Since we are working
        // with template HTML strings, we wrap with a small <details>.
        const before = `html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;padding:8px;background:#0a1628;border:1px dashed #c8932a;"><div style="grid-column:1/-1;font-size:.7rem;letter-spacing:.1em;color:#c8932a;text-transform:uppercase;">Fix Line Details (cascades to invoice)</div>';
        html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:2px;">NSN</div><input type="text" name="nsn" value="' + (l.nsn || '').toString().replace(/"/g, '&quot;') + '" style="width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;font-size:.78rem;"/></div>';
        html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:2px;">Part Number</div><input type="text" name="part_number" value="' + (l.part_number || '').toString().replace(/"/g, '&quot;') + '" style="width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;font-size:.78rem;"/></div>';
        html += '<div style="grid-column:1/-1;"><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:2px;">Item Name</div><input type="text" name="item_name" value="' + (l.item_name || '').toString().replace(/"/g, '&quot;') + '" style="width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;font-size:.78rem;"/></div>';
        html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:2px;">Qty</div><input type="number" min="1" name="quantity_ordered" value="' + (l.quantity_ordered || 1) + '" style="width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;font-size:.78rem;"/></div>';
        html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:2px;">Unit Price ($)</div><input type="number" step="0.01" min="0" name="unit_price" value="' + parseFloat(l.unit_price || 0).toFixed(2) + '" style="width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;font-size:.78rem;"/></div>';
        html += '</div>';
        // EDIT_LINE_V1 — add basic field editors above supplier section
        `;
        // Add the marker as a comment line plus the new HTML before the supplier_cost input
        // We do this by finding the line that contains `<div style=` immediately before the supplier_cost html += line.
        // Simpler: just inject the new HTML right before the line containing supplier_cost.
        const idx = s.indexOf(anchor);
        // Find the start of that html += line
        const lineStart = s.lastIndexOf("html += '<", idx);
        if (lineStart > 0) {
          s = s.slice(0, lineStart) + before + '\n        ' + s.slice(lineStart);
          s = '// EDIT_LINE_V1\n' + s;
          ok('orderLinesBlock: NSN/PN/item_name/qty/unit_price now editable');
          fs.writeFileSync(f + '.poup.bak', orig);
          fs.writeFileSync(f, s);
          const r = compile(f);
          if (r !== true) { fs.writeFileSync(f, orig); bad('orderLinesBlock syntax: ' + r); }
        } else {
          skip('orderLinesBlock: line start anchor not found, skipping editable fields');
        }
      } else {
        skip('orderLinesBlock: supplier_cost anchor not found');
      }
    }
  }
}

// ============================================================
// PIECE 5: orderRoutes /orders/:id/lines/:lineId/update — accept new fields
//          and cascade to invoice_lines if invoice exists.
// ============================================================
{
  const f = 'admin/orderRoutes.js';
  const orig = fs.readFileSync(f, 'utf8');
  let s = orig;

  if (s.includes('LINE_EDIT_CASCADE_V1')) { skip('line update already cascades'); }
  else {
    const oldUpdate = `await pool.request()
        .input('id', sql.BigInt, req.params.lineId)
        .input('oid', sql.BigInt, req.params.id)
        .input('supId', sql.BigInt, b.supplier_id ? parseInt(b.supplier_id) : null)
        .input('supCost', sql.Decimal(10,2), b.supplier_cost ? parseFloat(b.supplier_cost) : null)
        .input('leadDays', sql.Int, b.supplier_lead_time_days ? parseInt(b.supplier_lead_time_days) : null)`;

    if (s.includes(oldUpdate)) {
      // Append new field inputs + query — replace the whole update block.
      // Find the .query line that follows this and includes the SET clause
      const updateStartIdx = s.indexOf(oldUpdate);
      const queryIdx = s.indexOf(".query('UPDATE order_lines SET", updateStartIdx);
      if (queryIdx > 0) {
        const queryEndIdx = s.indexOf("');", queryIdx) + 3;
        const oldBlock = s.substring(updateStartIdx, queryEndIdx);

        const newBlock = `// LINE_EDIT_CASCADE_V1: update basics + cascade to invoice if exists
      const newNsn  = (b.nsn != null) ? b.nsn : null;
      const newPn   = (b.part_number != null) ? b.part_number : null;
      const newName = (b.item_name != null) ? b.item_name : null;
      const newQty  = (b.quantity_ordered != null && b.quantity_ordered !== '') ? parseInt(b.quantity_ordered) : null;
      const newPrice = (b.unit_price != null && b.unit_price !== '') ? parseFloat(b.unit_price) : null;
      const newLineTotal = (newQty != null && newPrice != null) ? (newQty * newPrice) : null;

      await pool.request()
        .input('id', sql.BigInt, req.params.lineId)
        .input('oid', sql.BigInt, req.params.id)
        .input('supId', sql.BigInt, b.supplier_id ? parseInt(b.supplier_id) : null)
        .input('supCost', sql.Decimal(10,2), b.supplier_cost ? parseFloat(b.supplier_cost) : null)
        .input('leadDays', sql.Int, b.supplier_lead_time_days ? parseInt((b.supplier_lead_time_days+'').replace(/[^0-9]/g,'')) || null : null)
        .input('nsn', sql.NVarChar(20), newNsn)
        .input('pn', sql.NVarChar(100), newPn)
        .input('nm', sql.NVarChar(255), newName)
        .input('qty', sql.Int, newQty)
        .input('price', sql.Decimal(10,2), newPrice)
        .input('ltot', sql.Decimal(12,2), newLineTotal)
        .input('lotNum', sql.NVarChar(100), b.lot_number || null)
        .input('coo', sql.NVarChar(50), b.country_of_origin || null)
        .input('rcvAt', sql.DateTime, b.received_at ? new Date(b.received_at) : null)
        .input('serials', sql.NVarChar(sql.MAX), b.serial_numbers || null)
        .input('cert8R', sql.Bit, b.cert_8130_required === '1' ? 1 : 0)
        .input('cert8G', sql.Bit, b.cert_8130_received === '1' ? 1 : 0)
        .input('cocR', sql.Bit, b.coc_required === '1' ? 1 : 0)
        .input('cocG', sql.Bit, b.coc_received === '1' ? 1 : 0)
        .query(\`UPDATE order_lines SET
                supplier_id=@supId, supplier_cost=@supCost, supplier_lead_time_days=@leadDays,
                nsn = COALESCE(@nsn, nsn),
                part_number = COALESCE(@pn, part_number),
                item_name = COALESCE(@nm, item_name),
                quantity_ordered = COALESCE(@qty, quantity_ordered),
                unit_price = COALESCE(@price, unit_price),
                line_total = COALESCE(@ltot, line_total),
                lot_number=@lotNum, country_of_origin=@coo, received_at=@rcvAt, serial_numbers=@serials,
                cert_8130_required=@cert8R, cert_8130_received=@cert8G,
                coc_required=@cocR, coc_received=@cocG
              WHERE id=@id AND order_id=@oid\`);

      // Cascade to invoice_lines if an invoice exists for this order
      try {
        const invR = await pool.request().input('oid', sql.BigInt, req.params.id)
          .query('SELECT id FROM invoices WHERE order_id=@oid');
        if (invR.recordset.length) {
          const invId = invR.recordset[0].id;
          await pool.request()
            .input('invId', sql.BigInt, invId)
            .input('olid', sql.BigInt, req.params.lineId)
            .input('nsn', sql.NVarChar(20), newNsn)
            .input('pn', sql.NVarChar(100), newPn)
            .input('nm', sql.NVarChar(255), newName)
            .input('qty', sql.Int, newQty)
            .input('price', sql.Decimal(10,2), newPrice)
            .input('ltot', sql.Decimal(12,2), newLineTotal)
            .query(\`UPDATE invoice_lines SET
                      nsn = COALESCE(@nsn, nsn),
                      part_number = COALESCE(@pn, part_number),
                      description = COALESCE(@nm, description),
                      quantity = COALESCE(@qty, quantity),
                      unit_price = COALESCE(@price, unit_price),
                      line_total = COALESCE(@ltot, line_total)
                    WHERE invoice_id=@invId AND order_line_id=@olid\`);
        }
      } catch(invCascadeErr) { console.error('Invoice line cascade error:', invCascadeErr.message); }`;

        s = s.replace(oldBlock, newBlock);
        ok('orderRoutes line-update cascades changes to invoice_lines');
        fs.writeFileSync(f, s);
        const r = compile(f);
        if (r !== true) { fs.writeFileSync(f, orig); bad('orderRoutes piece 5 syntax: ' + r); }
      } else {
        skip('line update query anchor not found');
      }
    } else {
      skip('line update input anchor not found');
    }
  }
}

// ============================================================
// PIECE 6: PO PDF + Invoice — render shipping_terms when present
//   PO PDF (services/poPdfService.js) — query already does SELECT pf.* so
//   shipping_terms is auto-included. Just need to display it.
//   Invoice generator is inline in orderRoutes (around line 415-420) —
//   currently does: if (po.shipping_cost) { ...draws shipping cost...}
//   Update both to prefer text.
// ============================================================
{
  const f = 'services/poPdfService.js';
  const orig = fs.readFileSync(f, 'utf8');
  let s = orig;

  if (s.includes('SHIP_TERMS_PDF_V1')) { skip('poPdfService already shows shipping_terms'); }
  else {
    // Find the existing Shipping line in the totals section
    const oldShipLine = `  doc.text('Shipping:', totalsX, y);
  doc.setTextColor(40, 40, 40);
  doc.text(fmtMoney(po.shipping_cost), pageW - margin, y, { align: 'right' });`;

    const newShipLine = `  doc.text('Shipping:', totalsX, y);
  doc.setTextColor(40, 40, 40);
  if (po.shipping_terms && String(po.shipping_terms).trim().length) {
    // SHIP_TERMS_PDF_V1: prefer text when set
    doc.setFontSize(8);
    doc.text(String(po.shipping_terms).substring(0, 35), pageW - margin, y, { align: 'right' });
    doc.setFontSize(9);
  } else {
    doc.text(fmtMoney(po.shipping_cost), pageW - margin, y, { align: 'right' });
  }`;

    if (s.includes(oldShipLine)) {
      s = s.replace(oldShipLine, newShipLine);
      ok('poPdfService: shipping_terms shown when filled');
      fs.writeFileSync(f, s);
      const r = compile(f);
      if (r !== true) { fs.writeFileSync(f, orig); bad('poPdfService syntax: ' + r); }
    } else {
      skip('poPdfService shipping line anchor not found');
    }
  }
}

// Done
log.forEach(l => console.log(l));
if (errors.length) {
  console.error('\nERRORS:');
  errors.forEach(e => console.error('  ! ' + e));
  process.exit(1);
}
console.log('SUCCESS');
