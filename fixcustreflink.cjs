const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');

// 1. Make customer_ref a clickable link on RFQ detail
const oldRef = `          \${rfq.customer_ref ? \`<div class="detail-item"><div class="detail-label">Customer Ref</div><div class="detail-value" style="color:#c8932a;font-family:monospace;">\${rfq.customer_ref}</div></div>\` : ''}`;
const newRef = `          \${rfq.customer_ref ? \`<div class="detail-item"><div class="detail-label">Customer Ref</div><div class="detail-value"><a href="/admin/rfqs?ref=\${encodeURIComponent(rfq.customer_ref)}" style="color:#c8932a;font-family:monospace;">\${rfq.customer_ref}</a></div></div>\` : ''}`;
if (a.includes(oldRef)) { a = a.replace(oldRef, newRef); console.log('Ref link: FIXED'); }
else console.log('Ref link: NOT FOUND');

// 2. Add ref filter to RFQ list - extract ref from query
const oldExtract = `    const status = req.query.status || '';`;
const newExtract = `    const status = req.query.status || '';
    const refFilter = req.query.ref || '';`;
if (a.includes(oldExtract)) { a = a.replace(oldExtract, newExtract); console.log('Ref extract: FIXED'); }
else console.log('Ref extract: NOT FOUND');

// 3. Add ref to where clause
const oldWhere = `      let where = '';
      if (status) { r.input('status', sql.NVarChar, status); where = 'WHERE h.status=@status'; }`;
const newWhere = `      let where = '';
      let whereClauses = [];
      if (status) { r.input('status', sql.NVarChar, status); whereClauses.push('h.status=@status'); }
      if (refFilter) { r.input('refFilter', sql.NVarChar, refFilter); whereClauses.push('h.customer_ref=@refFilter'); }
      if (whereClauses.length) where = 'WHERE ' + whereClauses.join(' AND ');`;
if (a.includes(oldWhere)) { a = a.replace(oldWhere, newWhere); console.log('Where clause: FIXED'); }
else console.log('Where clause: NOT FOUND');

// 4. Fix count query to support ref filter
const oldCount = `      const countQ = await pool.request().input('status2', sql.NVarChar, status || null).query(\`
        SELECT COUNT(*) AS total FROM rfq_headers h
        JOIN customers c ON c.id=h.customer_id
        \${status ? 'WHERE h.status=@status2' : ''}
      \`);`;
const newCount = `      const countQ = await pool.request()
        .input('status2', sql.NVarChar, status || null)
        .input('refFilter2', sql.NVarChar, refFilter || null)
        .query(\`
        SELECT COUNT(*) AS total FROM rfq_headers h
        JOIN customers c ON c.id=h.customer_id
        WHERE (1=1)
          \${status ? 'AND h.status=@status2' : ''}
          \${refFilter ? 'AND h.customer_ref=@refFilter2' : ''}
      \`);`;
if (a.includes(oldCount)) { a = a.replace(oldCount, newCount); console.log('Count query: FIXED'); }
else console.log('Count query: NOT FOUND');

// 5. Add ref filter to page title when filtering by ref
const oldTitle = `        <div class="page-title">RFQs</div>
        <div class="page-sub">All customer requests for quotation</div>`;
const newTitle = `        <div class="page-title">RFQs\${refFilter ? ' — Ref: '+refFilter : ''}</div>
        <div class="page-sub">\${refFilter ? '<a href="/admin/rfqs" style="color:#c8932a;">← Clear filter</a> &nbsp;|&nbsp; Showing RFQs for customer ref <strong style="color:#c8932a;">'+refFilter+'</strong>' : 'All customer requests for quotation'}</div>`;
if (a.includes(oldTitle)) { a = a.replace(oldTitle, newTitle); console.log('Title: FIXED'); }
else console.log('Title: NOT FOUND');

// 6. Pass refFilter through pagination links - find baseUrl function
const oldBase = `      const baseUrl = (p) => \`/admin/rfqs?status=\${status}&sort=\${sortCol}&dir=\${sortDir}&page=\${p}&pageSize=\${pageSize}\`;`;
const newBase = `      const baseUrl = (p) => \`/admin/rfqs?status=\${status}&sort=\${sortCol}&dir=\${sortDir}&page=\${p}&pageSize=\${pageSize}\${refFilter?'&ref='+encodeURIComponent(refFilter):''}\`;`;
if (a.includes(oldBase)) { a = a.replace(oldBase, newBase); console.log('BaseUrl: FIXED'); }
else console.log('BaseUrl: NOT FOUND');

// 7. Show customer_ref in RFQ list rows
const oldRow = `        <td class="mono text-gold"><a href="/admin/rfqs/\${r.id}" style="color:#c8932a;">\${r.rfq_number}</a></td>
        <td><a href="/admin/customers/\${r.customer_id}" style="color:#c8932a;">\${r.customer_name}</a><br><span style="font-size:.75rem;color:#7a8a9a;">\${r.company||''}</span></td>
        <td style="color:#7a8a9a;font-size:.8rem;">\${r.email}</td>
        <td>\${r.line_count}</td>
        <td>\${statusBadge(r.priority)}</td>
        <td>\${statusBadge(r.status)}</td>
        <td>\${new Date(r.submitted_at).toLocaleDateString()}</td>
        <td><a href="/admin/rfqs/\${r.id}" class="btn btn-outline btn-sm">View</a></td>`;
const newRow = `        <td class="mono text-gold"><a href="/admin/rfqs/\${r.id}" style="color:#c8932a;">\${r.rfq_number}</a></td>
        <td><a href="/admin/customers/\${r.customer_id}" style="color:#c8932a;">\${r.customer_name}</a><br><span style="font-size:.75rem;color:#7a8a9a;">\${r.company||''}</span></td>
        <td style="color:#7a8a9a;font-size:.8rem;">\${r.email}</td>
        <td>\${r.customer_ref ? \`<a href="/admin/rfqs?ref=\${encodeURIComponent(r.customer_ref)}" style="color:#c8932a;font-size:.8rem;font-family:monospace;">\${r.customer_ref}</a>\` : '<span style="color:#555;">—</span>'}</td>
        <td>\${r.line_count}</td>
        <td>\${statusBadge(r.priority)}</td>
        <td>\${statusBadge(r.status)}</td>
        <td>\${new Date(r.submitted_at).toLocaleDateString()}</td>
        <td><a href="/admin/rfqs/\${r.id}" class="btn btn-outline btn-sm">View</a></td>`;
if (a.includes(oldRow)) { a = a.replace(oldRow, newRow); console.log('Row: FIXED'); }
else console.log('Row: NOT FOUND');

// 8. Add Cust Ref column header to RFQ list table
const oldHeader = `            ${sortLink('customer','Customer')}
            <th>Email</th>
            ${sortLink('lines','Lines')}`;
const newHeader = `            \${sortLink('customer','Customer')}
            <th>Email</th>
            <th>Cust Ref</th>
            \${sortLink('lines','Lines')}`;
if (a.includes(oldHeader)) { a = a.replace(oldHeader, newHeader); console.log('Header: FIXED'); }
else console.log('Header: NOT FOUND');

// 9. Add customer_ref to the SELECT in RFQ list query
const oldSelect = `          c.id AS customer_id, c.first_name+' '+c.last_name AS customer_name, c.company, c.email,`;
const newSelect = `          c.id AS customer_id, c.first_name+' '+c.last_name AS customer_name, c.company, c.email, h.customer_ref,`;
if (a.includes(oldSelect)) { a = a.replace(oldSelect, newSelect); console.log('SELECT: FIXED'); }
else console.log('SELECT: NOT FOUND');

fs.writeFileSync('admin/index.js', a);
console.log('All done!');
