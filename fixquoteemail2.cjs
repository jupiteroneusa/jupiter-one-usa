const fs = require('fs');
let a = fs.readFileSync('services/mailer.js', 'utf8');
const lines = a.split('\n');

// Check exact content of key lines
console.log('Line 46:', JSON.stringify(lines[45]));
console.log('Line 48:', JSON.stringify(lines[47]));
console.log('Line 230:', JSON.stringify(lines[229]));
console.log('Line 243:', JSON.stringify(lines[242]));

// Fix line 46: add bcc to send function signature
if (lines[45].includes('async function send(') && !lines[45].includes('bcc')) {
  lines[45] = lines[45].replace('{ to, subject,', '{ to, bcc, subject,');
  console.log('send() signature: FIXED');
}

// Fix lines 47-49: add bcc to sendMail call
if (lines[47].includes('sendMail({ from: FROM, to, subject, html }')) {
  lines[47] = lines[47].replace(
    'await transporter.sendMail({ from: FROM, to, subject, html });',
    'const mailOpts = { from: FROM, to, subject, html }; if (bcc) mailOpts.bcc = bcc; await transporter.sendMail(mailOpts);'
  );
  console.log('sendMail bcc: FIXED');
}

// Fix line 230: add rfq param to sendQuoteToCustomer
if (lines[229].includes('sendQuoteToCustomer(') && !lines[229].includes('rfq')) {
  lines[229] = lines[229].replace('{ customer, quote, lines, pdfUrl }', '{ customer, quote, lines, pdfUrl, rfq }');
  console.log('sendQuoteToCustomer signature: FIXED');
}

// Fix line 243: add bcc and personal_message to the send call
// Need to find the send({ call and add bcc
const sendCallIdx = lines.findIndex((l, i) => i >= 240 && i <= 250 && l.includes('to: customer.email, subject,'));
if (sendCallIdx > -1) {
  lines[sendCallIdx] = lines[sendCallIdx].replace(
    'to: customer.email, subject,',
    'to: customer.email, bcc: COMPANY.email, subject,'
  );
  console.log('Quote send bcc: FIXED at line', sendCallIdx + 1);
}

// Now fix the html to include personal message, RFQ ref, and lead time
// Find the html: layout line in sendQuoteToCustomer
const htmlStart = lines.findIndex((l, i) => i >= 230 && i <= 260 && l.includes('html: layout('));
console.log('html: layout( at line:', htmlStart + 1);

// Find "Hi customer.first_name" line
const hiLine = lines.findIndex((l, i) => i >= htmlStart && i <= htmlStart + 10 && l.includes('Hi ${customer.first_name}'));
if (hiLine > -1) {
  console.log('Hi line at:', hiLine + 1, JSON.stringify(lines[hiLine]));
  // Insert personal message and RFQ ref after the Hi line
  const personalMsgHtml = "      \${quote.personal_message ? `<div style=\"background:#f0f7ff;border-left:3px solid #4a90d9;padding:14px 20px;margin:16px 0;font-size:14px;color:#333;line-height:1.6;\">\${quote.personal_message}</div>` : ''}";
  const rfqRefHtml = "      \${rfq ? `<div style=\"background:#f9f9f9;border-left:3px solid #aaa;padding:10px 16px;font-size:12px;color:#666;margin-bottom:16px;\"><strong>RFQ Ref:</strong> \${rfq.rfq_number||(quote&&quote.rfq_number)||''}\${rfq.customer_ref?'<br/><strong>Your Ref:</strong> '+rfq.customer_ref:''}\${rfq.priority?'<br/><strong>Priority:</strong> '+rfq.priority:''}</div>` : ''}";
  lines.splice(hiLine + 1, 0, personalMsgHtml, rfqRefHtml);
  console.log('Personal message + RFQ ref: ADDED');
}

// Add Lead Time column to the table headers
const thLine = lines.findIndex((l, i) => i >= 230 && l.includes('<th style="padding:10px 12px;text-align:right;">Total</th>'));
if (thLine > -1) {
  lines[thLine] = lines[thLine].replace(
    '<th style="padding:10px 12px;text-align:right;">Total</th>',
    '<th style="padding:10px 12px;text-align:right;">Total</th>\n            <th style="padding:10px 12px;text-align:left;">Lead Time</th>'
  );
  console.log('Lead time header: ADDED');
}

// Add lead time to line rows
const lineRowsFunc = lines.findIndex((l, i) => i >= 230 && l.includes('const lineRows = lines.map'));
if (lineRowsFunc > -1) {
  // Find the closing td of the row
  const totalTd = lines.findIndex((l, i) => i >= lineRowsFunc && i <= lineRowsFunc + 15 && l.includes('line_total') && l.includes('</td>'));
  if (totalTd > -1) {
    lines[totalTd] = lines[totalTd].replace(
      '</td>\n    </tr>',
      '</td>\n      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">${l.lead_time_days ? l.lead_time_days + " days" : (l.lead_time_text || "—")}</td>\n    </tr>'
    );
    // simpler approach - just add after the last td
    const rowEnd = lines.findIndex((l2, i) => i >= totalTd && i <= totalTd + 3 && l2.trim() === '</tr>');
    if (rowEnd > -1) {
      lines.splice(rowEnd, 0, "      <td style=\"padding:8px 12px;border-bottom:1px solid #eee;color:#666;\">${l.lead_time_days ? l.lead_time_days + ' days' : (l.lead_time_text || '\u2014')}</td>");
      console.log('Lead time cell: ADDED');
    }
  }
}

fs.writeFileSync('services/mailer.js', lines.join('\n'));
console.log('Done.');
