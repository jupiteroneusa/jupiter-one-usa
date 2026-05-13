// admin/orderProformaBlock.js
// Renders Proforma tab on order detail page.

import { currency, shortDate, statusBadge } from './uiHelpers.js';

export function renderProformaTab(o, proformas, authorizations, baseUrl) {
  let html = '';

  // === EXISTING PROFORMAS ===
  if (proformas && proformas.length) {
    html += '<div class="card" style="margin-bottom:20px;"><div class="card-header">Proformas Sent</div>';
    html += '<div style="overflow-x:auto;"><table style="min-width:900px;"><thead><tr>';
    html += '<th>Proforma #</th><th>Sent</th><th>Method</th><th>Subtotal</th><th>Shipping</th><th>CC Fee</th><th>Total</th><th>Status</th><th>CC Auth</th>';
    html += '</tr></thead><tbody>';
    proformas.forEach(function(pf) {
      const auth = (authorizations || []).find(function(a) { return a.proforma_id === pf.id; });
      const authCell = auth
        ? (auth.status === 'Signed'
            ? '<span style="color:#4caf50;">\u2713 Signed ' + shortDate(auth.signed_at) + (auth.card_last4 ? ' \u00B7 ending ' + auth.card_last4 : '') + '</span>'
            : '<span style="color:#7a8a9a;">Pending</span>')
        : (pf.payment_method === 'Credit Card' ? '<span style="color:#7a8a9a;">Awaiting signature</span>' : '<span style="color:#7a8a9a;">N/A</span>');
      html += '<tr>';
      html += '<td class="mono"><a href="/admin/proformas/' + pf.id + '/pdf" target="_blank" style="color:#c8932a;">' + pf.proforma_number + '</a></td>';
      html += '<td style="font-size:.78rem;">' + shortDate(pf.sent_at) + '</td>';
      html += '<td>' + pf.payment_method + '</td>';
      html += '<td>' + currency(pf.subtotal) + '</td>';
      html += '<td>' + currency(pf.shipping_cost) + '</td>';
      html += '<td>' + (parseFloat(pf.cc_fee_amount) > 0 ? currency(pf.cc_fee_amount) : '\u2014') + '</td>';
      html += '<td style="font-weight:600;color:#c8932a;">' + currency(pf.total) + '</td>';
      html += '<td>' + statusBadge(pf.status) + '</td>';
      html += '<td style="font-size:.78rem;">' + authCell + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div></div>';
  }

  // === SEND NEW PROFORMA FORM ===
  html += '<div class="card"><div class="card-header">Send Proforma to Customer</div><div class="card-body">';
  html += '<p style="font-size:.85rem;color:#7a8a9a;margin-bottom:14px;">Generate a proforma invoice with payment instructions. For CC payments, customer receives an e-sign link to authorize the charge (no full card data is stored).</p>';
  html += '<form method="POST" action="/admin/orders/' + o.id + '/send-proforma" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">';

  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Payment Method</div>';
  html += '<select name="payment_method" id="pf_method" onchange="window._pfCalc&&window._pfCalc()" style="width:100%;">';
  html += '<option value="Credit Card">Credit Card (adds 3.5% fee)</option>';
  html += '<option value="Wire Transfer">Wire Transfer</option>';
  html += '<option value="Net 30">Net 30</option>';
  html += '</select></div>';

  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Estimated Shipping Cost ($)</div>';
  html += '<input type="number" step="0.01" min="0" name="shipping_cost" id="pf_ship" value="' + (o.shipping_cost || 0) + '" onchange="window._pfCalc&&window._pfCalc()" style="width:100%;"/></div>';

  html += '<div style="grid-column:1/-1;"><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Notes (optional)</div>';
  html += '<textarea name="notes" rows="2" style="width:100%;" placeholder="Optional notes for the customer..."></textarea></div>';

  // Calc preview
  html += '<div style="grid-column:1/-1;background:#0a1628;padding:14px;border:1px solid #1e2d42;">';
  html += '<div style="font-size:.7rem;letter-spacing:.15em;text-transform:uppercase;color:#c8932a;margin-bottom:10px;font-weight:700;">Total Preview</div>';
  html += '<div style="display:grid;grid-template-columns:1fr auto;gap:6px;font-size:.9rem;">';
  html += '<div style="color:#7a8a9a;">Subtotal:</div><div id="pf_sub" style="text-align:right;">' + currency(o.subtotal || 0) + '</div>';
  html += '<div style="color:#7a8a9a;">Shipping:</div><div id="pf_ship_d" style="text-align:right;">' + currency(o.shipping_cost || 0) + '</div>';
  html += '<div style="color:#7a8a9a;" id="pf_fee_label">CC Fee (3.5%):</div><div id="pf_fee" style="text-align:right;">$0.00</div>';
  html += '<div style="border-top:1px solid #1e2d42;padding-top:8px;margin-top:6px;color:#c8932a;font-weight:700;">TOTAL DUE:</div>';
  html += '<div id="pf_total" style="border-top:1px solid #1e2d42;padding-top:8px;margin-top:6px;text-align:right;color:#c8932a;font-weight:700;font-size:1.1rem;">$0.00</div>';
  html += '</div></div>';

  html += '<div style="grid-column:1/-1;"><button type="submit" class="btn btn-gold">Generate &amp; Send Proforma</button></div>';
  html += '</form>';

  // Live calc script
  html += '<script>(function(){var sub=' + parseFloat(o.subtotal || 0) + ';';
  html += 'window._pfCalc=function(){';
  html += 'var ship=parseFloat(document.getElementById("pf_ship").value)||0;';
  html += 'var method=document.getElementById("pf_method").value;';
  html += 'var feePercent=(method==="Credit Card")?3.5:0;';
  html += 'var preFeeTotal=sub+ship;';
  html += 'var fee=preFeeTotal*feePercent/100;';
  html += 'var total=preFeeTotal+fee;';
  html += 'var fmt=function(v){return"$"+v.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});};';
  html += 'document.getElementById("pf_ship_d").textContent=fmt(ship);';
  html += 'document.getElementById("pf_fee_label").textContent=feePercent>0?"CC Fee ("+feePercent+"%):":"CC Fee (N/A):";';
  html += 'document.getElementById("pf_fee").textContent=fmt(fee);';
  html += 'document.getElementById("pf_total").textContent=fmt(total);';
  html += '};window._pfCalc();})();</script>';

  html += '</div></div>';

  return html;
}
