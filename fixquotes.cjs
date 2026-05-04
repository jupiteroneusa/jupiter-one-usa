const fs = require('fs');

let a = fs.readFileSync('admin/index.js', 'utf8');

const before1 = '<td class="mono text-gold">${q.quote_number}</td>';
const after1  = '<td class="mono text-gold"><a href="/admin/quotes/${q.id}" style="color:#c8932a;">${q.quote_number}</a></td>';

const before2 = '<td class="mono" style="color:#7a8a9a;">${q.rfq_number}</td>';
const after2  = '<td class="mono"><a href="/admin/rfqs/${q.rfq_id}" style="color:#c8932a;">${q.rfq_number}</a></td>';

if (a.includes(before1)) {
  a = a.replace(before1, after1);
  console.log('Quote # link: FIXED');
} else {
  console.log('Quote # link: NOT FOUND - already fixed or mismatch');
}

if (a.includes(before2)) {
  a = a.replace(before2, after2);
  console.log('RFQ # link: FIXED');
} else {
  console.log('RFQ # link: NOT FOUND - already fixed or mismatch');
}

fs.writeFileSync('admin/index.js', a);
console.log('Done.');
