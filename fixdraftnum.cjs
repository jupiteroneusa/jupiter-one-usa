const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');
const lines = a.split('\n');

// Find line with quoteNumber for draft (line 926, 0-indexed 925)
const qnLine = lines.findIndex((l, i) => i >= 920 && i <= 932 && l.includes("rfq.rfq_number.replace(/^RFQ-/, 'QT-')"));
console.log('Quote number line:', qnLine + 1, lines[qnLine]);

if (qnLine > -1) {
  // Change draft quote number to use -D suffix to avoid conflicts
  lines[qnLine] = lines[qnLine].replace(
    "rfq.rfq_number.replace(/^RFQ-/, 'QT-')",
    "rfq.rfq_number.replace(/^RFQ-/, 'QT-') + '-D'"
  );
  console.log('Draft quote number: FIXED');
}

// Also fix the check - check for ANY quote with this rfq_id that has -D suffix
const checkLine = lines.findIndex((l, i) => i >= 925 && i <= 935 && l.includes("WHERE rfq_id=@rfqId AND status='Draft'"));
console.log('Check line:', checkLine + 1);
if (checkLine > -1) {
  lines[checkLine] = lines[checkLine].replace(
    "WHERE rfq_id=@rfqId AND status='Draft'",
    "WHERE rfq_id=@rfqId AND status='Draft' OR (rfq_id=@rfqId AND quote_number LIKE '%-D')"
  );
  // Actually simpler - just check by quote_number ending in -D
  lines[checkLine] = "        .query(\"SELECT id FROM quotes WHERE rfq_id=@rfqId AND quote_number LIKE '%-D'\");";
  console.log('Check: FIXED');
}

// Fix the UPDATE query too
const updateLine = lines.findIndex((l, i) => i >= 935 && i <= 950 && l.includes("WHERE rfq_id=@rfqId AND status='Draft'"));
if (updateLine > -1) {
  lines[updateLine] = lines[updateLine].replace(
    "WHERE rfq_id=@rfqId AND status='Draft'",
    "WHERE rfq_id=@rfqId AND quote_number LIKE '%-D'"
  );
  console.log('Update query: FIXED');
}

fs.writeFileSync('admin/index.js', lines.join('\n'));
console.log('Done.');
