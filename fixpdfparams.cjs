const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');
const lines = a.split('\n');

// Line 1347 (0-indexed 1346) - add ccEmails and attachPdf after pdfUrl
if (lines[1346].includes('pdfUrl: null,')) {
  lines[1346] = "        pdfUrl: null,\n        ccEmails: cc_emails || null,\n        attachPdf: attach_pdf === '1',";
  console.log('FIXED');
} else console.log('NOT FOUND:', JSON.stringify(lines[1346]));

fs.writeFileSync('admin/index.js', lines.join('\n'));
console.log('Done.');
