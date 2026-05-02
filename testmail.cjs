const nodemailer = require('nodemailer');
const t = nodemailer.createTransport({
  host: 'smtpout.secureserver.net',
  port: 465,
  secure: true,
  auth: { user: 'DTorchia@jupiteroneusa.com', pass: 'Nicolle2217$' }
});
t.verify((err, ok) => {
  if (err) console.log('FAIL:', err.message);
  else console.log('SUCCESS!');
});