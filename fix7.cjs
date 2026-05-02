const fs = require('fs');
let c = fs.readFileSync('admin/index.js', 'utf8');
c = c.replace(
  '        <td class="mono text-gold"><a href="/pages/nsn-detail.html?nsn=${l.nsn||l.part_number}" target="_blank" style="color:#c8932a;">${l.nsn||l.part_number||\'—\'}</a></td>',
  '        <td class="mono text-gold"><a href="https://www.nsn-now.com/Indexing/PublicSearch.aspx?NSN=${l.nsn||l.part_number}" target="_blank" style="color:#c8932a;">${l.nsn||l.part_number||\'—\'}</a></td>'
);
fs.writeFileSync('admin/index.js', c);
console.log('done');