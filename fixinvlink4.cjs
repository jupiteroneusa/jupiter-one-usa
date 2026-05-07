// fixinvlink4.cjs - the real fix
// The actual code is: '<tr><td class="mono" style="color:#c8932a;">'+inv.invoice_number+'</td><td>'
// (notice </td> is immediately followed by <td>, not by a closing quote)

const fs = require('fs');
const file = 'admin/orderRoutes.js';
let src = fs.readFileSync(file, 'utf8');

if (src.includes('<a href="/admin/invoices/\'+inv.id+\'"')) {
  console.log('Already patched. Nothing to do.');
  process.exit(0);
}

// Match the opening <tr><td>...</td> chunk that wraps inv.invoice_number.
// The string in the file is split: '<tr><td class="mono" ...">' + inv.invoice_number + '</td><td>'
// We want to replace that whole sub-expression up through the first '</td>'
// with a version that wraps inv.invoice_number in an <a> tag.

const before = `'<tr><td class="mono" style="color:#c8932a;">'+inv.invoice_number+'</td>'`;
const after  = `'<tr><td class="mono"><a href="/admin/invoices/'+inv.id+'" style="color:#c8932a;text-decoration:none;">'+inv.invoice_number+'</a></td>'`;

if (src.includes(before)) {
  // Easy path - exact match works
  src = src.replace(before, after);
  fs.writeFileSync(file, src);
  console.log('+ Patched (direct match)');
  process.exit(0);
}

// Harder path - the </td> is fused to the next <td>. We need to split it.
// Pattern: '<tr><td class="mono" style="color:#c8932a;">'+inv.invoice_number+'</td><td>'
// Replace with: '<tr><td class="mono"><a href=...>'+inv.invoice_number+'</a></td><td>'
const before2 = `'<tr><td class="mono" style="color:#c8932a;">'+inv.invoice_number+'</td><td>'`;
const after2  = `'<tr><td class="mono"><a href="/admin/invoices/'+inv.id+'" style="color:#c8932a;text-decoration:none;">'+inv.invoice_number+'</a></td><td>'`;

if (src.includes(before2)) {
  src = src.replace(before2, after2);
  fs.writeFileSync(file, src);
  console.log('+ Patched (fused td match)');
} else {
  console.error('! Still cannot find target. Dumping context:');
  const i = src.indexOf('inv.invoice_number');
  if (i >= 0) console.error(JSON.stringify(src.substring(i-100, i+50)));
}
