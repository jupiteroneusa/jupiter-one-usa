// admin/orderPaymentBlock.js
// Renders the Payment tab content for /admin/orders/:id

import { currency, shortDate, shortDateTime, statusBadge } from './uiHelpers.js';

export function renderPaymentTab(o, invoices, payments) {
  const totalAmount = parseFloat(o.total_amount || 0);
  const totalPaid = payments.recordset.reduce(function(s, p) { return s + parseFloat(p.amount || 0); }, 0);
  const balance = Math.max(0, totalAmount - totalPaid);
  const isPaid = balance < 0.01;
  const isPartial = totalPaid > 0 && !isPaid;

  let html = '';

  // Payment summary card
  html += '<div class="card" style="margin-bottom:16px;"><div class="card-header">Payment Summary</div><div class="card-body">';
  html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:12px;">';
  html += '<div><div style="font-size:.65rem;letter-spacing:.15em;text-transform:uppercase;color:#7a8a9a;margin-bottom:4px;">Order Total</div><div style="font-size:1.1rem;font-weight:700;">' + currency(totalAmount) + '</div></div>';
  html += '<div><div style="font-size:.65rem;letter-spacing:.15em;text-transform:uppercase;color:#7a8a9a;margin-bottom:4px;">Paid</div><div style="font-size:1.1rem;font-weight:700;color:#4caf50;">' + currency(totalPaid) + '</div></div>';
  html += '<div><div style="font-size:.65rem;letter-spacing:.15em;text-transform:uppercase;color:#7a8a9a;margin-bottom:4px;">Balance Due</div><div style="font-size:1.1rem;font-weight:700;color:' + (balance > 0 ? '#e05050' : '#4caf50') + ';">' + currency(balance) + '</div></div>';
  html += '<div><div style="font-size:.65rem;letter-spacing:.15em;text-transform:uppercase;color:#7a8a9a;margin-bottom:4px;">Status</div><div>' + statusBadge(isPaid ? 'Paid' : (isPartial ? 'Partially Paid' : 'Unpaid')) + '</div></div>';
  html += '</div>';
  html += '<div style="font-size:.78rem;color:#7a8a9a;">Subtotal: <strong style="color:#eef1f5;">' + currency(o.subtotal) + '</strong>';
  if (o.shipping_cost) html += ' &nbsp; + Shipping: <strong style="color:#eef1f5;">' + currency(o.shipping_cost) + '</strong>';
  html += '</div>';
  if (isPaid) html += '<div class="alert alert-success" style="margin-top:12px;">&#10004; Order is paid in full.</div>';
  html += '</div></div>';

  // Record a payment form (only if balance remaining)
  if (balance > 0) {
    html += '<div class="card" style="margin-bottom:16px;"><div class="card-header">Record a Payment</div><div class="card-body">';
    html += '<form method="POST" action="/admin/orders/' + o.id + '/record-payment" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;align-items:flex-end;">';
    html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Amount ($)</div><input type="number" step="0.01" min="0.01" max="' + balance.toFixed(2) + '" name="amount" value="' + balance.toFixed(2) + '" required style="width:100%;"/></div>';
    html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Payment Method</div><select name="payment_method" required><option>Wire Transfer</option><option>Credit Card</option><option>Check</option><option>ACH</option><option>Cash</option><option>Other</option></select></div>';
    html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Date</div><input type="date" name="received_at" value="' + new Date().toISOString().slice(0,10) + '" style="width:100%;"/></div>';
    html += '<div style="grid-column:1/-1;"><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Reference (wire ref, check #, transaction ID)</div><input type="text" name="payment_reference" placeholder="Optional reference" style="width:100%;"/></div>';
    html += '<div style="grid-column:1/-1;"><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Notes</div><input type="text" name="notes" placeholder="Optional notes" style="width:100%;"/></div>';
    html += '<div style="grid-column:1/-1;"><button type="submit" class="btn btn-gold" style="padding:11px 24px;">&#10004; Record Payment</button></div>';
    html += '</form></div></div>';
  }

  // Payment history table
  html += '<div class="card" style="margin-bottom:16px;"><div class="card-header">Payment History (' + payments.recordset.length + ')</div>';
  html += '<table><thead><tr><th>Date</th><th>Method</th><th>Reference</th><th>Notes</th><th style="text-align:right;">Amount</th></tr></thead><tbody>';
  if (payments.recordset.length === 0) {
    html += '<tr><td colspan="5" style="text-align:center;color:#7a8a9a;padding:16px;">No payments recorded yet</td></tr>';
  } else {
    payments.recordset.forEach(function(p) {
      html += '<tr>';
      html += '<td style="color:#7a8a9a;font-size:.78rem;">' + shortDate(p.received_at) + '</td>';
      html += '<td>' + (p.payment_method || '&mdash;') + '</td>';
      html += '<td style="color:#7a8a9a;font-family:monospace;font-size:.78rem;">' + (p.payment_reference || '&mdash;') + '</td>';
      html += '<td style="color:#7a8a9a;font-size:.78rem;">' + (p.notes || '&mdash;') + '</td>';
      html += '<td style="text-align:right;font-weight:600;color:#4caf50;">' + currency(p.amount) + '</td>';
      html += '</tr>';
    });
    html += '<tr><td colspan="4" style="text-align:right;font-weight:700;border-top:2px solid #1e2d42;">Total Paid:</td><td style="text-align:right;font-weight:700;color:#4caf50;border-top:2px solid #1e2d42;">' + currency(totalPaid) + '</td></tr>';
  }
  html += '</tbody></table></div>';

  // Invoices section
  if (invoices.recordset.length) {
    html += '<div class="card"><div class="card-header">Invoices</div>';
    html += '<table><thead><tr><th>Invoice #</th><th>Status</th><th>Total</th><th>Due Date</th></tr></thead><tbody>';
    invoices.recordset.forEach(function(inv) {
      html += '<tr>';
      html += '<td class="mono"><a href="/admin/invoices/' + inv.id + '" style="color:#c8932a;text-decoration:none;">' + inv.invoice_number + '</a></td>';
      html += '<td>' + statusBadge(inv.status) + '</td>';
      html += '<td style="font-weight:600;">' + currency(inv.total_amount) + '</td>';
      html += '<td style="color:#7a8a9a;font-size:.78rem;">' + shortDate(inv.due_date) + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
  } else {
    html += '<div class="card"><div class="card-header">Generate Invoice</div><div class="card-body">';
    html += '<p style="font-size:.85rem;color:#7a8a9a;margin-bottom:16px;">Generate and email a final invoice to the customer including all line items and shipping cost.</p>';
    html += '<form method="POST" action="/admin/orders/' + o.id + '/generate-invoice" onsubmit="return confirm(\'Generate and send invoice to ' + o.email + '?\')">';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">';
    html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Payment Due</div><select name="due_days"><option value="0">Due on Receipt</option><option value="15">Net 15</option><option value="30">Net 30</option></select></div>';
    html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Notes (optional)</div><input type="text" name="notes" placeholder="Additional invoice notes..." style="width:100%;"/></div>';
    html += '</div><button type="submit" class="btn btn-gold">&#128228; Generate &amp; Send Invoice</button></form>';
    html += '</div></div>';
  }

  return html;
}
