const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');

const oldInsert = `          INSERT INTO rfq_headers (customer_id, rfq_number, status, priority, notes)
          OUTPUT INSERTED.id
          VALUES (@customerId, @rfqNumber, @status, @priority, @notes)`;

const newInsert = `          INSERT INTO rfq_headers (customer_id, rfq_number, status, priority, notes, customer_ref)
          OUTPUT INSERTED.id
          VALUES (@customerId, @rfqNumber, @status, @priority, @notes, @customerRef)`;

if (a.includes(oldInsert)) {
  // Also need to add the input before the query
  a = a.replace(
    `.input('notes', sql.NVarChar(sql.MAX), notes || null)\n        .query(\`\n          INSERT INTO rfq_headers (customer_id, rfq_number, status, priority, notes)\n          OUTPUT INSERTED.id\n          VALUES (@customerId, @rfqNumber, @status, @priority, @notes)`,
    `.input('notes', sql.NVarChar(sql.MAX), notes || null)\n        .input('customerRef', sql.NVarChar(100), customer_ref?.trim() || null)\n        .query(\`\n          INSERT INTO rfq_headers (customer_id, rfq_number, status, priority, notes, customer_ref)\n          OUTPUT INSERTED.id\n          VALUES (@customerId, @rfqNumber, @status, @priority, @notes, @customerRef)`
  );
  console.log('INSERT: FIXED');
} else {
  console.log('INSERT: NOT FOUND - trying direct replace');
  a = a.replace(
    'INSERT INTO rfq_headers (customer_id, rfq_number, status, priority, notes)',
    'INSERT INTO rfq_headers (customer_id, rfq_number, status, priority, notes, customer_ref)'
  );
  a = a.replace(
    'VALUES (@customerId, @rfqNumber, @status, @priority, @notes)',
    'VALUES (@customerId, @rfqNumber, @status, @priority, @notes, @customerRef)'
  );
  console.log('INSERT: direct replace done');
}

fs.writeFileSync('admin/index.js', a);
console.log('Done.');
