const fs = require('fs');
let a = fs.readFileSync('services/mailer.js', 'utf8');

// Find and replace the sendQuoteToCustomer html layout
const oldHtml = `  const subject = \`Quote \${quote.quote_number} \u2014 Jupiter One USA\`;
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

const newHtml = `  const subject = \`Quote \${quote.quote_number} \u2014 Jupiter One USA\`;
  const now = new Date();
  const quoteDate = now.toLocaleDateString('en-US', { month:'2-digit', day:'2-digit', year:'numeric' }) + ' ' + now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', timeZone:'America/New_York' }) + ' ET';
  const validDate = new Date(quote.valid_until).toLocaleDateString('en-US', { month:'2-digit', day:'2-digit', year:'numeric' });
  const personalMsg = quote.personal_message ? \`<div style="background:#f0f7ff;border-left:3px solid #4a90d9;padding:14px 20px;margin-bottom:20px;font-size:14px;color:#333;line-height:1.6;">\${quote.personal_message}</div>\` : '';

  const TERMS = \`<strong>Payment:</strong> Credit Card or Wire Transfer. Credit card payments subject to a 3.5% processing fee. Wire transfer details provided upon order confirmation.<br/>
<strong>Cancellation:</strong> All orders placed with Jupiter One USA are considered non-cancellable and non-returnable once confirmed.<br/>
<strong>Delivery:</strong> Delivery times are estimated and not guaranteed. Jupiter One USA is not liable for delays caused by suppliers, carriers, or customs. Delivery claims must be reported within 7 days of receipt.<br/>
<strong>Validity:</strong> This quotation is valid for 30 days from the date of issue. Prices are subject to availability at time of order confirmation.<br/>
<strong>Condition Codes:</strong> NE=New, NS=New Surplus, OH=Overhaul, AR=As Removed, SV=Serviceable.\`;

  await send({
    to: customer.email,
    bcc: COMPANY.email,
    subject,
    type: 'quote_sent', entityType: 'quote', entityId: quote.id,
    html: layout(\`
      \${personalMsg}
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px;border:1px solid #ddd;">
        <tr>
          <td style="padding:10px 14px;border-bottom:1px solid #eee;border-right:1px solid #eee;width:50%;vertical-align:top;">
            <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Bill To</div>
            <strong style="font-size:13px;">\${customer.first_name} \${customer.last_name}</strong><br/>
            \${customer.company ? customer.company + '<br/>' : ''}
            <a href="mailto:\${customer.email}" style="color:#c8932a;">\${customer.email}</a>
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid #eee;vertical-align:top;">
            <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Quote Details</div>
            <table style="font-size:12px;width:100%;border-collapse:collapse;">
              <tr><td style="color:#888;padding:2px 0;width:110px;">Quote #</td><td style="font-weight:600;">\${quote.quote_number}</td></tr>
              \${rfq ? \`<tr><td style="color:#888;padding:2px 0;">RFQ #</td><td>\${rfq.rfq_number||''}</td></tr>\` : ''}
              \${rfq && rfq.customer_ref ? \`<tr><td style="color:#888;padding:2px 0;">Your Ref</td><td style="font-weight:600;color:#c8932a;">\${rfq.customer_ref}</td></tr>\` : ''}
              <tr><td style="color:#888;padding:2px 0;">Status</td><td><span style="background:#c8932a;color:#000;padding:1px 8px;font-size:11px;font-weight:700;">QUOTED</span></td></tr>
              <tr><td style="color:#888;padding:2px 0;">Issued</td><td>\${quoteDate}</td></tr>
              <tr><td style="color:#888;padding:2px 0;">Valid Until</td><td style="font-weight:600;">\${validDate}</td></tr>
              <tr><td style="color:#888;padding:2px 0;">Priority</td><td>\${rfq && rfq.priority ? rfq.priority : 'Standard'}</td></tr>
              <tr><td style="color:#888;padding:2px 0;">Sales Rep</td><td>Derek Torchia</td></tr>
            </table>
          </td>
        </tr>
      </table>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 20px 0;border:1px solid #ddd;">
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
          <tr style="background:#f5f5f5;">
            <td colspan="5" style="padding:10px 12px;text-align:right;font-weight:bold;font-size:14px;">Quote Total:</td>
            <td style="padding:10px 12px;text-align:right;font-weight:bold;color:#c8932a;font-size:14px;">$\${Number(quote.total_amount).toFixed(2)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      \${quote.notes ? \`<div style="background:#fff8e7;border-left:3px solid #c8932a;padding:12px 16px;font-size:13px;color:#555;margin-bottom:16px;">\${quote.notes}</div>\` : ''}
      <div style="margin:20px 0;">
        <a href="\${process.env.FRONTEND_URL}/account/quotes/\${quote.id}/accept"
           style="background:#c8932a;color:#000;padding:12px 28px;text-decoration:none;font-weight:bold;font-size:13px;display:inline-block;">
          ACCEPT QUOTE \u21E8
        </a>
      </div>
      <div style="background:#f9f9f9;border:1px solid #eee;padding:14px 18px;font-size:11px;color:#777;line-height:1.8;margin-top:20px;">
        <strong style="color:#555;font-size:12px;">Terms &amp; Conditions</strong><br/>
        \${TERMS}
      </div>
    \`),
  });
}`;

if (a.includes(oldHtml)) { a = a.replace(oldHtml, newHtml); console.log('Quote email template: FIXED'); }
else console.log('NOT FOUND');

fs.writeFileSync('services/mailer.js', a);
console.log('Done.');
