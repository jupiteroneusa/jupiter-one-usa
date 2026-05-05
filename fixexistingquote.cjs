const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');
const lines = a.split('\n');

// Line 1216 (0-indexed 1215) - exclude drafts from existingQuote check
if (lines[1215].includes("SELECT id, quote_number FROM quotes WHERE rfq_id=@rfqId2")) {
  lines[1215] = "        .query(\"SELECT id, quote_number FROM quotes WHERE rfq_id=@rfqId2 AND status<>'Draft' AND quote_number NOT LIKE '%-D'\");";
  console.log('existingQuote check: FIXED');
} else console.log('NOT FOUND:', JSON.stringify(lines[1215]));

fs.writeFileSync('admin/index.js', lines.join('\n'));
console.log('Done.');
