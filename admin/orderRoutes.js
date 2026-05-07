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
      const invoices = await pool.request().input('id', sql.BigInt, req.params.id).query('SELECT id, invoice_number, status, total_amount, due_date FROM invoices WHERE order_id=@id ORDER BY created_at DESC');
      const activeTab = req.query.tab || 'overview';
      const successMsg = req.query.saved ? '<div class="alert alert-success" style="margin-bottom:16px;">&#10004; Saved.</div>' : req.query.error ? '<div class="alert alert-error" style="margin-bottom:16px;">'+decodeURIComponent(req.query.error||'')+'</div>' : '';
      const lineRows = oLines.recordset.map(function(l) {
        return '<tr><td style="color:#7a8a9a;">'+l.line_number+'</td><td class="mono" style="color:#c8932a;">'+(l.nsn||l.part_number||'&mdash;')+'</td><td>'+(l.item_name||'&mdash;')+'</td><td>'+l.quantity_ordered+'</td><td style="color:#7a8a9a;">'+(l.condition_code||'&mdash;')+'</td><td style="font-weight:600;">$'+parseFloat(l.unit_price||0).toFixed(2)+'</td><td style="font-weight:600;">$'+parseFloat(l.line_total||0).toFixed(2)+'</td></tr>';
      }).join('');
      const shipRows = ships.recordset.map(function(s) {
        return '<tr><td class="mono">'+(s.shipment_number||'')+'</td><td>'+(s.carrier||'&mdash;')+'</td><td>'+(s.tracking_number ? '<a href="'+(s.tracking_url||'#')+'" target="_blank" style="color:#c8932a;">'+s.tracking_number+'</a>' : '&mdash;')+'</td><td>'+statusBadge(s.status||'Pending')+'</td><td style="color:#7a8a9a;font-size:.78rem;">'+(s.ship_date?new Date(s.ship_date).toLocaleDateString():'&mdash;')+'</td><td style="color:#7a8a9a;font-size:.78rem;">'+(s.estimated_delivery?new Date(s.estimated_delivery).toLocaleDateString():'&mdash;')+'</td></tr>';
      }).join('') || '<tr><td colspan="6" style="text-align:center;color:#7a8a9a;padding:12px;">No shipments yet</td></tr>';
      const logRows = sLog.recordset.map(function(l) {
        return '<tr><td style="color:#7a8a9a;font-size:.78rem;">'+new Date(l.created_at).toLocaleString()+'</td><td>'+statusBadge(l.new_status)+'</td><td style="color:#7a8a9a;">'+(l.note||'&mdash;')+'</td></tr>';
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
        html += '<div class="detail-item"><div class="detail-label">Company</div><div class="detail-value">'+(o.company||'&mdash;')+'</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Email</div><div class="detail-value"><a href="mailto:'+o.email+'" style="color:#c8932a;">'+o.email+'</a></div></div>';
        html += '<div class="detail-item"><div class="detail-label">Quote</div><div class="detail-value">'+(o.quote_number ? '<a href="/admin/quotes/'+o.quote_id+'" style="color:#c8932a;">'+o.quote_number+'</a>' : '&mdash;')+'</div></div>';
        html += '<div class="detail-item"><div class="detail-label">RFQ</div><div class="detail-value">'+(o.rfq_number ? '<a href="/admin/rfqs/'+o.rfq_id+'" style="color:#c8932a;">'+o.rfq_number+'</a>' : '&mdash;')+'</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Subtotal</div><div class="detail-value">$'+parseFloat(o.subtotal||0).toLocaleString('en-US',{minimumFractionDigits:2})+'</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Shipping</div><div class="detail-value">'+(o.shipping_cost ? '$'+parseFloat(o.shipping_cost).toFixed(2) : '<span style="color:#e05050;">Not set</span>')+'</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Total</div><div class="detail-value" style="font-weight:700;color:#c8932a;font-size:1.1rem;">$'+parseFloat(o.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2})+'</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">'+statusBadge(o.status)+'</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Created</div><div class="detail-value">'+(o.confirmed_at ? new Date(o.confirmed_at).toLocaleString() : '&mdash;')+'</div></div>';
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
        html += '<div class="card" style="margin-bottom:16px;"><div class="card-header">Payment Summary</div><div class="card-body">';
        html += '<div style="font-size:.88rem;color:#7a8a9a;margin-bottom:16px;">Subtotal: <strong style="color:#eef1f5;">$'+parseFloat(o.subtotal||0).toLocaleString('en-US',{minimumFractionDigits:2})+'</strong>';
        html += o.shipping_cost ? ' + Shipping: <strong style="color:#eef1f5;">$'+parseFloat(o.shipping_cost).toFixed(2)+'</strong>' : ' <span style="color:#e05050;">(shipping not added)</span>';
        html += ' &nbsp; Total: <strong style="color:#c8932a;">$'+parseFloat(o.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2})+'</strong></div>';
        if (o.status === 'Paid') html += '<div class="alert alert-success">&#10004; Order is marked Paid.</div>';
        html += '<form method="POST" action="/admin/orders/'+o.id+'/mark-paid" style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end;" onsubmit="return confirm(\'Mark as Paid?\')">';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Payment Method</div><select name="payment_method"><option>Wire Transfer</option><option>Credit Card</option><option>Check</option><option>Other</option></select></div>';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Date</div><input type="date" name="payment_date" value="'+new Date().toISOString().split('T')[0]+'" style="width:160px;"/></div>';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Ref / Notes</div><input type="text" name="payment_notes" placeholder="Wire ref, check #..." style="width:220px;"/></div>';
        html += '<button type="submit" class="btn btn-gold">&#10004; Mark as Paid</button></form></div></div>';
        if (invoices.recordset.length) {
          html += '<div class="card"><div class="card-header">Invoices</div>';
          html += '<table><thead><tr><th>Invoice #</th><th>Status</th><th>Total</th><th>Due Date</th></tr></thead><tbody>';
          invoices.recordset.forEach(function(inv) {
            html += '<tr><td class="mono"><a href="/admin/invoices/'+inv.id+'" style="color:#c8932a;text-decoration:none;">'+inv.invoice_number+'</a></td><td>'+statusBadge(inv.status)+'</td><td style="font-weight:600;">$'+parseFloat(inv.total_amount||0).toFixed(2)+'</td><td style="color:#7a8a9a;font-size:.78rem;">'+(inv.due_date?new Date(inv.due_date).toLocaleDateString():'&mdash;')+'</td></tr>';
          });
          html += '</tbody></table></div>';
        } else {
          html += '<div class="card"><div class="card-header">Generate Invoice</div><div class="card-body">';
          html += '<p style="font-size:.85rem;color:#7a8a9a;margin-bottom:16px;">Generate and email a final invoice to the customer including all line items and shipping cost.</p>';
          html += '<form method="POST" action="/admin/orders/'+o.id+'/generate-invoice" onsubmit="return confirm(\'Generate and send invoice to '+o.email+'?\')">';
          html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">';
          html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Payment Due</div><select name="due_days"><option value="0">Due on Receipt</option><option value="15">Net 15</option><option value="30">Net 30</option></select></div>';
          html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Notes (optional)</div><input type="text" name="notes" placeholder="Additional invoice notes..." style="width:100%;"/></div>';
          html += '</div><button type="submit" class="btn btn-gold">&#128228; Generate &amp; Send Invoice</button></form>';
          html += '</div></div>';
        }
      }
      html += '</div></div>';
      res.send(page('Order '+o.order_number, 'orders', html));
    } catch(err) {
      res.send(page('Order','orders','<div class="alert alert-error">'+err.message+'</div>'));
    }
  });

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
      // Send shipment notification to customer
      try {
        const custR = await pool.request().input('id', sql.BigInt, req.params.id)
          .query('SELECT o.order_number, c.first_name, c.last_name, c.email FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.id=@id');
        if (custR.recordset.length) {
          const { sendShipmentNotification } = await import('../services/mailer.js');
          const cr = custR.recordset[0];
          sendShipmentNotification({ customer: cr, order: { order_number: cr.order_number }, shipment: { carrier: b.carrier||'', tracking_number: b.tracking_number||'', tracking_url: b.tracking_url||null, estimated_delivery: b.estimated_delivery||null } }).catch(console.error);
        }
      } catch(shipEmailErr) { console.error('Shipment email error:', shipEmailErr.message); }
      res.redirect('/admin/orders/'+req.params.id+'?tab=shipping&saved=1');
    } catch(err) { res.redirect('/admin/orders/'+req.params.id+'?error='+encodeURIComponent(err.message)); }
  });

  router.post('/orders/:id/mark-paid', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const b = req.body;
      const note = 'Paid via '+(b.payment_method||'')+(b.payment_notes ? ' - '+b.payment_notes : '');
      await pool.request().input('id', sql.BigInt, req.params.id).query("UPDATE orders SET status='Paid',updated_at=GETDATE() WHERE id=@id");
      await pool.request().input('id', sql.BigInt, req.params.id).input('note', sql.NVarChar(500), note).query("INSERT INTO order_status_log (order_id,new_status,note) VALUES (@id,'Paid',@note)");
      // Mark invoice as Paid too
      await pool.request().input('id', sql.BigInt, req.params.id).query("UPDATE invoices SET status='Paid', paid_date=CAST(GETDATE() AS DATE), balance_due=0, updated_at=GETDATE() WHERE order_id=@id AND status<>'Paid'");
      res.redirect('/admin/orders/'+req.params.id+'?tab=payment&saved=1');
    } catch(err) { res.redirect('/admin/orders/'+req.params.id+'?error='+encodeURIComponent(err.message)); }
  });

  router.post('/orders/:id/generate-invoice', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const or = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT o.*, c.first_name, c.last_name, c.email, c.company FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.id=@id');
      if (!or.recordset.length) return res.redirect('/admin/orders/'+req.params.id+'?error=Order+not+found');
      const o = or.recordset[0];
      const existing = await pool.request().input('oid', sql.BigInt, req.params.id).query('SELECT id FROM invoices WHERE order_id=@oid');
      if (existing.recordset.length) return res.redirect('/admin/orders/'+req.params.id+'?tab=payment&error=Invoice+already+exists');
      const invoiceNumber = await generateNumber('INV');
      const dueDays = parseInt(req.body.due_days)||0;
      const issueDate = new Date();
      const dueDate = new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000);
      const invResult = await pool.request()
        .input('orderId', sql.BigInt, req.params.id)
        .input('customerId', sql.BigInt, o.customer_id)
        .input('invNumber', sql.NVarChar(20), invoiceNumber)
        .input('subtotal', sql.Decimal(12,2), o.subtotal||0)
        .input('shipAmt', sql.Decimal(12,2), o.shipping_cost||0)
        .input('total', sql.Decimal(12,2), o.total_amount||0)
        .input('balance', sql.Decimal(12,2), o.total_amount||0)
        .input('issueDate', sql.Date, issueDate)
        .input('dueDate', sql.Date, dueDate)
        .input('notes', sql.NVarChar(sql.MAX), req.body.notes||null)
        .query('INSERT INTO invoices (order_id,customer_id,invoice_number,subtotal,shipping_amount,total_amount,balance_due,issue_date,due_date,notes) OUTPUT INSERTED.id VALUES (@orderId,@customerId,@invNumber,@subtotal,@shipAmt,@total,@balance,@issueDate,@dueDate,@notes)');
      const invoiceId = invResult.recordset[0].id;
      const oLines = await pool.request().input('oid', sql.BigInt, req.params.id).query('SELECT * FROM order_lines WHERE order_id=@oid ORDER BY line_number');
      for (const l of oLines.recordset) {
        await pool.request()
          .input('invId', sql.BigInt, invoiceId)
          .input('olId', sql.BigInt, l.id)
          .input('lineNum', sql.Int, l.line_number)
          .input('desc', sql.NVarChar(255), l.item_name||l.nsn||l.part_number||'')
          .input('nsn', sql.NVarChar(20), l.nsn||null)
          .input('pn', sql.NVarChar(100), l.part_number||null)
          .input('cond', sql.NVarChar(5), l.condition_code||null)
          .input('qty', sql.Int, l.quantity_ordered)
          .input('price', sql.Decimal(10,2), l.unit_price)
          .input('total', sql.Decimal(12,2), l.line_total)
          .query('INSERT INTO invoice_lines (invoice_id,order_line_id,line_number,description,nsn,part_number,condition_code,quantity,unit_price,line_total) VALUES (@invId,@olId,@lineNum,@desc,@nsn,@pn,@cond,@qty,@price,@total)');
      }
      let pdfBuffer = null;
      try {
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const gold = [200,147,42]; const navy = [10,22,40]; const pageW = 210; const margin = 14; const contentW = pageW - margin*2;
        doc.setFillColor(...navy); doc.rect(0,0,pageW,28,'F');
        doc.setFillColor(...gold); doc.rect(0,28,pageW,1.5,'F');
        doc.setTextColor(...gold); doc.setFontSize(15); doc.setFont('helvetica','bold');
        doc.text('JUPITER ONE USA LLC', margin, 12);
        doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(180,180,180);
        doc.text('Aerospace & Defense Component Supplier', margin, 20);
        doc.setTextColor(255,255,255); doc.setFontSize(9); doc.text('INVOICE', pageW-margin, 12, {align:'right'});
        doc.setFontSize(8); doc.setTextColor(180,180,180); doc.text(invoiceNumber, pageW-margin, 20, {align:'right'});
        let y = 38;
        doc.setFontSize(7); doc.setTextColor(120,120,120); doc.setFont('helvetica','bold');
        doc.text('BILL TO', margin, y); doc.text('INVOICE DETAILS', margin+98, y); y+=5;
        doc.setFont('helvetica','normal'); doc.setTextColor(30,30,30); doc.setFontSize(9);
        doc.text(o.first_name+' '+o.last_name, margin, y);
        if (o.company) { doc.setFontSize(8); doc.setTextColor(80,80,80); doc.text(o.company, margin, y+5); }
        const dets = [['Invoice #:',invoiceNumber],['Order #:',o.order_number],['Issue Date:',issueDate.toLocaleDateString()],['Due Date:',dueDate.toLocaleDateString()],['Payment:','Credit Card or Wire Transfer']];
        let ry = y;
        dets.forEach(function(d) { doc.setFontSize(8); doc.setTextColor(120,120,120); doc.text(d[0], margin+98, ry); doc.setTextColor(30,30,30); doc.text(d[1], margin+126, ry); ry+=5; });
        y = Math.max(ry, y+22)+4;
        doc.setDrawColor(...gold); doc.setLineWidth(0.5); doc.line(margin, y, pageW-margin, y); y+=6;
        const cols = [{x:margin},{x:margin+35},{x:margin+85},{x:margin+99},{x:margin+117},{x:margin+141}];
        const hdrs = ['NSN/Part#','Description','Qty','Condition','Unit Price','Total'];
        doc.setFillColor(...navy); doc.rect(margin,y-4,contentW,7,'F');
        doc.setTextColor(255,255,255); doc.setFontSize(7); doc.setFont('helvetica','bold');
        hdrs.forEach(function(h,i) { doc.text(h, cols[i].x+1, y); }); y+=5;
        doc.setFont('helvetica','normal'); let alt = false;
        oLines.recordset.forEach(function(l) {
          if (y>255) { doc.addPage(); y=20; }
          if (alt) { doc.setFillColor(248,248,248); doc.rect(margin,y-3.5,contentW,6.5,'F'); }
          alt = !alt; doc.setTextColor(30,30,30); doc.setFontSize(7.5);
          doc.text(String(l.nsn||l.part_number||'-').substring(0,16), cols[0].x+1, y);
          doc.text(String(l.item_name||'-').substring(0,28), cols[1].x+1, y);
          doc.text(String(l.quantity_ordered), cols[2].x+1, y);
          doc.text(String(l.condition_code||'NE'), cols[3].x+1, y);
          doc.text('$'+parseFloat(l.unit_price||0).toFixed(2), cols[4].x+1, y);
          doc.text('$'+parseFloat(l.line_total||0).toFixed(2), cols[5].x+1, y);
          doc.setDrawColor(220,220,220); doc.setLineWidth(0.2); doc.line(margin,y+2.5,pageW-margin,y+2.5); y+=7;
        });
        y+=2;
        if (o.shipping_cost) {
          doc.setFillColor(240,240,240); doc.rect(margin,y-4,contentW,7,'F');
          doc.setTextColor(80,80,80); doc.setFontSize(8);
          doc.text('Shipping:', cols[4].x+1, y); doc.text('$'+parseFloat(o.shipping_cost).toFixed(2), cols[5].x+1, y); y+=8;
        }
        doc.setFillColor(...gold); doc.rect(margin,y-4,contentW,7,'F');
        doc.setTextColor(...navy); doc.setFontSize(9); doc.setFont('helvetica','bold');
        doc.text('TOTAL DUE', cols[4].x+1, y); doc.text('$'+parseFloat(o.total_amount||0).toFixed(2), cols[5].x+1, y); y+=12;
        if (req.body.notes) { doc.setFontSize(8); doc.setFont('helvetica','normal'); doc.setTextColor(100,100,100); doc.text('Notes: '+req.body.notes.substring(0,120), margin, y); y+=8; }
        doc.setFillColor(...navy); doc.rect(0,282,pageW,15,'F');
        doc.setFontSize(7); doc.setTextColor(170,170,170);
        doc.text('Jupiter One USA LLC  |  400 N Tampa St, Suite 1550, Tampa FL  |  +1 (347) 821-7412  |  DTorchia@jupiteroneusa.com', pageW/2, 288, {align:'center'});
        doc.setTextColor(130,130,130);
        doc.text('Payment: Credit Card or Wire Transfer (3.5% CC fee). All sales non-cancellable. Thank you for your business.', pageW/2, 293, {align:'center'});
        pdfBuffer = Buffer.from(doc.output('arraybuffer'));
      } catch(pdfErr) { console.error('Invoice PDF error:', pdfErr.message); }
      try {
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.default.createTransport({ host: process.env.SMTP_HOST, port: parseInt(process.env.SMTP_PORT)||587, secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
        const emailHtml = '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;"><div style="background:#0a1628;padding:20px;border-bottom:3px solid #c8932a;"><h2 style="color:#c8932a;margin:0;">JUPITER ONE USA LLC</h2><p style="color:#aaa;margin:4px 0 0;font-size:12px;">Aerospace &amp; Defense Component Supplier</p></div><div style="background:#fff;padding:28px;"><p>Hi '+o.first_name+',</p><p>Please find your invoice <strong>'+invoiceNumber+'</strong> for order <strong>'+o.order_number+'</strong> attached.</p><table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;"><tr><td style="color:#888;padding:4px 0;width:120px;">Invoice #</td><td><strong>'+invoiceNumber+'</strong></td></tr><tr><td style="color:#888;padding:4px 0;">Order #</td><td>'+o.order_number+'</td></tr><tr><td style="color:#888;padding:4px 0;">Total Due</td><td style="font-weight:bold;color:#c8932a;font-size:1.1rem;">$'+parseFloat(o.total_amount||0).toFixed(2)+'</td></tr><tr><td style="color:#888;padding:4px 0;">Due Date</td><td>'+dueDate.toLocaleDateString()+'</td></tr></table><p style="font-size:13px;color:#555;">Payment accepted via Credit Card or Wire Transfer (3.5% CC fee). Please contact us at DTorchia@jupiteroneusa.com to arrange payment.</p></div><div style="background:#0a1628;padding:14px 20px;"><p style="color:#555;font-size:11px;margin:0;">Jupiter One USA LLC | 400 N Tampa St, Suite 1550, Tampa FL | +1 (347) 821-7412</p></div></div>';
        const mailOpts = { from: '"Jupiter One USA" <DTorchia@jupiteroneusa.com>', to: o.email, bcc: 'DTorchia@jupiteroneusa.com', subject: 'Invoice '+invoiceNumber+' — Jupiter One USA', html: emailHtml };
        if (pdfBuffer) mailOpts.attachments = [{ filename: 'Invoice-'+invoiceNumber+'.pdf', content: pdfBuffer, contentType: 'application/pdf' }];
        await transporter.sendMail(mailOpts);
        console.log('Invoice email sent:', invoiceNumber);
      } catch(emailErr) { console.error('Invoice email error:', emailErr.message); }
      res.redirect('/admin/orders/'+req.params.id+'?tab=payment&saved=1');
    } catch(err) {
      console.error('Invoice generate error:', err);
      res.redirect('/admin/orders/'+req.params.id+'?tab=payment&error='+encodeURIComponent(err.message));
    }
  });
}
