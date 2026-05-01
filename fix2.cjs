const fs = require('fs');
let c = fs.readFileSync('admin/index.js', 'utf8');

c = c.replace(
  "        <td>${c.name}</td>",
  "        <td><a href=\"/admin/customers/${c.id}\" style=\"color:#c8932a;\">${c.name}</a></td>"
);

c = c.replace(
  "  // ── Suppliers",
  `  // ── Customer Detail
  router.get('/customers/:id', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const cr = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT * FROM customers WHERE id=@id');
      if (!cr.recordset.length) return res.send(page('Customer','customers','<div class="alert alert-error">Not found.</div>'));
      const cust = cr.recordset[0];
      const rfqs = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT h.id, h.rfq_number, h.status, h.priority, h.submitted_at, COUNT(l.id) AS line_count FROM rfq_headers h LEFT JOIN rfq_lines l ON l.rfq_id=h.id WHERE h.customer_id=@id GROUP BY h.id,h.rfq_number,h.status,h.priority,h.submitted_at ORDER BY h.submitted_at DESC');
      const rfqRows = rfqs.recordset.map(r => '<tr><td class="mono text-gold"><a href="/admin/rfqs/'+r.id+'" style="color:#c8932a;">'+r.rfq_number+'</a></td><td>'+r.line_count+'</td><td>'+statusBadge(r.priority)+'</td><td>'+statusBadge(r.status)+'</td><td style="color:#7a8a9a;font-size:.78rem;">'+new Date(r.submitted_at).toLocaleDateString()+'</td><td><a href="/admin/rfqs/'+r.id+'" class="btn btn-outline btn-sm">View</a></td></tr>').join('') || '<tr><td colspan="6" style="text-align:center;color:#7a8a9a;padding:16px;">No RFQs yet</td></tr>';
      res.send(page('Customer: '+cust.first_name+' '+cust.last_name,'customers',
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><div class="page-title">'+cust.first_name+' '+cust.last_name+'</div><a href="/admin/customers" class="btn btn-outline btn-sm">← Back</a></div>'+
        '<div class="page-sub">'+(cust.company||'')+'</div>'+
        '<div class="detail-grid">'+
          '<div class="detail-item"><div class="detail-label">Email</div><div class="detail-value">'+cust.email+'</div></div>'+
          '<div class="detail-item"><div class="detail-label">Phone</div><div class="detail-value">'+(cust.phone||'—')+'</div></div>'+
          '<div class="detail-item"><div class="detail-label">Company</div><div class="detail-value">'+(cust.company||'—')+'</div></div>'+
          '<div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">'+statusBadge(cust.status)+'</div></div>'+
          '<div class="detail-item"><div class="detail-label">Member Since</div><div class="detail-value">'+new Date(cust.created_at).toLocaleDateString()+'</div></div>'+
        '</div>'+
        '<div class="card"><div class="card-header">RFQ History</div>'+
        '<table><thead><tr><th>RFQ #</th><th>Lines</th><th>Priority</th><th>Status</th><th>Date</th><th></th></tr></thead>'+
        '<tbody>'+rfqRows+'</tbody></table></div>'
      ));
    } catch(err) {
      res.send(page('Customer','customers','<div class="alert alert-error">'+err.message+'</div>'));
    }
  });

  // ── Suppliers`
);

fs.writeFileSync('admin/index.js', c);
console.log('done');