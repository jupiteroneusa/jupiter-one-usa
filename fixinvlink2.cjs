// fixinvlink2.cjs
// CRLF-safe version. Adds clickable invoice numbers + invoice detail page.

const fs = require('fs');

function read(file) {
  return fs.readFileSync(file, 'utf8');
}
function write(file, content) {
  // Preserve CRLF line endings on Windows
  fs.writeFileSync(file, content);
}

console.log('Jupiter One - Invoice link + detail page patch (v2)');
console.log('---------------------------------------------------');

// =========================================================================
// PATCH 1: admin/orderRoutes.js - link invoice # on order payment tab
// Match the smaller, unique fragment instead of the whole line.
// =========================================================================
{
  const file = 'admin/orderRoutes.js';
  if (!fs.existsSync(file)) {
    console.error('  ! Missing: ' + file);
  } else {
    let src = read(file);
    const before = `'<tr><td class="mono" style="color:#c8932a;">'+inv.invoice_number+'</td>'`;
    const after  = `'<tr><td class="mono"><a href="/admin/invoices/'+inv.id+'" style="color:#c8932a;text-decoration:none;">'+inv.invoice_number+'</a></td>'`;

    if (src.includes(after)) {
      console.log('  - Already patched: orderRoutes.js link');
    } else if (!src.includes(before)) {
      console.error('  ! Could not find target: orderRoutes.js link');
      // Show what we DO see, for debug
      const m = src.match(/'<tr><td class="mono"[^']*'\+inv\.invoice_number/);
      if (m) console.error('    Found instead: ' + m[0]);
    } else {
      src = src.replace(before, after);
      write(file, src);
      console.log('  + Patched: orderRoutes.js link');
    }
  }
}

// =========================================================================
// PATCH 2: admin/index.js - add /admin/invoices/:id detail route
// CRLF-safe anchor: just match the comment line on its own
// =========================================================================
{
  const file = 'admin/index.js';
  if (!fs.existsSync(file)) {
    console.error('  ! Missing: ' + file);
  } else {
    let src = read(file);

    if (src.includes("router.get('/invoices/:id'")) {
      console.log('  - Already patched: invoice detail route exists');
    } else {
      // Use a regex that handles either CRLF or LF
      const anchorRe = /(\r?\n)(\s*\/\/ Suppliers\r?\n\s*router\.get\('\/suppliers')/;
      const m = src.match(anchorRe);
      if (!m) {
        console.error('  ! Could not find Suppliers anchor');
      } else {
        const newline = m[1]; // matches existing line ending style
        const detailRoute =
`  // Invoice Detail
  router.get('/invoices/:id', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const ir = await pool.request().input('id', sql.BigInt, req.params.id).query(\`
        SELECT i.*, o.order_number, o.id AS order_id,
          c.first_name+' '+c.last_name AS customer_name, c.company, c.email, c.phone, c.id AS customer_id,
          c.billing_address1, c.billing_address2, c.billing_city, c.billing_state, c.billing_zip, c.billing_country
        FROM invoices i
        LEFT JOIN orders o ON o.id=i.order_id
        JOIN customers c ON c.id=i.customer_id
        WHERE i.id=@id
      \`);
      if (!ir.recordset.length) return res.send(page('Invoice','invoices','<div class="alert alert-error">Invoice not found.</div>'));
      const inv = ir.recordset[0];
      const lines = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT * FROM invoice_lines WHERE invoice_id=@id ORDER BY line_number');

      const successMsg = req.query.saved ? '<div class="alert alert-success" style="margin-bottom:16px;">&#10004; Saved.</div>' :
        req.query.error ? '<div class="alert alert-error" style="margin-bottom:16px;">'+decodeURIComponent(req.query.error||'')+'</div>' : '';

      const lineRows = lines.recordset.map(l => \`<tr>
        <td style="color:#7a8a9a;">\${l.line_number}</td>
        <td class="mono" style="color:#c8932a;">\${l.nsn||l.part_number||'\u2014'}</td>
        <td>\${l.description||'\u2014'}</td>
        <td>\${l.quantity}</td>
        <td style="color:#7a8a9a;">\${l.condition_code||'\u2014'}</td>
        <td style="font-weight:600;">$\${parseFloat(l.unit_price||0).toFixed(2)}</td>
        <td style="font-weight:600;">$\${parseFloat(l.line_total||0).toFixed(2)}</td>
      </tr>\`).join('') || '<tr><td colspan="7" style="text-align:center;color:#7a8a9a;padding:16px;">No lines</td></tr>';

      const billTo = [
        inv.billing_address1,
        inv.billing_address2,
        [inv.billing_city, inv.billing_state, inv.billing_zip].filter(Boolean).join(', '),
        inv.billing_country
      ].filter(Boolean).join('<br>') || '<span style="color:#7a8a9a;">No billing address on file</span>';

      const isPaid = inv.status === 'Paid';
      const balanceDue = parseFloat(inv.balance_due||0);

      let html = successMsg;
      html += \`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:8px;">
        <div>
          <div class="page-title">\${inv.invoice_number}</div>
          <div class="page-sub" style="margin-bottom:0;">\${inv.customer_name} \u00b7 \${inv.company||''}</div>
        </div>
        <div style="display:flex;gap:8px;">
          \${inv.order_id ? '<a href="/admin/orders/'+inv.order_id+'?tab=payment" class="btn btn-outline btn-sm">View Order</a>' : ''}
          <a href="/admin/invoices" class="btn btn-outline btn-sm">&larr; Back</a>
        </div>
      </div>\`;

      html += \`<div class="detail-grid">
        <div class="detail-item"><div class="detail-label">Invoice #</div><div class="detail-value" style="font-family:monospace;color:#c8932a;">\${inv.invoice_number}</div></div>
        <div class="detail-item"><div class="detail-label">Order</div><div class="detail-value">\${inv.order_number ? '<a href="/admin/orders/'+inv.order_id+'" style="color:#c8932a;">'+inv.order_number+'</a>' : '\u2014'}</div></div>
        <div class="detail-item"><div class="detail-label">Customer</div><div class="detail-value"><a href="/admin/customers/\${inv.customer_id}" style="color:#c8932a;">\${inv.customer_name}</a></div></div>
        <div class="detail-item"><div class="detail-label">Email</div><div class="detail-value"><a href="mailto:\${inv.email}" style="color:#c8932a;">\${inv.email}</a></div></div>
        <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">\${statusBadge(inv.status)}</div></div>
        <div class="detail-item"><div class="detail-label">Issue Date</div><div class="detail-value">\${inv.issue_date?new Date(inv.issue_date).toLocaleDateString():'\u2014'}</div></div>
        <div class="detail-item"><div class="detail-label">Due Date</div><div class="detail-value">\${inv.due_date?new Date(inv.due_date).toLocaleDateString():'\u2014'}</div></div>
        <div class="detail-item"><div class="detail-label">Paid Date</div><div class="detail-value">\${inv.paid_date?new Date(inv.paid_date).toLocaleDateString():'\u2014'}</div></div>
        <div class="detail-item"><div class="detail-label">Subtotal</div><div class="detail-value">$\${parseFloat(inv.subtotal||0).toLocaleString('en-US',{minimumFractionDigits:2})}</div></div>
        <div class="detail-item"><div class="detail-label">Shipping</div><div class="detail-value">$\${parseFloat(inv.shipping_amount||0).toLocaleString('en-US',{minimumFractionDigits:2})}</div></div>
        <div class="detail-item"><div class="detail-label">Total</div><div class="detail-value" style="font-weight:700;color:#c8932a;font-size:1.1rem;">$\${parseFloat(inv.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2})}</div></div>
        <div class="detail-item"><div class="detail-label">Balance Due</div><div class="detail-value" style="font-weight:700;color:\${balanceDue>0?'#e05050':'#4caf50'};font-size:1.1rem;">$\${balanceDue.toLocaleString('en-US',{minimumFractionDigits:2})}</div></div>
      </div>\`;

      html += \`<div class="card"><div class="card-header">Bill To</div><div class="card-body" style="line-height:1.6;">
        <strong>\${inv.customer_name}</strong>\${inv.company ? '<br>'+inv.company : ''}<br>
        \${billTo}
      </div></div>\`;

      html += \`<div class="card"><div class="card-header">Line Items (\${lines.recordset.length})</div>
        <table><thead><tr><th>#</th><th>NSN/Part</th><th>Description</th><th>Qty</th><th>Condition</th><th>Unit Price</th><th>Line Total</th></tr></thead>
        <tbody>\${lineRows}</tbody></table>
        <div style="padding:16px;text-align:right;border-top:1px solid #1e2d42;">
          <span style="color:#7a8a9a;margin-right:16px;">Subtotal: <strong>$\${parseFloat(inv.subtotal||0).toLocaleString('en-US',{minimumFractionDigits:2})}</strong></span>
          \${parseFloat(inv.shipping_amount||0)>0 ? '<span style="color:#7a8a9a;margin-right:16px;">Shipping: <strong>$'+parseFloat(inv.shipping_amount).toFixed(2)+'</strong></span>' : ''}
          <span style="font-size:1.1rem;font-weight:700;">Total: <strong style="color:#c8932a;">$\${parseFloat(inv.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2})}</strong></span>
        </div>
      </div>\`;

      if (!isPaid && inv.order_id) {
        html += \`<div class="card"><div class="card-header">Payment</div><div class="card-body">
          <p style="font-size:.85rem;color:#7a8a9a;margin-bottom:12px;">To mark this invoice paid, use the order payment tab.</p>
          <a href="/admin/orders/\${inv.order_id}?tab=payment" class="btn btn-gold">Go to Order Payment Tab &rarr;</a>
        </div></div>\`;
      } else if (isPaid) {
        html += '<div class="alert alert-success">&#10004; This invoice is paid in full.</div>';
      }

      if (inv.notes) {
        html += \`<div class="card"><div class="card-header">Notes</div><div class="card-body" style="color:#7a8a9a;">\${inv.notes}</div></div>\`;
      }

      res.send(page('Invoice '+inv.invoice_number, 'invoices', html));
    } catch(err) {
      console.error('Invoice detail error:', err);
      res.send(page('Invoice','invoices','<div class="alert alert-error">'+err.message+'</div>'));
    }
  });

`;
        // Convert detailRoute to use same line endings as the source file
        const detailRouteFixed = newline === '\r\n'
          ? detailRoute.replace(/\n/g, '\r\n')
          : detailRoute;

        src = src.replace(anchorRe, newline + detailRouteFixed + m[2]);
        write(file, src);
        console.log('  + Patched: index.js - added /admin/invoices/:id detail route');
      }
    }
  }
}

console.log('---------------------------------------------------');
console.log('Done.');
