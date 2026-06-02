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
      // MARK_CHARGED_V1
      const auth = (authorizations || []).find(function(a) { return a.proforma_id === pf.id; });
      let authCell;
      if (auth && auth.captured_at) {
        // Already charged
        const refLine = auth.captured_reference ? '<div style="font-size:.7rem;color:#7a8a9a;">ref: ' + auth.captured_reference + '</div>' : '';
        authCell = '<div style="color:#4caf50;">\u2713 Charged ' + shortDate(auth.captured_at) + (auth.card_last4 ? ' \u00B7 ending ' + auth.card_last4 : '') + ' <a href="/admin/cc-authorizations/' + auth.id + '/pdf" target="_blank" style="color:#c8932a;font-size:.7rem;margin-left:6px;">[PDF]</a></div>' + refLine; /* CC_AUTH_PDF_v1 */
      } else if (auth && auth.status === 'Signed') {
        // Signed, not yet captured -> show button
        const amt = parseFloat(auth.amount_authorized || pf.total || 0);
        authCell = '<div style="color:#4caf50;font-size:.78rem;">\u2713 Signed ' + shortDate(auth.signed_at) + (auth.card_last4 ? ' \u00B7 ending ' + auth.card_last4 : '') + ' <a href="/admin/cc-authorizations/' + auth.id + '/pdf" target="_blank" style="color:#c8932a;font-size:.7rem;margin-left:6px;">[PDF]</a></div>' +
          '<button type="button" onclick="openCharge(' + auth.id + ',' + amt + ',\'' + (auth.card_last4 || '') + '\')" class="btn btn-gold btn-sm" style="margin-top:6px;font-size:.7rem;padding:4px 10px;">Mark CC Charged</button>';
      } else if (auth) {
        authCell = '<span style="color:#7a8a9a;">Pending</span>';
      } else {
        authCell = (pf.payment_method === 'Credit Card' ? '<span style="color:#7a8a9a;">Awaiting signature</span>' : '<span style="color:#7a8a9a;">N/A</span>');
      }
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

  // BILL_TO_BUYER_v1: Billing Recipient section (optional buyer/cardholder different from customer)
  html += '<div class="card" style="margin-bottom:20px;border-left:3px solid #c8932a;"><div class="card-body">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">';
  html += '<div style="font-size:.78rem;letter-spacing:.1em;text-transform:uppercase;color:#c8932a;font-weight:700;">&#128179; Billing Recipient (optional)</div>';
  html += '<div style="font-size:.7rem;color:#7a8a9a;">Leave blank to bill the customer directly</div>';
  html += '</div>';
  html += '<p style="font-size:.78rem;color:#7a8a9a;margin:0 0 12px;">When a different person (buyer/cardholder) places the order on behalf of the customer, fill these in. Proforma email + CC auth link will go to this person.</p>';
  html += '<form method="POST" action="/admin/orders/' + o.id + '/buyer-update" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">';
  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Buyer Name</div>';
  html += '<input type="text" name="buyer_name" value="' + ((o.buyer_name || '').toString().replace(/"/g,"&quot;")) + '" placeholder="e.g. Mary Smith" style="width:100%;"/></div>';
  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Buyer Email</div>';
  html += '<input type="email" name="buyer_email" value="' + ((o.buyer_email || '').toString().replace(/"/g,"&quot;")) + '" placeholder="mary@company.com" style="width:100%;"/></div>';
  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Buyer Phone</div>';
  html += '<input type="text" name="buyer_phone" value="' + ((o.buyer_phone || '').toString().replace(/"/g,"&quot;")) + '" placeholder="(optional)" style="width:100%;"/></div>';
  html += '<div></div>';
  html += '<div style="grid-column:1/-1;border-top:1px solid #1e2d42;padding-top:10px;margin-top:4px;"><div style="font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:#7a8a9a;font-weight:700;margin-bottom:6px;">Bill-To Address (for credit card)</div></div>';
  html += '<div style="grid-column:1/-1;"><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Street Address</div>';
  html += '<input type="text" name="bill_to_address1" value="' + ((o.bill_to_address1 || '').toString().replace(/"/g,"&quot;")) + '" placeholder="e.g. 123 Main St" style="width:100%;"/></div>';
  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">City</div>';
  html += '<input type="text" name="bill_to_city" value="' + ((o.bill_to_city || '').toString().replace(/"/g,"&quot;")) + '" style="width:100%;"/></div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">';
  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">State</div>';
  html += '<input type="text" name="bill_to_state" value="' + ((o.bill_to_state || '').toString().replace(/"/g,"&quot;")) + '" style="width:100%;"/></div>';
  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Zip</div>';
  html += '<input type="text" name="bill_to_zip" value="' + ((o.bill_to_zip || '').toString().replace(/"/g,"&quot;")) + '" style="width:100%;"/></div>';
  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Country</div>';
  html += '<input type="text" name="bill_to_country" value="' + ((o.bill_to_country || 'USA').toString().replace(/"/g,"&quot;")) + '" style="width:100%;"/></div>';
  html += '</div>';
  html += '<div style="grid-column:1/-1;display:flex;gap:8px;align-items:center;">';
  html += '<button type="submit" class="btn btn-outline btn-sm">Save Billing Recipient</button>';
  html += '<button type="button" onclick="if(confirm(\u0027Clear billing recipient? Proforma will go to the customer.\u0027)){this.form.buyer_name.value=\u0027\u0027;this.form.buyer_email.value=\u0027\u0027;this.form.buyer_phone.value=\u0027\u0027;this.form.bill_to_address1.value=\u0027\u0027;this.form.bill_to_city.value=\u0027\u0027;this.form.bill_to_state.value=\u0027\u0027;this.form.bill_to_zip.value=\u0027\u0027;this.form.bill_to_country.value=\u0027\u0027;this.form.submit();}" class="btn btn-outline btn-sm" style="color:#e05050;border-color:#5a2828;">Clear</button>';
  if (o.buyer_email) html += '<span style="font-size:.72rem;color:#4caf50;margin-left:6px;">&#10003; Buyer set</span>';
  html += '</div>';
  html += '</form>';
  html += '</div></div>';
  html += '<p style="font-size:.85rem;color:#7a8a9a;margin-bottom:14px;">Generate a proforma invoice with payment instructions. For CC payments, customer receives an e-sign link to authorize the charge (no full card data is stored).</p>';
  html += '<form method="POST" action="/admin/orders/' + o.id + '/send-proforma" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">';

    // BILL_TO_BUYER_v1: CC additional recipients
  html += '<div style="grid-column:1/-1;"><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">CC additional recipients (comma-separated emails, optional)</div>';
  html += '<input type="text" name="cc_emails" placeholder="e.g. jake@company.com, accounting@company.com" style="width:100%;"/></div>';

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

  html += '<div style="grid-column:1/-1;display:flex;gap:10px;">' +
    '<button type="button" class="btn btn-outline" onclick="(function(f){var a=f.getAttribute(\'action\'),t=f.getAttribute(\'target\');f.setAttribute(\'action\',\'/admin/orders/' + o.id + '/proforma-preview\');f.setAttribute(\'target\',\'_blank\');f.submit();f.setAttribute(\'action\',a);if(t){f.setAttribute(\'target\',t);}else{f.removeAttribute(\'target\');}})(this.form)">Generate &amp; Preview</button>' +
    '<button type="submit" class="btn btn-gold">Generate &amp; Send Proforma</button></div>'; /* PROFORMA_PREVIEW_v1 */
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

  // MARK_CHARGED_V1: capture modal + script
  html += '<div id="charge-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;align-items:center;justify-content:center;">';
  html += '<div style="background:#0a1628;border:1px solid #c8932a;padding:28px;max-width:480px;width:90%;border-radius:6px;">';
  html += '<h3 style="margin:0 0 6px;color:#c8932a;font-size:1.1rem;">Mark Credit Card Charged</h3>';
  html += '<p style="margin:0 0 18px;font-size:.85rem;color:#7a8a9a;">Records that you ran the card through your payment processor. This will move the order to Paid status.</p>';
  html += '<form method="POST" id="charge-form">';
  html += '<input type="hidden" name="auth_id" id="ch_auth_id"/>';
  html += '<div style="margin-bottom:14px;"><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Amount Charged ($)</div>';
  html += '<input type="number" step="0.01" min="0" name="captured_amount" id="ch_amount" required style="width:100%;"/></div>';
  html += '<div style="margin-bottom:14px;"><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Card</div>';
  html += '<input type="text" id="ch_card_display" readonly style="width:100%;background:#111e30;color:#7a8a9a;"/></div>';
  html += '<div style="margin-bottom:14px;"><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Transaction Reference / ID <span style="color:#c8932a;">*</span></div>';
  html += '<input type="text" name="captured_reference" required placeholder="e.g. Stripe ch_3PaQ... or Square ABC123" style="width:100%;"/></div>';
  html += '<div style="margin-bottom:18px;"><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Notes (optional)</div>';
  html += '<textarea name="notes" rows="2" style="width:100%;" placeholder="Optional notes..."></textarea></div>';
  html += '<div style="display:flex;gap:10px;justify-content:flex-end;">';
  html += '<button type="button" onclick="closeCharge()" class="btn btn-outline">Cancel</button>';
  html += '<button type="submit" class="btn btn-gold">Record Charge</button>';
  html += '</div></form></div></div>';

  html += '<script>';
  html += 'function openCharge(authId, amount, last4) {';
  html += 'document.getElementById("ch_auth_id").value = authId;';
  html += 'document.getElementById("ch_amount").value = amount.toFixed(2);';
  html += 'document.getElementById("ch_card_display").value = last4 ? "Visa/MC ending " + last4 : "Card on file";';
  html += 'document.getElementById("charge-form").action = "/admin/orders/' + o.id + '/cc-auth/" + authId + "/capture";';
  html += 'document.getElementById("charge-modal").style.display = "flex";';
  html += '}';
  html += 'function closeCharge() { document.getElementById("charge-modal").style.display = "none"; }';
  html += '</script>';

  return html;
}
