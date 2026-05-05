const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');
const lines = a.split('\n');

// Line 1270 (0-indexed 1269) - quote = qr.recordset[0] in INSERT path
const insertQuoteLine = lines.findIndex((l, i) => i >= 1268 && i <= 1275 && l.trim() === 'quote = qr.recordset[0];');
console.log('INSERT quote line:', insertQuoteLine + 1, JSON.stringify(lines[insertQuoteLine]));

if (insertQuoteLine > -1) {
  // Add null check - if OUTPUT failed, fetch by quote number
  lines.splice(insertQuoteLine + 1, 0,
    "        if (!quote) {",
    "          const fb = await pool.request().input('qnFb', sql.NVarChar(20), quoteNumber)",
    "            .query('SELECT id, quote_number FROM quotes WHERE quote_number=@qnFb');",
    "          quote = fb.recordset[0];",
    "        }"
  );
  console.log('INSERT null check: ADDED');
}

fs.writeFileSync('admin/index.js', lines.join('\n'));
console.log('Done.');
