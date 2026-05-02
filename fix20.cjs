const fs = require('fs');
let e = fs.readFileSync('.env', 'utf8');
e = e.replace(/SMTP_HOST=.*/g, 'SMTP_HOST=smtp.sendgrid.net');
e = e.replace(/SMTP_PORT=.*/g, 'SMTP_PORT=587');
e = e.replace(/SMTP_USER=.*/g, 'SMTP_USER=apikey');
e = e.replace(/SMTP_PASS=.*/g, 'SMTP_PASS=SENDGRID_KEY_IN_AZURE');
fs.writeFileSync('.env', e);
console.log('done');