const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');

const old = 'const fd=new FormData(form);fetch("/admin/rfqs/\'+rfq.id+\'/quote-draft",{method:"POST",body:fd})';
const neu = 'const fd=new URLSearchParams(new FormData(form));fetch("/admin/rfqs/\'+rfq.id+\'/quote-draft",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:fd.toString()})';

if (a.includes(old)) { a = a.replace(old, neu); console.log('FIXED'); }
else console.log('NOT FOUND');

fs.writeFileSync('admin/index.js', a);
console.log('Done.');
