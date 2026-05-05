const fs = require('fs');

// Fix mailer - add attachments support to send() function
let m = fs.readFileSync('services/mailer.js', 'utf8');
const lines = m.split('\n');

console.log('Line 46:', JSON.stringify(lines[45]));
console.log('Line 48:', JSON.stringify(lines[47]));

// Fix send() signature to include attachments
lines[45] = "async function send({ to, bcc, cc, subject, html, attachments, type, entityType, entityId, sentBy }) {";
// Fix sendMail to include attachments
lines[47] = "    const mailOpts = { from: FROM, to, subject, html }; if (bcc) mailOpts.bcc = bcc; if (cc) mailOpts.cc = cc; if (attachments) mailOpts.attachments = attachments; await transporter.sendMail(mailOpts);";

console.log('Fixed line 46:', lines[45]);
fs.writeFileSync('services/mailer.js', lines.join('\n'));
console.log('Done.');
