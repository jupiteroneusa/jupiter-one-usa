const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');

// 1. Add CC and PDF checkbox after personal message in review page
const old1 = `html += '<textarea name="personal_message" rows="3" style="width:100%;border-color:#c8932a;" placeholder="Hi, great speaking with you..."></textarea></div>';`;
if (a.includes(old1)) {
  const new1 = old1 + `
      html += '<div style="margin-top:12px;"><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Additional Recipients <span style="color:#555;">(optional)</span></div><input type="text" name="cc_emails" placeholder="e.g. john@co.com, jane@co.com" style="width:100%;"/></div>';
      html += '<div style="margin-top:12px;display:flex;align-items:center;gap:8px;"><input type="checkbox" name="attach_pdf" id="attach_pdf" value="1" style="width:auto;accent-color:#c8932a;"/><label for="attach_pdf" style="font-size:.85rem;cursor:pointer;">Attach quote as PDF</label></div>';`;
  a = a.replace(old1, new1);
  console.log('Review page fields: ADDED');
} else console.log('Review page: NOT FOUND');

// 2. Add to quote POST route - extract cc_emails and attach_pdf
const old2 = `      const { personal_message } = req.body;`;
if (a.includes(old2)) {
  a = a.replace(old2, `      const { personal_message, cc_emails, attach_pdf } = req.body;`);
  console.log('Route params: UPDATED');
} else console.log('Route params: NOT FOUND');

// 3. Pass to sendQuoteToCustomer
const old3 = `        pdfUrl: null,
        rfq: { rfq_number: rfq.rfq_number`;
if (a.includes(old3)) {
  a = a.replace(old3, `        pdfUrl: null,
        ccEmails: cc_emails || null,
        attachPdf: attach_pdf === '1',
        rfq: { rfq_number: rfq.rfq_number`);
  console.log('sendQuote params: UPDATED');
} else console.log('sendQuote params: NOT FOUND');

fs.writeFileSync('admin/index.js', a);
console.log('admin/index.js done.');

// 4. Update mailer signature and add cc support
let m = fs.readFileSync('services/mailer.js', 'utf8');
m = m.replace(
  '{ customer, quote, lines, pdfUrl, rfq }',
  '{ customer, quote, lines, pdfUrl, rfq, ccEmails, attachPdf }'
);
m = m.replace(
  'bcc: COMPANY.email,',
  'bcc: COMPANY.email,\n    cc: ccEmails ? ccEmails.split(\',\').map(e => e.trim()).filter(Boolean).join(\',\') : undefined,'
);
fs.writeFileSync('services/mailer.js', m);
console.log('mailer.js done.');
console.log('All done!');
