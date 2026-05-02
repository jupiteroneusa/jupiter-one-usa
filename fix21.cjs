const fs = require('fs');
let c = fs.readFileSync('routes/search.js', 'utf8');
c = c.replace(
  'export default router;',
  `router.get('/email-test', async (req, res) => {
  try {
    const nodemailer = await import('nodemailer');
    const t = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    await t.verify();
    await t.sendMail({
      from: process.env.SMTP_USER + '@jupiteroneusa.com',
      to: process.env.RFQ_NOTIFY_EMAIL || 'DTorchia@jupiteroneusa.com',
      subject: 'Test from Azure',
      text: 'SMTP working. HOST:' + process.env.SMTP_HOST + ' USER:' + process.env.SMTP_USER
    });
    res.json({ success: true, host: process.env.SMTP_HOST, user: process.env.SMTP_USER, to: process.env.RFQ_NOTIFY_EMAIL });
  } catch(err) {
    res.json({ error: err.message, host: process.env.SMTP_HOST, user: process.env.SMTP_USER });
  }
});

export default router;`
);
fs.writeFileSync('routes/search.js', c);
console.log('done');