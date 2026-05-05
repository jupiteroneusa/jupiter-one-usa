const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');

// Replace Puppeteer PDF generation with a simple HTML-to-buffer approach
// Since we can't use Puppeteer, use a simple approach: 
// Generate the PDF HTML and send it as an attachment using nodemailer's html-to-text
// Actually, let's use the 'pdfkit' or just skip PDF for now and note the issue

// Find the PDF generation block and replace with a note
const oldPdf = `      // Generate PDF if requested
      let pdfBuffer = null;
      if (attach_pdf === '1' && quote && quote.id) {
        try {
          const puppeteer = await import('puppeteer');`;

if (a.includes(oldPdf)) {
  // Find the end of the try block for PDF
  const startIdx = a.indexOf(oldPdf);
  const endMarker = "        } catch(pdfErr) { console.error('PDF gen error:', pdfErr.message); }\n      }";
  const endIdx = a.indexOf(endMarker, startIdx);
  
  if (endIdx > -1) {
    const newPdf = `      // Generate PDF if requested
      let pdfBuffer = null;
      if (attach_pdf === '1' && quote && quote.id) {
        try {
          // Use jsPDF via require for server-side PDF generation
          const { jsPDF } = await import('jspdf');
          const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
          doc.setFontSize(16); doc.setTextColor(200, 147, 42);
          doc.text('JUPITER ONE USA LLC', 15, 20);
          doc.setFontSize(9); doc.setTextColor(150, 150, 150);
          doc.text('Aerospace & Defense Component Supplier', 15, 27);
          doc.setFontSize(10); doc.setTextColor(50, 50, 50);
          doc.text('Quote #: ' + quoteNumber, 15, 40);
          doc.text('RFQ #: ' + rfq.rfq_number, 15, 47);
          doc.text('Customer: ' + rfq.first_name + ' ' + rfq.last_name, 15, 54);
          doc.text('Valid Until: ' + new Date(validUntil).toLocaleDateString(), 15, 61);
          doc.text('Sales Rep: Derek Torchia', 15, 68);
          let y = 80;
          doc.setFillColor(10, 22, 40); doc.rect(15, y-6, 180, 8, 'F');
          doc.setTextColor(255, 255, 255); doc.setFontSize(8);
          doc.text('NSN/Part', 17, y); doc.text('Description', 55, y); doc.text('Qty', 110, y); doc.text('Unit Price', 125, y); doc.text('Total', 155, y); doc.text('Lead Time', 170, y);
          y += 4; doc.setTextColor(50, 50, 50); doc.setFontSize(8);
          for (const l of processedLines) {
            if (y > 260) { doc.addPage(); y = 20; }
            doc.text(String(l.nsn||l.part_number||'—').substring(0,18), 17, y);
            doc.text(String(l.item_name||'—').substring(0,22), 55, y);
            doc.text(String(l.quantity), 110, y);
            doc.text('$' + parseFloat(l.unit_price||0).toFixed(2), 125, y);
            doc.text('$' + parseFloat(l.line_total||0).toFixed(2), 155, y);
            doc.text(String(l.lead_time_text||l.lead_time_days||'—').substring(0,15), 170, y);
            y += 7;
          }
          y += 4;
          doc.setFontSize(10); doc.setTextColor(200, 147, 42);
          doc.text('Total: $' + Number(subtotal).toFixed(2), 155, y);
          if (notes) { y += 10; doc.setFontSize(8); doc.setTextColor(100,100,100); doc.text('Notes: ' + notes.substring(0,80), 15, y); }
          y += 12; doc.setFontSize(7); doc.setTextColor(120,120,120);
          doc.text('Payment: Credit Card or Wire Transfer (3.5% CC fee). All orders non-cancellable once confirmed.', 15, y);
          doc.text('Delivery times estimated. Claims within 7 days. Quote valid 30 days.', 15, y+5);
          doc.text('Jupiter One USA LLC | 400 N Tampa St, Suite 1550, Tampa FL | +1 (347) 821-7412', 15, y+10);
          pdfBuffer = Buffer.from(doc.output('arraybuffer'));
          console.log('PDF generated with jsPDF, size:', pdfBuffer.length);`;
    
    a = a.slice(0, startIdx) + newPdf + '\n' + endMarker + a.slice(endIdx + endMarker.length);
    console.log('PDF method: REPLACED with jsPDF');
  } else console.log('End marker NOT FOUND');
} else console.log('PDF block NOT FOUND');

fs.writeFileSync('admin/index.js', a);
console.log('Done.');
