const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');

// 1. Add customer_ref field to Create Manual RFQ form (after Notes textarea)
const oldNotes = `              <div>
                <div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Notes</div>
                <textarea name="notes" rows="3" style="width:100%;" placeholder="Customer notes, special requirements, delivery instructions..."></textarea>
              </div>`;
const newNotes = `              <div>
                <div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Notes</div>
                <textarea name="notes" rows="3" style="width:100%;" placeholder="Customer notes, special requirements, delivery instructions..."></textarea>
              </div>
              <div style="margin-top:12px;">
                <div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Customer Reference <span style="color:#555;">(optional — customer's PO#, project code, etc.)</span></div>
                <input type="text" name="customer_ref" placeholder="e.g. PO-12345, Project Alpha" style="width:100%;"/>
              </div>`;
if (a.includes(oldNotes)) { a = a.replace(oldNotes, newNotes); console.log('Create form: FIXED'); }
else console.log('Create form: NOT FOUND');

// 2. Add customer_ref to the POST handler - extract from req.body
const oldExtract = `      const { customer_type, customer_id, priority, status, source, notes,
              new_first_name, new_last_name, new_email, new_phone, new_company, new_country } = req.body;`;
const newExtract = `      const { customer_type, customer_id, priority, status, source, notes, customer_ref,
              new_first_name, new_last_name, new_email, new_phone, new_company, new_country } = req.body;`;
if (a.includes(oldExtract)) { a = a.replace(oldExtract, newExtract); console.log('POST extract: FIXED'); }
else console.log('POST extract: NOT FOUND');

// 3. Add customer_ref to the INSERT rfq_headers query
const oldInsert = `        .input('notes', sql.NVarChar(sql.MAX), notes || null)
        .query(\`
          INSERT INTO rfq_headers (customer_id, rfq_number, status, priority, notes)
          OUTPUT INSERTED.id
          VALUES (@customerId, @rfqNumber, @status, @priority, @notes)
        \`);`;
const newInsert = `        .input('notes', sql.NVarChar(sql.MAX), notes || null)
        .input('customerRef', sql.NVarChar(100), customer_ref?.trim() || null)
        .query(\`
          INSERT INTO rfq_headers (customer_id, rfq_number, status, priority, notes, customer_ref)
          OUTPUT INSERTED.id
          VALUES (@customerId, @rfqNumber, @status, @priority, @notes, @customerRef)
        \`);`;
if (a.includes(oldInsert)) { a = a.replace(oldInsert, newInsert); console.log('INSERT query: FIXED'); }
else console.log('INSERT query: NOT FOUND');

// 4. Show customer_ref in RFQ detail page - add to detail-grid
const oldGrid = `          <div class="detail-item"><div class="detail-label">Priority</div><div class="detail-value">\${statusBadge(rfq.priority)}</div></div>
          <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">\${statusBadge(rfq.status)}</div></div>`;
const newGrid = `          <div class="detail-item"><div class="detail-label">Priority</div><div class="detail-value">\${statusBadge(rfq.priority)}</div></div>
          <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">\${statusBadge(rfq.status)}</div></div>
          \${rfq.customer_ref ? \`<div class="detail-item"><div class="detail-label">Customer Ref</div><div class="detail-value" style="color:#c8932a;font-family:monospace;">\${rfq.customer_ref}</div></div>\` : ''}`;
if (a.includes(oldGrid)) { a = a.replace(oldGrid, newGrid); console.log('Detail grid: FIXED'); }
else console.log('Detail grid: NOT FOUND');

// 5. Show customer_ref in RFQ list table - add to rows
const oldRfqRow = `        <td>${'$'}{r.line_count}</td>
        <td>${'$'}{statusBadge(r.priority)}</td>
        <td>${'$'}{statusBadge(r.status)}</td>`;

fs.writeFileSync('admin/index.js', a);
console.log('Done.');
