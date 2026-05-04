const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');

const old = `GROUP BY h.id,h.rfq_number,h.status,h.priority,h.submitted_at,c.id,c.first_name,c.last_name,c.company,c.email`;
const neu = `GROUP BY h.id,h.rfq_number,h.status,h.priority,h.submitted_at,h.customer_ref,c.id,c.first_name,c.last_name,c.company,c.email`;

if (a.includes(old)) { a = a.replace(old, neu); console.log('FIXED'); }
else console.log('NOT FOUND');

fs.writeFileSync('admin/index.js', a);
console.log('Done.');
