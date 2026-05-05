const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');
const lines = a.split('\n');

// Find the fallback query
const fallbackLine = lines.findIndex((l, i) => i >= 1238 && i <= 1252 && l.includes("SELECT id, quote_number FROM quotes WHERE rfq_id=@rfqIdFb"));
console.log('Fallback at line:', fallbackLine + 1, JSON.stringify(lines[fallbackLine]));

// The real fix - change the UPDATE to also update by id, and make sure OUTPUT works
// Find the UPDATE query line
const updateLine = lines.findIndex((l, i) => i >= 1225 && i <= 1237 && l.includes('UPDATE quotes SET'));
console.log('UPDATE at line:', updateLine + 1);

// Change WHERE clause to use the existingQuote id directly instead of rfq_id
const existingIdLine = lines.findIndex((l, i) => i >= 1218 && i <= 1225 && l.includes('quote = { ...existingQuote') || l.includes('existingQuote.recordset[0]'));

// Find where existingQuote is used
const existingUseLine = lines.findIndex((l, i) => i >= 1218 && i <= 1222 && l.includes('if (existingQuote.recordset.length)'));
console.log('existingQuote check at:', existingUseLine + 1);

// Add variable assignment after the check
if (existingUseLine > -1) {
  lines.splice(existingUseLine + 1, 0, "        const existingQ = existingQuote.recordset[0];");
  console.log('existingQ variable: ADDED');
}

// Now fix the UPDATE WHERE to use existingQ.id
const whereRfqLine = lines.findIndex((l, i) => i >= updateLine && i <= updateLine + 10 && l.includes('WHERE rfq_id=@rfqId AND status'));
if (whereRfqLine > -1) {
  // Add id input and change WHERE
  const inputBeforeLine = lines.findIndex((l, i) => i >= updateLine - 8 && i <= updateLine && l.includes('.input(\'rfqId\''));
  if (inputBeforeLine > -1) {
    lines.splice(inputBeforeLine + 1, 0, "          .input('existingId', sql.BigInt, existingQ.id)");
    console.log('existingId input: ADDED');
  }
  // Fix WHERE clause (now shifted)
  const newWhereLine = lines.findIndex((l, i) => i >= whereRfqLine && i <= whereRfqLine + 3 && l.includes('WHERE rfq_id=@rfqId AND status'));
  if (newWhereLine > -1) {
    lines[newWhereLine] = "            WHERE id=@existingId";
    console.log('UPDATE WHERE: simplified to use id');
  }
}

fs.writeFileSync('admin/index.js', lines.join('\n'));
console.log('Done.');
