const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');

// Find the RFQs sidebar link and add Accounts after it
const idx = a.indexOf("href=\"/admin/rfqs\"");
if (idx > -1) {
  // Find the end of that anchor tag
  const endIdx = a.indexOf('</a>', idx) + 4;
  const accountsLink = `\n    <a href="/admin/accounts" class="\${active==='accounts'?'active':''}">🏢 Accounts</a>`;
  a = a.slice(0, endIdx) + accountsLink + a.slice(endIdx);
  console.log('Sidebar: FIXED');
} else {
  console.log('Sidebar: NOT FOUND');
}

fs.writeFileSync('admin/index.js', a);
console.log('Done.');
