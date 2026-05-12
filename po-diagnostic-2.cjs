// po-diagnostic-2.cjs
// Pulls actual UI code chunks Claude needs to see.
const fs = require('fs');

function dump(file, label) {
  console.log(`\n========== ${label} (${file}) ==========\n`);
  if (!fs.existsSync(file)) { console.log('FILE NOT FOUND'); return; }
  console.log(fs.readFileSync(file, 'utf8'));
}

// Full supplierPoRoutes — small enough to dump entirely
dump('admin/supplierPoRoutes.js', 'SUPPLIER PO ROUTES (FULL)');

// Full documents route
dump('routes/documents.js', 'DOCUMENTS ROUTE (FULL)');

// Print Q11 + Q12 SQL queries for SSMS
console.log(`\n========== RUN IN SSMS ==========\n
-- Q11: documents table schema
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'documents'
ORDER BY ORDINAL_POSITION;

-- Q12: receiving_log schema
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'receiving_log'
ORDER BY ORDINAL_POSITION;

-- Q13: supplier_pos status values currently used
SELECT status, COUNT(*) AS cnt FROM supplier_pos GROUP BY status;

-- Q14: do any supplier_pos have a sent_at or similar field already?
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'supplier_pos' AND
      (COLUMN_NAME LIKE '%sent%' OR COLUMN_NAME LIKE '%email%');
`);
