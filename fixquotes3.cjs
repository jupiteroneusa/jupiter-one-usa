const fs = require('fs');

let a = fs.readFileSync('admin/index.js', 'utf8');

// 1. Fix SQL to include rfq_id and customer_id
const oldSQL = `          c.first_name+' '+c.last_name AS customer_name, c.company, h.rfq_number`;
const newSQL = `          q.rfq_id, q.customer_id,
          c.first_name+' '+c.last_name AS customer_name, c.company, h.rfq_number`;
if (a.includes(oldSQL)) { a = a.replace(oldSQL, newSQL); console.log('SQL: FIXED'); }
else console.log('SQL: NOT FOUND');

// 2. Fix rows - add company col, clickable customer, fix colspan
const oldRows = `        <td>\${q.customer_name}<br><span style="font-size:.75rem;color:#7a8a9a;">\${q.company||''}</span></td>
        <td style="font-weight:600;">\$\${parseFloat(q.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
        <td>\${statusBadge(q.status)}</td>
        <td style="color:#7a8a9a;font-size:.78rem;">\${q.valid_until?new Date(q.valid_until).toLocaleDateString():'\u2014'}</td>
        <td style="color:#7a8a9a;font-size:.78rem;">\${new Date(q.created_at).toLocaleDateString()}</td>
      </tr>\`).join('') || '<tr><td colspan="7" style="text-align:center;color:#7a8a9a;padding:24px;">No quotes yet</td></tr>';`;

const newRows = `        <td><a href="/admin/customers/\${q.customer_id}" style="color:#c8932a;">\${q.customer_name}</a></td>
        <td style="color:#7a8a9a;font-size:.8rem;">\${q.company||'\u2014'}</td>
        <td style="font-weight:600;">\$\${parseFloat(q.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
        <td>\${statusBadge(q.status)}</td>
        <td style="color:#7a8a9a;font-size:.78rem;">\${q.valid_until?new Date(q.valid_until).toLocaleDateString():'\u2014'}</td>
        <td style="color:#7a8a9a;font-size:.78rem;">\${new Date(q.created_at).toLocaleDateString()}</td>
      </tr>\`).join('') || '<tr><td colspan="8" style="text-align:center;color:#7a8a9a;padding:24px;">No quotes yet</td></tr>';`;

if (a.includes(oldRows)) { a = a.replace(oldRows, newRows); console.log('Rows: FIXED'); }
else console.log('Rows: NOT FOUND');

// 3. Fix table header - add Company, make sortable
const oldHeader = `          <table><thead><tr><th>Quote #</th><th>RFQ #</th><th>Customer</th><th>Amount</th><th>Status</th><th>Valid Until</th><th>Created</th></tr></thead>`;
const newHeader = `          <table><thead><tr>
            <th class="sortable" onclick="sortTable(this,0)">Quote #</th>
            <th class="sortable" onclick="sortTable(this,1)">RFQ #</th>
            <th class="sortable" onclick="sortTable(this,2)">Customer</th>
            <th class="sortable" onclick="sortTable(this,3)">Company</th>
            <th class="sortable" onclick="sortTable(this,4)">Amount</th>
            <th class="sortable" onclick="sortTable(this,5)">Status</th>
            <th class="sortable" onclick="sortTable(this,6)">Valid Until</th>
            <th class="sortable" onclick="sortTable(this,7)">Created</th>
          </tr></thead>`;
if (a.includes(oldHeader)) { a = a.replace(oldHeader, newHeader); console.log('Header: FIXED'); }
else console.log('Header: NOT FOUND');

fs.writeFileSync('admin/index.js', a);
console.log('admin/index.js saved.');

// 4. Add quote detail route if not already there
if (a.includes("router.get('/quotes/:id'")) {
  console.log('Quote detail route: already exists');
} else {
  const insertBefore = `  // Orders\n  router.get('/orders'`;
  const detailRoute = `  // Quote Detail
  router.get('/quotes/:id', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const qr = await pool.request().input('id', sql.BigInt, req.params.id).query(\`
        SELECT q.*, h.rfq_number, h.id AS rfq_header_id,
          c.first_name+' '+c.last_name AS customer_name, c.company, c.email, c.phone, c.id AS customer_id
        FROM quotes q
        JOIN rfq_headers h ON h.id=q.rfq_id
        JOIN customers c ON c.id=q.customer_id
        WHERE q.id=@id\`);
      if (!qr.recordset.length) return res.send(page('Quote','quotes','<div class="alert alert-error">Quote not found.</div>'));
      const q = qr.recordset[0];
      const lines = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT * FROM quote_lines WHERE quote_id=@id ORDER BY line_number');
      const lineRows = lines.recordset.map(l => \`<tr>
        <td style="color:#7a8a9a;">\${l.line_number}</td>
        <td class="mono" style="color:#c8932a;">\${l.nsn||l.part_number||'\u2014'}</td>
        <td>\${l.item_name||'\u2014'}</td>
        <td>\${l.quantity}</td>
        <td style="color:#7a8a9a;">\${l.condition_code||'\u2014'}</td>
        <td style="color:#7a8a9a;">$\${parseFloat(l.unit_cost||0).toFixed(2)}</td>
        <td style="font-weight:600;">$\${parseFloat(l.unit_price||0).toFixed(2)}</td>
        <td style="font-weight:600;">$\${parseFloat(l.line_total||0).toFixed(2)}</td>
        <td style="color:#7a8a9a;">\${l.lead_time_days ? l.lead_time_days+' days' : '\u2014'}</td>
        <td style="color:\${parseFloat(l.margin_pct||0)>=20?'#4caf50':'#e05050'};">\${parseFloat(l.margin_pct||0).toFixed(1)}%</td>
      </tr>\`).join('');
      res.send(page(\`Quote \${q.quote_number}\`,'quotes',\`
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div class="page-title">Quote \${q.quote_number}</div>
          <a href="/admin/quotes" class="btn btn-outline btn-sm">\u2190 Back to Quotes</a>
        </div>
        <div class="page-sub">Created \${new Date(q.created_at).toLocaleString()}</div>
        <div class="detail-grid">
          <div class="detail-item"><div class="detail-label">Customer</div><div class="detail-value"><a href="/admin/customers/\${q.customer_id}" style="color:#c8932a;">\${q.customer_name}</a></div></div>
          <div class="detail-item"><div class="detail-label">Company</div><div class="detail-value">\${q.company||'\u2014'}</div></div>
          <div class="detail-item"><div class="detail-label">Email</div><div class="detail-value"><a href="mailto:\${q.email}" style="color:#c8932a;">\${q.email}</a></div></div>
          <div class="detail-item"><div class="detail-label">RFQ</div><div class="detail-value"><a href="/admin/rfqs/\${q.rfq_header_id}" style="color:#c8932a;">\${q.rfq_number}</a></div></div>
          <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">\${statusBadge(q.status)}</div></div>
          <div class="detail-item"><div class="detail-label">Valid Until</div><div class="detail-value">\${q.valid_until?new Date(q.valid_until).toLocaleDateString():'\u2014'}</div></div>
          <div class="detail-item"><div class="detail-label">Payment Terms</div><div class="detail-value">\${q.payment_terms||'\u2014'}</div></div>
          <div class="detail-item"><div class="detail-label">Total</div><div class="detail-value" style="font-weight:700;color:#c8932a;font-size:1.1rem;">$\${parseFloat(q.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2})}</div></div>
        </div>
        <div class="card">
          <div class="card-header">Line Items (\${lines.recordset.length})</div>
          <div style="overflow-x:auto;">
            <table><thead><tr>
              <th>#</th><th>NSN / Part</th><th>Description</th><th>Qty</th><th>Condition</th>
              <th>Unit Cost</th><th>Unit Price</th><th>Line Total</th><th>Lead Time</th><th>Margin %</th>
            </tr></thead>
            <tbody>\${lineRows||'<tr><td colspan="10" style="text-align:center;color:#7a8a9a;padding:16px;">No lines</td></tr>'}</tbody></table>
          </div>
          <div style="padding:16px;text-align:right;border-top:1px solid #1e2d42;">
            <span style="color:#7a8a9a;margin-right:16px;">Total Cost: <strong style="color:#eef1f5;">$\${parseFloat(q.total_cost||0).toLocaleString('en-US',{minimumFractionDigits:2})}</strong></span>
            <span style="color:#7a8a9a;margin-right:16px;">Margin: <strong style="color:#4caf50;">$\${parseFloat(q.total_margin||0).toLocaleString('en-US',{minimumFractionDigits:2})}</strong></span>
            <span style="font-size:1.1rem;font-weight:700;">Total: <strong style="color:#c8932a;">$\${parseFloat(q.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2})}</strong></span>
          </div>
        </div>
        \${q.notes?\`<div class="card"><div class="card-header">Notes</div><div class="card-body" style="color:#7a8a9a;">\${q.notes}</div></div>\`:''}
      \`));
    } catch(err) {
      res.send(page('Quote','quotes',\`<div class="alert alert-error">\${err.message}</div>\`));
    }
  });

  // Orders
  router.get('/orders'`;

  let b = fs.readFileSync('admin/index.js', 'utf8');
  if (b.includes(insertBefore)) {
    b = b.replace(insertBefore, detailRoute);
    fs.writeFileSync('admin/index.js', b);
    console.log('Quote detail route: ADDED');
  } else {
    console.log('Quote detail route: insert point not found');
  }
}

console.log('All done!');
