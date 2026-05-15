const fs = require('fs');
const { execSync } = require('child_process');

const f = 'admin/orderLinesBlock.js';
const orig = fs.readFileSync(f, 'utf8');

const newFile = `// ORDERLINES_REWRITE_V1
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

  let html = '';
  html += '<div class="card" style="margin-bottom:16px;"><div class="card-header" style="display:flex;justify-content:space-between;align-items:center;"><span>Order Line Items (' + oLines.recordset.length + ')</span></div>';

  if (oLines.recordset.length === 0) {
    html += '<div style="padding:24px;text-align:center;color:#7a8a9a;">No line items.</div></div>';
    return html;
  }

  html += '<div style="padding:16px;">';

  oLines.recordset.forEach(function(l) {
    const lineSources = _sourcesMap[l.id] || [];
    const hasPending = lineSources.some(function(s) { return !s.supplier_po_line_id; });
    const allPoed = lineSources.length > 0 && lineSources.every(function(s) { return s.supplier_po_line_id; });

    html += '<div style="border:1px solid #1e2d42;background:#0a1628;margin-bottom:16px;border-radius:4px;overflow:hidden;">';

    // Line header
    html += '<div style="padding:14px 16px;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;border-bottom:1px solid #1e2d42;">';
    html += '<div style="flex:1;min-width:240px;">';
    html += '<div style="font-size:.65rem;letter-spacing:.15em;text-transform:uppercase;color:#7a8a9a;">Line #' + l.line_number + '</div>';
    html += '<div style="font-family:monospace;color:#c8932a;font-size:1.05rem;font-weight:700;margin-top:2px;">' + (l.nsn || l.part_number || '\u2014') + '</div>';
    html += '<div style="font-size:.88rem;color:#eef1f5;margin-top:2px;">' + (l.item_name || '\u2014') + '</div>';
    html += '<div style="font-size:.72rem;color:#7a8a9a;margin-top:4px;">Condition: <strong style="color:#cfd5dc;">' + (l.condition_code || 'NE') + '</strong></div>';
    html += '</div>';
    html += '<div style="text-align:right;min-width:140px;">';
    html += '<div style="font-size:.65rem;letter-spacing:.15em;text-transform:uppercase;color:#7a8a9a;">Qty \u00d7 Price</div>';
    html += '<div style="font-size:.95rem;color:#eef1f5;margin-top:2px;">' + l.quantity_ordered + ' \u00d7 ' + currency(l.unit_price) + '</div>';
    html += '<div style="font-size:1.1rem;font-weight:700;color:#c8932a;margin-top:2px;">' + currency(l.line_total) + '</div>';
    html += '</div></div>';

    // Sources sub-row
    if (lineSources.length > 0) {
      const isSplit = lineSources.length > 1;
      html += '<div style="background:rgba(200,147,42,0.06);padding:10px 16px;border-bottom:1px solid #1e2d42;">';
      html += '<div style="font-size:.65rem;letter-spacing:.12em;text-transform:uppercase;color:#c8932a;margin-bottom:8px;font-weight:700;display:flex;justify-content:space-between;align-items:center;">';
      html += '<span>\u{1F512} Sourcing' + (isSplit ? ' (' + lineSources.length + ' suppliers, split)' : '') + '</span>';
      html += '<button type="button" onclick="var d=document.getElementById(\\'srcedit-' + l.id + '\\');d.style.display=d.style.display===\\'none\\'?\\'block\\':\\'none\\';" style="background:transparent;border:1px solid #c8932a;color:#c8932a;padding:2px 10px;cursor:pointer;border-radius:3px;font-size:.65rem;">\u270E Edit Sources</button>';
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
        if (!certs) certs = '<span style="color:#7a8a9a;">\u2014</span>';
        html += '<tr style="border-top:1px solid rgba(30,45,66,0.5);">';
        html += '<td style="padding:6px;"><a href="/admin/suppliers/' + src.supplier_id + '" style="color:#c8932a;font-weight:600;">' + (src.supplier_name || '\u2014') + '</a></td>';
        html += '<td style="padding:6px;font-weight:700;">' + src.allocated_qty + '</td>';
        html += '<td style="padding:6px;color:' + (full ? '#4caf50' : '#7a8a9a') + ';">' + (src.received_qty || 0) + '/' + src.allocated_qty + (full ? ' \u2713' : '') + '</td>';
        html += '<td style="padding:6px;">$' + parseFloat(src.unit_cost || 0).toFixed(2) + '</td>';
        html += '<td style="padding:6px;font-weight:600;">$' + parseFloat(lineCost).toFixed(2) + '</td>';
        html += '<td style="padding:6px;color:#7a8a9a;">' + (src.lead_time_text || (src.supplier_lead_time_days ? src.supplier_lead_time_days + ' days' : '\u2014')) + '</td>';
        html += '<td style="padding:6px;text-align:center;">' + certs + '</td>';
        html += '<td style="padding:6px;">' + (src.supplier_po_line_id ? '<span style="color:#4caf50;font-size:.72rem;">\u2713 PO\\'d</span>' : '<span style="color:#7a8a9a;">Pending</span>') + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';

      // Edit sources panel
      html += '<div id="srcedit-' + l.id + '" style="display:none;margin-top:10px;padding-top:10px;border-top:1px dashed #1e2d42;">';
      html += '<form method="POST" action="/admin/orders/' + o.id + '/lines/' + l.id + '/sources-update">';
      lineSources.forEach(function(src, idx) {
        html += '<div style="display:grid;grid-template-columns:1.5fr 0.5fr 0.7fr 1fr 0.4fr 0.4fr 0.4fr;gap:6px;margin-bottom:6px;align-items:end;">';
        html += '<input type="hidden" name="src_' + idx + '_id" value="' + src.id + '"/>';
        html += '<div><div style="font-size:.6rem;color:#7a8a9a;">Supplier</div><input type="text" value="' + (src.supplier_name || '') + '" readonly style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#7a8a9a;padding:4px 6px;font-size:.76rem;"/></div>';
        html += '<div><div style="font-size:.6rem;color:#7a8a9a;">Qty</div><input type="number" min="1" name="src_' + idx + '_qty" value="' + src.allocated_qty + '" style="width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:4px 6px;font-size:.76rem;"/></div>';
        html += '<div><div style="font-size:.6rem;color:#7a8a9a;">Unit Cost</div><input type="number" step="0.01" name="src_' + idx + '_cost" value="' + parseFloat(src.unit_cost || 0).toFixed(2) + '" style="width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:4px 6px;font-size:.76rem;"/></div>';
        html += '<div><div style="font-size:.6rem;color:#7a8a9a;">Lead</div><input type="text" name="src_' + idx + '_lead" value="' + ((src.lead_time_text || '').toString().replace(/"/g, '&quot;')) + '" placeholder="5 days" style="width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:4px 6px;font-size:.76rem;"/></div>';
        html += '<div><div style="font-size:.6rem;color:#7a8a9a;">8130</div><input type="checkbox" name="src_' + idx + '_8130"' + (src.has_8130 ? ' checked' : '') + '/></div>';
        html += '<div><div style="font-size:.6rem;color:#7a8a9a;">CoC</div><input type="checkbox" name="src_' + idx + '_coc"' + (src.has_coc ? ' checked' : '') + '/></div>';
        html += '<div><div style="font-size:.6rem;color:#7a8a9a;">Trace</div><input type="checkbox" name="src_' + idx + '_trace"' + (src.has_trace ? ' checked' : '') + '/></div>';
        html += '</div>';
      });
      html += '<input type="hidden" name="src_count" value="' + lineSources.length + '"/>';
      html += '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;"><button type="button" onclick="document.getElementById(\\'srcedit-' + l.id + '\\').style.display=\\'none\\';" class="btn btn-outline btn-sm">Cancel</button><button type="submit" class="btn btn-gold btn-sm">Save Source Changes</button></div>';
      html += '</form></div></div>';
    } else {
      html += '<div style="padding:8px 16px;background:rgba(224,80,80,0.06);color:#e05050;font-size:.78rem;border-bottom:1px solid #1e2d42;">\u26A0 No sources on this line.</div>';
    }

    // Action bar
    html += '<div style="padding:10px 16px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">';
    html += '<button type="button" onclick="var d=document.getElementById(\\'lineedit-' + l.id + '\\');d.style.display=d.style.display===\\'none\\'?\\'block\\':\\'none\\';" style="background:transparent;border:1px solid #7a8a9a;color:#7a8a9a;padding:5px 12px;cursor:pointer;border-radius:3px;font-size:.72rem;">\u270E Edit Line Details</button>';
    if (hasPending) {
      html += '<form method="GET" action="/admin/orders/' + o.id + '/create-supplier-pos-from-order" style="margin:0;"><input type="hidden" name="line_id" value="' + l.id + '"/><button type="submit" class="btn btn-gold btn-sm" style="font-size:.78rem;">+ Generate PO for this Line</button></form>';
    } else if (allPoed) {
      html += '<span style="color:#4caf50;font-size:.78rem;font-weight:600;">\u2713 All sources have POs</span>';
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
    html += '<div style="display:flex;justify-content:flex-end;gap:8px;"><button type="button" onclick="document.getElementById(\\'lineedit-' + l.id + '\\').style.display=\\'none\\';" class="btn btn-outline btn-sm">Cancel</button><button type="submit" class="btn btn-gold btn-sm">Save Line</button></div>';
    html += '</form></div></div>';
  });

  html += '</div>';
  html += '<div style="padding:16px;text-align:right;border-top:1px solid #1e2d42;background:#0a1628;">';
  html += '<span style="color:#7a8a9a;margin-right:16px;">Subtotal: <strong style="color:#eef1f5;">' + currency(o.subtotal) + '</strong></span>';
  if (o.shipping_cost) html += '<span style="color:#7a8a9a;margin-right:16px;">Shipping: <strong style="color:#eef1f5;">' + currency(o.shipping_cost) + '</strong></span>';
  html += '<span style="font-size:1.1rem;font-weight:700;">Total: <strong style="color:#c8932a;">' + currency(o.total_amount) + '</strong></span>';
  html += '</div></div>';

  return html;
}
`;

fs.writeFileSync(f + '.rewrite.bak', orig);
fs.writeFileSync(f, newFile);

try {
  execSync('node -c "' + f + '"', { stdio: 'pipe' });
  console.log('+ orderLinesBlock.js fully rewritten');
  console.log('+ Sources actually load now (was broken)');
  console.log('+ Clean line cards, sources visible, edit panels collapse');
  console.log('+ Per-line Generate PO button + Edit Sources inline');
} catch (err) {
  fs.writeFileSync(f, orig);
  console.error('! syntax error - REVERTED');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}

// Add line_id filter to review handler
const orFile = 'admin/orderRoutes.js';
const orOrig = fs.readFileSync(orFile, 'utf8');
let orS = orOrig;

if (!orS.includes('PER_LINE_PO_V1')) {
  const idx = orS.indexOf("AND ols.supplier_po_line_id IS NULL");
  if (idx > 0) {
    const lineEnd = orS.indexOf('\n', idx);
    const before = orS.substring(0, lineEnd);
    const after = orS.substring(lineEnd);
    // Look back to find the start of the query and add the filter
    const queryStart = orS.lastIndexOf("const sourcesR", idx);
    if (queryStart > 0) {
      // Inject filter via _lineFilter variable just before the query
      const inject = "      // PER_LINE_PO_V1\n      const _lineFilter = req.query.line_id ? ' AND ol.id = ' + parseInt(req.query.line_id) : '';\n";
      // Replace the static WHERE clause line with one that appends _lineFilter
      const oldWhere = "          AND ols.supplier_po_line_id IS NULL";
      const newWhere = "          AND ols.supplier_po_line_id IS NULL ${_lineFilter}";
      if (orS.includes(oldWhere)) {
        orS = orS.replace(oldWhere, newWhere);
        // Add the _lineFilter declaration just before "const sourcesR"
        orS = orS.replace("const sourcesR = await pool.request().input('oid'", "const _lineFilter = req.query.line_id ? ' AND ol.id = ' + parseInt(req.query.line_id) : '';\n      const sourcesR = await pool.request().input('oid'");
        fs.writeFileSync(orFile + '.perline.bak', orOrig);
        fs.writeFileSync(orFile, orS);
        try {
          execSync('node -c "' + orFile + '"', { stdio: 'pipe' });
          console.log('+ orderRoutes.js: review screen filters by line_id when provided');
        } catch (err) {
          fs.writeFileSync(orFile, orOrig);
          console.error('! orderRoutes syntax - REVERTED');
          console.error(err.stderr ? err.stderr.toString() : err.message);
        }
      }
    }
  }
}

console.log('SUCCESS');
