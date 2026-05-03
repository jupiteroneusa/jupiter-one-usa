// Run this script to add sendRfqStatusUpdate to mailer.js
import fs from 'fs';

const file = 'C:\\Jupiter One USA\\website\\jupiter-one-backend-complete\\jupiter-one-backend\\services\\mailer.js';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('sendRfqStatusUpdate')) {
  const addition = `
export async function sendRfqStatusUpdate({ customer, rfq, status, message }) {
  const subj = 'RFQ ' + rfq.rfq_number + ' Update — ' + status + ' | Jupiter One USA';
  await send({
    to: customer.email, subject: subj,
    type: 'rfq_status_update', entityType: 'rfq', entityId: rfq.id,
    html: layout(\`
      <p style="font-size:15px;">Hi \${customer.first_name},</p>
      <p style="font-size:14px;color:#444;line-height:1.7;">\${message}</p>
      <div style="background:#f9f9f9;border-left:3px solid #c8932a;padding:14px 20px;margin:20px 0;font-size:13px;color:#666;">
        <strong>RFQ:</strong> \${rfq.rfq_number}<br/>
        <strong>New Status:</strong> \${status}
      </div>
      <div style="margin-top:20px;">
        <a href="\${process.env.FRONTEND_URL}/pages/account.html?tab=rfqs" style="background:#c8932a;color:#000;padding:12px 28px;text-decoration:none;font-weight:bold;font-size:13px;">VIEW MY RFQS \u2192</a>
      </div>
    \`),
  });
}
`;
  fs.writeFileSync(file, content + addition, 'utf8');
  console.log('mailer.js updated!');
} else {
  console.log('Already has sendRfqStatusUpdate!');
}
