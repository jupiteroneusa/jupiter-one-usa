const fs = require('fs');

// Fix 1: homepage - Source to Supply
let h = fs.readFileSync('public/index.html', 'utf8');
h = h.replace('We Source<br/>The Right', 'We Supply<br/>The Right');
fs.writeFileSync('public/index.html', h);
console.log('homepage done');

// Fix 2: Remove FAQ question about NSN stock
let f = fs.readFileSync('public/pages/faq.html', 'utf8');
f = f.replace(/<div class='faq-item'><div class='faq-q'[^>]+>Is every NSN in your database actually in stock\?[\s\S]*?<\/div><\/div>/g, '');
f = f.replace(/<div class="faq-item"><div class="faq-q"[^>]+>Is every NSN in your database actually in stock\?[\s\S]*?<\/div><\/div>/g, '');
fs.writeFileSync('public/pages/faq.html', f);
console.log('faq done');