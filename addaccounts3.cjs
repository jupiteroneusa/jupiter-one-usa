const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');

const insertBefore = "  // Customers List\n  router.get('/customers'";

if (!a.includes(insertBefore)) {
  console.log('NOT FOUND - dumping nearby text');
  const idx = a.indexOf('Customers List');
  console.log(JSON.stringify(a.slice(idx-5, idx+60)));
} else {
  console.log('FOUND - inserting');

  const accountsCode = `  // Accounts
  router.get('/accounts', async (req, res) => {
    if (!requireAuth(req, res)) return;
    const search = (req.query.q || '').trim();
    const type = req.query.type || 'company';
    try {
      const pool = await getPool();
      let rows = '';
      let headers = '';
      if (search) {
        if (type === 'ref') {
          headers = '<th>Customer Ref</th><th>Customer</th><th>Company</th><th>RFQs</th><th>Quotes</th><th>Total Quoted</th><th>Last Activity</th>';
          const result = await pool.request()
            .input('q', sql.NVarChar, '%' + search + '%')
            .query(\`SELECT h.customer_ref, COUNT(DISTINCT h.id) AS rfq_count, COUNT(DISTINCT q.id) AS quote_count,
              SUM(ISNULL(q.total_amount,0)) AS total_quoted, MAX(h.submitted_at) AS last_activity,
              MAX(c.first_name+' '+c.last_name) AS customer_name, MAX(c.company) AS company
              FROM rfq_headers h JOIN customers c ON c.id=h.customer_id LEFT JOIN quotes q ON q.rfq_id=h.id
              WHERE h.customer_ref LIKE @q GROUP BY h.customer_ref ORDER BY last_activity DESC\`);
          rows = result.recordset.map(function(r) {
            return '<tr><td><a href="/admin/accounts/ref/' + encodeURIComponent(r.customer_ref) + '" style="color:#c8932a;font-family:monospace;">' + r.customer_ref + '</a></td>' +
              '<td style="color:#7a8a9a;">' + (r.customer_name||'') + '</td><td style="color:#7a8a9a;">' + (r.company||'--') + '</td>' +
              '<td>' + r.rfq_count + '</td><td>' + r.quote_count + '</td>' +
              '<td style="font-weight:600;">$' + parseFloat(r.total_quoted||0).toLocaleString('en-US',{minimumFractionDigits:2}) + '</td>' +
              '<td style="color:#7a8a9a;font-size:.78rem;">' + new Date(r.last_activity).toLocaleDateString() + '</td></tr>';
          }).join('') || '<tr><td colspan="7" style="text-align:center;color:#7a8a9a;padding:24px;">No results</td></tr>';
        } else {
          headers = '<th>Company</th><th>Contacts</th><th>RFQs</th><th>Quotes</th><th>Total Quoted</th><th>Last Activity</th>';
          const result = await pool.request()
            .input('q', sql.NVarChar, '%' + search + '%')
            .query(\`SELECT c.company, COUNT(DISTINCT c.id) AS contact_count, COUNT(DISTINCT h.id) AS rfq_count,
              COUNT(DISTINCT q.id) AS quote_count, SUM(ISNULL(q.total_amount,0)) AS total_quoted, MAX(h.submitted_at) AS last_activity
              FROM customers c LEFT JOIN rfq_headers h ON h.customer_id=c.id LEFT JOIN quotes q ON q.rfq_id=h.id
              WHERE c.company LIKE @q GROUP BY c.company ORDER BY last_activity DESC\`);
          rows = result.recordset.map(function(r) {
            return '<tr><td><a href="/admin/accounts/company/' + encodeURIComponent(r.company) + '" style="color:#c8932a;">' + (r.company||'') + '</a></td>' +
              '<td>' + r.contact_count + '</td><td>' + r.rfq_count + '</td><td>' + r.quote_count + '</td>' +
              '<td style="font-weight:600;">$' + parseFloat(r.total_quoted||0).toLocaleString('en-US',{minimumFractionDigits:2}) + '</td>' +
              '<td style="color:#7a8a9a;font-size:.78rem;">' + (r.last_activity ? new Date(r.last_activity).toLocaleDateString() : '--') + '</td></tr>';
          }).join('') || '<tr><td colspan="6" style="text-align:center;color:#7a8a9a;padding:24px;">No results</td></tr>';
        }
      }
      const isRef = type === 'ref';
      const tableHtml = search
        ? ('<div class="card"><div class="card-header">Results for "' + search + '"</div><div style="overflow-x:auto;"><table><thead><tr>' + headers + '</tr></thead><tbody>' + rows + '</tbody></table></div></div>')
        : '<div style="text-align:center;padding:60px;color:#7a8a9a;"><div style="font-size:2rem;margin-bottom:12px;">&#128194;</div><div>Search by company or customer reference</div></div>';
      res.send(page('Accounts','accounts', SORT_SCRIPT +
        '<div class="page-title">Accounts</div><div class="page-sub">Search by company or customer reference</div>' +
        '<div class="card" style="margin-bottom:20px;"><div class="card-body">' +
        '<form method="GET" action="/admin/accounts" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">' +
        '<div style="flex:1;min-width:250px;"><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Search</div>' +
        '<input type="text" name="q" value="' + search + '" placeholder="' + (isRef ? 'Customer ref...' : 'Company name...') + '" style="width:100%;" autofocus/></div>' +
        '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Search By</div>' +
        '<select name="type" style="width:150px;"><option value="company"' + (!isRef?' selected':'') + '>Company</option>' +
        '<option value="ref"' + (isRef?' selected':'') + '>Customer Ref</option></select></div>' +
        '<button type="submit" class="btn btn-gold">Search &rarr;</button>' +
        (search ? ' <a href="/admin/accounts" class="btn btn-outline">Clear</a>' : '') +
        '</form></div></div>' + tableHtml));
    } catch(err) {
      res.send(page('Accounts','accounts','<div class="alert alert-error">' + err.message + '</div>'));
    }
  });

  router.get('/accounts/ref/:ref', async (req, res) => {
    if (!requireAuth(req, res)) return;
    const ref = decodeURIComponent(req.params.ref);
    try {
      const pool = await getPool();
      const rfqs = await pool.request().input('ref', sql.NVarChar, ref).query(\`
        SELECT h.id, h.rfq_number, h.status, h.priority, h.submitted_at,
          c.id AS customer_id, c.first_name+' '+c.last_name AS customer_name, c.company,
          COUNT(l.id) AS line_count, q.id AS quote_id, q.quote_number, q.total_amount, q.status AS quote_status
        FROM rfq_headers h JOIN customers c ON c.id=h.customer_id
        LEFT JOIN rfq_lines l ON l.rfq_id=h.id LEFT JOIN quotes q ON q.rfq_id=h.id
        WHERE h.customer_ref=@ref
        GROUP BY h.id,h.rfq_number,h.status,h.priority,h.submitted_at,c.id,c.first_name,c.last_name,c.company,q.id,q.quote_number,q.total_amount,q.status
        ORDER BY h.submitted_at DESC\`);
      const totalQuoted = rfqs.recordset.reduce(function(s,r){ return s+parseFloat(r.total_amount||0); },0);
      const rfqRows = rfqs.recordset.map(function(r) {
        return '<tr><td class="mono text-gold"><a href="/admin/rfqs/'+r.id+'" style="color:#c8932a;">'+r.rfq_number+'</a></td>' +
          '<td><a href="/admin/customers/'+r.customer_id+'" style="color:#c8932a;">'+r.customer_name+'</a><br><span style="font-size:.75rem;color:#7a8a9a;">'+(r.company||'')+'</span></td>' +
          '<td>'+r.line_count+'</td><td>'+statusBadge(r.priority)+'</td><td>'+statusBadge(r.status)+'</td>' +
          '<td>'+(r.quote_number?'<a href="/admin/quotes/'+r.quote_id+'" style="color:#c8932a;">'+r.quote_number+'</a>':'--')+'</td>' +
          '<td>'+(r.total_amount?'$'+parseFloat(r.total_amount).toLocaleString('en-US',{minimumFractionDigits:2}):'--')+'</td>' +
          '<td>'+(r.quote_status?statusBadge(r.quote_status):'--')+'</td>' +
          '<td style="color:#7a8a9a;font-size:.78rem;">'+new Date(r.submitted_at).toLocaleDateString()+'</td></tr>';
      }).join('') || '<tr><td colspan="9" style="text-align:center;color:#7a8a9a;padding:24px;">No RFQs</td></tr>';
      res.send(page('Ref: '+ref,'accounts',
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
        '<div class="page-title">Ref: <span style="color:#c8932a;font-family:monospace;">'+ref+'</span></div>' +
        '<a href="/admin/accounts?type=ref&q='+encodeURIComponent(ref)+'" class="btn btn-outline btn-sm">&larr; Back</a></div>' +
        '<div class="stat-grid" style="margin-bottom:20px;">' +
        '<div class="stat"><div class="stat-num">'+rfqs.recordset.length+'</div><div class="stat-label">RFQs</div></div>' +
        '<div class="stat"><div class="stat-num">'+rfqs.recordset.filter(function(r){return r.quote_id;}).length+'</div><div class="stat-label">Quotes</div></div>' +
        '<div class="stat"><div class="stat-num">$'+totalQuoted.toLocaleString('en-US',{minimumFractionDigits:2})+'</div><div class="stat-label">Total Quoted</div></div></div>' +
        '<div class="card"><div class="card-header">RFQs & Quotes</div><div style="overflow-x:auto;">' +
        '<table><thead><tr><th>RFQ #</th><th>Customer</th><th>Lines</th><th>Priority</th><th>RFQ Status</th><th>Quote #</th><th>Amount</th><th>Quote Status</th><th>Date</th></tr></thead>' +
        '<tbody>'+rfqRows+'</tbody></table></div></div>'));
    } catch(err) {
      res.send(page('Account','accounts','<div class="alert alert-error">'+err.message+'</div>'));
    }
  });

  router.get('/accounts/company/:company', async (req, res) => {
    if (!requireAuth(req, res)) return;
    const company = decodeURIComponent(req.params.company);
    try {
      const pool = await getPool();
      const contacts = await pool.request().input('co', sql.NVarChar, company)
        .query(\`SELECT id, first_name+' '+last_name AS name, email, phone, status, created_at FROM customers WHERE company=@co ORDER BY last_name\`);
      const rfqs = await pool.request().input('co2', sql.NVarChar, company).query(\`
        SELECT h.id, h.rfq_number, h.status, h.priority, h.customer_ref, h.submitted_at,
          c.id AS customer_id, c.first_name+' '+c.last_name AS customer_name, COUNT(l.id) AS line_count,
          q.id AS quote_id, q.quote_number, q.total_amount, q.status AS quote_status
        FROM rfq_headers h JOIN customers c ON c.id=h.customer_id
        LEFT JOIN rfq_lines l ON l.rfq_id=h.id LEFT JOIN quotes q ON q.rfq_id=h.id
        WHERE c.company=@co2
        GROUP BY h.id,h.rfq_number,h.status,h.priority,h.customer_ref,h.submitted_at,c.id,c.first_name,c.last_name,q.id,q.quote_number,q.total_amount,q.status
        ORDER BY h.submitted_at DESC\`);
      const totalQuoted = rfqs.recordset.reduce(function(s,r){return s+parseFloat(r.total_amount||0);},0);
      const contactRows = contacts.recordset.map(function(c) {
        return '<tr><td><a href="/admin/customers/'+c.id+'" style="color:#c8932a;">'+c.name+'</a></td>' +
          '<td style="color:#7a8a9a;font-size:.8rem;">'+c.email+'</td><td style="color:#7a8a9a;">'+(c.phone||'--')+'</td>' +
          '<td>'+statusBadge(c.status)+'</td><td style="color:#7a8a9a;font-size:.78rem;">'+new Date(c.created_at).toLocaleDateString()+'</td></tr>';
      }).join('');
      const rfqRows = rfqs.recordset.map(function(r) {
        return '<tr><td class="mono text-gold"><a href="/admin/rfqs/'+r.id+'" style="color:#c8932a;">'+r.rfq_number+'</a></td>' +
          '<td><a href="/admin/customers/'+r.customer_id+'" style="color:#c8932a;">'+r.customer_name+'</a></td>' +
          '<td>'+(r.customer_ref?'<a href="/admin/accounts/ref/'+encodeURIComponent(r.customer_ref)+'" style="color:#c8932a;font-family:monospace;">'+r.customer_ref+'</a>':'--')+'</td>' +
          '<td>'+r.line_count+'</td><td>'+statusBadge(r.priority)+'</td><td>'+statusBadge(r.status)+'</td>' +
          '<td>'+(r.quote_number?'<a href="/admin/quotes/'+r.quote_id+'" style="color:#c8932a;">'+r.quote_number+'</a>':'--')+'</td>' +
          '<td>'+(r.total_amount?'$'+parseFloat(r.total_amount).toLocaleString('en-US',{minimumFractionDigits:2}):'--')+'</td>' +
          '<td style="color:#7a8a9a;font-size:.78rem;">'+new Date(r.submitted_at).toLocaleDateString()+'</td></tr>';
      }).join('') || '<tr><td colspan="9" style="text-align:center;color:#7a8a9a;padding:24px;">No RFQs yet</td></tr>';
      res.send(page('Company: '+company,'accounts',
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
        '<div class="page-title">'+company+'</div>' +
        '<a href="/admin/accounts?type=company&q='+encodeURIComponent(company)+'" class="btn btn-outline btn-sm">&larr; Back</a></div>' +
        '<div class="stat-grid" style="margin-bottom:20px;">' +
        '<div class="stat"><div class="stat-num">'+contacts.recordset.length+'</div><div class="stat-label">Contacts</div></div>' +
        '<div class="stat"><div class="stat-num">'+rfqs.recordset.length+'</div><div class="stat-label">RFQs</div></div>' +
        '<div class="stat"><div class="stat-num">'+rfqs.recordset.filter(function(r){return r.quote_id;}).length+'</div><div class="stat-label">Quotes</div></div>' +
        '<div class="stat"><div class="stat-num">$'+totalQuoted.toLocaleString('en-US',{minimumFractionDigits:2})+'</div><div class="stat-label">Total Quoted</div></div></div>' +
        '<div class="card" style="margin-bottom:20px;"><div class="card-header">Contacts</div>' +
        '<table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Joined</th></tr></thead><tbody>'+contactRows+'</tbody></table></div>' +
        '<div class="card"><div class="card-header">RFQs & Quotes</div><div style="overflow-x:auto;">' +
        '<table><thead><tr><th>RFQ #</th><th>Contact</th><th>Cust Ref</th><th>Lines</th><th>Priority</th><th>RFQ Status</th><th>Quote #</th><th>Amount</th><th>Date</th></tr></thead>' +
        '<tbody>'+rfqRows+'</tbody></table></div></div>'));
    } catch(err) {
      res.send(page('Account','accounts','<div class="alert alert-error">'+err.message+'</div>'));
    }
  });

  // Customers List
  router.get('/customers'`;

  a = a.replace(insertBefore, accountsCode);
  console.log('Accounts routes: ADDED');
}

fs.writeFileSync('admin/index.js', a);
console.log('Done.');
