const fs = require('fs');

let a = fs.readFileSync('admin/index.js', 'utf8');
a = a.replace(
  '<td class="mono text-gold">${q.quote_number}</td>',
  '<td class="mono text-gold"><a href="/admin/quotes/${q.id}" style="color:#c8932a;">${q.quote_number}</a></td>'
);
a = a.replace(
  '<td class="mono" style="color:#7a8a9a;">${q.rfq_number}</td>',
  '<td class="mono"><a href="/admin/rfqs/${q.rfq_id}" style="color:#c8932a;">${q.rfq_number}</a></td>'
);
fs.writeFileSync('admin/index.js', a);
console.log('admin/index.js done');

let m = fs.readFileSync('services/mailer.js', 'utf8');
m = m.replace('NSN &amp; Aerospace Component Sourcing', 'Aerospace &amp; Defense Component Supplier');
fs.writeFileSync('services/mailer.js', m);
console.log('mailer.js done');
