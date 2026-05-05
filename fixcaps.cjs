const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');

let count = 0;

// Fix all NSN/part number inputs - add uppercase to any that don't have it
// Pattern: input with name containing [part] or [fulfillment_part] without toUpperCase
const regex = /(<input type="text" name="lines\[\d+\]\[(?:part|fulfillment_part)\][^>]*?)(?= *\/>)/g;

a = a.replace(regex, (match) => {
  if (match.includes('toUpperCase')) return match; // already fixed
  count++;
  return match + ' style="text-transform:uppercase;" oninput="this.value=this.value.toUpperCase()"'.replace('style="text-transform:uppercase;"', 
    match.includes('style=') ? '' : 'style="text-transform:uppercase;"');
});

// Simpler targeted approach - find the specific inputs without uppercase
const targets = [
  `name="lines[0][part]" placeholder="NSN or Part #" style="width:150px;"`,
];

targets.forEach(t => {
  if (a.includes(t)) {
    a = a.replace(t, t.replace('style="width:150px;"', 'style="width:150px;text-transform:uppercase;" oninput="this.value=this.value.toUpperCase()"'));
    console.log('Static part field: FIXED');
  }
});

// Fix the dynamic addLine part field
const dynOld = `name="lines[\${idx}][part]" placeholder="NSN or Part #" style="width:150px;"`;
const dynNew = `name="lines[\${idx}][part]" placeholder="NSN or Part #" style="width:150px;text-transform:uppercase;" oninput="this.value=this.value.toUpperCase()"`;
if (a.includes(dynOld)) { a = a.replace(dynOld, dynNew); console.log('Dynamic part field: FIXED'); }
else console.log('Dynamic part field: not found (may already be fixed)');

fs.writeFileSync('admin/index.js', a);
console.log('Done.');
