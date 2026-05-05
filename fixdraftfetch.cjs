const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');

// Fix the saveDraft fetch to use URLSearchParams instead of FormData
const oldFetch = "const fd=new FormData(form);fetch(\\\"/admin/rfqs/'+rfq.id+'/quote-draft\\\",{method:\\\"POST\\\",body:fd})";
const newFetch = "const fd=new URLSearchParams(new FormData(form));fetch(\\\"/admin/rfqs/'+rfq.id+'/quote-draft\\\",{method:\\\"POST\\\",headers:{\\\"Content-Type\\\":\\\"application/x-www-form-urlencoded\\\"},body:fd.toString()})";

if (a.includes(oldFetch)) { a = a.replace(oldFetch, newFetch); console.log('Fetch: FIXED'); }
else console.log('NOT FOUND - trying alternate');

// Try finding it differently
const idx = a.indexOf('new FormData(form)');
if (idx > -1) {
  console.log('Found FormData at:', idx);
  // Check context
  const chunk = a.slice(idx - 20, idx + 200);
  console.log('Context:', JSON.stringify(chunk));
}

fs.writeFileSync('admin/index.js', a);
console.log('Done.');
