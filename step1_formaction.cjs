const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');

// Check exact content of line 836 and 857
const l836 = a.split('\n')[835];
const l857 = a.split('\n')[856];
console.log('Line 836:', JSON.stringify(l836));
console.log('Line 857:', JSON.stringify(l857));

// Only change form action - exact string match
const old836 = l836.trim();
const new836 = old836.replace('/quote">', '/quote-review">');
if (old836 !== new836) {
  a = a.replace(l836, l836.replace('/quote">', '/quote-review">'));
  console.log('Form action: FIXED');
} else console.log('Form action: no change needed or not found');

// Only change button text - exact string match  
const old857 = l857.trim();
if (l857.includes('Create & Send Quote to Customer')) {
  const newLine = l857.replace(/Create & Send Quote to Customer.*?<\/button>/, 'Preview Quote &rarr;</button>');
  a = a.replace(l857, newLine);
  console.log('Button text: FIXED');
} else console.log('Button text: already changed or not found');

fs.writeFileSync('admin/index.js', a);
console.log('Done. Verify before committing.');
