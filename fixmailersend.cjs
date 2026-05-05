const fs = require('fs');
let a = fs.readFileSync('services/mailer.js', 'utf8');
const lines = a.split('\n');

// Fix line 46 - add cc to signature
lines[45] = "async function send({ to, bcc, cc, subject, html, type, entityType, entityId, sentBy }) {";

// Fix line 48 - broken sendMail line
lines[47] = "    const mailOpts = { from: FROM, to, subject, html }; if (bcc) mailOpts.bcc = bcc; if (cc) mailOpts.cc = cc; await transporter.sendMail(mailOpts);";

console.log('Fixed line 46:', lines[45]);
console.log('Fixed line 48:', lines[47]);

fs.writeFileSync('services/mailer.js', lines.join('\n'));
console.log('Done.');
