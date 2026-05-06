// admin/orderRoutes.js
// Order detail routes for admin panel
import { getPool, sql } from '../db/connect.js';
import { generateNumber } from '../db/numbering.js';

function statusBadge(s) {
  const map = { 'Submitted':'blue','Under Review':'blue','Sourcing':'gold','Quoted':'gold','Closed':'green','Cancelled':'red','Active':'green','New':'blue','Sent':'blue','Accepted':'green','Rejected':'red','Expired':'gray','Confirmed':'green','Processing':'blue','Ready to Ship':'gold','Shipped':'gold','Delivered':'green','Paid':'green','Unpaid':'red','Overdue':'red','Draft':'gray','Standard':'gray','Urgent':'gold','AOG':'red' };
  const c = map[s] || 'gray';
  return '<span class="badge badge-'+c+'">'+(s||'—')+'</span>';
}

export function mountOrderRoutes(router, requireAuth, page) {

  // Order Detail
  router.get('/orders/:id', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const or = await pool.request().input('id', sql.BigInt, req.params.id).query(
        'SELECT o.*, c.first_name+\' \'+c.last_name AS customer_name, c.company, c.email, c.id AS customer_id, q.quote_number, h.rfq_number, q.id AS quote_id FROM orders o JOIN customers c ON c.id=o.customer_id LEFT JOIN quotes q ON q.id=o.quote_id LEFT JOIN rfq_headers h ON h.id=o.rfq_id WHERE o.id=@id'
      );
      if (!or.recordset.length) return res.send(page('Order','orders','<div class="alert alert-error">Order not found.</div>'));
      const o = or.recordset[0];
      const oLines = await pool.request().input('id', sql.BigInt, req.params.id).query('SELECT * FROM order_lines WHERE order_id=@id ORDER BY line_number');
      const ships = await pool.request().input('id', sql.BigInt, req.params.id).query('SELECT * FROM shipments WHERE order_id=@id ORDER BY created_at DESC');
      const sLog = await pool.request().input('id', sql.BigInt, req.params.id).query('SELECT * FROM order_status_log WHERE order_id=@id ORDER BY created_at ASC');
      const activeTab = req.query.tab || 'overview';
      const successMsg = req.query.saved ? '<div class="alert alert-success" style="margin-bottom:16px;">&#10004; Saved.</div>' : req.query.error ? '<div class="alert alert-error" style="margin-bottom:16px;">'+decodeURIComponent(req.query.error||'')+'</div>' : '';
      const lineRows = oLines.recordset.map(function(l) {
        return '<tr><td style="color:#7a8a9a;">'+l.line_number+'</td><td class="mono" style="color:#c8932a;">'+(l.nsn||l.part_number||'—')+'</td><td>'+(l.item_name||'—')+'</td><td>'+l.quantity_ordered+'</td><td style="color:#7a8a9a;">'+(l.condition_code||'—')+'</td><td style="font-weight:600;">$'+parseFloat(l.unit_price||0).toFixed(2)+'</td><td style="font-weight:600;">$'+parseFloat(l.line_total||0).toFixed(2)+'</td></tr>';
      }).join('');
      const shipRows = ships.recordset.map(function(s) {
        return '<tr><td class="mono">'+(s.shipment_number||'')+'</td><td>'+(s.carrier||'—')+'</td><td>'+(s.tracking_number ? '<a href="'+(s.tracking_url||'#')+'" target="_blank" style="color:#c8932a;">'+s.tracking_number+'</a>' : '—')+'</td><td>'+statusBadge(s.status||'Pending')+'</td><td style="color:#7a8a9a;font-size:.78rem;">'+(s.ship_date?new Date(s.ship_date).toLocaleDateString():'—')+'</td><td style="color:#7a8a9a;font-size:.78rem;">'+(s.estimated_delivery?new Date(s.estimated_delivery).toLocaleDateString():'—')+'</td></tr>';
      }).join('') || '<tr><td colspan="6" style="text-align:center;color:#7a8a9a;padding:12px;">No shipments yet</td></tr>';
      const logRows = sLog.recordset.map(function(l) {
        return '<tr><td style="color:#7a8a9a;font-size:.78rem;">'+new Date(l.created_at).toLocaleString()+'</td><td>'+statusBadge(l.new_status)+'</td><td style="color:#7a8a9a;">'+(l.note||'—')+'</td></tr>';
      }).join('') || '<tr><td colspan="3" style="text-align:center;color:#7a8a9a;padding:12px;">No history</td></tr>';
      const statuses = ['Confirmed','Processing','Ready to Ship','Shipped','Delivered','Cancelled'];
      const statusOpts = statuses.map(function(st) { return '<option value="'+st+'"'+(o.status===st?' selected':'')+'>'+st+'</option>'; }).join('');
      function tabLink(tab, label) {
        return '<a href="/admin/orders/'+o.id+'?tab='+tab+'" style="display:inline-block;padding:8px 18px;font-size:.82rem;font-weight:600;border-bottom:2px solid '+(activeTab===tab?'#c8932a':'transparent')+';color:'+(activeTab===tab?'#c8932a':'#7a8a9a')+';text-decoration:none;white-space:nowrap;">'+label+'</a>';
      }
      let html = successMsg;
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:8px;">';
      html += '<div><div class="page-title">'+o.order_number+'</div><div class="page-sub" style="margin-bottom:0;">'+o.customer_name+' &middot; '+(o.company||'')+'</div></div>';
      html += '<a href="/admin/orders" class="btn btn-outline btn-sm">&#8592; Back</a></div>';
      html += '<div style="border-bottom:1px solid #1e2d42;margin-bottom:24px;overflow-x:auto;white-space:nowrap;">';
      html += tabLink('overview','&#128203; Overview')+tabLink('lines','&#128230; Lines')+tabLink('shipping','&#128666; Shipping')+tabLink('payment','&#128179; Payment');
      html += '</div><div class="card"><div class="card-body">';
      if (activeTab === 'overview') {
        html += '<div class="detail-grid" style="margin-bottom:20px;">';
        html += '<div class="detail-item"><div class="detail-label">Order #</div><div class="detail-value" style="font-family:monospace;color:#c8932a;">'+o.order_number+'</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Customer</div><div class="detail-value"><a href="/admin/customers/'+o.customer_id+'" style="color:#c8932a;">'+o.customer_name+'</a></div></div>';
        html += '<div class="detail-item"><div class="detail-label">Company</div><div class="detail-value">'+(o.company||'—')+'</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Email</div><div class="detail-value"><a href="mailto:'+o.email+'" style="color:#c8932a;">'+o.email+'</a></div></div>';
        html += '<div class="detail-item"><div class="detail-label">Quote</div><div class="detail-value">'+(o.quote_number ? '<a href="/admin/quotes/'+o.quote_id+'" style="color:#c8932a;">'+o.quote_number+'</a>' : '—')+'</div></div>';
        html += '<div class="detail-item"><div class="detail-label">RFQ</div><div class="detail-value">'+(o.rfq_number ? '<a href="/admin/rfqs/'+o.rfq_id+'" style="color:#c8932a;">'+o.rfq_number+'</a>' : '—')+'</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Subtotal</div><div class="detail-value">$'+parseFloat(o.subtotal||0).toLocaleString('en-US',{minimumFractionDigits:2})+'</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Shipping</div><div class="detail-value">'+(o.shipping_cost ? '$'+parseFloat(o.shipping_cost).toFixed(2) : '<span style="color:#e05050;">Not set</span>')+'</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Total</div><div class="detail-value" style="font-weight:700;color:#c8932a;font-size:1.1rem;">$'+parseFloat(o.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2})+'</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">'+statusBadge(o.status)+'</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Created</div><div class="detail-value">'+(o.confirmed_at ? new Date(o.confirmed_at).toLocaleString() : '—')+'</div></div>';
        html += '</div>';
        html += '<div class="card" style="margin-bottom:16px;"><div class="card-header">Update Status</div><div class="card-body">';
        html += '<form method="POST" action="/admin/orders/'+o.id+'/status" style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">New Status</div><select name="status">'+statusOpts+'</select></div>';
        html += '<div style="flex:1;min-width:200px;"><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Note</div><input type="text" name="note" placeholder="Add a note..." style="width:100%;"/></div>';
        html += '<button type="submit" class="btn btn-gold">Update</button></form></div></div>';
        html += '<div class="card"><div class="card-header">Status History</div>';
        html += '<table><thead><tr><th>Date</th><th>Status</th><th>Note</th></tr></thead><tbody>'+logRows+'</tbody></table></div>';
      } else if (activeTab === 'lines') {
        html += '<table><thead><tr><th>#</th><th>NSN/Part</th><th>Description</th><th>Qty</th><th>Condition</th><th>Unit Price</th><th>Line Total</th></tr></thead>';
        html += '<tbody>'+(lineRows || '<tr><td colspan="7" style="text-align:center;color:#7a8a9a;padding:16px;">No lines</td></tr>')+'</tbody></table>';
        html += '<div style="padding:16px;text-align:right;border-top:1px solid #1e2d42;">';
        html += '<span style="color:#7a8a9a;margin-right:16px;">Subtotal: <strong>$'+parseFloat(o.subtotal||0).toLocaleString('en-US',{minimumFractionDigits:2})+'</strong></span>';
        if (o.shipping_cost) html += '<span style="color:#7a8a9a;margin-right:16px;">Shipping: <strong>$'+parseFloat(o.shipping_cost).toFixed(2)+'</strong></span>';
        html += '<span style="font-size:1.1rem;font-weight:700;">Total: <strong style="color:#c8932a;">$'+parseFloat(o.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2})+'</strong></span></div>';
      } else if (activeTab === 'shipping') {
        html += '<div class="card" style="margin-bottom:20px;"><div class="card-header">Shipping Info</div><div class="card-body">';
        html += '<form method="POST" action="/admin/orders/'+o.id+'/shipping" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Shipping Cost ($)</div><input type="number" step="0.01" min="0" name="shipping_cost" value="'+(o.shipping_cost||'')+'" style="width:100%;"/></div>';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Address</div><input type="text" name="ship_to_address1" value="'+(o.ship_to_address1||'')+'" style="width:100%;"/></div>';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">City</div><input type="text" name="ship_to_city" value="'+(o.ship_to_city||'')+'" style="width:100%;"/></div>';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">State</div><input type="text" name="ship_to_state" value="'+(o.ship_to_state||'')+'" style="width:100%;"/></div>';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">ZIP</div><input type="text" name="ship_to_zip" value="'+(o.ship_to_zip||'')+'" style="width:100%;"/></div>';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Country</div><input type="text" name="ship_to_country" value="'+(o.ship_to_country||'USA')+'" style="width:100%;"/></div>';
        html += '<div style="grid-column:1/-1;"><button type="submit" class="btn btn-gold">Save Shipping</button></div></form></div></div>';
        html += '<div class="card" style="margin-bottom:20px;"><div class="card-header">Add Tracking</div><div class="card-body">';
        html += '<form method="POST" action="/admin/orders/'+o.id+'/tracking" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Carrier</div><input type="text" name="carrier" placeholder="FedEx, UPS, DHL..." style="width:100%;"/></div>';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Tracking #</div><input type="text" name="tracking_number" style="width:100%;"/></div>';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Tracking URL</div><input type="text" name="tracking_url" placeholder="https://..." style="width:100%;"/></div>';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Ship Date</div><input type="date" name="ship_date" style="width:100%;"/></div>';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Est. Delivery</div><input type="date" name="estimated_delivery" style="width:100%;"/></div>';
        html += '<div style="grid-column:1/-1;"><button type="submit" class="btn btn-gold">Add Shipment</button></div></form></div></div>';
        html += '<div class="card"><div class="card-header">Shipments</div>';
        html += '<table><thead><tr><th>Shipment #</th><th>Carrier</th><th>Tracking</th><th>Status</th><th>Ship Date</th><th>Est. Delivery</th></tr></thead>';
        html += '<tbody>'+shipRows+'</tbody></table></div>';
      } else if (activeTab === 'payment') {
        html += '<div class="card"><div class="card-header">Mark as Paid</div><div class="card-body">';
        html += '<div style="margin-bottom:16px;font-size:.88rem;color:#7a8a9a;">Subtotal: <strong style="color:#eef1f5;">$'+parseFloat(o.subtotal||0).toLocaleString('en-US',{minimumFractionDigits:2})+'</strong>';
        html += o.shipping_cost ? ' + Shipping: <strong style="color:#eef1f5;">$'+parseFloat(o.shipping_cost).toFixed(2)+'</strong>' : ' <span style="color:#e05050;">(shipping not added)</span>';
        html += ' &nbsp; Total: <strong style="color:#c8932a;">$'+parseFloat(o.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2})+'</strong></div>';
        if (o.status === 'Paid') html += '<div class="alert alert-success">&#10004; Order is marked Paid.</div>';
        // Invoice section
        const invResult = await pool.request().input('oid', sql.BigInt, req.params.id).query('SELECT id, invoice_number, status, total_amount, due_date FROM invoices WHERE order_id=@oid ORDER BY created_at DESC');
        if (invResult.recordset.length) {
          html += '<div class="card" style="margin-bottom:16px;"><div class="card-header">Invoices</div>';
          html += '<table><thead><tr><th>Invoice #</th><th>Status</th><th>Total</th><th>Due Date</th></tr></thead><tbody>';
          invResult.recordset.forEach(function(inv) {
            html += '<tr><td class="mono" style="color:#c8932a;">'+inv.invoice_number+'</td><td>'+statusBadge(inv.status)+'</td><td style="font-weight:600;">
        html += '<form method="POST" action="/admin/orders/'+o.id+'/mark-paid" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;" onsubmit="return confirm(\'Mark as Paid?\')">';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Payment Method</div><select name="payment_method"><option>Wire Transfer</option><option>Credit Card</option><option>Check</option><option>Other</option></select></div>';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Date</div><input type="date" name="payment_date" value="'+new Date().toISOString().split('T')[0]+'" style="width:160px;"/></div>';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Ref / Notes</div><input type="text" name="payment_notes" placeholder="Wire ref, check #..." style="width:220px;"/></div>';
        html += '<button type="submit" class="btn btn-gold">&#10004; Mark as Paid</button></form></div></div>';
      }
      html += '</div></div>';
      res.send(page('Order '+o.order_number, 'orders', html));
    } catch(err) {
      res.send(page('Order','orders','<div class="alert alert-error">'+err.message+'</div>'));
    }
  });

  // Order status update
  router.post('/orders/:id/status', async (req, res) => {
    if (!requireAuth(req, res)) return;
    const { status, note } = req.body;
    try {
      const pool = await getPool();
      await pool.request().input('id', sql.BigInt, req.params.id).input('status', sql.NVarChar, status).query('UPDATE orders SET status=@status, updated_at=GETDATE() WHERE id=@id');
      await pool.request().input('id', sql.BigInt, req.params.id).input('status', sql.NVarChar, status).input('note', sql.NVarChar(500), note||null).query('INSERT INTO order_status_log (order_id, new_status, note) VALUES (@id, @status, @note)');
      res.redirect('/admin/orders/'+req.params.id+'?tab=overview&saved=1');
    } catch(err) { res.redirect('/admin/orders/'+req.params.id+'?error='+encodeURIComponent(err.message)); }
  });

  // Order shipping update
  router.post('/orders/:id/shipping', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const b = req.body;
      const shippingCost = parseFloat(b.shipping_cost)||0;
      const or2 = await pool.request().input('id', sql.BigInt, req.params.id).query('SELECT subtotal FROM orders WHERE id=@id');
      const subtotal = parseFloat(or2.recordset[0] && or2.recordset[0].subtotal || 0);
      await pool.request()
        .input('id', sql.BigInt, req.params.id)
        .input('shipping', sql.Decimal(12,2), shippingCost)
        .input('total', sql.Decimal(12,2), subtotal + shippingCost)
        .input('addr1', sql.NVarChar(150), b.ship_to_address1||null)
        .input('city', sql.NVarChar(100), b.ship_to_city||null)
        .input('state', sql.NVarChar(50), b.ship_to_state||null)
        .input('zip', sql.NVarChar(20), b.ship_to_zip||null)
        .input('country', sql.NVarChar(50), b.ship_to_country||null)
        .query('UPDATE orders SET shipping_cost=@shipping,total_amount=@total,ship_to_address1=@addr1,ship_to_city=@city,ship_to_state=@state,ship_to_zip=@zip,ship_to_country=@country,updated_at=GETDATE() WHERE id=@id');
      res.redirect('/admin/orders/'+req.params.id+'?tab=shipping&saved=1');
    } catch(err) { res.redirect('/admin/orders/'+req.params.id+'?error='+encodeURIComponent(err.message)); }
  });

  // Add shipment tracking
  router.post('/orders/:id/tracking', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const b = req.body;
      const shipNum = await generateNumber('SHP');
      await pool.request()
        .input('orderId', sql.BigInt, req.params.id)
        .input('shipNum', sql.NVarChar(20), shipNum)
        .input('carrier', sql.NVarChar(100), b.carrier||null)
        .input('tracking', sql.NVarChar(100), b.tracking_number||null)
        .input('trackingUrl', sql.NVarChar(500), b.tracking_url||null)
        .input('shipDate', sql.Date, b.ship_date||null)
        .input('estDelivery', sql.Date, b.estimated_delivery||null)
        .query("INSERT INTO shipments (order_id,shipment_number,carrier,tracking_number,tracking_url,ship_date,estimated_delivery,status) VALUES (@orderId,@shipNum,@carrier,@tracking,@trackingUrl,@shipDate,@estDelivery,'Shipped')");
      await pool.request().input('id', sql.BigInt, req.params.id).query("UPDATE orders SET status='Shipped',updated_at=GETDATE() WHERE id=@id");
      await pool.request().input('id', sql.BigInt, req.params.id).query("INSERT INTO order_status_log (order_id,new_status,note) VALUES (@id,'Shipped','Shipment added')");
      res.redirect('/admin/orders/'+req.params.id+'?tab=shipping&saved=1');
    } catch(err) { res.redirect('/admin/orders/'+req.params.id+'?error='+encodeURIComponent(err.message)); }
  });

  // Mark order paid
  router.post('/orders/:id/mark-paid', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const b = req.body;
      const note = 'Paid via '+(b.payment_method||'')+(b.payment_notes ? ' — '+b.payment_notes : '');
      await pool.request().input('id', sql.BigInt, req.params.id).query("UPDATE orders SET status='Paid',updated_at=GETDATE() WHERE id=@id");
      await pool.request().input('id', sql.BigInt, req.params.id).input('note', sql.NVarChar(500), note).query("INSERT INTO order_status_log (order_id,new_status,note) VALUES (@id,'Paid',@note)");
      res.redirect('/admin/orders/'+req.params.id+'?tab=payment&saved=1');
    } catch(err) { res.redirect('/admin/orders/'+req.params.id+'?error='+encodeURIComponent(err.message)); }
  });
}
+parseFloat(inv.total_amount||0).toFixed(2)+'</td><td style="color:#7a8a9a;font-size:.78rem;">'+(inv.due_date?new Date(inv.due_date).toLocaleDateString():'—')+'</td></tr>';
          });
          html += '</tbody></table></div>';
        } else {
          html += '<div class="card" style="margin-bottom:16px;"><div class="card-header">Generate Invoice</div><div class="card-body">';
          html += '<p style="font-size:.85rem;color:#7a8a9a;margin-bottom:16px;">Generate and email a final invoice to the customer including all line items and shipping.</p>';
          html += '<form method="POST" action="/admin/orders/'+o.id+'/generate-invoice" onsubmit="return confirm(\'Generate and send invoice to '+o.email+'?\')">';
          html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">';
          html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Payment Due</div><select name="due_days"><option value="0">Due on Receipt</option><option value="15">Net 15</option><option value="30">Net 30</option></select></div>';
          html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Notes (optional)</div><input type="text" name="notes" placeholder="Additional invoice notes..." style="width:100%;"/></div>';
          html += '</div><button type="submit" class="btn btn-gold">&#128228; Generate &amp; Send Invoice</button></form>';
          html += '</div></div>';
        }
        html += '<form method="POST" action="/admin/orders/'+o.id+'/mark-paid" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;" onsubmit="return confirm(\'Mark as Paid?\')">';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Payment Method</div><select name="payment_method"><option>Wire Transfer</option><option>Credit Card</option><option>Check</option><option>Other</option></select></div>';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Date</div><input type="date" name="payment_date" value="'+new Date().toISOString().split('T')[0]+'" style="width:160px;"/></div>';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Ref / Notes</div><input type="text" name="payment_notes" placeholder="Wire ref, check #..." style="width:220px;"/></div>';
        html += '<button type="submit" class="btn btn-gold">&#10004; Mark as Paid</button></form></div></div>';
      }
      html += '</div></div>';
      res.send(page('Order '+o.order_number, 'orders', html));
    } catch(err) {
      res.send(page('Order','orders','<div class="alert alert-error">'+err.message+'</div>'));
    }
  });

  // Order status update
  router.post('/orders/:id/status', async (req, res) => {
    if (!requireAuth(req, res)) return;
    const { status, note } = req.body;
    try {
      const pool = await getPool();
      await pool.request().input('id', sql.BigInt, req.params.id).input('status', sql.NVarChar, status).query('UPDATE orders SET status=@status, updated_at=GETDATE() WHERE id=@id');
      await pool.request().input('id', sql.BigInt, req.params.id).input('status', sql.NVarChar, status).input('note', sql.NVarChar(500), note||null).query('INSERT INTO order_status_log (order_id, new_status, note) VALUES (@id, @status, @note)');
      res.redirect('/admin/orders/'+req.params.id+'?tab=overview&saved=1');
    } catch(err) { res.redirect('/admin/orders/'+req.params.id+'?error='+encodeURIComponent(err.message)); }
  });

  // Order shipping update
  router.post('/orders/:id/shipping', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const b = req.body;
      const shippingCost = parseFloat(b.shipping_cost)||0;
      const or2 = await pool.request().input('id', sql.BigInt, req.params.id).query('SELECT subtotal FROM orders WHERE id=@id');
      const subtotal = parseFloat(or2.recordset[0] && or2.recordset[0].subtotal || 0);
      await pool.request()
        .input('id', sql.BigInt, req.params.id)
        .input('shipping', sql.Decimal(12,2), shippingCost)
        .input('total', sql.Decimal(12,2), subtotal + shippingCost)
        .input('addr1', sql.NVarChar(150), b.ship_to_address1||null)
        .input('city', sql.NVarChar(100), b.ship_to_city||null)
        .input('state', sql.NVarChar(50), b.ship_to_state||null)
        .input('zip', sql.NVarChar(20), b.ship_to_zip||null)
        .input('country', sql.NVarChar(50), b.ship_to_country||null)
        .query('UPDATE orders SET shipping_cost=@shipping,total_amount=@total,ship_to_address1=@addr1,ship_to_city=@city,ship_to_state=@state,ship_to_zip=@zip,ship_to_country=@country,updated_at=GETDATE() WHERE id=@id');
      res.redirect('/admin/orders/'+req.params.id+'?tab=shipping&saved=1');
    } catch(err) { res.redirect('/admin/orders/'+req.params.id+'?error='+encodeURIComponent(err.message)); }
  });

  // Add shipment tracking
  router.post('/orders/:id/tracking', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const b = req.body;
      const shipNum = await generateNumber('SHP');
      await pool.request()
        .input('orderId', sql.BigInt, req.params.id)
        .input('shipNum', sql.NVarChar(20), shipNum)
        .input('carrier', sql.NVarChar(100), b.carrier||null)
        .input('tracking', sql.NVarChar(100), b.tracking_number||null)
        .input('trackingUrl', sql.NVarChar(500), b.tracking_url||null)
        .input('shipDate', sql.Date, b.ship_date||null)
        .input('estDelivery', sql.Date, b.estimated_delivery||null)
        .query("INSERT INTO shipments (order_id,shipment_number,carrier,tracking_number,tracking_url,ship_date,estimated_delivery,status) VALUES (@orderId,@shipNum,@carrier,@tracking,@trackingUrl,@shipDate,@estDelivery,'Shipped')");
      await pool.request().input('id', sql.BigInt, req.params.id).query("UPDATE orders SET status='Shipped',updated_at=GETDATE() WHERE id=@id");
      await pool.request().input('id', sql.BigInt, req.params.id).query("INSERT INTO order_status_log (order_id,new_status,note) VALUES (@id,'Shipped','Shipment added')");
      res.redirect('/admin/orders/'+req.params.id+'?tab=shipping&saved=1');
    } catch(err) { res.redirect('/admin/orders/'+req.params.id+'?error='+encodeURIComponent(err.message)); }
  });

  // Mark order paid
  router.post('/orders/:id/mark-paid', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const b = req.body;
      const note = 'Paid via '+(b.payment_method||'')+(b.payment_notes ? ' — '+b.payment_notes : '');
      await pool.request().input('id', sql.BigInt, req.params.id).query("UPDATE orders SET status='Paid',updated_at=GETDATE() WHERE id=@id");
      await pool.request().input('id', sql.BigInt, req.params.id).input('note', sql.NVarChar(500), note).query("INSERT INTO order_status_log (order_id,new_status,note) VALUES (@id,'Paid',@note)");
      res.redirect('/admin/orders/'+req.params.id+'?tab=payment&saved=1');
    } catch(err) { res.redirect('/admin/orders/'+req.params.id+'?error='+encodeURIComponent(err.message)); }
  });
}
