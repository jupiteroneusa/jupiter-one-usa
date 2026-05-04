const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');

const old = `\${rfq.customer_ref ? \`<div class="detail-item"><div class="detail-label">Customer Ref</div><div class="detail-value" style="color:#c8932a;font-family:monospace;">\${rfq.customer_ref}</div></div>\` : ''}`;
const neu = `\${rfq.customer_ref ? \`<div class="detail-item"><div class="detail-label">Customer Ref</div><div class="detail-value"><a href="/admin/rfqs?ref=\${rfq.customer_ref}" style="color:#c8932a;font-family:monospace;">\${rfq.customer_ref}</a></div></div>\` : ''}`;

if (a.includes(old)) { a = a.replace(old, neu); console.log('FIXED'); }
else console.log('NOT FOUND');

fs.writeFileSync('admin/index.js', a);
console.log('Done.');
