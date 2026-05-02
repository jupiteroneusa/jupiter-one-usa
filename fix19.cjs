const fs = require('fs');

// Fix topbar in api.js
let a = fs.readFileSync('public/js/api.js', 'utf8');
a = a.replace(
  'Aerospace and Defense Component Sourcing',
  'Aerospace and Defense Component Supply'
);
fs.writeFileSync('public/js/api.js', a);
console.log('done - ' + (a.includes('Component Supply') ? 'fixed' : 'not found'));