// admin/orderOverviewBlock.js
// Renders the Overview tab content for /admin/orders/:id
// Imported by admin/orderRoutes.js

import {
  currency, shortDate, shortDateTime,
  priorityBadge, statusBadge,
  lifecycleTimeline,
  inputField, selectField, textareaField, checkboxField
} from './uiHelpers.js';

export function renderOverviewTab(o, sLog) {
  const logRows = sLog.recordset.map(function(l) {
    return '<tr>' +
      '<td style="color:#7a8a9a;font-size:.78rem;">' + shortDateTime(l.created_at) + '</td>' +
      '<td>' + statusBadge(l.new_status) + '</td>' +
      '<td style="color:#7a8a9a;">' + (l.note || '&mdash;') + '</td>' +
    '</tr>';
  }).join('') || '<tr><td colspan="3" style="text-align:center;color:#7a8a9a;padding:12px;">No history</td></tr>';

  const statuses = ['Confirmed','Processing','Ready to Ship','Shipped','Delivered','Cancelled'];
  const statusOpts = statuses.map(function(st) {
    return '<option value="' + st + '"' + (o.status === st ? ' selected' : '') + '>' + st + '</option>';
  }).join('');

  let html = '';

  // Lifecycle timeline at the top
  html += lifecycleTimeline(o);

  // Detail grid
  html += '<div class="detail-grid" style="margin-bottom:20px;">';
  html += '<div class="detail-item"><div class="detail-label">Order #</div><div class="detail-value" style="font-family:monospace;color:#c8932a;">' + o.order_number + '</div></div>';
  html += '<div class="detail-item"><div class="detail-label">Customer</div><div class="detail-value"><a href="/admin/customers/' + o.customer_id + '" style="color:#c8932a;">' + o.customer_name + '</a></div></div>';
  html += '<div class="detail-item"><div class="detail-label">Company</div><div class="detail-value">' + (o.company || '&mdash;') + '</div></div>';
  html += '<div class="detail-item"><div class="detail-label">Email</div><div class="detail-value"><a href="mailto:' + o.email + '" style="color:#c8932a;">' + o.email + '</a></div></div>';
  html += '<div class="detail-item"><div class="detail-label">Quote</div><div class="detail-value">' + (o.quote_number ? '<a href="/admin/quotes/' + o.quote_id + '" style="color:#c8932a;">' + o.quote_number + '</a>' : '&mdash;') + '</div></div>';
  html += '<div class="detail-item"><div class="detail-label">RFQ</div><div class="detail-value">' + (o.rfq_number ? '<a href="/admin/rfqs/' + o.rfq_id + '" style="color:#c8932a;">' + o.rfq_number + '</a>' : '&mdash;') + '</div></div>';
  html += '<div class="detail-item"><div class="detail-label">Priority</div><div class="detail-value">' + priorityBadge(o.priority) + '</div></div>';
  html += '<div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">' + statusBadge(o.status) + '</div></div>';
  html += '<div class="detail-item"><div class="detail-label">Subtotal</div><div class="detail-value">' + currency(o.subtotal) + '</div></div>';
  html += '<div class="detail-item"><div class="detail-label">Shipping</div><div class="detail-value">' + (o.shipping_cost ? currency(o.shipping_cost) : '<span style="color:#e05050;">Not set</span>') + '</div></div>';
  html += '<div class="detail-item"><div class="detail-label">Total</div><div class="detail-value" style="font-weight:700;color:#c8932a;font-size:1.1rem;">' + currency(o.total_amount) + '</div></div>';
  html += '<div class="detail-item"><div class="detail-label">Paid Amount</div><div class="detail-value" style="font-weight:600;color:' + (parseFloat(o.paid_amount || 0) >= parseFloat(o.total_amount || 0) ? '#4caf50' : '#7a8a9a') + ';">' + currency(o.paid_amount) + '</div></div>';
  html += '<div class="detail-item"><div class="detail-label">Confirmed</div><div class="detail-value">' + shortDateTime(o.confirmed_at) + '</div></div>';
  html += '<div class="detail-item"><div class="detail-label">Assigned To</div><div class="detail-value">' + (o.assigned_to || '<span style="color:#7a8a9a;">Unassigned</span>') + '</div></div>';
  html += '<div class="detail-item"><div class="detail-label">Contract #</div><div class="detail-value">' + (o.contract_number || '&mdash;') + '</div></div>';
  html += '<div class="detail-item"><div class="detail-label">Destination Country</div><div class="detail-value">' + (o.country_of_destination || '&mdash;') + '</div></div>';
  html += '</div>';

  // Order Details form (priority, assigned, contract, internal notes)
  html += '<div class="card" style="margin-bottom:16px;"><div class="card-header">Order Details (Internal)</div><div class="card-body">';
  html += '<form method="POST" action="/admin/orders/' + o.id + '/overview-update">';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">';
  html += selectField('Priority', 'priority', o.priority || 'Standard', ['Standard','Urgent','AOG']);
  html += inputField('Assigned To', 'assigned_to', o.assigned_to);
  html += inputField('Contract Number', 'contract_number', o.contract_number);
  html += inputField('Country of Destination', 'country_of_destination', o.country_of_destination);
  html += '</div>';
  html += '<div style="margin-bottom:12px;">';
  html += checkboxField('End-Use Certification Required (ITAR/EAR)', 'end_use_cert_required', o.end_use_cert_required);
  html += '</div>';
  html += textareaField('Internal Notes (not visible to customer)', 'internal_notes', o.internal_notes, 4);
  html += '<button type="submit" class="btn btn-gold">Save Order Details</button>';
  html += '</form>';
  html += '</div></div>';

  // Update Status section
  html += '<div class="card" style="margin-bottom:16px;"><div class="card-header">Update Status</div><div class="card-body">';
  html += '<form method="POST" action="/admin/orders/' + o.id + '/status" style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">';
  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">New Status</div><select name="status">' + statusOpts + '</select></div>';
  html += '<div style="flex:1;min-width:200px;"><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Note</div><input type="text" name="note" placeholder="Add a note..." style="width:100%;"/></div>';
  html += '<button type="submit" class="btn btn-gold">Update</button></form>';
  html += '</div></div>';

  // Status History
  html += '<div class="card"><div class="card-header">Status History</div>';
  html += '<table><thead><tr><th>Date</th><th>Status</th><th>Note</th></tr></thead><tbody>' + logRows + '</tbody></table>';
  html += '</div>';

  return html;
}
