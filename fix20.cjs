const fs = require('fs');

// Update .env with SendGrid
let e = fs.readFileSync('.env', 'utf8');
e = e.replace(/SMTP_HOST=.*/g, 'SMTP_HOST=smtp.sendgrid.net');
e = e.replace(/SMTP_PORT=.*/g, 'SMTP_PORT=587');
e = e.replace(/SMTP_USER=.*/g, 'SMTP_USER=apikey');
e = e.replace(/SMTP_PASS=.*/g, 'SMTP_PASS=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');
fs.writeFileSync('.env', e);
console.log('.env done');

// Update mailer.js secure setting
let m = fs.readFileSync('services/mailer.js', 'utf8');
m = m.replace(
  'secure: process.env.SMTP_PORT == 465,',
  'secure: false,'
);
fs.writeFileSync('services/mailer.js', m);
console.log('mailer done');