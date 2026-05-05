const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');
const lines = a.split('\n');

// Remove duplicate personal_message line (line 1088, 0-indexed 1087)
if (lines[1087].includes('personal_message') && lines[1088].includes('personal_message')) {
  lines.splice(1087, 1);
  console.log('Duplicate removed');
}

// Add missing customer param - line 1090 should be sendQuoteToCustomer({
// line 1091 should be customer,
const sendLine = lines.findIndex((l, i) => i >= 1087 && i <= 1095 && l.includes('sendQuoteToCustomer({'));
if (sendLine > -1) {
  const nextLine = lines[sendLine + 1];
  if (!nextLine.includes('customer,')) {
    lines.splice(sendLine + 1, 0, '        customer,');
    console.log('customer param: ADDED at line', sendLine + 2);
  } else {
    console.log('customer param already there');
  }
}

fs.writeFileSync('admin/index.js', lines.join('\n'));
console.log('Done.');
