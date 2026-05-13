// patch-mark-cc-charged.cjs
// Adds "Mark CC Charged" workflow:
//   1. Update orderProformaBlock.js to show charge button + state on signed auths
//   2. Add POST /admin/orders/:oid/cc-auth/:aid/capture route in orderRoutes.js
//      that records payment, marks auth captured, cascades order status

const fs = require('fs');
const { execSync } = require('child_process');

// ============ 1) Rewrite orderProformaBlock.js auth cell logic ============
const blockPath = 'admin/orderProformaBlock.js';
const origBlock = fs.readFileSync(blockPath, 'utf8');

if (origBlock.includes('MARK_CHARGED_V1')) {
  console.log('- orderProformaBlock already patched');
} else {
  // Replace the authCell logic with capture-aware logic + add modal HTML at end
  const oldAuthCell = `      const auth = (authorizations || []).find(function(a) { return a.proforma_id === pf.id; });
      const authCell = auth
        ? (auth.status === 'Signed'
            ? '<span style="color:#4caf50;">\\u2713 Signed ' + shortDate(auth.signed_at) + (auth.card_last4 ? ' \\u00B7 ending ' + auth.card_last4 : '') + '</span>'
            : '<span style="color:#7a8a9a;">Pending</span>')
        : (pf.payment_method === 'Credit Card' ? '<span style="color:#7a8a9a;">Awaiting signature</span>' : '<span style="color:#7a8a9a;">N/A</span>');`;

  const newAuthCell = `      // MARK_CHARGED_V1
      const auth = (authorizations || []).find(function(a) { return a.proforma_id === pf.id; });
      let authCell;
      if (auth && auth.captured_at) {
        // Already charged
        const refLine = auth.captured_reference ? '<div style="font-size:.7rem;color:#7a8a9a;">ref: ' + auth.captured_reference + '</div>' : '';
        authCell = '<div style="color:#4caf50;">\\u2713 Charged ' + shortDate(auth.captured_at) + (auth.card_last4 ? ' \\u00B7 ending ' + auth.card_last4 : '') + '</div>' + refLine;
      } else if (auth && auth.status === 'Signed') {
        // Signed, not yet captured -> show button
        const amt = parseFloat(auth.amount_authorized || pf.total || 0);
        authCell = '<div style="color:#4caf50;font-size:.78rem;">\\u2713 Signed ' + shortDate(auth.signed_at) + (auth.card_last4 ? ' \\u00B7 ending ' + auth.card_last4 : '') + '</div>' +
          '<button type="button" onclick="openCharge(' + auth.id + ',' + amt + ',\\'' + (auth.card_last4 || '') + '\\')" class="btn btn-gold btn-sm" style="margin-top:6px;font-size:.7rem;padding:4px 10px;">Mark CC Charged</button>';
      } else if (auth) {
        authCell = '<span style="color:#7a8a9a;">Pending</span>';
      } else {
        authCell = (pf.payment_method === 'Credit Card' ? '<span style="color:#7a8a9a;">Awaiting signature</span>' : '<span style="color:#7a8a9a;">N/A</span>');
      }`;

  if (!origBlock.includes(oldAuthCell)) {
    console.error('! authCell anchor not found in orderProformaBlock.js');
    process.exit(1);
  }
  let b = origBlock.replace(oldAuthCell, newAuthCell);

  // Add modal + script before the final "return html;"
  const oldReturn = `  return html;
}`;

  const newReturn = `  // MARK_CHARGED_V1: capture modal + script
  html += '<div id="charge-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:1000;align-items:center;justify-content:center;">';
  html += '<div style="background:#0a1628;border:1px solid #c8932a;padding:28px;max-width:480px;width:90%;border-radius:6px;">';
  html += '<h3 style="margin:0 0 6px;color:#c8932a;font-size:1.1rem;">Mark Credit Card Charged</h3>';
  html += '<p style="margin:0 0 18px;font-size:.85rem;color:#7a8a9a;">Records that you ran the card through your payment processor. This will move the order to Paid status.</p>';
  html += '<form method="POST" id="charge-form">';
  html += '<input type="hidden" name="auth_id" id="ch_auth_id"/>';
  html += '<div style="margin-bottom:14px;"><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Amount Charged ($)</div>';
  html += '<input type="number" step="0.01" min="0" name="captured_amount" id="ch_amount" required style="width:100%;"/></div>';
  html += '<div style="margin-bottom:14px;"><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Card</div>';
  html += '<input type="text" id="ch_card_display" readonly style="width:100%;background:#111e30;color:#7a8a9a;"/></div>';
  html += '<div style="margin-bottom:14px;"><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Transaction Reference / ID <span style="color:#c8932a;">*</span></div>';
  html += '<input type="text" name="captured_reference" required placeholder="e.g. Stripe ch_3PaQ... or Square ABC123" style="width:100%;"/></div>';
  html += '<div style="margin-bottom:18px;"><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Notes (optional)</div>';
  html += '<textarea name="notes" rows="2" style="width:100%;" placeholder="Optional notes..."></textarea></div>';
  html += '<div style="display:flex;gap:10px;justify-content:flex-end;">';
  html += '<button type="button" onclick="closeCharge()" class="btn btn-outline">Cancel</button>';
  html += '<button type="submit" class="btn btn-gold">Record Charge</button>';
  html += '</div></form></div></div>';

  html += '<script>';
  html += 'function openCharge(authId, amount, last4) {';
  html += 'document.getElementById("ch_auth_id").value = authId;';
  html += 'document.getElementById("ch_amount").value = amount.toFixed(2);';
  html += 'document.getElementById("ch_card_display").value = last4 ? "Visa/MC ending " + last4 : "Card on file";';
  html += 'document.getElementById("charge-form").action = "/admin/orders/' + o.id + '/cc-auth/" + authId + "/capture";';
  html += 'document.getElementById("charge-modal").style.display = "flex";';
  html += '}';
  html += 'function closeCharge() { document.getElementById("charge-modal").style.display = "none"; }';
  html += '</script>';

  return html;
}`;

  if (!b.includes(oldReturn)) {
    console.error('! return anchor not found');
    process.exit(1);
  }
  b = b.replace(oldReturn, newReturn);

  fs.writeFileSync(blockPath + '.markch.bak', origBlock);
  fs.writeFileSync(blockPath, b);
  try {
    execSync('node -c "' + blockPath + '"', { stdio: 'pipe' });
    console.log('+ orderProformaBlock.js patched: charge button + modal');
  } catch (err) {
    fs.writeFileSync(blockPath, origBlock);
    console.error('! orderProformaBlock syntax error - REVERTED');
    console.error(err.stderr ? err.stderr.toString() : err.message);
    process.exit(1);
  }
}

// ============ 2) Add capture route to orderRoutes.js ============
const routesPath = 'admin/orderRoutes.js';
const origRoutes = fs.readFileSync(routesPath, 'utf8');
let r = origRoutes;

if (r.includes('CC_CAPTURE_ROUTE_V1')) {
  console.log('- capture route already exists');
} else {
  const captureRoute = `
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

`;

  // Inject before the final closing brace of buildOrderRoutes
  const lastBraceIdx = r.lastIndexOf('\n}');
  if (lastBraceIdx < 0) {
    console.error('! could not find function close in orderRoutes.js');
    process.exit(1);
  }
  r = r.slice(0, lastBraceIdx) + captureRoute + r.slice(lastBraceIdx);

  fs.writeFileSync(routesPath + '.markch.bak', origRoutes);
  fs.writeFileSync(routesPath, r);
  try {
    execSync('node -c "' + routesPath + '"', { stdio: 'pipe' });
    console.log('+ orderRoutes.js patched: POST /orders/:oid/cc-auth/:aid/capture');
  } catch (err) {
    fs.writeFileSync(routesPath, origRoutes);
    console.error('! orderRoutes syntax error - REVERTED');
    console.error(err.stderr ? err.stderr.toString() : err.message);
    process.exit(1);
  }
}

console.log('SUCCESS');
