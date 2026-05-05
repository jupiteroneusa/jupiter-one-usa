const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');

// The fix: intercept the form submit with JS, serialize to JSON, and POST as JSON
// Find the Send Quote form in the review page
const oldFormAction = `html += '<form method="POST" action="/admin/rfqs/' + rfq.id + '/quote">';`;
const newFormAction = `html += '<form id="quote-send-form" method="POST" action="/admin/rfqs/' + rfq.id + '/quote">';`;

let count = 0;
while (a.includes(oldFormAction)) { a = a.replace(oldFormAction, newFormAction); count++; }
console.log('Form id added:', count, 'times');

// Also fix in resume draft route
const oldFormAction2 = `html += '<form method="POST" action="/admin/rfqs/'+rfq.id+'/quote">';`;
const newFormAction2 = `html += '<form id="quote-send-form" method="POST" action="/admin/rfqs/'+rfq.id+'/quote">';`;
let count2 = 0;
while (a.includes(oldFormAction2)) { a = a.replace(oldFormAction2, newFormAction2); count2++; }
console.log('Form id added (resume):', count2, 'times');

// Now fix the quote POST route to also handle flat body if nested fails
const oldLinesRaw = `      const linesRaw = req.body.lines || {};`;
const newLinesRaw = `      // Support both nested {lines:{0:{...}}} and flat body
      let linesRaw = req.body.lines || {};
      if (Object.keys(linesRaw).length === 0) {
        // Try to reconstruct from flat keys like lines[0][fulfillment_part]
        Object.keys(req.body).forEach(key => {
          const m = key.match(/^lines\\[(\\d+)\\]\\[(.+)\\]$/);
          if (m) {
            const idx = m[1], field = m[2];
            if (!linesRaw[idx]) linesRaw[idx] = {};
            linesRaw[idx][field] = req.body[key];
          }
        });
      }`;

if (a.includes(oldLinesRaw)) { a = a.replace(oldLinesRaw, newLinesRaw); console.log('linesRaw fallback: ADDED'); }
else console.log('linesRaw: NOT FOUND');

fs.writeFileSync('admin/index.js', a);
console.log('Done.');
