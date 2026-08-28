// ORDERLINES_REWRITE_V1
import { currency, statusBadge } from './uiHelpers.js';
import { getPool, sql } from '../db/connect.js';

export async function renderLinesTab(o, oLines, suppliers) {
  let _sourcesMap = {};
  try {
    const pool = await getPool();
    const ids = (oLines.recordset || oLines).map(function(l) { return l.id; }).filter(Boolean);
    if (ids.length) {
      const r = await pool.request().query(
        "SELECT ols.*, s.company_name AS supplier_name FROM order_line_sources ols " +
        "JOIN suppliers s ON s.id = ols.supplier_id " +
        "WHERE ols.order_line_id IN (" + ids.join(',') + ") " +
        "ORDER BY ols.order_line_id, ols.sort_order"
      );
      r.recordset.forEach(function(src) {
        if (!_sourcesMap[src.order_line_id]) _sourcesMap[src.order_line_id] = [];
        _sourcesMap[src.order_line_id].push(src);
      });
    }
  } catch (err) { console.error('Sources load error:', err.message); }
  // ORDER_SOURCES_ADDREMOVE_V2: load suppliers for combobox
  let _supplierList = [];
  try {
    const _pool2 = await getPool();
    const _supR = await _pool2.request().query("SELECT id, company_name FROM suppliers WHERE status='Active' ORDER BY company_name ASC");
    _supplierList = _supR.recordset;
  } catch (err) { console.error('Supplier list error:', err.message); }

  let html = '';
  html += '<div class="card" style="margin-bottom:16px;"><div class="card-header" style="display:flex;justify-content:space-between;align-items:center;"><span>Order Line Items (' + oLines.recordset.length + ')</span></div>';

  if (oLines.recordset.length === 0) {
    html += '<div style="padding:24px;text-align:center;color:#7a8a9a;">No line items.</div></div>';

  }

  html += '<div style="padding:16px;">';

  /* LINE_PROFIT_v1: order-wide profit accumulators (sourced portions only) */
  var _ordSourcedRev = 0, _ordSourcedCost = 0;
  oLines.recordset.forEach(function(l) {
    const lineSources = _sourcesMap[l.id] || [];
    const hasPending = lineSources.some(function(s) { return !s.supplier_po_line_id; });
    const allPoed = lineSources.length > 0 && lineSources.every(function(s) { return s.supplier_po_line_id; });

    html += '<div style="border:1px solid #1e2d42;background:#0a1628;margin-bottom:16px;border-radius:4px;overflow:hidden;">';

    // Line header
    html += '<div style="padding:14px 16px;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;border-bottom:1px solid #1e2d42;">';
    html += '<div style="flex:1;min-width:240px;">';
    html += '<div style="font-size:.65rem;letter-spacing:.15em;text-transform:uppercase;color:#7a8a9a;">Line #' + l.line_number + '</div>';
    html += '<div style="font-family:monospace;color:#c8932a;font-size:1.05rem;font-weight:700;margin-top:2px;">' + (l.nsn || l.part_number || '—') + '</div>';
    html += '<div style="font-size:.88rem;color:#eef1f5;margin-top:2px;">' + (l.item_name || '—') + '</div>';
    html += '<div style="font-size:.72rem;color:#7a8a9a;margin-top:4px;">Condition: <strong style="color:#cfd5dc;">' + (l.condition_code || 'NE') + '</strong></div>';
    html += '</div>';
    html += '<div style="text-align:right;min-width:140px;">';
    html += '<div style="font-size:.65rem;letter-spacing:.15em;text-transform:uppercase;color:#7a8a9a;">Qty × Price</div>';
    html += '<div style="font-size:.95rem;color:#eef1f5;margin-top:2px;">' + l.quantity_ordered + ' × ' + currency(l.unit_price) + '</div>';
    html += '<div style="font-size:1.1rem;font-weight:700;color:#c8932a;margin-top:2px;">' + currency(l.line_total) + '</div>';
    /* LINE_PROFIT_v1: per-line margin from actual sources */
    (function(){
      if ((l.status || '') === 'Cancelled') { html += '<div style="font-size:.7rem;color:#7a8a9a;margin-top:3px;">Profit: &mdash; (cancelled)</div>'; return; }
      var _srcQty = 0, _srcCost = 0;
      lineSources.forEach(function(sx){ var q = parseFloat(sx.allocated_qty)||0; var c = parseFloat(sx.unit_cost)||0; _srcQty += q; _srcCost += q * c; });
      var _price = parseFloat(l.unit_price)||0;
      var _ordQty = parseFloat(l.quantity_ordered)||0;
      if (_srcQty <= 0) {
        html += '<div style="font-size:.7rem;color:#7a8a9a;margin-top:3px;">Profit: &mdash; not sourced</div>';
        return;
      }
      /* LINE_PROFIT_FIX_v2: revenue = price x ORDERED qty; cost = all sourced cost */
      var _rev = _price * _ordQty;
      var _profit = _rev - _srcCost;
      var _pct = _rev > 0 ? (_profit / _rev) * 100 : 0;
      _ordSourcedRev += _rev; _ordSourcedCost += _srcCost;
      var _under = _srcQty < _ordQty;
      var _col = _profit >= 0 ? '#4caf50' : '#e05050';
      html += '<div style="font-size:.72rem;margin-top:3px;color:' + _col + ';font-weight:600;">Profit: ' + _pct.toFixed(1) + '%' + (_under ? ' <span style="color:#e0a050;font-weight:400;">(under-sourced ' + _srcQty + '/' + _ordQty + ')</span>' : '') + ' <span style="color:#7a8a9a;font-weight:400;">&middot; ' + currency(_profit) + '</span></div>';
    })();
    html += '</div></div>';

    // Sources sub-row
    if (lineSources.length > 0) {
      const isSplit = lineSources.length > 1;
      html += '<div style="background:rgba(200,147,42,0.06);padding:10px 16px;border-bottom:1px solid #1e2d42;">';
      html += '<div style="font-size:.65rem;letter-spacing:.12em;text-transform:uppercase;color:#c8932a;margin-bottom:8px;font-weight:700;display:flex;justify-content:space-between;align-items:center;">';
      html += '<span>🔒 Sourcing' + (isSplit ? ' (' + lineSources.length + ' suppliers, split)' : '') + '</span>';
      html += '<button type="button" onclick="var d=document.getElementById(\'srcedit-' + l.id + '\');d.style.display=d.style.display===\'none\'?\'block\':\'none\';" style="background:transparent;border:1px solid #c8932a;color:#c8932a;padding:2px 10px;cursor:pointer;border-radius:3px;font-size:.65rem;">✎ Edit Sources</button>';
      html += '</div>';
      html += '<table style="width:100%;font-size:.78rem;color:#cfd5dc;border-collapse:collapse;"><thead><tr style="text-align:left;color:#7a8a9a;font-size:.66rem;">';
      html += '<th style="padding:4px 6px;">Supplier</th><th style="padding:4px 6px;">Qty</th><th style="padding:4px 6px;">Recv</th><th style="padding:4px 6px;">Unit Cost</th><th style="padding:4px 6px;">Line Cost</th><th style="padding:4px 6px;">Lead</th><th style="padding:4px 6px;text-align:center;">Certs</th><th style="padding:4px 6px;">PO</th>';
      html += '</tr></thead><tbody>';
      lineSources.forEach(function(src) {
        const full = (src.received_qty || 0) >= src.allocated_qty;
        const lineCost = src.line_cost || (src.allocated_qty * src.unit_cost) || 0;
        let certs = '';
        if (src.has_8130) certs += '<span style="display:inline-block;padding:1px 5px;background:rgba(76,175,80,0.15);color:#4caf50;border-radius:2px;font-size:.62rem;margin-right:2px;">8130</span>';
        if (src.has_coc) certs += '<span style="display:inline-block;padding:1px 5px;background:rgba(76,175,80,0.15);color:#4caf50;border-radius:2px;font-size:.62rem;margin-right:2px;">CoC</span>';
        if (src.has_trace) certs += '<span style="display:inline-block;padding:1px 5px;background:rgba(76,175,80,0.15);color:#4caf50;border-radius:2px;font-size:.62rem;">Trace</span>';
        if (!certs) certs = '<span style="color:#7a8a9a;">—</span>';
        html += '<tr style="border-top:1px solid rgba(30,45,66,0.5);">';
        html += '<td style="padding:6px;"><a href="/admin/suppliers/' + src.supplier_id + '" style="color:#c8932a;font-weight:600;">' + (src.supplier_name || '—') + '</a></td>';
        html += '<td style="padding:6px;font-weight:700;">' + src.allocated_qty + '</td>';
        html += '<td style="padding:6px;color:' + (full ? '#4caf50' : '#7a8a9a') + ';">' + (src.received_qty || 0) + '/' + src.allocated_qty + (full ? ' ✓' : '') + '</td>';
        html += '<td style="padding:6px;">$' + parseFloat(src.unit_cost || 0).toFixed(2) + '</td>';
        html += '<td style="padding:6px;font-weight:600;">$' + parseFloat(lineCost).toFixed(2) + '</td>';
        html += '<td style="padding:6px;color:#7a8a9a;">' + (src.lead_time_text || (src.supplier_lead_time_days ? src.supplier_lead_time_days + ' days' : '—')) + '</td>';
        html += '<td style="padding:6px;text-align:center;">' + certs + '</td>';
        html += '<td style="padding:6px;">' + (src.supplier_po_line_id ? '<span style="color:#4caf50;font-size:.72rem;">✓ PO\'d</span>' : '<span style="color:#7a8a9a;">Pending</span>') + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
    } /* FIX_LINE_SOURCES_v1: close read-only table block; panel now always renders */

    {
      // FIX_LINE_SOURCES_v1: edit panel ALWAYS renders (works for 0 or more sources)
      var _noSrc = (lineSources.length === 0);
      var _panelStyle = _noSrc ? 'display:block;margin-top:0;padding:10px 16px;border-bottom:1px solid #1e2d42;background:rgba(200,147,42,0.04);' : 'display:none;margin-top:10px;padding-top:10px;border-top:1px dashed #1e2d42;';
      if (_noSrc) {
        html += '<div style="padding:8px 16px;background:rgba(224,80,80,0.06);color:#e0a050;font-size:.78rem;border-bottom:1px solid #1e2d42;">&#9888; No sources yet &mdash; add one below.</div>';
      } else {
        html += '<div style="padding:8px 16px;border-bottom:1px solid #1e2d42;"><button type="button" onclick="var d=document.getElementById(\u0027srcedit-' + l.id + '\u0027);d.style.display=d.style.display===\u0027none\u0027?\u0027block\u0027:\u0027none\u0027;" style="background:transparent;border:1px solid #c8932a;color:#c8932a;padding:3px 12px;cursor:pointer;border-radius:3px;font-size:.7rem;">&#9998; Edit / Add Sources</button></div>';
      }
      html += '<div id="srcedit-' + l.id + '" style="' + _panelStyle + '">';
      html += '<form method="POST" action="/admin/orders/' + o.id + '/lines/' + l.id + '/sources-update">';
      html += '<div id="src-rows-' + l.id + '">';
      lineSources.forEach(function(src, idx) {
        const poBadge = src.supplier_po_line_id ? '<span style="display:inline-block;padding:1px 6px;background:rgba(76,175,80,0.15);color:#4caf50;border-radius:2px;font-size:.6rem;margin-left:6px;">&#10003; PO' + String.fromCharCode(39) + 'd</span>' : '';
        const removeOnclick = src.supplier_po_line_id
          ? 'alert(&quot;This source is linked to a supplier PO and cannot be removed. Update its actual cost instead.&quot;); return false;'
          : 'this.closest(&quot;[data-srcrow]&quot;).remove();';
        const supEsc = (src.supplier_name || '').replace(/"/g, '&quot;');
        const leadEsc = (src.lead_time_text || '').toString().replace(/"/g, '&quot;');
        html += '<div data-srcrow="' + l.id + '_' + idx + '" style="display:grid;grid-template-columns:1.5fr 0.5fr 0.7fr 1fr 0.4fr 0.4fr 0.4fr 0.3fr;gap:6px;margin-bottom:6px;align-items:end;">';
        html += '<input type="hidden" name="src_' + idx + '_id" value="' + src.id + '"/>';
        html += '<div style="position:relative;"><div style="font-size:.6rem;color:#7a8a9a;">Supplier' + poBadge + '</div>';
        html += '<input type="text" class="src-combo" data-target="sup_' + l.id + '_' + idx + '" value="' + supEsc + '" placeholder="Type to search..." autocomplete="off" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 22px 5px 8px;font-size:.76rem;"/>';
        html += '<div style="position:absolute;right:6px;top:22px;color:#c8932a;pointer-events:none;font-size:.65rem;">&#9660;</div>';
        html += '<div class="src-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:#0a1628;border:1px solid #c8932a;border-top:none;max-height:180px;overflow-y:auto;z-index:1000;"></div>';
        html += '<input type="hidden" id="sup_' + l.id + '_' + idx + '" name="src_' + idx + '_supplier_id" value="' + src.supplier_id + '" required/></div>';
        html += '<div><div style="font-size:.6rem;color:#7a8a9a;">Qty</div><input type="number" min="1" name="src_' + idx + '_qty" value="' + src.allocated_qty + '" style="width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 6px;font-size:.76rem;"/></div>';
        html += '<div><div style="font-size:.6rem;color:#7a8a9a;">Unit Cost</div><input type="number" step="0.01" name="src_' + idx + '_cost" value="' + parseFloat(src.unit_cost || 0).toFixed(2) + '" style="width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 6px;font-size:.76rem;"/></div>';
        html += '<div><div style="font-size:.6rem;color:#7a8a9a;">Lead</div><input type="text" name="src_' + idx + '_lead" value="' + leadEsc + '" placeholder="5 days" style="width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 6px;font-size:.76rem;"/></div>';
        html += '<div><div style="font-size:.6rem;color:#7a8a9a;">8130</div><input type="checkbox" name="src_' + idx + '_8130" value="1"' + (src.has_8130_required ? ' checked' : '') + '/></div>';
        html += '<div><div style="font-size:.6rem;color:#7a8a9a;">CoC</div><input type="checkbox" name="src_' + idx + '_coc" value="1"' + (src.has_coc_required ? ' checked' : '') + '/></div>';
        html += '<div><div style="font-size:.6rem;color:#7a8a9a;">Trace</div><input type="checkbox" name="src_' + idx + '_trace" value="1"' + (src.has_trace_required ? ' checked' : '') + '/></div>';
        html += '<div><button type="button" onclick="' + removeOnclick + '" title="' + (src.supplier_po_line_id ? 'PO-linked source cannot be removed' : 'Remove source') + '" style="background:' + (src.supplier_po_line_id ? '#1e2d42' : '#3b1d1d') + ';border:1px solid ' + (src.supplier_po_line_id ? '#7a8a9a' : '#5a2828') + ';color:' + (src.supplier_po_line_id ? '#7a8a9a' : '#e05050') + ';padding:4px 8px;cursor:pointer;border-radius:3px;">&#10006;</button></div>';
        html += '</div>';
      });
      html += '</div>';
      html += '<button type="button" onclick="window.addOrderSrcRow(' + l.id + ')" style="background:rgba(200,147,42,0.1);border:1px solid #c8932a;color:#c8932a;padding:5px 12px;cursor:pointer;border-radius:3px;font-size:.75rem;margin-top:4px;">+ Add Source</button>';
      html += '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;">';
      html += '<button type="button" onclick="document.getElementById(&quot;srcedit-' + l.id + '&quot;).style.display=&quot;none&quot;;" class="btn btn-outline btn-sm">Cancel</button>';
      html += '<button type="submit" class="btn btn-gold btn-sm">Save Source Changes</button>';
      html += '</div>';
      html += '</form></div></div>';
    } /* FIX_LINE_SOURCES_v1: end always-on edit panel */

    // Action bar
    html += '<div style="padding:10px 16px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">';
    /* REMOVE_ORDER_LINE_v1: per-line Remove button (left side of the bar) */
    html += '<form method="POST" action="/admin/orders/' + o.id + '/lines/' + l.id + '/remove" style="margin:0;" onsubmit="return confirm(&quot;Remove this line? If it has a PO, shipment, or invoice it will be cancelled (kept for records); otherwise it will be deleted.&quot;);"><button type="submit" style="background:#3b1d1d;border:1px solid #5a2828;color:#e05050;padding:5px 12px;cursor:pointer;border-radius:3px;font-size:.72rem;">&#10006; Remove Line</button></form>';
    html += '<button type="button" onclick="var d=document.getElementById(\'lineedit-' + l.id + '\');d.style.display=d.style.display===\'none\'?\'block\':\'none\';" style="background:transparent;border:1px solid #7a8a9a;color:#7a8a9a;padding:5px 12px;cursor:pointer;border-radius:3px;font-size:.72rem;">✎ Edit Line Details</button>';
    if (hasPending) {
      html += '<form method="GET" action="/admin/orders/' + o.id + '/create-supplier-pos-from-order" style="margin:0;"><input type="hidden" name="line_id" value="' + l.id + '"/><button type="submit" class="btn btn-gold btn-sm" style="font-size:.78rem;">+ Generate PO for this Line</button></form>';
    } else if (allPoed) {
      html += '<span style="color:#4caf50;font-size:.78rem;font-weight:600;">✓ All sources have POs</span>';
    }
    html += '</div>';

    // Edit line panel
    html += '<div id="lineedit-' + l.id + '" style="display:none;padding:14px 16px;border-top:1px solid #1e2d42;background:#0e1828;">';
    html += '<form method="POST" action="/admin/orders/' + o.id + '/lines/' + l.id + '/update">';
    html += '<div style="font-size:.7rem;letter-spacing:.1em;color:#c8932a;text-transform:uppercase;margin-bottom:10px;">Fix Line Details (cascades to invoice if generated)</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">';
    html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:2px;">NSN</div><input type="text" name="nsn" value="' + (l.nsn || '').toString().replace(/"/g, '&quot;') + '" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:6px 8px;font-size:.82rem;"/></div>';
    html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:2px;">Part Number</div><input type="text" name="part_number" value="' + (l.part_number || '').toString().replace(/"/g, '&quot;') + '" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:6px 8px;font-size:.82rem;"/></div>';
    html += '<div style="grid-column:1/-1;"><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:2px;">Item Name</div><input type="text" name="item_name" value="' + (l.item_name || '').toString().replace(/"/g, '&quot;') + '" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:6px 8px;font-size:.82rem;"/></div>';
    html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:2px;">Quantity</div><input type="number" min="1" name="quantity_ordered" value="' + (l.quantity_ordered || 1) + '" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:6px 8px;font-size:.82rem;"/></div>';
    html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:2px;">Unit Price ($)</div><input type="number" step="0.01" min="0" name="unit_price" value="' + parseFloat(l.unit_price || 0).toFixed(2) + '" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:6px 8px;font-size:.82rem;"/></div>';
    html += '</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;">';
    html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:2px;">Lot Number</div><input type="text" name="lot_number" value="' + (l.lot_number || '') + '" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:6px 8px;font-size:.82rem;"/></div>';
    html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:2px;">Country of Origin</div><input type="text" name="country_of_origin" value="' + (l.country_of_origin || '') + '" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:6px 8px;font-size:.82rem;"/></div>';
    html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:2px;">Received Date</div><input type="datetime-local" name="received_at" value="' + (l.received_at ? new Date(l.received_at).toISOString().slice(0, 16) : '') + '" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:6px 8px;font-size:.82rem;"/></div>';
    html += '</div>';
    html += '<div style="margin-bottom:10px;"><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:2px;">Serial Numbers</div><textarea name="serial_numbers" rows="2" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:6px 8px;font-size:.82rem;font-family:monospace;">' + (l.serial_numbers || '') + '</textarea></div>';
    html += '<div style="background:#0f1e35;padding:10px;border-left:3px solid #c8932a;margin-bottom:10px;">';
    html += '<div style="font-size:.7rem;letter-spacing:.15em;text-transform:uppercase;color:#c8932a;margin-bottom:8px;font-weight:600;">Compliance & Certifications</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">';
    html += '<label style="display:flex;align-items:center;gap:6px;font-size:.8rem;"><input type="checkbox" name="cert_8130_required" value="1"' + (l.cert_8130_required ? ' checked' : '') + '/> 8130-3 Required</label>';
    html += '<label style="display:flex;align-items:center;gap:6px;font-size:.8rem;"><input type="checkbox" name="cert_8130_received" value="1"' + (l.cert_8130_received ? ' checked' : '') + '/> 8130-3 Received</label>';
    html += '<label style="display:flex;align-items:center;gap:6px;font-size:.8rem;"><input type="checkbox" name="coc_required" value="1"' + (l.coc_required ? ' checked' : '') + '/> CoC Required</label>';
    html += '<label style="display:flex;align-items:center;gap:6px;font-size:.8rem;"><input type="checkbox" name="coc_received" value="1"' + (l.coc_received ? ' checked' : '') + '/> CoC Received</label>';
    html += '</div></div>';
    html += '<div style="display:flex;justify-content:flex-end;gap:8px;"><button type="button" onclick="document.getElementById(\'lineedit-' + l.id + '\').style.display=\'none\';" class="btn btn-outline btn-sm">Cancel</button><button type="submit" class="btn btn-gold btn-sm">Save Line</button></div>';
    html += '</form></div></div>';
  });

  html += '</div>';
  html += '<div style="padding:16px;text-align:right;border-top:1px solid #1e2d42;background:#0a1628;">';
  html += '<span style="color:#7a8a9a;margin-right:16px;">Subtotal: <strong style="color:#eef1f5;">' + currency(o.subtotal) + '</strong></span>';
  if (o.shipping_cost) html += '<span style="color:#7a8a9a;margin-right:16px;">Shipping: <strong style="color:#eef1f5;">' + currency(o.shipping_cost) + '</strong></span>';
  html += '<span style="font-size:1.1rem;font-weight:700;">Total: <strong style="color:#c8932a;">' + currency(o.total_amount) + '</strong></span>';
  /* LINE_PROFIT_v1: order-total profit (sourced portions only) */
  (function(){
    var _tProfit = _ordSourcedRev - _ordSourcedCost;
    var _tPct = _ordSourcedRev > 0 ? (_tProfit / _ordSourcedRev) * 100 : null;
    if (_tPct === null) {
      html += '<div style="margin-top:8px;font-size:.78rem;color:#7a8a9a;">Profit: &mdash; (no lines sourced yet)</div>';
      return;
    }
    var _col = _tProfit >= 0 ? '#4caf50' : '#e05050';
    html += '<div style="margin-top:8px;font-size:.95rem;font-weight:700;color:' + _col + ';">Profit (sourced): ' + currency(_tProfit) + ' &middot; ' + _tPct.toFixed(1) + '%</div>';
    html += '<div style="font-size:.68rem;color:#7a8a9a;margin-top:2px;">Based on sourced costs only; lines not yet sourced are excluded.</div>';
  })();
  html += '</div></div>';

    // ORDER_SOURCES_ADDREMOVE_V2: inject combobox + add row script
  html += '<script>';
  html += 'window.__OSUPPLIERS = ' + JSON.stringify(_supplierList) + ';';
  html += '\n';
  html += [
    'function renderOSrcDropdown(combo, query) {',
    '  var dd = combo.parentElement.querySelector(".src-dropdown");',
    '  if (!dd) return;',
    '  var q = (query || "").toLowerCase();',
    '  var matches = window.__OSUPPLIERS.filter(function(s) { return !q || (s.company_name||"").toLowerCase().indexOf(q) !== -1; }).slice(0, 50);',
    '  if (!matches.length) { dd.innerHTML = "<div style=\u0027padding:8px;color:#7a8a9a;font-size:.75rem;\u0027>No suppliers match</div>"; dd.style.display = "block"; return; }',
    '  var parts = matches.map(function(sup) { var name = (sup.company_name||"").replace(/</g,"&lt;").replace(/\"/g,"&quot;"); return "<div class=\u0027src-opt\u0027 data-id=\u0027" + sup.id + "\u0027 data-name=\u0027" + name + "\u0027 style=\u0027padding:5px 10px;cursor:pointer;font-size:.78rem;color:#eef1f5;border-bottom:1px solid #1e2d42;\u0027>" + name + "</div>"; });',
    '  dd.innerHTML = parts.join("");',
    '  dd.style.display = "block";',
    '}',
    'document.addEventListener("focus", function(e) {',
    '  if (!e.target.classList || !e.target.classList.contains("src-combo")) return;',
    '  renderOSrcDropdown(e.target, e.target.value);',
    '}, true);',
    'document.addEventListener("input", function(e) {',
    '  if (!e.target.classList || !e.target.classList.contains("src-combo")) return;',
    '  var hid = document.getElementById(e.target.getAttribute("data-target"));',
    '  var val = e.target.value.trim().toLowerCase();',
    '  var match = window.__OSUPPLIERS.find(function(sup) { return (sup.company_name||"").toLowerCase() === val; });',
    '  if (hid && match) { hid.value = match.id; } else if (hid && !e.target.value) { hid.value = ""; } /* FIX_SOURCE_SAVE_v1: only set on match; only clear when field emptied; never blank a prefilled id on partial text */',
    '  e.target.style.borderColor = match ? "#4caf50" : (e.target.value ? "#e05050" : "#1e2d42");',
    '  renderOSrcDropdown(e.target, e.target.value);',
    '});',
    'document.addEventListener("click", function(e) {',
    '  var opt = e.target.closest && e.target.closest(".src-opt");',
    '  if (opt) {',
    '    var dd = opt.parentElement; var wrap = dd.parentElement;',
    '    var input = wrap.querySelector(".src-combo");',
    '    var hid = document.getElementById(input.getAttribute("data-target"));',
    '    input.value = opt.getAttribute("data-name");',
    '    if (hid) hid.value = opt.getAttribute("data-id");',
    '    input.style.borderColor = "#4caf50";',
    '    dd.style.display = "none";',
    '    return;',
    '  }',
    '  if (!e.target.classList || !e.target.classList.contains("src-combo")) {',
    '    document.querySelectorAll(".src-dropdown").forEach(function(dd) { dd.style.display = "none"; });',
    '  }',
    '});',
    'window.addOrderSrcRow = function(lineId) {',
    '  var container = document.getElementById("src-rows-" + lineId);',
    '  if (!container) return;',
    '  var existing = container.querySelectorAll("[data-srcrow]");',
    '  /* FIX_SOURCE_SAVE_v1: monotonic per-line index, never reused, always above existing */',
    '  window.__srcIdxCounter = window.__srcIdxCounter || {};',
    '  if (window.__srcIdxCounter[lineId] === undefined) {',
    '    var _maxIdx = -1;',
    '    existing.forEach(function(row){ var p = (row.getAttribute("data-srcrow")||"").split("_"); var n = parseInt(p[p.length-1]); if (!isNaN(n) && n > _maxIdx) _maxIdx = n; });',
    '    window.__srcIdxCounter[lineId] = _maxIdx;',
    '  }',
    '  window.__srcIdxCounter[lineId] += 1;',
    '  var nextIdx = window.__srcIdxCounter[lineId];',
    '  var hidId = "sup_" + lineId + "_" + nextIdx + "_new";',
    '  var div = document.createElement("div");',
    '  div.setAttribute("data-srcrow", lineId + "_" + nextIdx);',
    '  div.style.cssText = "display:grid;grid-template-columns:1.5fr 0.5fr 0.7fr 1fr 0.4fr 0.4fr 0.4fr 0.3fr;gap:6px;margin-bottom:6px;align-items:end;";',
    '  var rowHtml = "";',
    '  rowHtml += "<input type=\u0027hidden\u0027 name=\u0027src_" + nextIdx + "_id\u0027 value=\u0027\u0027/>";',
    '  rowHtml += "<div style=\u0027position:relative;\u0027><div style=\u0027font-size:.6rem;color:#7a8a9a;\u0027>Supplier</div>";',
    '  rowHtml += "<input type=\u0027text\u0027 class=\u0027src-combo\u0027 data-target=\u0027" + hidId + "\u0027 placeholder=\u0027Type to search...\u0027 autocomplete=\u0027off\u0027 style=\u0027width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 22px 5px 8px;font-size:.76rem;\u0027/>";',
    '  rowHtml += "<div style=\u0027position:absolute;right:6px;top:22px;color:#c8932a;pointer-events:none;font-size:.65rem;\u0027>\u25BC</div>";',
    '  rowHtml += "<div class=\u0027src-dropdown\u0027 style=\u0027display:none;position:absolute;top:100%;left:0;right:0;background:#0a1628;border:1px solid #c8932a;border-top:none;max-height:180px;overflow-y:auto;z-index:1000;\u0027></div>";',
    '  rowHtml += "<input type=\u0027hidden\u0027 id=\u0027" + hidId + "\u0027 name=\u0027src_" + nextIdx + "_supplier_id\u0027 required/></div>";',
    '  rowHtml += "<div><div style=\u0027font-size:.6rem;color:#7a8a9a;\u0027>Qty</div><input type=\u0027number\u0027 min=\u00271\u0027 name=\u0027src_" + nextIdx + "_qty\u0027 value=\u00271\u0027 required style=\u0027width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 6px;font-size:.76rem;\u0027/></div>";',
    '  rowHtml += "<div><div style=\u0027font-size:.6rem;color:#7a8a9a;\u0027>Unit Cost</div><input type=\u0027number\u0027 step=\u00270.01\u0027 name=\u0027src_" + nextIdx + "_cost\u0027 required style=\u0027width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 6px;font-size:.76rem;\u0027/></div>";',
    '  rowHtml += "<div><div style=\u0027font-size:.6rem;color:#7a8a9a;\u0027>Lead</div><input type=\u0027text\u0027 name=\u0027src_" + nextIdx + "_lead\u0027 placeholder=\u00275 days\u0027 style=\u0027width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 6px;font-size:.76rem;\u0027/></div>";',
    '  rowHtml += "<div><div style=\u0027font-size:.6rem;color:#7a8a9a;\u0027>8130</div><input type=\u0027checkbox\u0027 name=\u0027src_" + nextIdx + "_8130\u0027 value=\u00271\u0027/></div>";',
    '  rowHtml += "<div><div style=\u0027font-size:.6rem;color:#7a8a9a;\u0027>CoC</div><input type=\u0027checkbox\u0027 name=\u0027src_" + nextIdx + "_coc\u0027 value=\u00271\u0027/></div>";',
    '  rowHtml += "<div><div style=\u0027font-size:.6rem;color:#7a8a9a;\u0027>Trace</div><input type=\u0027checkbox\u0027 name=\u0027src_" + nextIdx + "_trace\u0027 value=\u00271\u0027/></div>";',
    '  rowHtml += "<div><button type=\u0027button\u0027 onclick=\u0027this.closest(&quot;[data-srcrow]&quot;).remove();\u0027 style=\u0027background:#3b1d1d;border:1px solid #5a2828;color:#e05050;padding:4px 8px;cursor:pointer;border-radius:3px;\u0027>\u2716</button></div>";',
    '  div.innerHTML = rowHtml;',
    '  container.appendChild(div);',
    '};'
  ].join("\n");
  html += '<' + '/script>';

  return html;
}
