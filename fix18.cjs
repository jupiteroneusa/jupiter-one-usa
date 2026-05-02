const fs = require('fs');

// Fix description text on homepage
let h = fs.readFileSync('public/index.html', 'utf8');
h = h.replace(
  'Jupiter One USA — specialized NSN and aerospace component sourcing.',
  'Jupiter One USA — specialized NSN and aerospace component supply.'
);
h = h.replace(
  'Jupiter One USA ΓÇö specialized NSN and aerospace component sourcing.',
  'Jupiter One USA ΓÇö specialized NSN and aerospace component supply.'
);
fs.writeFileSync('public/index.html', h);
console.log('homepage description done');

// Also fix in api.js footer/nav
let a = fs.readFileSync('public/js/api.js', 'utf8');
a = a.replace(
  'NSN and aerospace component sourcing. Fast responses',
  'NSN and aerospace component supply. Fast responses'
);
fs.writeFileSync('public/js/api.js', a);
console.log('api.js done');