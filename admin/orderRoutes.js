// admin/orderRoutes.js
// Order detail routes for admin panel
import { getPool, sql } from '../db/connect.js';
import { generateNumber } from '../db/numbering.js';
import { renderOverviewTab } from './orderOverviewBlock.js';
import { renderShippingTab } from './orderShippingBlock.js';
import { renderProformaTab } from './orderProformaBlock.js';
import { generateProformaPdf } from '../services/proformaPdfService.js';
import crypto from 'crypto';
// PROFORMA_ROUTES_V1
import { renderPaymentTab } from './orderPaymentBlock.js';
import { renderLinesTab } from './orderLinesBlock.js';

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
      const payments = await pool.request().input('idP', sql.BigInt, req.params.id).query('SELECT id, amount, payment_method, payment_reference, received_at, notes FROM payments WHERE order_id=@idP ORDER BY received_at DESC');
      const suppliers = await pool.request().query("SELECT id, company_name AS name, country FROM suppliers WHERE status='Active' ORDER BY company_name ASC");
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
      html += tabLink('overview','&#128203; Overview')+tabLink('lines','&#128230; Lines')+tabLink('shipping','&#128666; Shipping') + tabLink('proforma','&#129534; Proforma')+tabLink('payment','&#128179; Payment');
      html += '</div><div class="card"><div class="card-body">';
      if (activeTab === 'overview') {
        html += renderOverviewTab(o, sLog);
      } else if (activeTab === 'lines') {
        // [Rewire 4] One-click Create Supplier POs button
        const _pendingSourcesR = await pool.request().input('idCSP', sql.BigInt, req.params.id).query("SELECT COUNT(*) AS pending FROM order_line_sources ols INNER JOIN order_lines ol ON ol.id = ols.order_line_id WHERE ol.order_id=@idCSP AND ols.supplier_po_line_id IS NULL");
        const _pending = _pendingSourcesR.recordset[0].pending;
        if (_pending > 0) {
          html += '<div style="background:rgba(200,147,42,0.1);border:1px solid #c8932a;padding:14px 18px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">';
          html += '<div><div style="font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:#c8932a;font-weight:700;margin-bottom:4px;">\u26A1 Ready for Supplier POs</div>';
          html += '<div style="color:#cfd5dc;font-size:.85rem;">' + _pending + ' supplier source(s) on this order have no PO yet. One click creates Draft POs (one per supplier).</div></div>';
          html += '<form method="POST" action="/admin/orders/' + req.params.id + '/create-supplier-pos-from-order" style="margin:0;">';
          html += '<button type="submit" class="btn btn-gold" onclick="return confirm(\'Create draft Supplier POs grouped by supplier? You can review/edit each before sending.\')">+ Create Supplier POs (' + _pending + ')</button>';
          html += '</form></div>';
        }
        html += await renderLinesTab(o, oLines, suppliers);
      } else if (activeTab === 'shipping') {
        const missingCertsR = await pool.request().input('idMc', sql.BigInt, req.params.id).query("SELECT line_number, COALESCE(NULLIF(part_number,''), nsn) AS part_number, nsn, cert_8130_required, cert_8130_received, coc_required, coc_received FROM order_lines WHERE order_id=@idMc AND ((cert_8130_required=1 AND cert_8130_received=0) OR (coc_required=1 AND coc_received=0))");
        html += renderShippingTab(o, ships, missingCertsR.recordset);
      } else if (activeTab === 'proforma') {
        const pfR = await pool.request().input('oid', sql.BigInt, req.params.id)
          .query('SELECT * FROM proformas WHERE order_id=@oid ORDER BY id DESC');
        const authR = await pool.request().input('oid2', sql.BigInt, req.params.id)
          .query('SELECT * FROM cc_authorizations WHERE order_id=@oid2 ORDER BY id DESC');
        html += renderProformaTab(o, pfR.recordset, authR.recordset, '');
      } else if (activeTab === 'payment') {
        html += renderPaymentTab(o, invoices, payments);
      }
      html += '</div></div>';
      res.send(page('Order '+o.order_number, 'orders', html));
    } catch(err) {
      res.send(page('Order','orders','<div class="alert alert-error">'+err.message+'</div>'));
    }
  });

  router.post('/orders/:id/overview-update', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const b = req.body;
      await pool.request()
        .input('id', sql.BigInt, req.params.id)
        .input('priority', sql.NVarChar(20), b.priority || 'Standard')
        .input('assignedTo', sql.NVarChar(100), b.assigned_to || null)
        .input('contractNumber', sql.NVarChar(100), b.contract_number || null)
        .input('country', sql.NVarChar(50), b.country_of_destination || null)
        .input('endUseCert', sql.Bit, b.end_use_cert_required === '1' ? 1 : 0)
        .input('internalNotes', sql.NVarChar(sql.MAX), b.internal_notes || null)
        .query('UPDATE orders SET priority=@priority, assigned_to=@assignedTo, contract_number=@contractNumber, country_of_destination=@country, end_use_cert_required=@endUseCert, internal_notes=@internalNotes, updated_at=GETDATE() WHERE id=@id');
      res.redirect('/admin/orders/'+req.params.id+'?tab=overview&saved=1');
    } catch(err) { res.redirect('/admin/orders/'+req.params.id+'?error='+encodeURIComponent(err.message)); }
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

      // Phase A2: Compliance gate - block ship if certs required but not received
      const compR = await pool.request().input('oid', sql.BigInt, req.params.id).query(
        "SELECT line_number, COALESCE(NULLIF(part_number,''), nsn) AS pn, " +
        "(cert_8130_required & ~cert_8130_received) AS m8130, " +
        "(coc_required & ~coc_received) AS mcoc " +
        "FROM order_lines WHERE order_id=@oid AND ((cert_8130_required=1 AND cert_8130_received=0) OR (coc_required=1 AND coc_received=0))"
      );
      if (compR.recordset.length && req.body.compliance_override === '1') {
        // Log the override to status log
        const reason = (req.body.override_reason || '').substring(0, 500);
        await pool.request().input('id', sql.BigInt, req.params.id).input('n', sql.NVarChar(500), 'COMPLIANCE OVERRIDE: ' + reason)
          .query("INSERT INTO order_status_log (order_id, new_status, note) VALUES (@id, 'Compliance Override', @n)");
      }
      if (compR.recordset.length && req.body.compliance_override !== '1') {
        const blocking = compR.recordset.map(function(l){
          var miss = []; if (l.m8130) miss.push('8130-3'); if (l.mcoc) miss.push('CoC');
          return 'Line ' + l.line_number + ' (' + l.pn + ') missing: ' + miss.join(', ');
        }).join('; ');
        return res.redirect('/admin/orders/' + req.params.id + '?tab=shipping&error=' + encodeURIComponent('Compliance blocked: ' + blocking + '. Mark certs received first or use override.'));
      }
      // (compliance_blocked check end)
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
        .input('weight', sql.Decimal(8,2), parseFloat(b.weight_lbs)||null)
        .input('dims', sql.NVarChar(50), b.dimensions||null)
        .input('pkgs', sql.Int, parseInt(b.package_count)||1)
        .input('sigReq', sql.Bit, b.signature_required==='1'?1:0)
        .input('ins', sql.Decimal(12,2), parseFloat(b.insurance_value)||null)
        .query("INSERT INTO shipments (order_id,shipment_number,carrier,tracking_number,tracking_url,ship_date,estimated_delivery,weight_lbs,dimensions,package_count,signature_required,insurance_value,status) VALUES (@orderId,@shipNum,@carrier,@tracking,@trackingUrl,@shipDate,@estDelivery,@weight,@dims,@pkgs,@sigReq,@ins,'Shipped')");
      await pool.request().input('id', sql.BigInt, req.params.id).query("UPDATE orders SET status='Shipped',shipped_at=ISNULL(shipped_at,GETDATE()),updated_at=GETDATE() WHERE id=@id");
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

  router.post('/orders/:id/shipments/:sid/deliver', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const b = req.body;
      const delAt = b.actual_delivery_at ? new Date(b.actual_delivery_at) : new Date();
      await pool.request()
        .input('sid', sql.BigInt, req.params.sid)
        .input('delAt', sql.DateTime, delAt)
        .input('rcvBy', sql.NVarChar(100), b.received_by_name||null)
        .input('proof', sql.NVarChar(500), b.delivery_proof_url||null)
        .query("UPDATE shipments SET actual_delivery_at=@delAt, received_by_name=@rcvBy, delivery_proof_url=@proof, status='Delivered' WHERE id=@sid");
      await pool.request()
        .input('id', sql.BigInt, req.params.id)
        .input('delAt2', sql.DateTime, delAt)
        .query("UPDATE orders SET status='Delivered', delivered_at=ISNULL(delivered_at,@delAt2), updated_at=GETDATE() WHERE id=@id");
      await pool.request().input('id', sql.BigInt, req.params.id)
        .query("INSERT INTO order_status_log (order_id,new_status,note) VALUES (@id,'Delivered','Delivery confirmed')");
      res.redirect('/admin/orders/'+req.params.id+'?tab=shipping&saved=1');
    } catch(err) { res.redirect('/admin/orders/'+req.params.id+'?tab=shipping&error='+encodeURIComponent(err.message)); }
  });

  router.post('/orders/:id/record-payment', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const b = req.body;
      const amount = parseFloat(b.amount);
      if (!amount || amount <= 0) return res.redirect('/admin/orders/'+req.params.id+'?tab=payment&error=Invalid+amount');
      const receivedAt = b.received_at ? new Date(b.received_at) : new Date();
      const ord = await pool.request().input('id', sql.BigInt, req.params.id).query('SELECT customer_id, total_amount FROM orders WHERE id=@id');
      if (!ord.recordset.length) return res.redirect('/admin/orders/'+req.params.id+'?error=Order+not+found');
      const cid = ord.recordset[0].customer_id;
      const orderTotal = parseFloat(ord.recordset[0].total_amount || 0);
      const invR = await pool.request().input('idI', sql.BigInt, req.params.id).query('SELECT TOP 1 id FROM invoices WHERE order_id=@idI');
      const iid = invR.recordset[0] ? invR.recordset[0].id : null;
      // Insert payment record
      await pool.request()
        .input('oid', sql.BigInt, req.params.id)
        .input('iid', sql.BigInt, iid)
        .input('cid', sql.BigInt, cid)
        .input('amt', sql.Decimal(12,2), amount)
        .input('pm', sql.NVarChar(50), b.payment_method || 'Other')
        .input('pref', sql.NVarChar(100), b.payment_reference || null)
        .input('rcv', sql.DateTime, receivedAt)
        .input('notes', sql.NVarChar(500), b.notes || null)
        .query('INSERT INTO payments (order_id,invoice_id,customer_id,amount,payment_method,payment_reference,received_at,notes) VALUES (@oid,@iid,@cid,@amt,@pm,@pref,@rcv,@notes)');
      // Recalculate paid total
      const sumR = await pool.request().input('idS', sql.BigInt, req.params.id).query('SELECT ISNULL(SUM(amount),0) AS total_paid FROM payments WHERE order_id=@idS');
      const totalPaid = parseFloat(sumR.recordset[0].total_paid || 0);
      const isPaid = totalPaid >= orderTotal - 0.01;
      const newStatus = isPaid ? 'Paid' : 'Partially Paid';
      await pool.request()
        .input('id', sql.BigInt, req.params.id)
        .input('paidAmt', sql.Decimal(12,2), totalPaid)
        .input('newStatus', sql.NVarChar(50), newStatus)
        .input('paidAt', sql.DateTime, isPaid ? receivedAt : null)
        .input('payMethod', sql.NVarChar(50), b.payment_method || null)
        .input('payRef', sql.NVarChar(100), b.payment_reference || null)
        .query("UPDATE orders SET paid_amount=@paidAmt, status=@newStatus, paid_at=ISNULL(paid_at,@paidAt), payment_method=ISNULL(payment_method,@payMethod), payment_reference=ISNULL(payment_reference,@payRef), updated_at=GETDATE() WHERE id=@id");
      await pool.request().input('id', sql.BigInt, req.params.id).input('s', sql.NVarChar(50), newStatus).input('n', sql.NVarChar(500), 'Payment of $'+amount.toFixed(2)+' recorded ('+(b.payment_method||'')+')').query('INSERT INTO order_status_log (order_id,new_status,note) VALUES (@id,@s,@n)');
      // If fully paid, mark invoices paid too
      if (isPaid) {
        await pool.request().input('id', sql.BigInt, req.params.id).query("UPDATE invoices SET status='Paid', paid_date=CAST(GETDATE() AS DATE), balance_due=0, updated_at=GETDATE() WHERE order_id=@id AND status<>'Paid'");
      }
      res.redirect('/admin/orders/'+req.params.id+'?tab=payment&saved=1');
    } catch(err) { console.error('Record payment error:', err); res.redirect('/admin/orders/'+req.params.id+'?tab=payment&error='+encodeURIComponent(err.message)); }
  });

  router.post('/orders/:id/lines/:lineId/update', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const b = req.body;
      await pool.request()
        .input('id', sql.BigInt, req.params.lineId)
        .input('oid', sql.BigInt, req.params.id)
        .input('supId', sql.BigInt, b.supplier_id ? parseInt(b.supplier_id) : null)
        .input('supCost', sql.Decimal(10,2), b.supplier_cost ? parseFloat(b.supplier_cost) : null)
        .input('leadDays', sql.Int, b.supplier_lead_time_days ? parseInt(b.supplier_lead_time_days) : null)
        .input('lotNum', sql.NVarChar(100), b.lot_number || null)
        .input('coo', sql.NVarChar(50), b.country_of_origin || null)
        .input('rcvAt', sql.DateTime, b.received_at ? new Date(b.received_at) : null)
        .input('serials', sql.NVarChar(sql.MAX), b.serial_numbers || null)
        .input('cert8R', sql.Bit, b.cert_8130_required === '1' ? 1 : 0)
        .input('cert8G', sql.Bit, b.cert_8130_received === '1' ? 1 : 0)
        .input('cocR', sql.Bit, b.coc_required === '1' ? 1 : 0)
        .input('cocG', sql.Bit, b.coc_received === '1' ? 1 : 0)
        .query('UPDATE order_lines SET supplier_id=@supId, supplier_cost=@supCost, supplier_lead_time_days=@leadDays, lot_number=@lotNum, country_of_origin=@coo, received_at=@rcvAt, serial_numbers=@serials, cert_8130_required=@cert8R, cert_8130_received=@cert8G, coc_required=@cocR, coc_received=@cocG WHERE id=@id AND order_id=@oid');
      res.redirect('/admin/orders/'+req.params.id+'?tab=lines&saved=1');
    } catch(err) { console.error('Line update error:', err); res.redirect('/admin/orders/'+req.params.id+'?tab=lines&error='+encodeURIComponent(err.message)); }
  });

  router.post('/orders/:id/mark-paid', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const b = req.body;
      const note = 'Paid via '+(b.payment_method||'')+(b.payment_notes ? ' - '+b.payment_notes : '');
      const paidAt = b.payment_date ? new Date(b.payment_date) : new Date();
      const orderTotal = await pool.request().input('idT', sql.BigInt, req.params.id).query('SELECT total_amount FROM orders WHERE id=@idT');
      const totalAmount = parseFloat(orderTotal.recordset[0] && orderTotal.recordset[0].total_amount || 0);
      await pool.request()
        .input('id', sql.BigInt, req.params.id)
        .input('paidAt', sql.DateTime, paidAt)
        .input('paidAmount', sql.Decimal(12,2), totalAmount)
        .input('payMethod', sql.NVarChar(50), b.payment_method||null)
        .input('payRef', sql.NVarChar(100), b.payment_notes||null)
        .query("UPDATE orders SET status='Paid', paid_at=@paidAt, paid_amount=@paidAmount, payment_method=@payMethod, payment_reference=@payRef, updated_at=GETDATE() WHERE id=@id");
      // Also insert into payments table
      try {
        const custR = await pool.request().input('idC', sql.BigInt, req.params.id).query('SELECT customer_id FROM orders WHERE id=@idC');
        const cid = custR.recordset[0] && custR.recordset[0].customer_id;
        const invR = await pool.request().input('idI', sql.BigInt, req.params.id).query('SELECT TOP 1 id FROM invoices WHERE order_id=@idI');
        const iid = invR.recordset[0] && invR.recordset[0].id;
        if (cid) {
          await pool.request()
            .input('oid', sql.BigInt, req.params.id)
            .input('iidP', sql.BigInt, iid || null)
            .input('cid', sql.BigInt, cid)
            .input('amt', sql.Decimal(12,2), totalAmount)
            .input('pm', sql.NVarChar(50), b.payment_method||'Other')
            .input('pref', sql.NVarChar(100), b.payment_notes||null)
            .input('pAt', sql.DateTime, paidAt)
            .query('INSERT INTO payments (order_id,invoice_id,customer_id,amount,payment_method,payment_reference,received_at) VALUES (@oid,@iidP,@cid,@amt,@pm,@pref,@pAt)');
        }
      } catch(payErr) { console.error('Payment insert error:', payErr.message); }
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
      // EMPTY_GUARD - refuse to make invoice from order with no lines
      const orderLineCount = await pool.request().input('oidCheck', sql.BigInt, req.params.id).query('SELECT COUNT(*) AS cnt FROM order_lines WHERE order_id=@oidCheck');
      if (!orderLineCount.recordset[0].cnt) return res.redirect('/admin/orders/'+req.params.id+'?tab=payment&error=' + encodeURIComponent('Cannot generate invoice: this order has no line items. Add lines from the source quote first.'));
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

  // [Rewire 4] POST /orders/:id/create-supplier-pos-from-order
  // Groups order_line_sources by supplier_id, creates one Draft PO per supplier.
  router.post('/orders/:id/create-supplier-pos-from-order', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      
      // Load order info
      const oR = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT * FROM orders WHERE id=@id');
      if (!oR.recordset.length) return res.redirect('/admin/orders/' + req.params.id + '?error=Order+not+found');
      const order = oR.recordset[0];
      
      // Load all order_line_sources for this order's lines
      const sourcesR = await pool.request().input('oid', sql.BigInt, req.params.id).query(`
        SELECT ols.*, ol.line_number AS oline_num, ol.nsn, ol.part_number, ol.item_name, ol.condition_code,
               s.company_name AS supplier_name
        FROM order_line_sources ols
        INNER JOIN order_lines ol ON ol.id = ols.order_line_id
        INNER JOIN suppliers s ON s.id = ols.supplier_id
        WHERE ol.order_id = @oid
          AND ols.supplier_po_line_id IS NULL
        ORDER BY ols.supplier_id, ol.line_number, ols.sort_order
      `);
      
      if (!sourcesR.recordset.length) {
        return res.redirect('/admin/orders/' + req.params.id + '?error=No+pending+sources+to+PO+(maybe+all+already+PO%27d)');
      }
      
      // Group by supplier_id
      const bySupplier = {};
      sourcesR.recordset.forEach(function(s) {
        if (!bySupplier[s.supplier_id]) bySupplier[s.supplier_id] = [];
        bySupplier[s.supplier_id].push(s);
      });
      
      const supplierIds = Object.keys(bySupplier);
      const created = [];
      
      // Need numbering helper
      const numberingMod = await import('../db/numbering.js');
      const generateNumber = numberingMod.generateNumber;
      
      // Create one PO per supplier
      for (const sid of supplierIds) {
        const lines = bySupplier[sid];
        const supplierName = lines[0].supplier_name;
        
        let subtotal = 0;
        lines.forEach(function(l) { subtotal += parseFloat(l.unit_cost || 0) * (l.allocated_qty || 0); });
        
        const poNumber = await generateNumber('PO');
        const phR = await pool.request()
          .input('oid', sql.BigInt, req.params.id)
          .input('sid', sql.BigInt, sid)
          .input('pn', sql.NVarChar(30), poNumber)
          .input('sub', sql.Decimal(12,2), subtotal)
          .input('tot', sql.Decimal(12,2), subtotal)
          .input('notes', sql.NVarChar(sql.MAX), 'Auto-generated from order ' + order.order_number)
          .query("INSERT INTO supplier_pos (order_id, supplier_id, po_number, status, subtotal, shipping_cost, total, notes) OUTPUT INSERTED.id VALUES (@oid, @sid, @pn, 'Draft', @sub, 0, @tot, @notes)");
        const poId = phR.recordset[0].id;
        
        let lineNum = 1;
        for (const l of lines) {
          const lineTotal = parseFloat(l.unit_cost || 0) * (l.allocated_qty || 0);
          const polR = await pool.request()
            .input('poid', sql.BigInt, poId)
            .input('olid', sql.BigInt, l.order_line_id)
            .input('ln', sql.Int, lineNum++)
            .input('nsn', sql.NVarChar(20), l.nsn)
            .input('pn2', sql.NVarChar(100), l.part_number)
            .input('item', sql.NVarChar(255), l.item_name)
            .input('cond', sql.NVarChar(5), l.condition_code)
            .input('qty', sql.Int, l.allocated_qty)
            .input('cost', sql.Decimal(10,2), l.unit_cost)
            .input('total', sql.Decimal(12,2), lineTotal)
            .input('lead', sql.Int, l.supplier_lead_time_days || null)
            .query('INSERT INTO supplier_po_lines (supplier_po_id, order_line_id, line_number, nsn, part_number, item_name, condition_code, quantity, unit_cost, line_total, expected_lead_time_days) OUTPUT INSERTED.id VALUES (@poid, @olid, @ln, @nsn, @pn2, @item, @cond, @qty, @cost, @total, @lead)');
          
          // Link the order_line_source to the new supplier_po_line
          await pool.request()
            .input('olsId', sql.BigInt, l.id)
            .input('polId', sql.BigInt, polR.recordset[0].id)
            .query('UPDATE order_line_sources SET supplier_po_line_id=@polId, updated_at=GETDATE() WHERE id=@olsId');
        }
        
        created.push({ id: poId, number: poNumber, supplier: supplierName, line_count: lines.length });
      }
      
      const summary = created.map(function(c) { return c.number + ' (' + c.supplier + ', ' + c.line_count + ' lines)'; }).join(', ');
      res.redirect('/admin/orders/' + req.params.id + '?saved=1&pos_created=' + encodeURIComponent(summary));
    } catch(err) {
      console.error('Create supplier POs error:', err);
      res.redirect('/admin/orders/' + req.params.id + '?error=' + encodeURIComponent(err.message));
    }
  });

  // PROFORMA_ROUTES_V1: Send proforma
  router.post('/orders/:id/send-proforma', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const b = req.body;
      const orderId = parseInt(req.params.id);

      const oR = await pool.request().input('id', sql.BigInt, orderId).query(`
        SELECT o.*, c.first_name, c.last_name, c.email, c.company
        FROM orders o INNER JOIN customers c ON c.id = o.customer_id
        WHERE o.id = @id
      `);
      if (!oR.recordset.length) return res.redirect('/admin/orders/' + orderId + '?error=Order+not+found');
      const o = oR.recordset[0];

      const paymentMethod = b.payment_method || 'Credit Card';
      const shippingCost = parseFloat(b.shipping_cost) || 0;
      const subtotal = parseFloat(o.subtotal || 0);
      const preFeeTotal = subtotal + shippingCost;
      const ccFeePercent = (paymentMethod === 'Credit Card') ? 3.5 : 0;
      const ccFeeAmount = preFeeTotal * ccFeePercent / 100;
      const total = preFeeTotal + ccFeeAmount;

      // Bump proforma number
      const numberingMod = await import('../db/numbering.js');
      const proformaNumber = await numberingMod.generateNumber('PF');
      const authToken = crypto.randomBytes(24).toString('hex');

      const insR = await pool.request()
        .input('oid', sql.BigInt, orderId)
        .input('pfn', sql.NVarChar(30), proformaNumber)
        .input('pm', sql.NVarChar(30), paymentMethod)
        .input('sub', sql.Decimal(12,2), subtotal)
        .input('ship', sql.Decimal(12,2), shippingCost)
        .input('feeAmt', sql.Decimal(12,2), ccFeeAmount)
        .input('feePct', sql.Decimal(5,3), ccFeePercent)
        .input('tot', sql.Decimal(12,2), total)
        .input('notes', sql.NVarChar(sql.MAX), b.notes || null)
        .input('tok', sql.NVarChar(64), authToken)
        .query(`INSERT INTO proformas (order_id, proforma_number, status, payment_method,
                  subtotal, shipping_cost, cc_fee_amount, cc_fee_percent, total, notes, auth_token)
                OUTPUT INSERTED.id
                VALUES (@oid, @pfn, 'Sent', @pm, @sub, @ship, @feeAmt, @feePct, @tot, @notes, @tok)`);
      const proformaId = insR.recordset[0].id;

      // Save shipping cost back to order ONLY if not already set or invoice not generated.
      // Avoids clobbering paid/invoiced totals on a proforma resend.
      const existingInv = await pool.request().input('idC', sql.BigInt, orderId)
        .query('SELECT COUNT(*) AS cnt FROM invoices WHERE order_id=@idC');
      if (!existingInv.recordset[0].cnt) {
        await pool.request()
          .input('id', sql.BigInt, orderId)
          .input('sc', sql.Decimal(12,2), shippingCost)
          .input('tot', sql.Decimal(12,2), total)
          .query('UPDATE orders SET shipping_cost=@sc, total_amount=@tot, updated_at=GETDATE() WHERE id=@id');
      }

      // Generate PDF
      let pdfBuffer = null;
      try {
        pdfBuffer = await generateProformaPdf(proformaId);
      } catch (pdfErr) {
        console.error('Proforma PDF error:', pdfErr.message);
      }

      // Send email
      try {
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.default.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: false,
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        });

        const baseUrl = process.env.PUBLIC_URL || 'https://jupiteroneusa.com';
        const authUrl = baseUrl + '/cc-auth/' + authToken;

        let authBlock = '';
        if (paymentMethod === 'Credit Card') {
          authBlock = '<div style="margin:24px 0;text-align:center;">' +
            '<a href="' + authUrl + '" style="background:#c8932a;color:#0a1628;padding:14px 32px;text-decoration:none;font-weight:700;letter-spacing:0.05em;display:inline-block;">SIGN CREDIT CARD AUTHORIZATION</a>' +
            '<p style="font-size:11px;color:#7a8a9a;margin-top:8px;">Click to securely sign the CC authorization form online</p>' +
            '</div>';
        }

        const emailHtml = '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;">' +
          '<div style="background:#0a1628;padding:20px;border-bottom:3px solid #c8932a;">' +
          '<h2 style="color:#c8932a;margin:0;">JUPITER ONE USA</h2>' +
          '<p style="color:#aaa;margin:4px 0 0;font-size:12px;">Aerospace &amp; Defense Parts Supply</p>' +
          '</div>' +
          '<div style="background:#fff;padding:28px;">' +
          '<p>Hi ' + o.first_name + ',</p>' +
          '<p>Attached is your proforma invoice <strong>' + proformaNumber + '</strong> for order <strong>' + o.order_number + '</strong>.</p>' +
          '<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">' +
          '<tr><td style="color:#888;padding:4px 0;width:160px;">Proforma #</td><td><strong>' + proformaNumber + '</strong></td></tr>' +
          '<tr><td style="color:#888;padding:4px 0;">Order #</td><td>' + o.order_number + '</td></tr>' +
          '<tr><td style="color:#888;padding:4px 0;">Payment Method</td><td>' + paymentMethod + '</td></tr>' +
          '<tr><td style="color:#888;padding:4px 0;">Total Due</td><td style="font-weight:bold;color:#c8932a;font-size:1.1rem;">$' + total.toFixed(2) + '</td></tr>' +
          '</table>' +
          authBlock +
          '<p style="font-size:13px;color:#555;">If you have any questions, reply to this email or call (347) 821-7412.</p>' +
          '</div>' +
          '<div style="background:#0a1628;padding:14px 20px;">' +
          '<p style="color:#555;font-size:11px;margin:0;">Jupiter One USA LLC | 1101 Porter Ave NW, Palm Bay, FL 32907 | (347) 821-7412</p>' +
          '</div></div>';

        const mailOpts = {
          from: '"Derek Torchia - Jupiter One USA" <' + (process.env.ADMIN_EMAIL || 'DTorchia@jupiteroneusa.com') + '>',
          to: o.email,
          bcc: process.env.ADMIN_EMAIL || 'DTorchia@jupiteroneusa.com',
          subject: 'Proforma ' + proformaNumber + ' - Jupiter One USA',
          html: emailHtml
        };
        if (pdfBuffer) {
          mailOpts.attachments = [{
            filename: 'Proforma-' + proformaNumber + '.pdf',
            content: pdfBuffer,
            contentType: 'application/pdf'
          }];
        }
        await transporter.sendMail(mailOpts);
        console.log('Proforma email sent:', proformaNumber);
      } catch (emailErr) {
        console.error('Proforma email error:', emailErr.message);
      }

      res.redirect('/admin/orders/' + orderId + '?tab=proforma&saved=1');
    } catch (err) {
      console.error('Send proforma error:', err);
      res.redirect('/admin/orders/' + req.params.id + '?tab=proforma&error=' + encodeURIComponent(err.message));
    }
  });

  // PROFORMA_ROUTES_V1: View PDF
  router.get('/proformas/:id/pdf', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pdfBuffer = await generateProformaPdf(parseInt(req.params.id));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Content-Disposition', 'inline; filename="proforma.pdf"');
      res.end(pdfBuffer);
    } catch (err) {
      console.error('Proforma PDF error:', err);
      res.status(500).send('Error: ' + err.message);
    }
  });


  // CC_CAPTURE_ROUTE_V1: Mark CC charged + record payment + cascade order to Paid
  router.post('/orders/:oid/cc-auth/:aid/capture', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const orderId = parseInt(req.params.oid);
      const authId  = parseInt(req.params.aid);
      const b = req.body;
      const amount = parseFloat(b.captured_amount);
      const ref = (b.captured_reference || '').trim();
      const notes = (b.notes || '').trim();

      if (!amount || amount <= 0) return res.redirect('/admin/orders/' + orderId + '?tab=proforma&error=Invalid+amount');
      if (!ref) return res.redirect('/admin/orders/' + orderId + '?tab=proforma&error=Reference+required');

      // Load auth
      const aR = await pool.request().input('aid', sql.BigInt, authId)
        .query('SELECT * FROM cc_authorizations WHERE id=@aid');
      if (!aR.recordset.length) return res.redirect('/admin/orders/' + orderId + '?tab=proforma&error=Auth+not+found');
      const auth = aR.recordset[0];
      if (auth.captured_at) return res.redirect('/admin/orders/' + orderId + '?tab=proforma&error=Already+captured');

      const now = new Date();
      const capturedBy = (req.user && req.user.email) || 'admin';

      // 1) Mark auth captured
      await pool.request()
        .input('aid', sql.BigInt, authId)
        .input('cat', sql.DateTime, now)
        .input('camt', sql.Decimal(12,2), amount)
        .input('cref', sql.NVarChar(100), ref)
        .input('cby', sql.NVarChar(100), capturedBy)
        .query('UPDATE cc_authorizations SET captured_at=@cat, captured_amount=@camt, captured_reference=@cref, captured_by=@cby, updated_at=GETDATE() WHERE id=@aid');

      // 2) Lookup order + invoice + customer
      const oR = await pool.request().input('id', sql.BigInt, orderId)
        .query('SELECT customer_id, total_amount FROM orders WHERE id=@id');
      if (!oR.recordset.length) return res.redirect('/admin/orders/' + orderId + '?error=Order+not+found');
      const orderTotal = parseFloat(oR.recordset[0].total_amount || 0);
      const cid = oR.recordset[0].customer_id;

      const invR = await pool.request().input('idI', sql.BigInt, orderId)
        .query('SELECT TOP 1 id FROM invoices WHERE order_id=@idI');
      const iid = invR.recordset[0] ? invR.recordset[0].id : null;

      // 3) Insert payment record
      const fullNote = 'CC charge ref: ' + ref + (notes ? ' | ' + notes : '');
      await pool.request()
        .input('oid', sql.BigInt, orderId)
        .input('iid', sql.BigInt, iid)
        .input('cid', sql.BigInt, cid)
        .input('amt', sql.Decimal(12,2), amount)
        .input('pm',  sql.NVarChar(50), 'Credit Card')
        .input('pref', sql.NVarChar(100), ref)
        .input('rcv', sql.DateTime, now)
        .input('notes', sql.NVarChar(500), fullNote.substring(0, 500))
        .query('INSERT INTO payments (order_id,invoice_id,customer_id,amount,payment_method,payment_reference,received_at,notes) VALUES (@oid,@iid,@cid,@amt,@pm,@pref,@rcv,@notes)');

      // 4) Recalculate order totals + cascade status
      const sumR = await pool.request().input('idS', sql.BigInt, orderId)
        .query('SELECT ISNULL(SUM(amount),0) AS total_paid FROM payments WHERE order_id=@idS');
      const totalPaid = parseFloat(sumR.recordset[0].total_paid || 0);
      const isPaid = totalPaid >= orderTotal - 0.01;
      const newStatus = isPaid ? 'Paid' : 'Partially Paid';

      await pool.request()
        .input('id', sql.BigInt, orderId)
        .input('paidAmt', sql.Decimal(12,2), totalPaid)
        .input('newStatus', sql.NVarChar(50), newStatus)
        .input('paidAt', sql.DateTime, isPaid ? now : null)
        .input('payRef', sql.NVarChar(100), ref)
        .query("UPDATE orders SET paid_amount=@paidAmt, status=@newStatus, paid_at=ISNULL(paid_at,@paidAt), payment_method='Credit Card', payment_reference=ISNULL(payment_reference,@payRef), updated_at=GETDATE() WHERE id=@id");

      // 5) Cascade invoice to Paid if fully paid
      if (isPaid && iid) {
        await pool.request().input('id', sql.BigInt, orderId)
          .query("UPDATE invoices SET status='Paid', paid_date=CAST(GETDATE() AS DATE), balance_due=0, updated_at=GETDATE() WHERE order_id=@id AND status<>'Paid'");
      }

      // 6) Status log
      await pool.request().input('id', sql.BigInt, orderId)
        .input('s', sql.NVarChar(50), newStatus)
        .input('n', sql.NVarChar(500), 'CC charge captured: $' + amount.toFixed(2) + ' ref ' + ref.substring(0, 50))
        .query('INSERT INTO order_status_log (order_id,new_status,note) VALUES (@id,@s,@n)');

      res.redirect('/admin/orders/' + orderId + '?tab=proforma&saved=1');
    } catch (err) {
      console.error('CC capture error:', err);
      res.redirect('/admin/orders/' + req.params.oid + '?tab=proforma&error=' + encodeURIComponent(err.message));
    }
  });


}
