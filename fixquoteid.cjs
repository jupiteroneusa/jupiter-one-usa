const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');
const lines = a.split('\n');

// Find line 1240 (0-indexed 1239) - quote = qr.recordset[0]
const quoteLine = lines.findIndex((l, i) => i >= 1238 && i <= 1248 && l.includes('quote = qr.recordset[0]') && l.includes('//') === false);
console.log('quote = qr line:', quoteLine + 1, JSON.stringify(lines[quoteLine]));

if (quoteLine > -1) {
  // Replace the entire quote assignment + fallback with a simple fetch by existingQ.id
  lines[quoteLine] = "        quote = { id: existingQ.id, quote_number: existingQ.quote_number };";
  // Remove the fallback block (lines quoteLine+1 through quoteLine+6)
  const fallbackStart = quoteLine + 1;
  if (lines[fallbackStart].includes('if (!quote)')) {
    lines.splice(fallbackStart, 6); // remove the if(!quote){...} block
    console.log('Fallback removed, quote set directly from existingQ');
  }
  console.log('Quote id: FIXED');
}

fs.writeFileSync('admin/index.js', lines.join('\n'));
console.log('Done.');
