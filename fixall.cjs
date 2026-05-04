const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');

// 1. Fix RFQ list - replace old where/count with ref-aware version
const oldWhere = `      let where = '';
      if (status) { r.input('status', sql.NVarChar, status); where = 'WHERE h.status=@status'; }

      // Count query
      const countQ = await pool.request().input('status2', sql.NVarChar, status || null).query(\`
        SELECT COUNT(*) AS total FROM rfq_headers h
        JOIN customers c ON c.id=h.customer_id
        \${status ? 'WHERE h.status=@status2' : ''}
      \`);`;

const newWhere = `      const refFilter = req.query.ref || '';
      let where = '';
      let whereClauses = [];
      if (status) { r.input('status', sql.NVarChar, status); whereClauses.push('h.status=@status'); }
      if (refFilter) { r.input('refFilter', sql.NVarChar, refFilter); whereClauses.push('h.customer_ref=@refFilter'); }
      if (whereClauses.length) where = 'WHERE ' + whereClauses.join(' AND ');

      // Count query
      const countQ = await pool.request()
        .input('status2', sql.NVarChar, status || null)
        .input('refFilter2', sql.NVarChar, refFilter || null)
        .query(\`
        SELECT COUNT(*) AS total FROM rfq_headers h
        JOIN customers c ON c.id=h.customer_id
        WHERE (1=1)
          \${status ? 'AND h.status=@status2' : ''}
          \${refFilter ? 'AND h.customer_ref=@refFilter2' : ''}
      \`);`;

if (a.includes(oldWhere)) { a = a.replace(oldWhere, newWhere); console.log('RFQ where/count: FIXED'); }
else console.log('RFQ where/count: NOT FOUND');

// 2. Fix RFQ list title to show ref filter
const oldTitle = `        <div class="page-title">RFQs</div>
        <div class="page-sub">All customer requests for quotation</div>`;
const newTitle = `        <div class="page-title">RFQs\${refFilter ? ' — Ref: '+refFilter : ''}</div>
        <div class="page-sub">\${refFilter ? '<a href="/admin/rfqs" style="color:#c8932a;">← Clear filter</a> &nbsp;|&nbsp; RFQs for ref: <strong style="color:#c8932a;">'+refFilter+'</strong>' : 'All customer requests for quotation'}</div>`;
if (a.includes(oldTitle)) { a = a.replace(oldTitle, newTitle); console.log('RFQ title: FIXED'); }
else console.log('RFQ title: NOT FOUND');

// 3. Fix baseUrl to include refFilter
const oldBase = `      const baseUrl = (p) => \`/admin/rfqs?status=\${status}&sort=\${sortCol}&dir=\${sortDir}&page=\${p}&pageSize=\${pageSize}\`;`;
const newBase = `      const baseUrl = (p) => \`/admin/rfqs?status=\${status}&sort=\${sortCol}&dir=\${sortDir}&page=\${p}&pageSize=\${pageSize}\${refFilter?'&ref='+encodeURIComponent(refFilter):''}\`;`;
if (a.includes(oldBase)) { a = a.replace(oldBase, newBase); console.log('BaseUrl: FIXED'); }
else console.log('BaseUrl: NOT FOUND');

// 4. Fix quotes amount missing $ sign
const oldAmt = `        <td style="font-weight:600;">\${parseFloat(q.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>`;
const newAmt = `        <td style="font-weight:600;">$\${parseFloat(q.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>`;
if (a.includes(oldAmt)) { a = a.replace(oldAmt, newAmt); console.log('Quote amount $: FIXED'); }
else console.log('Quote amount $: NOT FOUND');

// 5. Add SORT_SCRIPT to quotes page
const oldQuotesRender = `      res.send(page('Quotes','quotes',\`
        <div class="page-title">Quotes</div>`;
const newQuotesRender = `      res.send(page('Quotes','quotes',\`
        \${SORT_SCRIPT}
        <div class="page-title">Quotes</div>`;
if (a.includes(oldQuotesRender)) { a = a.replace(oldQuotesRender, newQuotesRender); console.log('Quotes SORT_SCRIPT: FIXED'); }
else console.log('Quotes SORT_SCRIPT: NOT FOUND');

// 6. Add customer_ref to RFQ list SELECT
const oldSelect = `          c.id AS customer_id, c.first_name+' '+c.last_name AS customer_name, c.company, c.email,`;
const newSelect = `          c.id AS customer_id, c.first_name+' '+c.last_name AS customer_name, c.company, c.email, h.customer_ref,`;
if (a.includes(oldSelect)) { a = a.replace(oldSelect, newSelect); console.log('RFQ SELECT: FIXED'); }
else console.log('RFQ SELECT: already fixed');

// 7. Add customer_ref to RFQ list row
const oldRow = `        <td style="color:#7a8a9a;font-size:.8rem;">\${r.email}</td>\n        <td>\${r.line_count}</td>`;
const newRow = `        <td style="color:#7a8a9a;font-size:.8rem;">\${r.email}</td>
        <td>\${r.customer_ref ? \`<a href="/admin/rfqs?ref=\${encodeURIComponent(r.customer_ref)}" style="color:#c8932a;font-size:.8rem;font-family:monospace;">\${r.customer_ref}</a>\` : '<span style="color:#555;">—</span>'}</td>
        <td>\${r.line_count}</td>`;
if (a.includes(oldRow)) { a = a.replace(oldRow, newRow); console.log('RFQ row: FIXED'); }
else console.log('RFQ row: NOT FOUND');

fs.writeFileSync('admin/index.js', a);
console.log('All done!');
