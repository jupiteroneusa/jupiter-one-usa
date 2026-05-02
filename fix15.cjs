const fs = require('fs');
let c = fs.readFileSync('public/js/api.js', 'utf8');

// Fix cart.add to use quantity from item
c = c.replace(
  "else { items.push({ ...item, quantity: 1, condition_code: item.condition_code || 'NE' }); }",
  "else { items.push({ ...item, quantity: item.quantity || 1, condition_code: item.condition_code || 'NE' }); }"
);

fs.writeFileSync('public/js/api.js', c);
console.log('done - ' + (c.includes('item.quantity || 1') ? 'fixed' : 'not found'));