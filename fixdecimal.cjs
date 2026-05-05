const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');

// Fix markup_pct and margin_pct calculations to cap at valid decimal(5,2) range
const oldMarkup = `markup_pct: unitCost > 0 ? ((unitPrice - unitCost) / unitCost) * 100 : 0,`;
const newMarkup = `markup_pct: unitCost > 0 ? Math.min(999.99, Math.max(-999.99, parseFloat((((unitPrice - unitCost) / unitCost) * 100).toFixed(2)))) : 0,`;

const oldMargin = `margin_pct: lineTotal > 0 ? ((lineTotal - lineCost) / lineTotal) * 100 : 0,`;
const newMargin = `margin_pct: lineTotal > 0 ? Math.min(999.99, Math.max(-999.99, parseFloat((((lineTotal - lineCost) / lineTotal) * 100).toFixed(2)))) : 0,`;

let count1 = 0, count2 = 0;
while (a.includes(oldMarkup)) { a = a.replace(oldMarkup, newMarkup); count1++; }
while (a.includes(oldMargin)) { a = a.replace(oldMargin, newMargin); count2++; }
console.log('markup_pct fixed:', count1, 'times');
console.log('margin_pct fixed:', count2, 'times');

fs.writeFileSync('admin/index.js', a);
console.log('Done.');
