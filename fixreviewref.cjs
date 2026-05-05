const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');

// Add customer_ref to review page detail grid - insert after RFQ # line
const old = "      html += '<div class=\"detail-item\"><div class=\"detail-label\">RFQ #</div><div class=\"detail-value\">' + rfq.rfq_number + '</div></div></div>';";
const neu = "      html += '<div class=\"detail-item\"><div class=\"detail-label\">RFQ #</div><div class=\"detail-value\">' + rfq.rfq_number + '</div></div>';\r\n      html += rfq.customer_ref ? '<div class=\"detail-item\"><div class=\"detail-label\">Customer Ref</div><div class=\"detail-value\" style=\"color:#c8932a;font-family:monospace;\">' + rfq.customer_ref + '</div></div>' : '';\r\n      html += '</div>';";

if (a.includes(old)) { a = a.replace(old, neu); console.log('Customer ref: ADDED'); }
else console.log('NOT FOUND');

fs.writeFileSync('admin/index.js', a);
console.log('Done.');
