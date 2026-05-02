const fs = require('fs');
let c = fs.readFileSync('public/js/api.js', 'utf8');

// Fix cart.add - when item exists, add the new quantity instead of just +1
c = c.replace(
  "if (existing) { existing.quantity = (existing.quantity || 1) + 1; }",
  "if (existing) { existing.quantity = (existing.quantity || 1) + (item.quantity || 1); }"
);

fs.writeFileSync('public/js/api.js', c);
console.log('done - ' + (c.includes('item.quantity || 1') ? 'fixed' : 'not found'));