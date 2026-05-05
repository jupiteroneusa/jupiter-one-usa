const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');

// 1. Add PDF checkbox and CC field to review page - insert after personal message textarea
const oldPersonalMsg = `html += '<textarea name="personal_message" rows="3" style="width:100%;border-color:#c8932a;" placeholder="Hi, great speaking with you..."></textarea></div>';`;
const newPersonalMsg = `html += '<textarea name="personal_message" rows="3" style="width:100%;border-color:#c8932a;" placeholder="Hi, great speaking with you..."></textarea></div>';
      html += '<div style="margin-top:12px;"><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Additional Recipients <span style="color:#555;">(optional — comma separated emails)</span></div>';
      html += '<input type="text" name="cc_emails" placeholder="e.g. john@company.com, jane@company.com" style="width:100%;"/></div>';
      html += '<div style="margin-top:12px;display:flex;align-items:center;gap:8px;">';
      html += '<input type="checkbox" name="attach_pdf" id="attach_pdf" value="1" style="width:auto;accent-color:#c8932a;"/>';
      html += '<label for="attach_pdf" style="font-size:.85rem;cursor:pointer;">Attach quote as PDF</label></div>';`;

let count = 0;
while (a.includes(oldPersonalMsg)) { a = a.replace(oldPersonalMsg, newPersonalMsg); count++; }
console.log('PDF/CC fields added:', count, 'times');

// 2. Also add to resume draft page
const oldResumePM = `html += '<textarea name="personal_message" rows="3" style="width:100%;border-color:#c8932a;" placeholder="Hi, great speaking with you...">'+(draft.personal_message||'')+'</textarea></div>';`;
const newResumePM = `html += '<textarea name="personal_message" rows="3" style="width:100%;border-color:#c8932a;" placeholder="Hi, great speaking with you...">'+(draft.personal_message||'')+'</textarea></div>';
      html += '<div style="margin-top:12px;"><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Additional Recipients <span style="color:#555;">(optional — comma separated emails)</span></div>';
      html += '<input type="text" name="cc_emails" placeholder="e.g. john@company.com, jane@company.com" style="width:100%;"/></div>';
      html += '<div style="margin-top:12px;display:flex;align-items:center;gap:8px;">';
      html += '<input type="checkbox" name="attach_pdf" id="attach_pdf" value="1" style="width:auto;accent-color:#c8932a;"/>';
      html += '<label for="attach_pdf" style="font-size:.85rem;cursor:pointer;">Attach quote as PDF</label></div>';`;

let count2 = 0;
while (a.includes(oldResumePM)) { a = a.replace(oldResumePM, newResumePM); count2++; }
console.log('Resume draft PDF/CC fields added:', count2, 'times');

// 3. Pass cc_emails and attach_pdf to the email send in the quote POST route
const oldSend = `      const { personal_message } = req.body;
      await sendQuoteToCustomer({`;
const newSend = `      const { personal_message, cc_emails, attach_pdf } = req.body;
      await sendQuoteToCustomer({`;
if (a.includes(oldSend)) { a = a.replace(oldSend, newSend); console.log('cc/pdf params: ADDED to quote route'); }
else console.log('cc/pdf params: NOT FOUND');

// 4. Pass cc_emails to the sendQuoteToCustomer call
const oldCall = `        quote: { ...quote, total_amount: subtotal, valid_until: validUntil, payment_terms, notes, personal_message },
        lines: processedLines,
        rfq: { rfq_number: rfq.rfq_number, customer_ref: rfq.customer_ref, priority: rfq.priority },
        pdfUrl: null,`;
const newCall = `        quote: { ...quote, total_amount: subtotal, valid_until: validUntil, payment_terms, notes, personal_message },
        lines: processedLines,
        rfq: { rfq_number: rfq.rfq_number, customer_ref: rfq.customer_ref, priority: rfq.priority },
        pdfUrl: null,
        ccEmails: cc_emails || null,
        attachPdf: attach_pdf === '1',`;
if (a.includes(oldCall)) { a = a.replace(oldCall, newCall); console.log('sendQuoteToCustomer params: UPDATED'); }
else console.log('sendQuoteToCustomer params: NOT FOUND');

fs.writeFileSync('admin/index.js', a);
console.log('Done.');

// 5. Update mailer to handle cc and attachPdf
const mailer = fs.readFileSync('services/mailer.js', 'utf8');
const mLines = mailer.split('\n');

// Find sendQuoteToCustomer signature and add ccEmails, attachPdf params
const sigLine = mLines.findIndex(l => l.includes('export async function sendQuoteToCustomer('));
if (sigLine > -1) {
  mLines[sigLine] = mLines[sigLine].replace('{ customer, quote, lines, pdfUrl, rfq }', '{ customer, quote, lines, pdfUrl, rfq, ccEmails, attachPdf }');
  console.log('Mailer signature: UPDATED');
}

// Find the send({ call and add cc
const sendCallLine = mLines.findIndex((l, i) => i > sigLine && l.includes('to: customer.email,') && l.includes('bcc:'));
if (sendCallLine > -1) {
  mLines[sendCallLine] = mLines[sendCallLine].replace(
    'to: customer.email,',
    'to: customer.email,'
  );
  // Add cc after bcc line
  const bccLine = mLines.findIndex((l, i) => i >= sendCallLine && i <= sendCallLine + 3 && l.includes('bcc: COMPANY.email'));
  if (bccLine > -1) {
    mLines[bccLine] = mLines[bccLine].replace('bcc: COMPANY.email,', 'bcc: COMPANY.email,\n    cc: ccEmails ? ccEmails.split(\',\').map(e => e.trim()).filter(Boolean).join(\',\') : undefined,');
    console.log('CC: ADDED to mailer send call');
  }
}

fs.writeFileSync('services/mailer.js', mLines.join('\n'));
console.log('Mailer updated.');
