const fs = require('fs');
let c = fs.readFileSync('admin/index.js', 'utf8');

// Add customer_id to dashboard query
c = c.replace(
  'c.first_name + \' \' + c.last_name AS customer_name,\n        c.company, c.email,\n        COUNT(l.id) AS line_count\n      FROM rfq_headers h\n      JOIN customers c ON c.id = h.customer_id\n      LEFT JOIN rfq_lines l ON l.rfq_id = h.id\n      GROUP BY h.rfq_number,h.status,h.priority,h.submitted_at,c.first_name,c.last_name,c.company',
  'c.id AS customer_id, c.first_name + \' \' + c.last_name AS customer_name,\n        c.company, c.email,\n        COUNT(l.id) AS line_count\n      FROM rfq_headers h\n      JOIN customers c ON c.id = h.customer_id\n      LEFT JOIN rfq_lines l ON l.rfq_id = h.id\n      GROUP BY h.rfq_number,h.status,h.priority,h.submitted_at,c.id,c.first_name,c.last_name,c.company'
);

fs.writeFileSync('admin/index.js', c);
console.log('done');