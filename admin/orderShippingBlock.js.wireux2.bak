// admin/orderShippingBlock.js
// Renders the Shipping tab content for /admin/orders/:id

import { currency, shortDate, statusBadge } from './uiHelpers.js';

export function renderShippingTab(o, ships) {
  const shipRows = ships.recordset.map(function(s) {
    const isDelivered = !!s.actual_delivery_at;
    const trackingDisplay = s.tracking_number
      ? '<a href="' + (s.tracking_url || '#') + '" target="_blank" style="color:#c8932a;">' + s.tracking_number + '</a>'
      : '&mdash;';
    let row = '<tr>';
    row += '<td class="mono">' + (s.shipment_number || '') + '</td>';
    row += '<td>' + (s.carrier || '&mdash;') + '</td>';
    row += '<td>' + trackingDisplay + '</td>';
    row += '<td>' + (s.weight_lbs ? s.weight_lbs + ' lbs' : '&mdash;') + '</td>';
    row += '<td style="font-size:.78rem;">' + (s.dimensions || '&mdash;') + '</td>';
    row += '<td>' + (s.package_count || 1) + '</td>';
    row += '<td>' + (s.signature_required ? '<span style="color:#c8932a;">&#10003; Sig</span>' : '<span style="color:#7a8a9a;">&mdash;</span>') + '</td>';
    row += '<td>' + (s.insurance_value ? currency(s.insurance_value) : '&mdash;') + '</td>';
    row += '<td>' + statusBadge(s.status || 'Pending') + '</td>';
    row += '<td style="color:#7a8a9a;font-size:.78rem;">' + shortDate(s.ship_date) + '</td>';
    row += '<td style="color:#7a8a9a;font-size:.78rem;">' + shortDate(s.estimated_delivery) + '</td>';
    row += '<td>';
    if (isDelivered) {
      row += '<div style="font-size:.78rem;color:#4caf50;">&#10004; ' + shortDate(s.actual_delivery_at) + '</div>';
      if (s.received_by_name) row += '<div style="font-size:.7rem;color:#7a8a9a;">by ' + s.received_by_name + '</div>';
    } else {
      row += '<button type="button" onclick="document.getElementById(\'deliver-' + s.id + '\').style.display=\'block\'" class="btn btn-outline btn-sm" style="font-size:.7rem;">Mark Delivered</button>';
    }
    row += '</td>';
    row += '</tr>';
    // Hidden delivery form row
    if (!isDelivered) {
      row += '<tr id="deliver-' + s.id + '" style="display:none;background:#0a1628;"><td colspan="12" style="padding:14px;">';
      row += '<form method="POST" action="/admin/orders/' + o.id + '/shipments/' + s.id + '/deliver" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">';
      row += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Delivered Date</div><input type="datetime-local" name="actual_delivery_at" value="' + new Date().toISOString().slice(0,16) + '" required style="width:200px;"/></div>';
      row += '<div style="flex:1;min-width:180px;"><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Received By</div><input type="text" name="received_by_name" placeholder="Name on receipt" style="width:100%;"/></div>';
      row += '<div style="flex:1;min-width:200px;"><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Proof URL (optional)</div><input type="text" name="delivery_proof_url" placeholder="Photo or signature URL" style="width:100%;"/></div>';
      row += '<button type="submit" class="btn btn-gold btn-sm">Confirm Delivery</button>';
      row += '<button type="button" onclick="document.getElementById(\'deliver-' + s.id + '\').style.display=\'none\'" class="btn btn-outline btn-sm">Cancel</button>';
      row += '</form></td></tr>';
    }
    return row;
  }).join('') || '<tr><td colspan="12" style="text-align:center;color:#7a8a9a;padding:12px;">No shipments yet</td></tr>';

  let html = '';

  // Shipping address form
  html += '<div class="card" style="margin-bottom:20px;"><div class="card-header">Shipping Info</div><div class="card-body">';
  html += '<form method="POST" action="/admin/orders/' + o.id + '/shipping" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">';
  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Shipping Cost ($)</div><input type="number" step="0.01" min="0" name="shipping_cost" value="' + (o.shipping_cost || '') + '" style="width:100%;"/></div>';
  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Address</div><input type="text" name="ship_to_address1" value="' + (o.ship_to_address1 || '') + '" style="width:100%;"/></div>';
  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">City</div><input type="text" name="ship_to_city" value="' + (o.ship_to_city || '') + '" style="width:100%;"/></div>';
  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">State</div><input type="text" name="ship_to_state" value="' + (o.ship_to_state || '') + '" style="width:100%;"/></div>';
  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">ZIP</div><input type="text" name="ship_to_zip" value="' + (o.ship_to_zip || '') + '" style="width:100%;"/></div>';
  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Country</div><input type="text" name="ship_to_country" value="' + (o.ship_to_country || 'USA') + '" style="width:100%;"/></div>';
  html += '<div style="grid-column:1/-1;"><button type="submit" class="btn btn-gold">Save Shipping</button></div></form></div></div>';

  // Add shipment form (with new fields)
  html += '<div class="card" style="margin-bottom:20px;"><div class="card-header">Add Tracking / Shipment</div><div class="card-body">';
  html += '<form method="POST" action="/admin/orders/' + o.id + '/tracking" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">';
  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Carrier</div><input type="text" name="carrier" placeholder="FedEx, UPS, DHL..." style="width:100%;"/></div>';
  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Tracking #</div><input type="text" name="tracking_number" style="width:100%;"/></div>';
  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Tracking URL</div><input type="text" name="tracking_url" placeholder="https://..." style="width:100%;"/></div>';
  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Ship Date</div><input type="date" name="ship_date" style="width:100%;"/></div>';
  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Est. Delivery</div><input type="date" name="estimated_delivery" style="width:100%;"/></div>';
  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Weight (lbs)</div><input type="number" step="0.01" min="0" name="weight_lbs" placeholder="0.00" style="width:100%;"/></div>';
  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Dimensions</div><input type="text" name="dimensions" placeholder="12x8x6 in" style="width:100%;"/></div>';
  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Package Count</div><input type="number" min="1" name="package_count" value="1" style="width:100%;"/></div>';
  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Insurance Value ($)</div><input type="number" step="0.01" min="0" name="insurance_value" placeholder="0.00" style="width:100%;"/></div>';
  html += '<div style="grid-column:1/-1;display:flex;align-items:center;gap:8px;"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.85rem;"><input type="checkbox" name="signature_required" value="1" style="width:auto;accent-color:#c8932a;"/> Signature Required</label></div>';
  html += '<div style="grid-column:1/-1;"><button type="submit" class="btn btn-gold">Add Shipment</button></div></form></div></div>';

  // Shipments table
  html += '<div class="card"><div class="card-header">Shipments</div>';
  html += '<div style="overflow-x:auto;"><table style="min-width:1100px;"><thead><tr>';
  html += '<th>Shipment #</th><th>Carrier</th><th>Tracking</th><th>Weight</th><th>Dims</th><th>Pkgs</th><th>Sig</th><th>Insurance</th><th>Status</th><th>Ship Date</th><th>Est. Delivery</th><th>Delivered</th>';
  html += '</tr></thead><tbody>' + shipRows + '</tbody></table></div></div>';

  return html;
}
