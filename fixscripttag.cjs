const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');
const lines = a.split('\n');

console.log('Line 1083:', JSON.stringify(lines[1082]));

if (lines[1082].includes("'<script>' + addRowScript")) {
  lines[1082] = lines[1082].replace("'<script>' + addRowScript", "'<script>' + draftScript + addRowScript");
  console.log('FIXED');
} else console.log('NOT FOUND');

fs.writeFileSync('admin/index.js', lines.join('\n'));
console.log('Done.');
