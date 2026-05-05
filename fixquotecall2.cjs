const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');
const lines = a.split('\n');

// Lines 1088-1093 (0-indexed 1087-1092)
if (lines[1087].includes('sendQuoteToCustomer') &&
    lines[1089].includes('quote:') &&
    lines[1092].includes('catch')) {
  
  lines[1087] = "      const { personal_message } = req.body;\r";
  lines[1088] = "      await sendQuoteToCustomer({\r";  // wait, need to keep this
  // Actually insert before 1087
  lines.splice(1087, 0, "      const { personal_message } = req.body;");
  
  // Now lines shifted by 1, so quote line is at 1090
  lines[1090] = "        quote: { ...quote, total_amount: subtotal, valid_until: validUntil, payment_terms, notes, personal_message },\r";
  
  // Add rfq param after lines: processedLines
  const pdfLine = lines.findIndex((l, i) => i >= 1090 && i <= 1096 && l.includes('pdfUrl: null'));
  if (pdfLine > -1) {
    lines.splice(pdfLine, 0, "        rfq: { rfq_number: rfq.rfq_number, customer_ref: rfq.customer_ref, priority: rfq.priority },");
    console.log('rfq param: ADDED at line', pdfLine + 1);
  }
  console.log('personal_message: ADDED');
} else {
  console.log('Lines dont match:', JSON.stringify(lines[1087]));
}

fs.writeFileSync('admin/index.js', lines.join('\n'));
console.log('Done.');
