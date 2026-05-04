const fs = require('fs');

let a = fs.readFileSync('admin/index.js', 'utf8');

// 1. Fix duplicate q.rfq_id, q.customer_id in SQL
const oldDupe = `          q.rfq_id, q.customer_id,\n          q.rfq_id, q.customer_id,`;
const newDupe = `          q.rfq_id, q.customer_id,`;
if (a.includes(oldDupe)) { a = a.replace(oldDupe, newDupe); console.log('Duplicate SQL: FIXED'); }
else console.log('Duplicate SQL: not found');

// 2. Fix RFQ # link in rows
const oldRfqCell = `        <td class="mono" style="color:#7a8a9a;">\${q.rfq_number}</td>`;
const newRfqCell = `        <td class="mono"><a href="/admin/rfqs/\${q.rfq_id}" style="color:#c8932a;">\${q.rfq_number}</a></td>`;
if (a.includes(oldRfqCell)) { a = a.replace(oldRfqCell, newRfqCell); console.log('RFQ link: FIXED'); }
else console.log('RFQ link: not found (may already be fixed)');

// 3. Replace quotes page render block with sortable version
const oldRender = `      res.send(page('Quotes','quotes',\`
        <div class="page-title">Quotes</div>
        <div class="page-sub">All customer quotes</div>
        <div class="card">
          <table><thead><tr><th>Quote #</th><th>RFQ #</th><th>Customer</th><th>Amount</th><th>Status</th><th>Valid Until</th><th>Created</th></tr></thead>
          <tbody>\${rows}</tbody></table>
        </div>\`));`;

const newRender = `      res.send(page('Quotes','quotes',\`
        \${SORT_SCRIPT}
        <div class="page-title">Quotes</div>
        <div class="page-sub">All customer quotes</div>
        <div class="card">
          <table><thead><tr>
            <th class="sortable" onclick="sortTable(this,0)">Quote #</th>
            <th class="sortable" onclick="sortTable(this,1)">RFQ #</th>
            <th class="sortable" onclick="sortTable(this,2)">Customer</th>
            <th class="sortable" onclick="sortTable(this,3)">Company</th>
            <th class="sortable" onclick="sortTable(this,4)">Amount</th>
            <th class="sortable" onclick="sortTable(this,5)">Status</th>
            <th class="sortable" onclick="sortTable(this,6)">Valid Until</th>
            <th class="sortable" onclick="sortTable(this,7)">Created</th>
          </tr></thead>
          <tbody>\${rows}</tbody></table>
        </div>\`));`;

if (a.includes(oldRender)) { a = a.replace(oldRender, newRender); console.log('Render block: FIXED'); }
else console.log('Render block: NOT FOUND');

fs.writeFileSync('admin/index.js', a);
console.log('Done.');
