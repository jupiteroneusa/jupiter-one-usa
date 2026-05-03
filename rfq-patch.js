// Patches rfq.js to send email on status change
import fs from 'fs';

const file = 'C:\\Jupiter One USA\\website\\jupiter-one-backend-complete\\jupiter-one-backend\\routes\\rfq.js';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('sendRfqStatusUpdate')) {
  // Add to import
  content = content.replace(
    "import { sendRfqReceivedCustomer, sendRfqNotificationAdmin } from '../services/mailer.js';",
    "import { sendRfqReceivedCustomer, sendRfqNotificationAdmin, sendRfqStatusUpdate } from '../services/mailer.js';"
  );

  // Add email before res.json success in status route
  content = content.replace(
    "    res.json({ success: true });\n  } catch (err) {\n    res.status(500).json({ error: 'Status update failed.' });",
    `    // Email customer on status change
    try {
      const cr = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT h.rfq_number, h.id, c.first_name, c.last_name, c.email FROM rfq_headers h JOIN customers c ON c.id=h.customer_id WHERE h.id=@id');
      if (cr.recordset.length) {
        const r = cr.recordset[0];
        const msgs = {
          'Under Review': 'Your RFQ is now under review by our team. We will be in touch shortly.',
          'Sourcing': 'We are actively sourcing your parts from our verified supplier network.',
          'Quoted': 'Your quote is ready. Please log in to view and accept.',
          'Closed': 'Your RFQ has been closed. Contact us if you have questions.',
          'Cancelled': 'Your RFQ has been cancelled. Contact us if you have questions.'
        };
        if (msgs[status]) sendRfqStatusUpdate({ customer: r, rfq: r, status, message: msgs[status] }).catch(console.error);
      }
    } catch(e) { console.error('Status email error:', e); }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Status update failed.' });`
  );

  fs.writeFileSync(file, content, 'utf8');
  console.log('rfq.js patched!');
} else {
  console.log('Already patched!');
}
