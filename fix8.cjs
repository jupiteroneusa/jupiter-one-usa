const fs = require('fs');
let c = fs.readFileSync('admin/index.js', 'utf8');

// Find and replace any nsn link in line items
c = c.replace(
  /href="\/pages\/nsn-detail\.html\?nsn=\$\{l\.nsn\|\|l\.part_number\}"/g,
  'href="https://www.nsn-now.com/Indexing/PublicSearch.aspx?NSN=${l.nsn||l.part_number}"'
);

fs.writeFileSync('admin/index.js', c);
console.log('done');