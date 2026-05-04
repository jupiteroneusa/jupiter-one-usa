const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');

// 1. Add customer_ref to SELECT in RFQ list query
const oldSelect = `          c.id AS customer_id, c.first_name+' '+c.last_name AS customer_name, c.company, c.email,`;
const newSelect = `          c.id AS customer_id, c.first_name+' '+c.last_name AS customer_name, c.company, c.email, h.customer_ref,`;
if (a.includes(oldSelect)) { a = a.replace(oldSelect, newSelect); console.log('SELECT: FIXED'); }
else console.log('SELECT: NOT FOUND');

// 2. Add Cust Ref column header - find the Email th and add after it
const oldEmail = `            <th>Email</th>\n            \${sortLink('lines','Lines')}`;
const newEmail = `            <th>Email</th>\n            <th>Cust Ref</th>\n            \${sortLink('lines','Lines')}`;
if (a.includes(oldEmail)) { a = a.replace(oldEmail, newEmail); console.log('Header: FIXED'); }
else {
  // try without template literal issue
  const idx = a.indexOf('<th>Email</th>');
  if (idx > -1) {
    a = a.slice(0, idx) + '<th>Email</th>\n            <th>Cust Ref</th>' + a.slice(idx + '<th>Email</th>'.length);
    console.log('Header: FIXED (direct)');
  } else console.log('Header: NOT FOUND');
}

fs.writeFileSync('admin/index.js', a);
console.log('Done.');
