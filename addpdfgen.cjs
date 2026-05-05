const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');
const nl = a.includes('\r\n') ? '\r\n' : '\n';

// Add a PDF generation route before the quote POST route
const insertBefore = "  router.post('/rfqs/:id/quote', async (req, res) => {";
const idx = a.indexOf(insertBefore);
if (idx === -1) { console.log('NOT FOUND'); process.exit(1); }

const pdfRoute = `  // Generate quote PDF
  router.get('/rfqs/:id/quote-pdf/:quoteId', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const qr = await pool.request()
        .input('id', sql.BigInt, req.params.quoteId)
        .query(\`SELECT q.*, h.rfq_number, c.first_name+' '+c.last_name AS customer_name, c.company, c.email FROM quotes q JOIN rfq_headers h ON h.id=q.rfq_id JOIN customers c ON c.id=q.customer_id WHERE q.id=@id\`);
      if (!qr.recordset.length) return res.status(404).send('Quote not found');
      const q = qr.recordset[0];
      const lines = await pool.request().input('qid', sql.BigInt, req.params.quoteId)
        .query('SELECT * FROM quote_lines WHERE quote_id=@qid ORDER BY line_number');
      const lineRows = lines.recordset.map(l => \`<tr>
        <td style="padding:8px;border:1px solid #ddd;font-family:monospace;">\${l.nsn||l.part_number||'—'}</td>
        <td style="padding:8px;border:1px solid #ddd;">\${l.item_name||'—'}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:center;">\${l.quantity}</td>
        <td style="padding:8px;border:1px solid #ddd;">\${l.condition_code||'NE'}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right;">$\${parseFloat(l.unit_price||0).toFixed(2)}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right;font-weight:bold;">$\${parseFloat(l.line_total||0).toFixed(2)}</td>
        <td style="padding:8px;border:1px solid #ddd;">\${l.lead_time_text||l.lead_time_days||'—'}</td>
      </tr>\`).join('');
      const html = \`<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
        body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#222;}
        .header{background:#0a1628;color:#c8932a;padding:20px;margin-bottom:20px;}
        .header h1{margin:0;font-size:22px;letter-spacing:.06em;}
        .header p{margin:4px 0 0;color:#aaa;font-size:12px;}
        .two-col{display:flex;gap:20px;margin-bottom:20px;}
        .col{flex:1;border:1px solid #ddd;padding:14px;}
        .label{font-size:10px;text-transform:uppercase;color:#888;margin-bottom:6px;}
        table{width:100%;border-collapse:collapse;margin:20px 0;}
        th{background:#0a1628;color:#fff;padding:10px 8px;text-align:left;font-size:12px;}
        .total-row td{font-weight:bold;background:#f5f5f5;}
        .terms{font-size:10px;color:#777;border-top:1px solid #ddd;padding-top:12px;margin-top:20px;}
      </style></head><body>
        <div class="header"><h1>JUPITER ONE USA LLC</h1><p>Aerospace &amp; Defense Component Supplier</p></div>
        <div class="two-col">
          <div class="col">
            <div class="label">Bill To</div>
            <strong>\${q.customer_name}</strong><br/>
            \${q.company||''}<br/>
            \${q.email}
          </div>
          <div class="col">
            <div class="label">Quote Details</div>
            <table style="margin:0;border:none;"><tbody>
              <tr><td style="padding:2px 8px 2px 0;border:none;color:#888;font-size:12px;">Quote #</td><td style="padding:2px;border:none;font-weight:bold;">\${q.quote_number}</td></tr>
              <tr><td style="padding:2px 8px 2px 0;border:none;color:#888;font-size:12px;">RFQ #</td><td style="padding:2px;border:none;">\${q.rfq_number}</td></tr>
              <tr><td style="padding:2px 8px 2px 0;border:none;color:#888;font-size:12px;">Status</td><td style="padding:2px;border:none;">QUOTED</td></tr>
              <tr><td style="padding:2px 8px 2px 0;border:none;color:#888;font-size:12px;">Issued</td><td style="padding:2px;border:none;">\${new Date().toLocaleDateString()}</td></tr>
              <tr><td style="padding:2px 8px 2px 0;border:none;color:#888;font-size:12px;">Valid Until</td><td style="padding:2px;border:none;font-weight:bold;">\${new Date(q.valid_until).toLocaleDateString()}</td></tr>
              <tr><td style="padding:2px 8px 2px 0;border:none;color:#888;font-size:12px;">Sales Rep</td><td style="padding:2px;border:none;">Derek Torchia</td></tr>
            </tbody></table>
          </div>
        </div>
        <table>
          <thead><tr>
            <th>NSN / Part#</th><th>Description</th><th>Qty</th><th>Condition</th><th>Unit Price</th><th>Total</th><th>Lead Time</th>
          </tr></thead>
          <tbody>\${lineRows}</tbody>
          <tfoot><tr class="total-row">
            <td colspan="5" style="padding:10px 8px;text-align:right;border:1px solid #ddd;">Quote Total:</td>
            <td style="padding:10px 8px;text-align:right;border:1px solid #ddd;color:#c8932a;">$\${parseFloat(q.total_amount||0).toFixed(2)}</td>
            <td style="border:1px solid #ddd;"></td>
          </tr></tfoot>
        </table>
        \${q.notes ? \`<div style="background:#fff8e7;border-left:3px solid #c8932a;padding:12px;font-size:12px;color:#555;">\${q.notes}</div>\` : ''}
        <div class="terms">
          <strong>Terms &amp; Conditions:</strong> Payment: Credit Card or Wire Transfer (3.5% CC fee). 
          All orders non-cancellable once confirmed. Delivery times estimated, not guaranteed. 
          Claims within 7 days of receipt. Quote valid 30 days. Prices subject to availability.
        </div>
        <div style="margin-top:20px;font-size:11px;color:#888;">
          Jupiter One USA LLC | 400 N Tampa St, Suite 1550, Tampa FL | +1 (347) 821-7412 | DTorchia@jupiteroneusa.com
        </div>
      </body></html>\`;
      const puppeteer = await import('puppeteer');
      const browser = await puppeteer.default.launch({ 
        executablePath: '/home/puppeteer-cache/chrome/linux-147.0.7727.57/chrome-linux64/chrome',
        args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'] 
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', margin: { top:'10mm', bottom:'10mm', left:'10mm', right:'10mm' } });
      await browser.close();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', \`attachment; filename="Quote-\${q.quote_number}.pdf"\`);
      res.send(pdf);
    } catch(err) {
      console.error('PDF error:', err.message);
      res.status(500).send('PDF generation failed: ' + err.message);
    }
  });

  `;

a = a.slice(0, idx) + pdfRoute + a.slice(idx);
fs.writeFileSync('admin/index.js', a);
console.log('PDF route: ADDED');
console.log('Done.');

// Now update the quote POST route to generate PDF and attach it
let b = fs.readFileSync('admin/index.js', 'utf8');
const bLines = b.split('\n');

// Find the try { around sendQuoteToCustomer and replace with PDF-aware version
const tryLine = bLines.findIndex((l, i) => i >= 1340 && i <= 1360 && l.trim() === 'try {');
console.log('try line:', tryLine + 1);

const catchLine = bLines.findIndex((l, i) => i > tryLine && i <= tryLine + 15 && l.includes('} catch(emailErr)'));
console.log('catch line:', catchLine + 1);

if (tryLine > -1 && catchLine > -1) {
  // Replace the try block with PDF-aware version
  const newBlock = [
    "      try {",
    "      let pdfBuffer = null;",
    "      if (attachPdf && quote && quote.id) {",
    "        try {",
    "          const puppeteer = await import('puppeteer');",
    "          const lineRowsPdf = processedLines.map(l => `<tr><td style='padding:8px;border:1px solid #ddd;font-family:monospace;'>${l.nsn||l.part_number||'—'}</td><td style='padding:8px;border:1px solid #ddd;'>${l.item_name||'—'}</td><td style='padding:8px;border:1px solid #ddd;text-align:center;'>${l.quantity}</td><td style='padding:8px;border:1px solid #ddd;'>${l.condition_code||'NE'}</td><td style='padding:8px;border:1px solid #ddd;text-align:right;'>$${parseFloat(l.unit_price||0).toFixed(2)}</td><td style='padding:8px;border:1px solid #ddd;text-align:right;font-weight:bold;'>$${parseFloat(l.line_total||0).toFixed(2)}</td><td style='padding:8px;border:1px solid #ddd;'>${l.lead_time_text||l.lead_time_days||'—'}</td></tr>`).join('');",
    "          const pdfHtml = `<!DOCTYPE html><html><head><meta charset='utf-8'/><style>body{font-family:Arial,sans-serif;margin:0;padding:20px;}.header{background:#0a1628;color:#c8932a;padding:20px;margin-bottom:20px;}.header h1{margin:0;font-size:22px;}.header p{margin:4px 0 0;color:#aaa;font-size:12px;}table{width:100%;border-collapse:collapse;margin:20px 0;}th{background:#0a1628;color:#fff;padding:10px 8px;text-align:left;font-size:12px;}.terms{font-size:10px;color:#777;border-top:1px solid #ddd;padding-top:12px;margin-top:20px;}</style></head><body><div class='header'><h1>JUPITER ONE USA LLC</h1><p>Aerospace &amp; Defense Component Supplier</p></div><table style='margin-bottom:12px;border:none;'><tr><td style='border:none;vertical-align:top;width:50%;padding-right:20px;'><div style='font-size:10px;color:#888;text-transform:uppercase;margin-bottom:6px;'>Bill To</div><strong>${rfq.first_name} ${rfq.last_name}</strong><br/>${rfq.company||''}<br/>${rfq.email}</td><td style='border:none;vertical-align:top;'><div style='font-size:10px;color:#888;text-transform:uppercase;margin-bottom:6px;'>Quote Details</div>Quote #: <strong>${quote.quote_number}</strong><br/>RFQ #: ${rfq.rfq_number}<br/>Issued: ${new Date().toLocaleDateString()}<br/>Valid Until: <strong>${new Date(validUntil).toLocaleDateString()}</strong><br/>Sales Rep: Derek Torchia</td></tr></table><table><thead><tr><th>NSN/Part</th><th>Description</th><th>Qty</th><th>Condition</th><th>Unit Price</th><th>Total</th><th>Lead Time</th></tr></thead><tbody>${lineRowsPdf}</tbody><tfoot><tr><td colspan='5' style='padding:10px 8px;text-align:right;border:1px solid #ddd;font-weight:bold;'>Quote Total:</td><td style='padding:10px 8px;text-align:right;border:1px solid #ddd;font-weight:bold;color:#c8932a;'>$${Number(subtotal).toFixed(2)}</td><td style='border:1px solid #ddd;'></td></tr></tfoot></table>${notes?`<div style='background:#fff8e7;border-left:3px solid #c8932a;padding:12px;font-size:12px;'>${notes}</div>`:''}<div class='terms'>Payment: Credit Card or Wire Transfer (3.5% CC fee). All orders non-cancellable once confirmed. Delivery times estimated. Claims within 7 days. Quote valid 30 days.</div><div style='margin-top:20px;font-size:11px;color:#888;'>Jupiter One USA LLC | 400 N Tampa St, Suite 1550, Tampa FL | +1 (347) 821-7412 | DTorchia@jupiteroneusa.com</div></body></html>`;",
    "          const browser = await puppeteer.default.launch({ executablePath: '/home/puppeteer-cache/chrome/linux-147.0.7727.57/chrome-linux64/chrome', args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'] });",
    "          const pdfPage = await browser.newPage();",
    "          await pdfPage.setContent(pdfHtml, { waitUntil: 'networkidle0' });",
    "          pdfBuffer = await pdfPage.pdf({ format: 'A4', margin: { top:'10mm', bottom:'10mm', left:'10mm', right:'10mm' } });",
    "          await browser.close();",
    "        } catch(pdfErr) { console.error('PDF gen error:', pdfErr.message); }",
    "      }",
    "      await sendQuoteToCustomer({",
  ];
  
  // Find the await sendQuoteToCustomer line
  const sendLine = bLines.findIndex((l, i) => i > tryLine && i <= tryLine + 5 && l.includes('await sendQuoteToCustomer({'));
  
  // Replace from try to sendQuoteToCustomer
  bLines.splice(tryLine, sendLine - tryLine + 1, ...newBlock);
  console.log('PDF generation block: ADDED');
  
  // Now fix pdfUrl to pass pdfBuffer
  const pdfUrlLine = bLines.findIndex((l, i) => i > tryLine && i <= tryLine + 30 && l.includes('pdfUrl: null,'));
  if (pdfUrlLine > -1) {
    bLines[pdfUrlLine] = "        pdfUrl: null,";
    // Add attachments
    bLines.splice(pdfUrlLine + 1, 0, "        pdfBuffer: pdfBuffer,");
    console.log('pdfBuffer param: ADDED');
  }
}

fs.writeFileSync('admin/index.js', bLines.join('\n'));
console.log('All done!');
