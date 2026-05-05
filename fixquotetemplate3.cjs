const fs = require('fs');
let a = fs.readFileSync('services/mailer.js', 'utf8');
const lines = a.split('\n');

// Find start and end of sendQuoteToCustomer more carefully
const startLine = lines.findIndex(l => l.includes('export async function sendQuoteToCustomer'));
// End is the next export function
const endLine = lines.findIndex((l, i) => i > startLine && l.startsWith('export async function'));
console.log('Function at lines:', startLine + 1, 'to', endLine);
console.log('Last line of function:', JSON.stringify(lines[endLine - 1]));
console.log('First line of next func:', JSON.stringify(lines[endLine]));

// Only proceed if we found valid boundaries
if (startLine === -1 || endLine === -1) { console.log('BOUNDARIES NOT FOUND'); process.exit(1); }

const newFunc = `export async function sendQuoteToCustomer({ customer, quote, lines, pdfUrl, rfq }) {
  const lineRows = lines.map(l => \`
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-family:monospace;">\${l.nsn || l.part_number || '\u2014'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">\${l.item_name || '\u2014'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">\${l.quantity}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">\${l.condition_code || 'NE'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">$\${Number(l.unit_price).toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;">$\${Number(l.line_total).toFixed(2)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;">\${l.lead_time_text || (l.lead_time_days ? l.lead_time_days + ' days' : '\u2014')}</td>
    </tr>
  \`).join('');

  const subject = \`Quote \${quote.quote_number} \u2014 Jupiter One USA\`;
  const now = new Date();
  const quoteDate = now.toLocaleDateString('en-US', { month:'2-digit', day:'2-digit', year:'numeric' }) + ' ' + now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', timeZone:'America/New_York' }) + ' ET';
  const validDate = new Date(quote.valid_until).toLocaleDateString('en-US', { month:'2-digit', day:'2-digit', year:'numeric' });
  const personalMsg = quote.personal_message ? \`<div style="background:#f0f7ff;border-left:3px solid #4a90d9;padding:14px 20px;margin-bottom:20px;font-size:14px;color:#333;line-height:1.6;">\${quote.personal_message}</div>\` : '';

  await send({
    to: customer.email,
    bcc: COMPANY.email,
    subject,
    type: 'quote_sent', entityType: 'quote', entityId: quote.id,
    html: layout(\`
      \${personalMsg}
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px;border:1px solid #ddd;">
        <tr>
          <td style="padding:10px 14px;border-right:1px solid #eee;width:50%;vertical-align:top;">
            <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Bill To</div>
            <strong style="font-size:13px;">\${customer.first_name} \${customer.last_name}</strong><br/>
            \${customer.company ? customer.company + '<br/>' : ''}
            <a href="mailto:\${customer.email}" style="color:#c8932a;">\${customer.email}</a>
          </td>
          <td style="padding:10px 14px;vertical-align:top;">
            <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;">Quote Details</div>
            <table style="font-size:12px;width:100%;border-collapse:collapse;">
              <tr><td style="color:#888;padding:2px 0;width:100px;">Quote #</td><td style="font-weight:600;">\${quote.quote_number}</td></tr>
              \${rfq ? '<tr><td style="color:#888;padding:2px 0;">RFQ #</td><td>' + (rfq.rfq_number||'') + '</td></tr>' : ''}
              \${rfq && rfq.customer_ref ? '<tr><td style="color:#888;padding:2px 0;">Your Ref</td><td style="font-weight:600;color:#c8932a;">' + rfq.customer_ref + '</td></tr>' : ''}
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
      \${quote.notes ? '<div style="background:#fff8e7;border-left:3px solid #c8932a;padding:12px 16px;font-size:13px;color:#555;margin-bottom:16px;">' + quote.notes + '</div>' : ''}
      <div style="margin:20px 0;">
        <a href="\${process.env.FRONTEND_URL}/account/quotes/\${quote.id}/accept"
           style="background:#c8932a;color:#000;padding:12px 28px;text-decoration:none;font-weight:bold;font-size:13px;display:inline-block;">
          ACCEPT QUOTE &#8594;
        </a>
      </div>
      <div style="background:#f9f9f9;border:1px solid #eee;padding:14px 18px;font-size:11px;color:#777;line-height:1.9;margin-top:20px;">
        <strong style="color:#555;font-size:12px;display:block;margin-bottom:6px;">Terms &amp; Conditions</strong>
        <div><strong>Payment:</strong> Credit Card or Wire Transfer. Credit card payments subject to a 3.5% processing fee. Wire transfer details provided upon order confirmation.</div>
        <div><strong>Cancellation:</strong> All orders are non-cancellable and non-returnable once confirmed.</div>
        <div><strong>Delivery:</strong> Delivery times are estimated and not guaranteed. Delivery claims must be reported within 7 days of receipt.</div>
        <div><strong>Validity:</strong> Quote valid for 30 days. Prices subject to availability at time of order confirmation.</div>
        <div><strong>Condition Codes:</strong> NE=New, NS=New Surplus, OH=Overhaul, AR=As Removed, SV=Serviceable.</div>
      </div>
    \`),
  });
}

`;

// Replace lines from startLine to endLine (exclusive - keep the next export function)
lines.splice(startLine, endLine - startLine, ...newFunc.split('\n'));
fs.writeFileSync('services/mailer.js', lines.join('\n'));
console.log('Template: REPLACED');
console.log('New total lines:', lines.length);
console.log('Done.');
