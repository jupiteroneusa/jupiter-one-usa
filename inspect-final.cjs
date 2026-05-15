// inspect-final.cjs
const fs = require('fs');
const olb = fs.readFileSync('admin/orderLinesBlock.js', 'utf8');
console.log('===== orderLinesBlock.js =====');
console.log(olb);

console.log('\n\n===== orderRoutes.js - relevant routes =====');
const or = fs.readFileSync('admin/orderRoutes.js', 'utf8');
const orLines = or.split('\n');

// Print lines 50-120 (header area incl Create POs button)
console.log('\n--- Header area (L50-120) ---');
for (let i = 49; i < 120; i++) console.log('L' + (i+1) + ': ' + orLines[i]);

// Print lines 510-560 (review screen handler)
console.log('\n--- Create POs review handler (L510-560) ---');
for (let i = 509; i < 560; i++) console.log('L' + (i+1) + ': ' + orLines[i]);
