const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');

const old = `        .input('source', sql.NVarChar(50), source || 'Phone')
        .query(\`
          INSERT INTO rfq_headers (customer_id, rfq_number, status, priority, notes)
          OUTPUT INSERTED.id
          VALUES (@customerId, @rfqNumber, @status, @priority, @notes)`;

const neu = `        .input('source', sql.NVarChar(50), source || 'Phone')
        .input('customerRef', sql.NVarChar(100), customer_ref?.trim() || null)
        .query(\`
          INSERT INTO rfq_headers (customer_id, rfq_number, status, priority, notes, customer_ref)
          OUTPUT INSERTED.id
          VALUES (@customerId, @rfqNumber, @status, @priority, @notes, @customerRef)`;

if (a.includes(old)) { a = a.replace(old, neu); console.log('FIXED'); }
else console.log('NOT FOUND');

fs.writeFileSync('admin/index.js', a);
console.log('Done.');
