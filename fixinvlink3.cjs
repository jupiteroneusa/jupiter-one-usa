// fixinvlink3.cjs - just the orderRoutes.js link patch using regex
const fs = require('fs');

const file = 'admin/orderRoutes.js';
let src = fs.readFileSync(file, 'utf8');

if (src.includes('<a href="/admin/invoices/\'+inv.id+\'"')) {
  console.log('Already patched.');
  process.exit(0);
}

// Match the <td>...</td> wrapper around inv.invoice_number using a regex
// This handles any whitespace/quote variation
const re = /'<tr><td class="mono"[^']*?'\+inv\.invoice_number\+'<\/td>'/;
const m = src.match(re);
if (!m) {
  console.error('Pattern not found. Showing what is in the file around inv.invoice_number:');
  const i = src.indexOf('inv.invoice_number');
  if (i >= 0) console.error(JSON.stringify(src.substring(i-80, i+30)));
  process.exit(1);
}

console.log('Found:', m[0]);

const replacement = `'<tr><td class="mono"><a href="/admin/invoices/'+inv.id+'" style="color:#c8932a;text-decoration:none;">'+inv.invoice_number+'</a></td>'`;

src = src.replace(re, replacement);
fs.writeFileSync(file, src);
console.log('+ Patched orderRoutes.js');
