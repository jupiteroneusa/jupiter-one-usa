const fs = require('fs');
let a = fs.readFileSync('services/mailer.js', 'utf8');
const lines = a.split('\n');

// Find the send() function signature and mailOpts
const sendFnLine = lines.findIndex(l => l.includes('async function send(') && l.includes('to, bcc,'));
console.log('send() at line:', sendFnLine + 1, JSON.stringify(lines[sendFnLine]));

// Add cc to send() signature
if (sendFnLine > -1 && !lines[sendFnLine].includes('cc,')) {
  lines[sendFnLine] = lines[sendFnLine].replace('{ to, bcc, subject,', '{ to, bcc, cc, subject,');
  console.log('send() signature: FIXED');
}

// Find mailOpts and add cc support
const mailOptsLine = lines.findIndex((l, i) => i > sendFnLine && l.includes('const mailOpts = {'));
console.log('mailOpts at line:', mailOptsLine + 1);
const bccMailLine = lines.findIndex((l, i) => i > mailOptsLine && l.includes('if (bcc) mailOpts.bcc'));
if (bccMailLine > -1) {
  lines[bccMailLine] = lines[bccMailLine] + '\n    if (cc) mailOpts.cc = cc;';
  console.log('cc mailOpts: ADDED');
}

// Now fix sendQuoteToCustomer to pass cc to send()
const sendCallLine = lines.findIndex((l, i) => i > 200 && l.includes('to: customer.email,'));
console.log('send call at line:', sendCallLine + 1);
const ccLine = lines.findIndex((l, i) => i > sendCallLine && i < sendCallLine + 5 && l.includes('cc:'));
console.log('cc line:', ccLine + 1, ccLine > -1 ? JSON.stringify(lines[ccLine]) : 'NOT FOUND');

// Find the send({ in sendQuoteToCustomer and add cc
const bccCustomerLine = lines.findIndex((l, i) => i > 200 && l.includes('bcc: COMPANY.email,') && i < 300);
console.log('bcc in sendQuote at line:', bccCustomerLine + 1);
if (bccCustomerLine > -1) {
  // Check if cc already there
  if (!lines[bccCustomerLine + 1].includes('cc:')) {
    lines.splice(bccCustomerLine + 1, 0, '    cc: ccEmails ? ccEmails.split(\',\').map(e => e.trim()).filter(Boolean).join(\',\') : undefined,');
    console.log('cc in sendQuote: ADDED');
  } else console.log('cc already there');
}

fs.writeFileSync('services/mailer.js', lines.join('\n'));
console.log('Done.');
