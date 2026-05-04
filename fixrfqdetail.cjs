const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');

// 1. Fix double "RFQ" in title - "RFQ RFQ-2026-00001" -> "RFQ-2026-00001"
const oldTitle = `page(\`RFQ \${rfq.rfq_number}\`,'rfqs',\``;
const newTitle = `page(\`\${rfq.rfq_number}\`,'rfqs',\``;
if (a.includes(oldTitle)) { a = a.replace(oldTitle, newTitle); console.log('Title: FIXED'); }
else console.log('Title: NOT FOUND');

// 2. Fix double "RFQ" in page-title div
const oldPageTitle = `<div class="page-title">RFQ \${rfq.rfq_number}</div>`;
const newPageTitle = `<div class="page-title">\${rfq.rfq_number}</div>`;
if (a.includes(oldPageTitle)) { a = a.replace(oldPageTitle, newPageTitle); console.log('Page title: FIXED'); }
else console.log('Page title: NOT FOUND');

// 3. Fix submitted date to Eastern time
const oldDate = `<div class="page-sub">Submitted \${new Date(rfq.submitted_at).toLocaleString()}</div>`;
const newDate = `<div class="page-sub">Submitted \${new Date(rfq.submitted_at).toLocaleString('en-US', {timeZone:'America/New_York'})} ET</div>`;
if (a.includes(oldDate)) { a = a.replace(oldDate, newDate); console.log('Date ET: FIXED'); }
else console.log('Date ET: NOT FOUND');

fs.writeFileSync('admin/index.js', a);
console.log('Done.');
