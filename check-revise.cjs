// check-revise.cjs
const fs = require('fs');

console.log('========== Existing revise/reissue routes ==========\n');

const files = ['admin/index.js', 'admin/quoteRoutes.js', 'admin/quoteBuilder.js'];
files.forEach(function(f) {
  if (!fs.existsSync(f)) return;
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  console.log('--- ' + f + ' ---');
  lines.forEach(function(line, i) {
    if (
      /revise/i.test(line) ||
      /reissue/i.test(line) ||
      /superseded/i.test(line) ||
      /\/revise/i.test(line) ||
      /\/reissue/i.test(line) ||
      /reissued_count/i.test(line) ||
      /quote_version/i.test(line) ||
      /supersedes/i.test(line)
    ) {
      console.log('  L' + (i+1) + ': ' + line.trim().substring(0, 180));
    }
  });
  console.log('');
});

console.log('\n========== SQL: check quote-related columns ==========\n');
console.log(`-- Run in SSMS to check what version/revision columns already exist:
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('quotes', 'quote_versions', 'quote_history')
  AND (COLUMN_NAME LIKE '%version%'
       OR COLUMN_NAME LIKE '%revis%'
       OR COLUMN_NAME LIKE '%supersed%'
       OR COLUMN_NAME LIKE '%reissu%'
       OR COLUMN_NAME LIKE '%previous%'
       OR COLUMN_NAME LIKE '%parent%')
ORDER BY TABLE_NAME, COLUMN_NAME;`);
