// EDIT_LINE_V2
// admin/orderLinesBlock.js
// Renders the Lines tab content for /admin/orders/:id

import { currency, statusBadge } from './uiHelpers.js';
  // [Rewire 3] Load order_line_sources for split-display
  let _sourcesMap = {};
  try {
    const _pool = await getPool();
    const _ids = (oLines.recordset || oLines).map(function(l){ return l.id; }).filter(Boolean);
    if (_ids.length) {
      const _r = await _pool.request().query(
        "SELECT ols.*, s.company_name AS supplier_name FROM order_line_sources ols JOIN suppliers s ON s.id = ols.supplier_id WHERE ols.order_line_id IN (" + _ids.join(',') + ") ORDER BY ols.order_line_id, ols.sort_order"
      );
      _r.recordset.forEach(function(s) {
        if (!_sourcesMap[s.order_line_id]) _sourcesMap[s.order_line_id] = [];
        _sourcesMap[s.order_line_id].push(s);
      });
    }
  } catch(e) { console.error('Sources load error:', e.message); }

import { getPool, sql } from '../db/connect.js';
export async function renderLinesTab(o, oLines, suppliers) {
  let html = '';

  html += '<div class="card" style="margin-bottom:16px;"><div class="card-header" style="display:flex;justify-content:space-between;align-items:center;"><span>Order Line Items (' + oLines.recordset.length + ')</span>';
  if (oLines.recordset.length > 0) {
    const lineIds = oLines.recordset.map(function(l){return l.id;}).join(',');
    html += '<a href="/admin/supplier-pos/new?from_order=' + o.id + '&line_ids=' + lineIds + '" class="btn btn-gold btn-sm" style="font-size:.7rem;">+ Create Supplier PO</a>';
  }
  html += '</div>';

  if (oLines.recordset.length === 0) {
    html += '<div style="padding:24px;text-align:center;color:#7a8a9a;">No line items on this order.</div>';
  } else {
    html += '<div style="padding:16px;">';
    oLines.recordset.forEach(function(l) {
      // [Rewire 3] Render source splits for this order line
      const _lineSources = _sourcesMap[l.id] || [];
      let _srcHtml = '';
      if (_lineSources.length > 0) {
        const _isSplit = _lineSources.length > 1;
        _srcHtml += '<div style="background:#0a1628;border-top:1px solid #1e2d42;padding:10px 14px;margin-top:-1px;">';
        _srcHtml += '<div style="font-size:.65rem;letter-spacing:.12em;text-transform:uppercase;color:#c8932a;margin-bottom:6px;font-weight:700;">';
        _srcHtml += '\uD83D\uDD12 INTERNAL SOURCES ' + (_isSplit ? '(SPLIT: ' + _lineSources.length + ' suppliers)' : '') + '</div>';
        _srcHtml += '<table style="width:100%;font-size:.78rem;color:#cfd5dc;"><thead><tr style="text-align:left;">';
        _srcHtml += '<th style="padding:3px 6px;color:#7a8a9a;font-size:.65rem;">SUPPLIER</th>';
        _srcHtml += '<th style="padding:3px 6px;color:#7a8a9a;font-size:.65rem;">QTY</th>';
        _srcHtml += '<th style="padding:3px 6px;color:#7a8a9a;font-size:.65rem;">RECVD</th>';
        _srcHtml += '<th style="padding:3px 6px;color:#7a8a9a;font-size:.65rem;">UNIT COST</th>';
        _srcHtml += '<th style="padding:3px 6px;color:#7a8a9a;font-size:.65rem;">LINE COST</th>';
        _srcHtml += '<th style="padding:3px 6px;color:#7a8a9a;font-size:.65rem;text-align:center;">8130</th>';
        _srcHtml += '<th style="padding:3px 6px;color:#7a8a9a;font-size:.65rem;text-align:center;">CoC</th>';
        _srcHtml += '<th style="padding:3px 6px;color:#7a8a9a;font-size:.65rem;">PO</th>';
        _srcHtml += '</tr></thead><tbody>';
        _lineSources.forEach(function(_s) {
          const _full = _s.received_qty >= _s.allocated_qty;
          _srcHtml += '<tr>';
          _srcHtml += '<td style="padding:3px 6px;"><a href="/admin/suppliers/' + _s.supplier_id + '" style="color:#c8932a;">' + _s.supplier_name + '</a></td>';
          _srcHtml += '<td style="padding:3px 6px;font-weight:700;">' + _s.allocated_qty + '</td>';
          _srcHtml += '<td style="padding:3px 6px;color:' + (_full ? '#4caf50' : '#7a8a9a') + ';">' + (_s.received_qty || 0) + '/' + _s.allocated_qty + (_full ? ' \u2713' : '') + '</td>';
          _srcHtml += '<td style="padding:3px 6px;">$' + parseFloat(_s.unit_cost || 0).toFixed(2) + '</td>';
          _srcHtml += '<td style="padding:3px 6px;">$' + parseFloat(_s.line_cost || (_s.allocated_qty * _s.unit_cost) || 0).toFixed(2) + '</td>';
          _srcHtml += '<td style="padding:3px 6px;text-align:center;">' + (_s.has_8130_required ? (_s.has_8130_received ? '<span style="color:#4caf50;">\u2713</span>' : '<span style="color:#e05050;">!</span>') : '\u2014') + '</td>';
          _srcHtml += '<td style="padding:3px 6px;text-align:center;">' + (_s.has_coc_required ? (_s.has_coc_received ? '<span style="color:#4caf50;">\u2713</span>' : '<span style="color:#e05050;">!</span>') : '\u2014') + '</td>';
          _srcHtml += '<td style="padding:3px 6px;">' + (_s.supplier_po_line_id ? '<a href="/admin/supplier-pos" style="color:#c8932a;">View PO</a>' : '<span style="color:#7a8a9a;">Not yet</span>') + '</td>';
          _srcHtml += '</tr>';
        });
        _srcHtml += '</tbody></table></div>';
      }
      // Build supplier options for this line
      let supplierOpts = '<option value="">-- No supplier selected --</option>';
      suppliers.recordset.forEach(function(s) {
        const sel = (l.supplier_id == s.id) ? ' selected' : '';
        supplierOpts += '<option value="' + s.id + '"' + sel + '>' + s.name + (s.country ? ' (' + s.country + ')' : '') + '</option>';
      });

      html += '<div style="border:1px solid #1e2d42;background:#0a1628;margin-bottom:14px;padding:14px;">';

      // Header row: line #, NSN/Part, qty, price
      html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid #1e2d42;">';
      html += '<div>';
      html += '<div style="font-size:.65rem;letter-spacing:.15em;text-transform:uppercase;color:#7a8a9a;">Line #' + l.line_number + '</div>';
      html += '<div style="font-family:monospace;color:#c8932a;font-size:1rem;font-weight:600;margin-top:2px;">' + (l.nsn || l.part_number || '&mdash;') + '</div>';
      html += '<div style="font-size:.85rem;color:#eef1f5;margin-top:2px;">' + (l.item_name || '&mdash;') + '</div>';
      html += '<div style="font-size:.75rem;color:#7a8a9a;margin-top:4px;">Condition: <strong>' + (l.condition_code || 'NE') + '</strong></div>';
      html += '</div>';
      html += '<div style="text-align:right;">';
      html += '<div style="font-size:.65rem;letter-spacing:.15em;text-transform:uppercase;color:#7a8a9a;">Qty / Price</div>';
      html += '<div style="font-size:.95rem;color:#eef1f5;margin-top:2px;">' + l.quantity_ordered + ' \u00d7 ' + currency(l.unit_price) + '</div>';
      html += '<div style="font-size:1rem;font-weight:700;color:#c8932a;margin-top:2px;">' + currency(l.line_total) + '</div>';
      html += '</div>';
      html += '</div>';

      // Editable form for the line
      html += '<form method="POST" action="/admin/orders/' + o.id + '/lines/' + l.id + '/update">';

      // Supplier section
            // EDIT_LINE_V2: editable basic fields (cascades to invoice_lines via /lines/:id/update)
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0;padding:8px;background:#0a1628;border:1px dashed #c8932a;"><div style="grid-column:1/-1;font-size:.7rem;letter-spacing:.1em;color:#c8932a;text-transform:uppercase;">Fix Line Details (cascades to invoice if generated)</div>';
      html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:2px;">NSN</div><input type="text" name="nsn" value="' + (l.nsn || '').toString().replace(/"/g, '&quot;') + '" style="width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;font-size:.78rem;"/></div>';
      html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:2px;">Part Number</div><input type="text" name="part_number" value="' + (l.part_number || '').toString().replace(/"/g, '&quot;') + '" style="width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;font-size:.78rem;"/></div>';
      html += '<div style="grid-column:1/-1;"><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:2px;">Item Name</div><input type="text" name="item_name" value="' + (l.item_name || '').toString().replace(/"/g, '&quot;') + '" style="width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;font-size:.78rem;"/></div>';
      html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:2px;">Quantity</div><input type="number" min="1" name="quantity_ordered" value="' + (l.quantity_ordered || 1) + '" style="width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;font-size:.78rem;"/></div>';
      html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:2px;">Unit Price ($)</div><input type="number" step="0.01" min="0" name="unit_price" value="' + parseFloat(l.unit_price || 0).toFixed(2) + '" style="width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;font-size:.78rem;"/></div>';
      html += '</div>';
html += '<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px;margin-bottom:10px;">';
      html += '<div><div style="font-size:.65rem;letter-spacing:.1em;text-transform:uppercase;color:#7a8a9a;margin-bottom:3px;">Supplier</div>';
      html += '<select name="supplier_id" style="width:100%;background:#111e30;border:1px solid #1e2d42;color:#eef1f5;padding:6px 10px;font-size:.85rem;">' + supplierOpts + '</select></div>';
      html += '<div><div style="font-size:.65rem;letter-spacing:.1em;text-transform:uppercase;color:#7a8a9a;margin-bottom:3px;">Supplier Cost ($)</div>';
      html += '<input type="number" step="0.01" min="0" name="supplier_cost" value="' + (l.supplier_cost || '') + '" style="width:100%;background:#111e30;border:1px solid #1e2d42;color:#eef1f5;padding:6px 10px;font-size:.85rem;"/></div>';
      html += '<div><div style="font-size:.65rem;letter-spacing:.1em;text-transform:uppercase;color:#7a8a9a;margin-bottom:3px;">Supplier Lead (days)</div>';
      html += '<input type="number" min="0" name="supplier_lead_time_days" value="' + (l.supplier_lead_time_days || '') + '" style="width:100%;background:#111e30;border:1px solid #1e2d42;color:#eef1f5;padding:6px 10px;font-size:.85rem;"/></div>';
      html += '</div>';

      // Lot/serial/COO
      html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:10px;">';
      html += '<div><div style="font-size:.65rem;letter-spacing:.1em;text-transform:uppercase;color:#7a8a9a;margin-bottom:3px;">Lot Number</div>';
      html += '<input type="text" name="lot_number" value="' + (l.lot_number || '') + '" style="width:100%;background:#111e30;border:1px solid #1e2d42;color:#eef1f5;padding:6px 10px;font-size:.85rem;"/></div>';
      html += '<div><div style="font-size:.65rem;letter-spacing:.1em;text-transform:uppercase;color:#7a8a9a;margin-bottom:3px;">Country of Origin</div>';
      html += '<input type="text" name="country_of_origin" value="' + (l.country_of_origin || '') + '" style="width:100%;background:#111e30;border:1px solid #1e2d42;color:#eef1f5;padding:6px 10px;font-size:.85rem;"/></div>';
      html += '<div><div style="font-size:.65rem;letter-spacing:.1em;text-transform:uppercase;color:#7a8a9a;margin-bottom:3px;">Received Date</div>';
      html += '<input type="datetime-local" name="received_at" value="' + (l.received_at ? new Date(l.received_at).toISOString().slice(0,16) : '') + '" style="width:100%;background:#111e30;border:1px solid #1e2d42;color:#eef1f5;padding:6px 10px;font-size:.85rem;"/></div>';
      html += '</div>';

      // Serial numbers
      html += '<div style="margin-bottom:10px;"><div style="font-size:.65rem;letter-spacing:.1em;text-transform:uppercase;color:#7a8a9a;margin-bottom:3px;">Serial Numbers (comma-separated)</div>';
      html += '<textarea name="serial_numbers" rows="2" style="width:100%;background:#111e30;border:1px solid #1e2d42;color:#eef1f5;padding:6px 10px;font-size:.85rem;font-family:monospace;resize:vertical;">' + (l.serial_numbers || '') + '</textarea></div>';

      // Compliance certs
      html += '<div style="background:#0f1e35;padding:10px;border-left:3px solid #c8932a;margin-bottom:12px;">';
      html += '<div style="font-size:.7rem;letter-spacing:.15em;text-transform:uppercase;color:#c8932a;margin-bottom:8px;font-weight:600;">Compliance & Certifications</div>';
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">';
      html += '<label style="display:flex;align-items:center;gap:6px;font-size:.8rem;cursor:pointer;"><input type="checkbox" name="cert_8130_required" value="1"' + (l.cert_8130_required ? ' checked' : '') + ' style="width:auto;accent-color:#c8932a;"/> 8130-3 Required</label>';
      html += '<label style="display:flex;align-items:center;gap:6px;font-size:.8rem;cursor:pointer;"><input type="checkbox" name="cert_8130_received" value="1"' + (l.cert_8130_received ? ' checked' : '') + ' style="width:auto;accent-color:#4caf50;"/> 8130-3 Received</label>';
      html += '<label style="display:flex;align-items:center;gap:6px;font-size:.8rem;cursor:pointer;"><input type="checkbox" name="coc_required" value="1"' + (l.coc_required ? ' checked' : '') + ' style="width:auto;accent-color:#c8932a;"/> CoC Required</label>';
      html += '<label style="display:flex;align-items:center;gap:6px;font-size:.8rem;cursor:pointer;"><input type="checkbox" name="coc_received" value="1"' + (l.coc_received ? ' checked' : '') + ' style="width:auto;accent-color:#4caf50;"/> CoC Received</label>';
      html += '</div></div>';

      html += '<div style="display:flex;justify-content:flex-end;"><button type="submit" class="btn btn-gold btn-sm">Save Line</button></div>';
      html += '</form>';
      html += '</div>'; // end line card
          html += _srcHtml;
      });
    html += '</div>'; // end padding
  }

  // Totals footer
  html += '<div style="padding:16px;text-align:right;border-top:1px solid #1e2d42;background:#0a1628;">';
  html += '<span style="color:#7a8a9a;margin-right:16px;">Subtotal: <strong style="color:#eef1f5;">' + currency(o.subtotal) + '</strong></span>';
  if (o.shipping_cost) html += '<span style="color:#7a8a9a;margin-right:16px;">Shipping: <strong style="color:#eef1f5;">' + currency(o.shipping_cost) + '</strong></span>';
  html += '<span style="font-size:1.1rem;font-weight:700;">Total: <strong style="color:#c8932a;">' + currency(o.total_amount) + '</strong></span>';
  html += '</div>';

  html += '</div>'; // end card

  return html;
}
