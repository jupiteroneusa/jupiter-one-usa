const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');

// Fix the sendQuoteToCustomer call to pass personal_message and rfq
const old = `      await sendQuoteToCustomer({
        customer,
        quote: { ...quote, total_amount: subtotal, valid_until: validUntil, payment_terms, notes },
        lines: processedLines,
        pdfUrl: null,
      }).catch(console.error);`;

const neu = `      const { personal_message } = req.body;
      await sendQuoteToCustomer({
        customer,
        quote: { ...quote, total_amount: subtotal, valid_until: validUntil, payment_terms, notes, personal_message },
        lines: processedLines,
        pdfUrl: null,
        rfq: { rfq_number: rfq.rfq_number, customer_ref: rfq.customer_ref, priority: rfq.priority },
      }).catch(console.error);`;

if (a.includes(old)) { a = a.replace(old, neu); console.log('sendQuoteToCustomer call: FIXED'); }
else console.log('NOT FOUND');

fs.writeFileSync('admin/index.js', a);
console.log('Done.');
