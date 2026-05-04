const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');

// 1. Add Accounts to sidebar
const oldSidebar = `    <a href="/admin/rfqs" class="\${active==='rfqs'?'active':''}">≡ƒôï RFQs</a>`;
const newSidebar = `    <a href="/admin/rfqs" class="\${active==='rfqs'?'active':''}">≡ƒôï RFQs</a>
    <a href="/admin/accounts" class="\${active==='accounts'?'active':''}">≡ƒæó Accounts</a>`;
if (a.includes(oldSidebar)) { a = a.replace(oldSidebar, newSidebar); console.log('Sidebar: FIXED'); }
else console.log('Sidebar: NOT FOUND');

// 2. Add accounts routes before customers route
const insertBefore = `  // Customers List\n  router.get('/customers'`;
const accountsRoutes = `  // Accounts — search by company or customer ref
  router.get('/accounts', async (req, res) => {
    if (!requireAuth(req, res)) return;
    const search = (req.query.q || '').trim();
    const type = req.query.type || 'company'; // 'company' or 'ref'
    try {
      const pool = await getPool();
      let rows = '';

      if (search) {
        if (type === 'ref') {
          // Search by customer ref
          const result = await pool.request()
            .input('q', sql.NVarChar, '%' + search + '%')
            .query(\`
              SELECT h.customer_ref,
                COUNT(DISTINCT h.id) AS rfq_count,
                COUNT(DISTINCT q.id) AS quote_count,
                COUNT(DISTINCT o.id) AS order_count,
                SUM(DISTINCT ISNULL(q.total_amount,0)) AS total_quoted,
                MAX(h.submitted_at) AS last_activity,
                c.first_name+' '+c.last_name AS customer_name,
                c.company
              FROM rfq_headers h
              JOIN customers c ON c.id=h.customer_id
              LEFT JOIN quotes q ON q.rfq_id=h.id
              LEFT JOIN orders o ON o.quote_id=q.id
              WHERE h.customer_ref LIKE @q
              GROUP BY h.customer_ref, c.first_name, c.last_name, c.company
              ORDER BY last_activity DESC
            \`);
          rows = result.recordset.map(r => \`<tr>
            <td><a href="/admin/accounts/ref/\${encodeURIComponent(r.customer_ref)}" style="color:#c8932a;font-family:monospace;">\${r.customer_ref}</a></td>
            <td><span style="color:#7a8a9a;">\${r.customer_name}</span></td>
            <td style="color:#7a8a9a;">\${r.company||'—'}</td>
            <td style="text-align:center;">\${r.rfq_count}</td>
            <td style="text-align:center;">\${r.quote_count}</td>
            <td style="text-align:center;">\${r.order_count}</td>
            <td style="font-weight:600;">$\${parseFloat(r.total_quoted||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
            <td style="color:#7a8a9a;font-size:.78rem;">\${new Date(r.last_activity).toLocaleDateString()}</td>
          </tr>\`).join('') || '<tr><td colspan="8" style="text-align:center;color:#7a8a9a;padding:24px;">No results found</td></tr>';
        } else {
          // Search by company
          const result = await pool.request()
            .input('q', sql.NVarChar, '%' + search + '%')
            .query(\`
              SELECT c.company,
                COUNT(DISTINCT c.id) AS contact_count,
                COUNT(DISTINCT h.id) AS rfq_count,
                COUNT(DISTINCT q.id) AS quote_count,
                COUNT(DISTINCT o.id) AS order_count,
                SUM(ISNULL(q.total_amount,0)) AS total_quoted,
                MAX(h.submitted_at) AS last_activity
              FROM customers c
              LEFT JOIN rfq_headers h ON h.customer_id=c.id
              LEFT JOIN quotes q ON q.rfq_id=h.id
              LEFT JOIN orders o ON o.quote_id=q.id
              WHERE c.company LIKE @q
              GROUP BY c.company
              ORDER BY last_activity DESC
            \`);
          rows = result.recordset.map(r => \`<tr>
            <td><a href="/admin/accounts/company/\${encodeURIComponent(r.company)}" style="color:#c8932a;">\${r.company||'—'}</a></td>
            <td style="text-align:center;">\${r.contact_count}</td>
            <td style="text-align:center;">\${r.rfq_count}</td>
            <td style="text-align:center;">\${r.quote_count}</td>
            <td style="text-align:center;">\${r.order_count}</td>
            <td style="font-weight:600;">$\${parseFloat(r.total_quoted||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
            <td style="color:#7a8a9a;font-size:.78rem;">\${r.last_activity ? new Date(r.last_activity).toLocaleDateString() : '—'}</td>
          </tr>\`).join('') || '<tr><td colspan="7" style="text-align:center;color:#7a8a9a;padding:24px;">No results found</td></tr>';
        }
      }

      const isRef = type === 'ref';
      res.send(page('Accounts','accounts',\`
        \${SORT_SCRIPT}
        <div class="page-title">Accounts</div>
        <div class="page-sub">Search activity by company or customer reference</div>
        <div class="card" style="margin-bottom:20px;">
          <div class="card-body">
            <form method="GET" action="/admin/accounts" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
              <div style="flex:1;min-width:250px;">
                <div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Search</div>
                <input type="text" name="q" value="\${search}" placeholder="\${isRef ? 'Enter customer ref...' : 'Enter company name...'}" style="width:100%;" autofocus/>
              </div>
              <div>
                <div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Search By</div>
                <select name="type" style="width:150px;">
                  <option value="company" \${!isRef?'selected':''}>Company</option>
                  <option value="ref" \${isRef?'selected':''}>Customer Ref</option>
                </select>
              </div>
              <button type="submit" class="btn btn-gold">Search →</button>
              \${search ? '<a href="/admin/accounts" class="btn btn-outline">Clear</a>' : ''}
            </form>
          </div>
        </div>
        \${search ? \`
        <div class="card">
          <div class="card-header">\${isRef ? 'Customer Refs' : 'Companies'} matching "\${search}"</div>
          <div style="overflow-x:auto;">
            <table><thead><tr>
              \${isRef
                ? '<th>Customer Ref</th><th>Customer</th><th>Company</th><th>RFQs</th><th>Quotes</th><th>Orders</th><th>Total Quoted</th><th>Last Activity</th>'
                : '<th>Company</th><th>Contacts</th><th>RFQs</th><th>Quotes</th><th>Orders</th><th>Total Quoted</th><th>Last Activity</th>'
              }
            </tr></thead>
            <tbody>\${rows}</tbody></table>
          </div>
        </div>\` : \`
        <div style="text-align:center;padding:60px;color:#7a8a9a;">
          <div style="font-size:2rem;margin-bottom:12px;">≡ƒæó</div>
          <div style="font-size:1rem;">Search by company name or customer reference to view account activity</div>
        </div>\`}
      \`));
    } catch(err) {
      res.send(page('Accounts','accounts',\`<div class="alert alert-error">\${err.message}</div>\`));
    }
  });

  // Account detail by customer ref
  router.get('/accounts/ref/:ref', async (req, res) => {
    if (!requireAuth(req, res)) return;
    const ref = decodeURIComponent(req.params.ref);
    try {
      const pool = await getPool();
      const rfqs = await pool.request().input('ref', sql.NVarChar, ref).query(\`
        SELECT h.id, h.rfq_number, h.status, h.priority, h.submitted_at,
          c.id AS customer_id, c.first_name+' '+c.last_name AS customer_name, c.company,
          COUNT(l.id) AS line_count,
          q.id AS quote_id, q.quote_number, q.total_amount, q.status AS quote_status
        FROM rfq_headers h
        JOIN customers c ON c.id=h.customer_id
        LEFT JOIN rfq_lines l ON l.rfq_id=h.id
        LEFT JOIN quotes q ON q.rfq_id=h.id
        WHERE h.customer_ref=@ref
        GROUP BY h.id,h.rfq_number,h.status,h.priority,h.submitted_at,
          c.id,c.first_name,c.last_name,c.company,q.id,q.quote_number,q.total_amount,q.status
        ORDER BY h.submitted_at DESC
      \`);

      const totalQuoted = rfqs.recordset.reduce((s,r) => s + parseFloat(r.total_amount||0), 0);
      const rfqRows = rfqs.recordset.map(r => \`<tr>
        <td class="mono text-gold"><a href="/admin/rfqs/\${r.id}" style="color:#c8932a;">\${r.rfq_number}</a></td>
        <td><a href="/admin/customers/\${r.customer_id}" style="color:#c8932a;">\${r.customer_name}</a><br><span style="font-size:.75rem;color:#7a8a9a;">\${r.company||''}</span></td>
        <td>\${r.line_count}</td>
        <td>\${statusBadge(r.priority)}</td>
        <td>\${statusBadge(r.status)}</td>
        <td>\${r.quote_number ? \`<a href="/admin/quotes/\${r.quote_id}" style="color:#c8932a;">\${r.quote_number}</a>\` : '—'}</td>
        <td>\${r.total_amount ? '$'+parseFloat(r.total_amount).toLocaleString('en-US',{minimumFractionDigits:2}) : '—'}</td>
        <td>\${r.quote_status ? statusBadge(r.quote_status) : '—'}</td>
        <td style="color:#7a8a9a;font-size:.78rem;">\${new Date(r.submitted_at).toLocaleDateString()}</td>
      </tr>\`).join('') || '<tr><td colspan="9" style="text-align:center;color:#7a8a9a;padding:24px;">No RFQs found</td></tr>';

      res.send(page(\`Ref: \${ref}\`,'accounts',\`
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div class="page-title">Customer Ref: <span style="color:#c8932a;font-family:monospace;">\${ref}</span></div>
          <a href="/admin/accounts?type=ref&q=\${encodeURIComponent(ref)}" class="btn btn-outline btn-sm">← Back</a>
        </div>
        <div class="page-sub">All activity linked to this reference</div>
        <div class="stat-grid" style="margin-bottom:20px;">
          <div class="stat"><div class="stat-num">\${rfqs.recordset.length}</div><div class="stat-label">RFQs</div></div>
          <div class="stat"><div class="stat-num">\${rfqs.recordset.filter(r=>r.quote_id).length}</div><div class="stat-label">Quotes</div></div>
          <div class="stat"><div class="stat-num">$\${totalQuoted.toLocaleString('en-US',{minimumFractionDigits:2})}</div><div class="stat-label">Total Quoted</div></div>
        </div>
        <div class="card">
          <div class="card-header">RFQs & Quotes</div>
          <div style="overflow-x:auto;">
            <table><thead><tr>
              <th>RFQ #</th><th>Customer</th><th>Lines</th><th>Priority</th><th>RFQ Status</th>
              <th>Quote #</th><th>Amount</th><th>Quote Status</th><th>Date</th>
            </tr></thead>
            <tbody>\${rfqRows}</tbody></table>
          </div>
        </div>
      \`));
    } catch(err) {
      res.send(page('Account','accounts',\`<div class="alert alert-error">\${err.message}</div>\`));
    }
  });

  // Account detail by company
  router.get('/accounts/company/:company', async (req, res) => {
    if (!requireAuth(req, res)) return;
    const company = decodeURIComponent(req.params.company);
    try {
      const pool = await getPool();

      // Get all contacts at this company
      const contacts = await pool.request().input('company', sql.NVarChar, company).query(\`
        SELECT id, first_name+' '+last_name AS name, email, phone, status, created_at
        FROM customers WHERE company=@company ORDER BY last_name
      \`);

      // Get all RFQs for this company
      const rfqs = await pool.request().input('company', sql.NVarChar, company).query(\`
        SELECT h.id, h.rfq_number, h.status, h.priority, h.customer_ref, h.submitted_at,
          c.id AS customer_id, c.first_name+' '+c.last_name AS customer_name,
          COUNT(l.id) AS line_count,
          q.id AS quote_id, q.quote_number, q.total_amount, q.status AS quote_status
        FROM rfq_headers h
        JOIN customers c ON c.id=h.customer_id
        LEFT JOIN rfq_lines l ON l.rfq_id=h.id
        LEFT JOIN quotes q ON q.rfq_id=h.id
        WHERE c.company=@company
        GROUP BY h.id,h.rfq_number,h.status,h.priority,h.customer_ref,h.submitted_at,
          c.id,c.first_name,c.last_name,q.id,q.quote_number,q.total_amount,q.status
        ORDER BY h.submitted_at DESC
      \`);

      const totalQuoted = rfqs.recordset.reduce((s,r) => s + parseFloat(r.total_amount||0), 0);

      const contactRows = contacts.recordset.map(c => \`<tr>
        <td><a href="/admin/customers/\${c.id}" style="color:#c8932a;">\${c.name}</a></td>
        <td style="color:#7a8a9a;font-size:.8rem;">\${c.email}</td>
        <td style="color:#7a8a9a;">\${c.phone||'—'}</td>
        <td>\${statusBadge(c.status)}</td>
        <td style="color:#7a8a9a;font-size:.78rem;">\${new Date(c.created_at).toLocaleDateString()}</td>
      </tr>\`).join('');

      const rfqRows = rfqs.recordset.map(r => \`<tr>
        <td class="mono text-gold"><a href="/admin/rfqs/\${r.id}" style="color:#c8932a;">\${r.rfq_number}</a></td>
        <td style="color:#7a8a9a;"><a href="/admin/customers/\${r.customer_id}" style="color:#c8932a;">\${r.customer_name}</a></td>
        <td>\${r.customer_ref ? \`<a href="/admin/accounts/ref/\${encodeURIComponent(r.customer_ref)}" style="color:#c8932a;font-family:monospace;">\${r.customer_ref}</a>\` : '—'}</td>
        <td>\${r.line_count}</td>
        <td>\${statusBadge(r.priority)}</td>
        <td>\${statusBadge(r.status)}</td>
        <td>\${r.quote_number ? \`<a href="/admin/quotes/\${r.quote_id}" style="color:#c8932a;">\${r.quote_number}</a>\` : '—'}</td>
        <td>\${r.total_amount ? '$'+parseFloat(r.total_amount).toLocaleString('en-US',{minimumFractionDigits:2}) : '—'}</td>
        <td style="color:#7a8a9a;font-size:.78rem;">\${new Date(r.submitted_at).toLocaleDateString()}</td>
      </tr>\`).join('') || '<tr><td colspan="9" style="text-align:center;color:#7a8a9a;padding:24px;">No RFQs yet</td></tr>';

      res.send(page(\`Company: \${company}\`,'accounts',\`
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div class="page-title">\${company}</div>
          <a href="/admin/accounts?type=company&q=\${encodeURIComponent(company)}" class="btn btn-outline btn-sm">← Back</a>
        </div>
        <div class="page-sub">Full account activity</div>
        <div class="stat-grid" style="margin-bottom:20px;">
          <div class="stat"><div class="stat-num">\${contacts.recordset.length}</div><div class="stat-label">Contacts</div></div>
          <div class="stat"><div class="stat-num">\${rfqs.recordset.length}</div><div class="stat-label">RFQs</div></div>
          <div class="stat"><div class="stat-num">\${rfqs.recordset.filter(r=>r.quote_id).length}</div><div class="stat-label">Quotes</div></div>
          <div class="stat"><div class="stat-num">$\${totalQuoted.toLocaleString('en-US',{minimumFractionDigits:2})}</div><div class="stat-label">Total Quoted</div></div>
        </div>
        <div class="card" style="margin-bottom:20px;">
          <div class="card-header">Contacts</div>
          <table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Joined</th></tr></thead>
          <tbody>\${contactRows}</tbody></table>
        </div>
        <div class="card">
          <div class="card-header">RFQs & Quotes</div>
          <div style="overflow-x:auto;">
            <table><thead><tr>
              <th>RFQ #</th><th>Contact</th><th>Cust Ref</th><th>Lines</th><th>Priority</th>
              <th>RFQ Status</th><th>Quote #</th><th>Amount</th><th>Date</th>
            </tr></thead>
            <tbody>\${rfqRows}</tbody></table>
          </div>
        </div>
      \`));
    } catch(err) {
      res.send(page('Account','accounts',\`<div class="alert alert-error">\${err.message}</div>\`));
    }
  });

  // Customers List
  router.get('/customers'`;

if (a.includes(insertBefore)) {
  a = a.replace(insertBefore, accountsRoutes);
  console.log('Accounts routes: ADDED');
} else {
  console.log('Accounts routes: insert point NOT FOUND');
}

fs.writeFileSync('admin/index.js', a);
console.log('Done.');
