const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');
const lines = a.split('\n');

// Find the sendQuoteToCustomer call line
const sendLine = lines.findIndex((l, i) => i >= 1290 && i <= 1320 && l.includes('await sendQuoteToCustomer('));
console.log('sendQuoteToCustomer at line:', sendLine + 1);

// Find the .catch(console.error) line
const catchLine = lines.findIndex((l, i) => i >= sendLine && i <= sendLine + 8 && l.includes('.catch(console.error)'));
console.log('catch line:', catchLine + 1, JSON.stringify(lines[catchLine]));

if (catchLine > -1) {
  // Remove .catch(console.error) and wrap whole call in try/catch
  lines[catchLine] = lines[catchLine].replace('.catch(console.error);', ';');
  // Wrap the entire sendQuoteToCustomer block
  lines.splice(sendLine, 0, '      try {');
  const newCatchLine = catchLine + 1; // shifted by 1
  lines.splice(newCatchLine + 1, 0, "      } catch(emailErr) { console.error('Email send error:', emailErr.message); }");
  console.log('Email try/catch: ADDED');
}

fs.writeFileSync('admin/index.js', lines.join('\n'));
console.log('Done.');
