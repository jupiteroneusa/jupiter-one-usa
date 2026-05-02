const nodemailer = require('nodemailer');
require('dotenv').config();
const t = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
});
t.verify((err) => {
  if (err) console.log('FAIL:', err.message);
  else console.log('SUCCESS!');
});