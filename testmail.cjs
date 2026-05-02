const nodemailer = require('nodemailer');
const t = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 587,
  secure: false,
  auth: { 
    user: 'apikey',
    pass: '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'
  }
});
t.verify((err, ok) => {
  if (err) console.log('FAIL:', err.message);
  else console.log('SUCCESS!');
});