const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');
const lines = a.split('\n');

// Line 1238 (0-indexed 1237) - add null check after quote = qr.recordset[0]
if (lines[1237].includes('quote = qr.recordset[0]')) {
  lines.splice(1238, 0, 
    "        if (!quote) {",
    "          // OUTPUT returned nothing - fetch the existing quote",  
    "          const fallback = await pool.request().input('rfqIdFb', sql.BigInt, rfq.id)",
    "            .query(\"SELECT id, quote_number FROM quotes WHERE rfq_id=@rfqIdFb AND status='Sent' ORDER BY updated_at DESC\");",
    "          quote = fallback.recordset[0];",
    "        }"
  );
  console.log('Null check: ADDED');
} else console.log('NOT FOUND:', JSON.stringify(lines[1237]));

fs.writeFileSync('admin/index.js', lines.join('\n'));
console.log('Done.');
