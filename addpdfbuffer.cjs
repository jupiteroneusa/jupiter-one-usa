const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');
const lines = a.split('\n');

// Insert PDF generation block at line 1434 (0-indexed 1433) before the try {
// Lines: 1433=const{personal_message...}, 1434=try {, 1435=await sendQuoteToCustomer

const insertAt = 1433; // 0-indexed - after personal_message line
const pdfBlock = [
  "      // Generate PDF if requested",
  "      let pdfBuffer = null;",
  "      if (attach_pdf === '1' && quote && quote.id) {",
  "        try {",
  "          const puppeteer = await import('puppeteer');",
  "          const pdfLineRows = processedLines.map(l => `<tr><td style='padding:6px 8px;border:1px solid #ddd;font-family:monospace;font-size:11px;'>${l.nsn||l.part_number||'—'}</td><td style='padding:6px 8px;border:1px solid #ddd;font-size:11px;'>${l.item_name||'—'}</td><td style='padding:6px 8px;border:1px solid #ddd;text-align:center;font-size:11px;'>${l.quantity}</td><td style='padding:6px 8px;border:1px solid #ddd;font-size:11px;'>${l.condition_code||'NE'}</td><td style='padding:6px 8px;border:1px solid #ddd;text-align:right;font-size:11px;'>$${parseFloat(l.unit_price||0).toFixed(2)}</td><td style='padding:6px 8px;border:1px solid #ddd;text-align:right;font-weight:bold;font-size:11px;'>$${parseFloat(l.line_total||0).toFixed(2)}</td><td style='padding:6px 8px;border:1px solid #ddd;font-size:11px;'>${l.lead_time_text||l.lead_time_days||'—'}</td></tr>`).join('');",
  "          const pdfHtml = `<!DOCTYPE html><html><head><meta charset='utf-8'/><style>body{font-family:Arial,sans-serif;margin:0;padding:20px;font-size:12px;}.hdr{background:#0a1628;color:#c8932a;padding:16px 20px;margin-bottom:16px;}.hdr h1{margin:0;font-size:18px;letter-spacing:.04em;}.hdr p{margin:3px 0 0;color:#aaa;font-size:11px;}table{width:100%;border-collapse:collapse;margin:16px 0;}th{background:#0a1628;color:#fff;padding:8px;text-align:left;font-size:11px;}.terms{font-size:9px;color:#777;border-top:1px solid #ddd;padding-top:10px;margin-top:16px;}</style></head><body><div class='hdr'><h1>JUPITER ONE USA LLC</h1><p>Aerospace &amp; Defense Component Supplier</p></div><table style='margin-bottom:10px;'><tr><td style='border:none;vertical-align:top;width:50%;padding-right:16px;'><div style='font-size:9px;color:#888;text-transform:uppercase;margin-bottom:4px;'>Bill To</div><strong>${rfq.first_name} ${rfq.last_name}</strong><br/>${rfq.company||''}<br/>${rfq.email}</td><td style='border:none;vertical-align:top;'><div style='font-size:9px;color:#888;text-transform:uppercase;margin-bottom:4px;'>Quote Details</div><table style='margin:0;'><tr><td style='border:none;padding:1px 8px 1px 0;color:#888;font-size:11px;'>Quote #</td><td style='border:none;font-weight:bold;font-size:11px;'>${quoteNumber}</td></tr><tr><td style='border:none;padding:1px 8px 1px 0;color:#888;font-size:11px;'>RFQ #</td><td style='border:none;font-size:11px;'>${rfq.rfq_number}</td></tr><tr><td style='border:none;padding:1px 8px 1px 0;color:#888;font-size:11px;'>Issued</td><td style='border:none;font-size:11px;'>${new Date().toLocaleDateString()}</td></tr><tr><td style='border:none;padding:1px 8px 1px 0;color:#888;font-size:11px;'>Valid Until</td><td style='border:none;font-weight:bold;font-size:11px;'>${new Date(validUntil).toLocaleDateString()}</td></tr><tr><td style='border:none;padding:1px 8px 1px 0;color:#888;font-size:11px;'>Sales Rep</td><td style='border:none;font-size:11px;'>Derek Torchia</td></tr></table></td></tr></table><table><thead><tr><th>NSN/Part</th><th>Description</th><th>Qty</th><th>Condition</th><th>Unit Price</th><th>Total</th><th>Lead Time</th></tr></thead><tbody>${pdfLineRows}</tbody><tfoot><tr><td colspan='5' style='padding:8px;text-align:right;border:1px solid #ddd;font-weight:bold;'>Quote Total:</td><td style='padding:8px;text-align:right;border:1px solid #ddd;font-weight:bold;color:#c8932a;'>$${Number(subtotal).toFixed(2)}</td><td style='border:1px solid #ddd;'></td></tr></tfoot></table>${notes?`<div style='background:#fff8e7;border-left:3px solid #c8932a;padding:10px;font-size:11px;color:#555;margin-bottom:12px;'>${notes}</div>`:''}<div class='terms'>Payment: Credit Card or Wire Transfer (3.5% CC fee). All orders non-cancellable once confirmed. Delivery times estimated, not guaranteed. Claims within 7 days of receipt. Quote valid 30 days from issue. Prices subject to availability at time of order confirmation.</div><div style='margin-top:16px;font-size:10px;color:#888;'>Jupiter One USA LLC | 400 N Tampa St, Suite 1550, Tampa FL | +1 (347) 821-7412 | DTorchia@jupiteroneusa.com</div></body></html>`;",
  "          const browser = await puppeteer.default.launch({ executablePath: '/home/puppeteer-cache/chrome/linux-147.0.7727.57/chrome-linux64/chrome', args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'] });",
  "          const pdfPage = await browser.newPage();",
  "          await pdfPage.setContent(pdfHtml, { waitUntil: 'networkidle0' });",
  "          pdfBuffer = await pdfPage.pdf({ format: 'A4', margin: { top:'10mm', bottom:'10mm', left:'10mm', right:'10mm' } });",
  "          await browser.close();",
  "          console.log('PDF generated, size:', pdfBuffer.length);",
  "        } catch(pdfErr) { console.error('PDF gen error:', pdfErr.message); }",
  "      }",
];

lines.splice(insertAt, 0, ...pdfBlock);
console.log('PDF block: INSERTED at line', insertAt + 1);

// Now find pdfUrl: null and add pdfBuffer
const pdfUrlLine = lines.findIndex((l, i) => i >= insertAt + pdfBlock.length && i <= insertAt + pdfBlock.length + 20 && l.includes('pdfUrl: null,'));
if (pdfUrlLine > -1) {
  lines.splice(pdfUrlLine + 1, 0, "        pdfBuffer,");
  console.log('pdfBuffer param: ADDED at line', pdfUrlLine + 2);
} else console.log('pdfUrl line NOT FOUND');

fs.writeFileSync('admin/index.js', lines.join('\n'));
console.log('Done.');

// Update mailer to attach pdfBuffer
let m = fs.readFileSync('services/mailer.js', 'utf8');
m = m.replace(
  '{ customer, quote, lines, pdfUrl, rfq, ccEmails, attachPdf }',
  '{ customer, quote, lines, pdfUrl, rfq, ccEmails, attachPdf, pdfBuffer }'
);
// Add attachments to send call
m = m.replace(
  "    cc: ccEmails ? ccEmails.split(',').map(e => e.trim()).filter(Boolean).join(',') : undefined,",
  "    cc: ccEmails ? ccEmails.split(',').map(e => e.trim()).filter(Boolean).join(',') : undefined,\n    attachments: pdfBuffer ? [{ filename: `Quote-${quote.quote_number}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }] : undefined,"
);
fs.writeFileSync('services/mailer.js', m);
console.log('Mailer: pdfBuffer attachment ADDED');
