const fs = require('fs');
let a = fs.readFileSync('services/mailer.js', 'utf8');
const lines = a.split('\n');

// Fix line 46 (0-indexed 45) - add cc to send() signature
if (!lines[45].includes('cc,')) {
  lines[45] = lines[45].replace('{ to, bcc, subject,', '{ to, bcc, cc, subject,');
  console.log('send() signature: FIXED');
}

// Fix line 48 (0-indexed 47) - add cc to mailOpts
console.log('Line 48:', JSON.stringify(lines[47]));
if (lines[47].includes('if (bcc) mailOpts.bcc')) {
  lines[47] = lines[47] + ' if (cc) mailOpts.cc = cc;';
  console.log('cc mailOpts: ADDED');
} else {
  // Find the bcc line in mailOpts
  const bccIdx = lines.findIndex((l, i) => i >= 45 && i <= 55 && l.includes('if (bcc)'));
  console.log('bcc line:', bccIdx + 1, JSON.stringify(lines[bccIdx]));
  if (bccIdx > -1) {
    lines[bccIdx] = lines[bccIdx] + ' if (cc) mailOpts.cc = cc;';
    console.log('cc mailOpts: ADDED at', bccIdx + 1);
  }
}

// Check line 251 - make sure cc is being passed to send()
console.log('Line 251:', JSON.stringify(lines[250]));
console.log('Line 252:', JSON.stringify(lines[251]));

fs.writeFileSync('services/mailer.js', lines.join('\n'));
console.log('Done.');
