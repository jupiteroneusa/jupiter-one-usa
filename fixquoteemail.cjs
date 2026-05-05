const fs = require('fs');
let a = fs.readFileSync('services/mailer.js', 'utf8');

// 1. Fix sendQuoteToCustomer to add BCC, personal message, RFQ info, lead time
const oldFunc = `export async function sendQuoteToCustomer({ customer, quote, lines, pdfUrl }) {
  const lineRows = lines.map(l => \`
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-family:monospace;">\${l.nsn || l.part_number}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">\${l.item_name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">\${l.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">\${l.condition_code}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">$\${Number(l.unit_price).toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;">$\${Number(l.line_total).toFixed(2)}</td>
    </tr>
  \`).join('');

  const subject = \`Quote \${quote.quote_number} \u2014 Jupiter One USA\`;
  await send({
    to: customer.email, subject,
    type: 'quote_sent', entityType: 'quote', entityId: quote.id,
    html: layout(\`
      <p style="font-size:15px;">Hi \${customer.first_name},</p>
      <p style="font-size:14px;color:#444;line-height:1.7;">
        Please find your quote <strong>\${quote.quote_number}</strong> below.
        This quote is valid until <strong>\${new Date(quote.valid_until).toLocaleDateString()}</strong>.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:20px 0;">
        <thead>
          <tr style="background:#0a1628;color:#fff;">
            <th style="padding:10px 12px;text-align:left;">NSN / Part#</th>
            <th style="padding:10px 12px;text-align:left;">Description</th>
            <th style="padding:10px 12px;text-align:center;">Qty</th>
            <th style="padding:10px 12px;text-align:left;">Condition</th>
            <th style="padding:10px 12px;text-align:right;">Unit Price</th>
            <th style="padding:10px 12px;text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>\${lineRows}</tbody>
        <tfoot>
          <tr>
            <td colspan="5" style="padding:10px 12px;text-align:right;font-weight:bold;">Total</td>
            <td style="padding:10px 12px;text-align:right;font-weight:bold;color:#c8932a;">$\${Number(quote.total_amount).toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      <div style="background:#f9f9f9;border-left:3px solid #c8932a;padding:14px 20px;font-size:12px;color:#666;margin-bottom:20px;">
        \${quote.notes || 'This quotation is valid for 30 days from the date of issue. Prices are subject to availability at time of order confirmation.'}
      </div>
      \${pdfUrl ? \`<p style="font-size:13px;">\u{1F4C4} <a href="\${pdfUrl}">Download Quote PDF</a></p>\` : ''}
      <div style="margin-top:20px;">
        <a href="\${process.env.FRONTEND_URL}/account/quotes/\${quote.id}/accept"
           style="background:#c8932a;color:#000;padding:12px 28px;text-decoration:none;font-weight:bold;font-size:13px;">
          ACCEPT QUOTE \u{21E8}
        </a>
      </div>
    \`),
  });
}`;

const newFunc = `export async function sendQuoteToCustomer({ customer, quote, lines, pdfUrl, rfq }) {
  const lineRows = lines.map(l => \`
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-family:monospace;">\${l.nsn || l.part_number || '\u2014'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">\${l.item_name || '\u2014'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">\${l.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">\${l.condition_code || 'NE'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">$\${Number(l.unit_price).toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;">$\${Number(l.line_total).toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">\${l.lead_time_days ? l.lead_time_days + ' days' : (l.lead_time_text || '\u2014')}</td>
    </tr>
  \`).join('');

  const subject = \`Quote \${quote.quote_number} \u2014 Jupiter One USA\`;
  const personalMsg = quote.personal_message ? \`<div style="background:#f0f7ff;border-left:3px solid #4a90d9;padding:14px 20px;margin-bottom:20px;font-size:14px;color:#333;line-height:1.6;">\${quote.personal_message}</div>\` : '';
  const rfqRef = rfq ? \`<div style="background:#f9f9f9;border-left:3px solid #c8932a;padding:14px 20px;font-size:12px;color:#666;margin-bottom:20px;">
    <strong>RFQ Reference:</strong> \${rfq.rfq_number || quote.rfq_number || ''}\${rfq.customer_ref ? '<br/><strong>Your Reference:</strong> ' + rfq.customer_ref : ''}\${rfq.priority ? '<br/><strong>Priority:</strong> ' + rfq.priority : ''}
  </div>\` : '';

  await send({
    to: customer.email,
    bcc: COMPANY.email,
    subject,
    type: 'quote_sent', entityType: 'quote', entityId: quote.id,
    html: layout(\`
      <p style="font-size:15px;">Hi \${customer.first_name},</p>
      \${personalMsg}
      <p style="font-size:14px;color:#444;line-height:1.7;">
        Please find your quote <strong>\${quote.quote_number}</strong> below.
        This quote is valid until <strong>\${new Date(quote.valid_until).toLocaleDateString()}</strong>.
      </p>
      \${rfqRef}
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:20px 0;">
        <thead>
          <tr style="background:#0a1628;color:#fff;">
            <th style="padding:10px 12px;text-align:left;">NSN / Part#</th>
            <th style="padding:10px 12px;text-align:left;">Description</th>
            <th style="padding:10px 12px;text-align:center;">Qty</th>
            <th style="padding:10px 12px;text-align:left;">Condition</th>
            <th style="padding:10px 12px;text-align:right;">Unit Price</th>
            <th style="padding:10px 12px;text-align:right;">Total</th>
            <th style="padding:10px 12px;text-align:left;">Lead Time</th>
          </tr>
        </thead>
        <tbody>\${lineRows}</tbody>
        <tfoot>
          <tr>
            <td colspan="5" style="padding:10px 12px;text-align:right;font-weight:bold;">Total</td>
            <td style="padding:10px 12px;text-align:right;font-weight:bold;color:#c8932a;">$\${Number(quote.total_amount).toFixed(2)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <div style="background:#f9f9f9;border-left:3px solid #c8932a;padding:14px 20px;font-size:12px;color:#666;margin-bottom:20px;">
        \${quote.notes || 'This quotation is valid for 30 days from the date of issue. Prices are subject to availability at time of order confirmation.'}
      </div>
      \${pdfUrl ? \`<p style="font-size:13px;">\u{1F4C4} <a href="\${pdfUrl}">Download Quote PDF</a></p>\` : ''}
      <div style="margin-top:20px;">
        <a href="\${process.env.FRONTEND_URL}/account/quotes/\${quote.id}/accept"
           style="background:#c8932a;color:#000;padding:12px 28px;text-decoration:none;font-weight:bold;font-size:13px;">
          ACCEPT QUOTE \u21E8
        </a>
      </div>
    \`),
  });
}`;

if (a.includes(oldFunc)) { a = a.replace(oldFunc, newFunc); console.log('sendQuoteToCustomer: FIXED'); }
else console.log('sendQuoteToCustomer: NOT FOUND');

// 2. Fix the send function to support bcc
const oldSend = `async function send({ to, subject, html, type, entityType, entityId, sentBy }) {
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });`;
const newSend = `async function send({ to, bcc, subject, html, type, entityType, entityId, sentBy }) {
  try {
    const mailOpts = { from: FROM, to, subject, html };
    if (bcc) mailOpts.bcc = bcc;
    await transporter.sendMail(mailOpts);`;
if (a.includes(oldSend)) { a = a.replace(oldSend, newSend); console.log('send() bcc: FIXED'); }
else console.log('send() bcc: NOT FOUND');

fs.writeFileSync('services/mailer.js', a);
console.log('Done.');
