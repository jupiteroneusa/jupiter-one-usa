// admin/supplierPoRoutes.js
// Step 8: Supplier Purchase Order Management
// Routes: list, detail (4 tabs), create from order line(s), receive flow,
// payment flow, status updates, line received quantity tracking.
//
// Mounted by admin/index.js via mountSupplierPoRoutes(router, requireAuth, page)

import { getPool, sql } from '../db/connect.js';
import { generateNumber } from '../db/numbering.js';
import { currency, shortDate, shortDateTime, statusBadge, inputField, selectField, textareaField } from './uiHelpers.js';
import { generatePoPdf } from '../services/poPdfService.js';
import nodemailer from 'nodemailer';

export function mountSupplierPoRoutes(router, requireAuth, page) {

  // ==========================================================================
  // GET /supplier-pos - LIST
  // ==========================================================================
  router.get('/supplier-pos', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const status = req.query.status || '';
      const where = status ? "WHERE p.status = '" + status.replace(/'/g,"''") + "'" : '';
      const result = await pool.request().query(`
        SELECT
          p.id, p.po_number, p.status, p.total, p.issued_at, p.expected_delivery, p.received_at,
          p.order_id, o.order_number,
          p.supplier_id, s.company_name AS supplier_name
        FROM supplier_pos p
        LEFT JOIN orders o ON p.order_id = o.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        ${where}
        ORDER BY p.created_at DESC
      `);

      const statuses = ['', 'Draft', 'Sent', 'Confirmed', 'Received', 'Closed', 'Cancelled'];
      const filters = statuses.map(function(st) {
        const active = st === status;
        const label = st || 'All';
        return '<a href="/admin/supplier-pos' + (st ? '?status=' + st : '') + '" class="btn btn-sm ' + (active ? 'btn-gold' : 'btn-outline') + '">' + label + '</a>';
      }).join(' ');

      const rows = result.recordset.map(function(p) {
        return '<tr data-po-row data-href="/admin/supplier-pos/' + p.id + '" style="cursor:pointer;">' +
          '<td class="mono" style="font-weight:600;color:#c8932a;">' + p.po_number + '</td>' +
          '<td>' + (p.supplier_name ? '<a href="/admin/suppliers/' + p.supplier_id + '" style="color:#c8932a;" onclick="event.stopPropagation();">' + p.supplier_name + '</a>' : '&mdash;') + '</td>' +
          '<td>' + (p.order_number ? '<a href="/admin/orders/' + p.order_id + '" style="color:#c8932a;font-family:monospace;font-size:.78rem;" onclick="event.stopPropagation();">' + p.order_number + '</a>' : '&mdash;') + '</td>' +
          '<td>' + statusBadge(p.status) + '</td>' +
          '<td style="font-weight:600;">' + currency(p.total) + '</td>' +
          '<td style="color:#7a8a9a;font-size:.78rem;">' + shortDate(p.issued_at) + '</td>' +
          '<td style="color:#7a8a9a;font-size:.78rem;">' + shortDate(p.expected_delivery) + '</td>' +
          '<td style="color:#7a8a9a;font-size:.78rem;">' + shortDate(p.received_at) + '</td>' +
        '</tr>';
      }).join('') || '<tr><td colspan="8" style="text-align:center;color:#7a8a9a;padding:24px;">No supplier POs yet</td></tr>';

      const html =
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
          '<div class="page-title">Supplier POs</div>' +
        '</div>' +
        '<div class="page-sub">Purchase orders issued to suppliers for order fulfillment</div>' +
        '<div style="margin-bottom:14px;">' + filters + '</div>' +
        '<div class="card">' +
          '<table id="poTable">' +
            '<thead><tr>' +
              '<th data-sort="0" style="cursor:pointer;user-select:none;">PO # &#x25B2;&#x25BC;</th>' +
              '<th data-sort="1" style="cursor:pointer;user-select:none;">Supplier &#x25B2;&#x25BC;</th>' +
              '<th data-sort="2" style="cursor:pointer;user-select:none;">Order &#x25B2;&#x25BC;</th>' +
              '<th data-sort="3" style="cursor:pointer;user-select:none;">Status &#x25B2;&#x25BC;</th>' +
              '<th data-sort="4" style="cursor:pointer;user-select:none;">Total &#x25B2;&#x25BC;</th>' +
              '<th data-sort="5" style="cursor:pointer;user-select:none;">Issued &#x25B2;&#x25BC;</th>' +
              '<th data-sort="6" style="cursor:pointer;user-select:none;">Expected &#x25B2;&#x25BC;</th>' +
              '<th data-sort="7" style="cursor:pointer;user-select:none;">Received &#x25B2;&#x25BC;</th>' +
            '</tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>' +
        '<script>(function(){' +
          'document.querySelectorAll("tr[data-po-row]").forEach(function(tr){' +
            'tr.addEventListener("click", function(e){' +
              'if (e.target.tagName === "A" || e.target.closest("a")) return;' +
              'window.location = tr.getAttribute("data-href");' +
            '});' +
            'tr.addEventListener("mouseenter", function(){ tr.style.background="rgba(200,147,42,0.08)"; });' +
            'tr.addEventListener("mouseleave", function(){ tr.style.background=""; });' +
          '});' +
          'var t = document.getElementById("poTable"); if (!t) return;' +
          'var dirs = {};' +
          't.querySelectorAll("th[data-sort]").forEach(function(h){' +
            'h.addEventListener("click", function(){' +
              'var col = parseInt(h.getAttribute("data-sort"));' +
              'var dir = dirs[col] = (dirs[col] === "asc" ? "desc" : "asc");' +
              'var tbody = t.querySelector("tbody");' +
              'var rows = Array.from(tbody.querySelectorAll("tr[data-po-row]"));' +
              'rows.sort(function(a,b){' +
                'var av = (a.children[col].textContent || "").trim().toLowerCase();' +
                'var bv = (b.children[col].textContent || "").trim().toLowerCase();' +
                'if (av < bv) return dir==="asc"?-1:1;' +
                'if (av > bv) return dir==="asc"?1:-1;' +
                'return 0;' +
              '});' +
              'rows.forEach(function(r){ tbody.appendChild(r); });' +
            '});' +
          '});' +
        '})();</script>';

      res.send(page('Supplier POs', 'supplier-pos', html));
    } catch(err) {
      res.send(page('Supplier POs', 'supplier-pos', '<div class="alert alert-error">' + err.message + '</div>'));
    }
  });

  // ==========================================================================
  // GET /supplier-pos/new?from_order=X&line_ids=1,2,3 - CREATE FORM
  // Shows form pre-filled from order line(s)
  // ==========================================================================
  router.get('/supplier-pos/new', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const fromOrder = req.query.from_order;
      const lineIds = req.query.line_ids ? req.query.line_ids.split(',').map(function(x){return parseInt(x);}).filter(Boolean) : [];

      // Load suppliers
      const sup = await pool.request().query("SELECT id, company_name FROM suppliers WHERE status='Active' ORDER BY company_name ASC");

      // Pre-fill from order if given
      let order = null, orderLines = [];
      if (fromOrder) {
        const oR = await pool.request().input('id', sql.BigInt, fromOrder).query('SELECT id, order_number FROM orders WHERE id=@id');
        order = oR.recordset[0];
        if (order && lineIds.length) {
          const idsCsv = lineIds.join(',');
          const lR = await pool.request().input('oid', sql.BigInt, fromOrder)
            .query('SELECT id, line_number, nsn, part_number, item_name, condition_code, quantity_ordered, supplier_cost, supplier_id FROM order_lines WHERE order_id=@oid AND id IN (' + idsCsv + ') ORDER BY line_number');
          orderLines = lR.recordset;
        }
      }

      const errorMsg = req.query.error ? '<div class="alert alert-error" style="margin-bottom:16px;">' + decodeURIComponent(req.query.error) + '</div>' : '';

      let html = errorMsg;
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
        '<div class="page-title">New Supplier PO</div>' +
        '<a href="/admin/supplier-pos" class="btn btn-outline btn-sm">&larr; Back</a></div>';
      html += '<div class="page-sub">' + (order ? 'Creating PO for ' + order.order_number : 'Standalone supplier PO') + '</div>';

      html += '<form method="POST" action="/admin/supplier-pos/create"><div class="card"><div class="card-body">';
      if (order) html += '<input type="hidden" name="order_id" value="' + order.id + '"/>';

      // Header fields
      html += '<div class="detail-grid">';

      // Supplier dropdown
      let supOpts = '<option value="">-- Select supplier --</option>';
      const preselectSup = orderLines[0] && orderLines[0].supplier_id;
      sup.recordset.forEach(function(s) {
        supOpts += '<option value="' + s.id + '"' + (preselectSup == s.id ? ' selected' : '') + '>' + s.company_name + '</option>';
      });
      html += '<div><div style="font-size:.65rem;color:#7a8a9a;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px;">Supplier *</div>' +
        '<select name="supplier_id" required style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:8px 12px;font-size:.85rem;">' + supOpts + '</select></div>';

      html += inputField('Expected Delivery', 'expected_delivery', '', 'date');
      html += inputField('Shipping Cost ($)', 'shipping_cost', '0.00', 'number', 'step="0.01" min="0"');
      html += '</div>';

      // Lines section
      if (orderLines.length) {
        html += '<div style="margin-top:16px;border-top:1px solid #1e2d42;padding-top:14px;">';
        html += '<div style="font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;color:#c8932a;margin-bottom:10px;">PO Lines (from order)</div>';
        html += '<table><thead><tr>' +
          '<th>#</th><th>NSN/Part</th><th>Item</th><th>Cond</th><th>Qty</th><th>Unit Cost ($)</th><th>Lead (days)</th><th>Total</th>' +
          '</tr></thead><tbody>';
        orderLines.forEach(function(l, idx) {
          const cost = parseFloat(l.supplier_cost || 0).toFixed(2);
          html += '<tr>' +
            '<td>' + (idx + 1) + '</td>' +
            '<td class="mono">' + (l.nsn || l.part_number || '&mdash;') + '<input type="hidden" name="lines[' + idx + '][order_line_id]" value="' + l.id + '"/><input type="hidden" name="lines[' + idx + '][nsn]" value="' + (l.nsn || '') + '"/><input type="hidden" name="lines[' + idx + '][part_number]" value="' + (l.part_number || '') + '"/><input type="hidden" name="lines[' + idx + '][item_name]" value="' + (l.item_name || '').replace(/"/g, '&quot;') + '"/><input type="hidden" name="lines[' + idx + '][condition_code]" value="' + (l.condition_code || '') + '"/></td>' +
            '<td style="font-size:.8rem;">' + (l.item_name || '&mdash;') + '</td>' +
            '<td>' + (l.condition_code || '&mdash;') + '</td>' +
            '<td><input type="number" name="lines[' + idx + '][quantity]" value="' + l.quantity_ordered + '" min="1" required style="width:80px;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;"/></td>' +
            '<td><input type="number" step="0.01" min="0" name="lines[' + idx + '][unit_cost]" value="' + cost + '" required style="width:100px;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;" data-line-cost/></td>' +
            '<td><input type="number" min="0" name="lines[' + idx + '][lead_days]" placeholder="optional" style="width:80px;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;"/></td>' +
            '<td class="line-total" style="font-weight:600;">$' + (l.quantity_ordered * parseFloat(cost)).toFixed(2) + '</td>' +
          '</tr>';
        });
        html += '</tbody></table>';
        html += '</div>';
      } else {
        html += '<div style="margin-top:16px;color:#7a8a9a;font-size:.85rem;">No lines pre-filled. After creating this PO header, you can add lines on the detail page.</div>';
      }

      // Notes
      html += '<div style="margin-top:14px;">' + textareaField('Notes', 'notes', '', 3) + '</div>';

      html += '<button type="submit" class="btn btn-gold" style="margin-top:12px;">&#10004; Create Supplier PO</button>';
      html += '</div></div></form>';

      // Live total update
      html += '<script>(function(){' +
        'function recalc(){' +
          'document.querySelectorAll("tr").forEach(function(tr){' +
            'var qtyI = tr.querySelector("input[name$=\\"[quantity]\\"]");' +
            'var costI = tr.querySelector("input[name$=\\"[unit_cost]\\"]");' +
            'var totalCell = tr.querySelector(".line-total");' +
            'if (qtyI && costI && totalCell){ var t = (parseFloat(qtyI.value)||0) * (parseFloat(costI.value)||0); totalCell.textContent = "$" + t.toFixed(2); }' +
          '});' +
        '}' +
        'document.querySelectorAll("input[name$=\\"[quantity]\\"], input[name$=\\"[unit_cost]\\"]").forEach(function(el){ el.addEventListener("input", recalc); });' +
      '})();</script>';

      res.send(page('New Supplier PO', 'supplier-pos', html));
    } catch(err) {
      console.error('PO new error:', err);
      res.send(page('New Supplier PO', 'supplier-pos', '<div class="alert alert-error">' + err.message + '</div>'));
    }
  });

  // ==========================================================================
  // POST /supplier-pos/create
  // ==========================================================================
  router.post('/supplier-pos/create', async (req, res) => {
    if (!requireAuth(req, res)) return;
    const pool = await getPool();
    const tx = pool.transaction();
    try {
      const b = req.body;
      if (!b.supplier_id) return res.redirect('/admin/supplier-pos/new?error=Supplier+required');

      await tx.begin();

      const poNumber = await generateNumber('PO');
      const shipping = parseFloat(b.shipping_cost || 0);

      // Compute subtotal from lines
      let subtotal = 0;
      const lines = b.lines || {};
      const lineKeys = Object.keys(lines);
      lineKeys.forEach(function(k) {
        const l = lines[k];
        const qty = parseFloat(l.quantity || 0);
        const cost = parseFloat(l.unit_cost || 0);
        subtotal += qty * cost;
      });
      const total = subtotal + shipping;

      // Insert PO header
      const phR = await new sql.Request(tx)
        .input('oid', sql.BigInt, b.order_id || null)
        .input('sid', sql.BigInt, parseInt(b.supplier_id))
        .input('pn', sql.NVarChar(30), poNumber)
        .input('sub', sql.Decimal(12,2), subtotal)
        .input('ship', sql.Decimal(10,2), shipping)
        .input('tot', sql.Decimal(12,2), total)
        .input('exp', sql.Date, b.expected_delivery || null)
        .input('notes', sql.NVarChar(sql.MAX), b.notes || null)
        .query("INSERT INTO supplier_pos (order_id, supplier_id, po_number, status, subtotal, shipping_cost, total, expected_delivery, notes) OUTPUT INSERTED.id VALUES (@oid, @sid, @pn, 'Draft', @sub, @ship, @tot, @exp, @notes)");

      const poId = phR.recordset[0].id;

      // Insert PO lines
      let lineNum = 1;
      for (const k of lineKeys) {
        const l = lines[k];
        const qty = parseInt(l.quantity || 0);
        const cost = parseFloat(l.unit_cost || 0);
        if (qty <= 0) continue;
        await new sql.Request(tx)
          .input('poid', sql.BigInt, poId)
          .input('olid', sql.BigInt, l.order_line_id ? parseInt(l.order_line_id) : null)
          .input('ln', sql.Int, lineNum++)
          .input('nsn', sql.NVarChar(20), l.nsn || null)
          .input('pn2', sql.NVarChar(100), l.part_number || null)
          .input('item', sql.NVarChar(255), l.item_name || null)
          .input('cond', sql.NVarChar(5), l.condition_code || null)
          .input('qty', sql.Int, qty)
          .input('cost', sql.Decimal(10,2), cost)
          .input('total', sql.Decimal(12,2), qty * cost)
          .input('lead', sql.Int, l.lead_days ? parseInt(l.lead_days) : null)
          .query('INSERT INTO supplier_po_lines (supplier_po_id, order_line_id, line_number, nsn, part_number, item_name, condition_code, quantity, unit_cost, line_total, expected_lead_time_days) VALUES (@poid, @olid, @ln, @nsn, @pn2, @item, @cond, @qty, @cost, @total, @lead)');
      }

      await tx.commit();
      res.redirect('/admin/supplier-pos/' + poId + '?saved=1');
    } catch(err) {
      try { await tx.rollback(); } catch(e) {}
      console.error('PO create error:', err);
      const back = req.body.order_id ? '/admin/supplier-pos/new?from_order=' + req.body.order_id : '/admin/supplier-pos/new';
      res.redirect(back + '&error=' + encodeURIComponent(err.message));
    }
  });

  // ==========================================================================
  // GET /supplier-pos/:id - DETAIL with 4 tabs
  // ==========================================================================
  router.get('/supplier-pos/:id', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const pR = await pool.request().input('id', sql.BigInt, req.params.id).query(`
        SELECT p.*, s.company_name AS supplier_name, s.contact_name, s.email AS supplier_email, s.phone AS supplier_phone, s.payment_terms AS supplier_payment_terms,
          o.order_number, o.id AS order_id_join
        FROM supplier_pos p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN orders o ON p.order_id = o.id
        WHERE p.id = @id
      `);
      if (!pR.recordset.length) return res.send(page('Supplier PO', 'supplier-pos', '<div class="alert alert-error">PO not found.</div>'));
      const po = pR.recordset[0];

      const linesR = await pool.request().input('id', sql.BigInt, req.params.id).query('SELECT * FROM supplier_po_lines WHERE supplier_po_id=@id ORDER BY line_number');
      const docsR = await pool.request().input('id', sql.BigInt, req.params.id).query("SELECT id, doc_type, file_name, file_url, uploaded_at, notes FROM documents WHERE related_to_type='supplier_po' AND related_to_id=@id ORDER BY uploaded_at DESC");

      const activeTab = req.query.tab || 'overview';
      const successMsg = req.query.saved ? '<div class="alert alert-success" style="margin-bottom:16px;">&#10004; Saved.</div>' :
        req.query.error ? '<div class="alert alert-error" style="margin-bottom:16px;">' + decodeURIComponent(req.query.error || '') + '</div>' : '';

      function tabLink(t, label) {
        return '<a href="/admin/supplier-pos/' + po.id + '?tab=' + t + '" style="display:inline-block;padding:8px 18px;font-size:.82rem;font-weight:600;letter-spacing:.04em;border-bottom:2px solid ' + (activeTab === t ? '#c8932a' : 'transparent') + ';color:' + (activeTab === t ? '#c8932a' : '#7a8a9a') + ';text-decoration:none;white-space:nowrap;">' + label + '</a>';
      }

      let html = successMsg;
      html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;flex-wrap:wrap;gap:8px;">' +
        '<div><div class="page-title">' + po.po_number + '</div>' +
        '<div class="page-sub" style="margin-bottom:0;">' +
          (po.supplier_name ? '<a href="/admin/suppliers/' + po.supplier_id + '" style="color:#c8932a;">' + po.supplier_name + '</a>' : '&mdash;') +
          (po.order_number ? ' &middot; for <a href="/admin/orders/' + po.order_id_join + '" style="color:#c8932a;">' + po.order_number + '</a>' : '') +
          ' &middot; ' + statusBadge(po.status) +
        '</div></div>' +
        '<a href="/admin/supplier-pos" class="btn btn-outline btn-sm">&larr; Back</a></div>';

      html += '<div style="border-bottom:1px solid #1e2d42;margin-bottom:24px;overflow-x:auto;white-space:nowrap;">';
      html += tabLink('overview', '&#128221; Overview');
      html += tabLink('lines', '&#128203; Lines (' + linesR.recordset.length + ')');
      html += tabLink('payment', '&#128181; Payment');
      html += tabLink('documents', '&#128196; Documents (' + docsR.recordset.length + ')');
      html += '</div>';

      html += '<div class="card"><div class="card-body">';

      // ---------- OVERVIEW TAB ----------
      if (activeTab === 'overview') {
        html += '<div class="detail-grid">';
        html += '<div class="detail-item"><div class="detail-label">PO #</div><div class="detail-value" style="font-family:monospace;color:#c8932a;">' + po.po_number + '</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">' + statusBadge(po.status) + '</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Supplier</div><div class="detail-value">' + (po.supplier_name ? '<a href="/admin/suppliers/' + po.supplier_id + '" style="color:#c8932a;">' + po.supplier_name + '</a>' : '&mdash;') + '</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Supplier Contact</div><div class="detail-value">' + (po.contact_name || '&mdash;') + '</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Supplier Email</div><div class="detail-value">' + (po.supplier_email ? '<a href="mailto:' + po.supplier_email + '" style="color:#c8932a;">' + po.supplier_email + '</a>' : '&mdash;') + '</div></div>';
        html += '<div class="detail-item"><div class="detail-label">For Order</div><div class="detail-value">' + (po.order_number ? '<a href="/admin/orders/' + po.order_id + '" style="color:#c8932a;">' + po.order_number + '</a>' : 'Standalone') + '</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Subtotal</div><div class="detail-value">' + currency(po.subtotal) + '</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Shipping</div><div class="detail-value">' + currency(po.shipping_cost) + '</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Total</div><div class="detail-value" style="font-weight:700;color:#c8932a;font-size:1.1rem;">' + currency(po.total) + '</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Payment Terms</div><div class="detail-value">' + (po.supplier_payment_terms || '&mdash;') + '</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Issued</div><div class="detail-value">' + shortDateTime(po.issued_at) + '</div></div>';
        // PO_DETAIL_EDIT_V1: editable expected delivery + shipping terms
        const expDate = po.expected_delivery ? new Date(po.expected_delivery).toISOString().substring(0,10) : '';
        html += '<div class="detail-item" style="grid-column:1/-1;">';
        html += '<form method="POST" action="/admin/supplier-pos/' + po.id + '/po-details" style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;align-items:end;">';
        html += '<div><div class="detail-label">Expected Delivery</div><input type="date" name="expected_delivery" value="' + expDate + '" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:6px 10px;font-size:.85rem;"/></div>';
        html += '<div><div class="detail-label">Shipping Cost ($)</div><input type="number" step="0.01" min="0" name="shipping_cost" value="' + parseFloat(po.shipping_cost || 0).toFixed(2) + '" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:6px 10px;font-size:.85rem;"/></div>';
        html += '<div><div class="detail-label">Shipping Terms</div><input type="text" name="shipping_terms" placeholder="e.g. Pre-Pay and Add Ground" value="' + ((po.shipping_terms || '').toString().replace(/"/g, '&quot;')) + '" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:6px 10px;font-size:.85rem;"/></div>';
        html += '<button type="submit" class="btn btn-gold btn-sm">Save</button>';
        html += '</form></div>';
        html += '<div class="detail-item"><div class="detail-label">Received</div><div class="detail-value">' + shortDateTime(po.received_at) + '</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Paid</div><div class="detail-value">' + (po.paid_at ? '<span style="color:#4caf50;">' + shortDateTime(po.paid_at) + '</span>' : '<span style="color:#e05050;">Unpaid</span>') + '</div></div>';
        html += '</div>';

        // Status update form
        html += '<div style="margin-top:24px;border-top:1px solid #1e2d42;padding-top:16px;">';
        html += '<div style="font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;color:#c8932a;margin-bottom:10px;">Update Status</div>';
        const statusOptions = ['Draft', 'Sent', 'Confirmed', 'Received', 'Closed', 'Cancelled'];
        let stOpts = '';
        statusOptions.forEach(function(s) { stOpts += '<option value="' + s + '"' + (po.status === s ? ' selected' : '') + '>' + s + '</option>'; });
        html += '<form method="POST" action="/admin/supplier-pos/' + po.id + '/status" style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">';
        html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:4px;">New Status</div><select name="status">' + stOpts + '</select></div>';
        html += '<div style="flex:1;min-width:200px;"><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:4px;">Note (optional)</div><input type="text" name="note" placeholder="Reason for status change..." style="width:100%;"/></div>';
        html += '<button type="submit" class="btn btn-gold">Update</button></form>';
        html += '<div style="font-size:.78rem;color:#7a8a9a;margin-top:10px;">Setting status to <strong>Received</strong> will mark all lines as fully received and update the linked order.</div>';
        html += '</div>';

        // Send PO button (Draft only)
        if (po.status === 'Draft') {
          html += '<div style="margin-top:24px;border-top:1px solid #1e2d42;padding-top:16px;background:rgba(200,147,42,0.06);padding:16px;border-radius:6px;border:1px solid rgba(200,147,42,0.3);">';
          html += '<div style="font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;color:#c8932a;margin-bottom:10px;">&#128231; Send PO to Supplier</div>';
          html += '<form method="POST" action="/admin/supplier-pos/' + po.id + '/send" style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;">';
          html += '<div style="flex:1;min-width:240px;"><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:4px;">Email To</div>';
          html += '<input type="email" name="email_to" required value="' + (po.supplier_email || '') + '" placeholder="supplier@example.com" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:8px 12px;"/></div>';
          html += '<div style="flex:1;min-width:200px;"><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:4px;">CC (optional)</div>';
          html += '<input type="email" name="email_cc" placeholder="cc@example.com" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:8px 12px;"/></div>';
          html += '<button type="submit" class="btn btn-gold">&#128231; Send PO + PDF</button>';
          html += '</form>';
          html += '<div style="font-size:.78rem;color:#7a8a9a;margin-top:8px;">Generates PO PDF, emails it to supplier, and sets status to <strong>Sent</strong>.</div>';
          html += '</div>';
        } else if (po.sent_at) {
          html += '<div style="margin-top:16px;padding:10px 14px;background:rgba(76,175,80,0.08);border-left:3px solid #4caf50;font-size:.85rem;">&#10004; PO sent to <strong>' + (po.email_to || 'supplier') + '</strong> on ' + shortDateTime(po.sent_at) + '. <a href="/admin/supplier-pos/' + po.id + '/pdf" target="_blank" style="color:#c8932a;margin-left:8px;">View PDF</a></div>';
        }

        // PDF preview link (always available)
        html += '<div style="margin-top:16px;"><a href="/admin/supplier-pos/' + po.id + '/pdf" target="_blank" class="btn btn-outline btn-sm">&#128196; Preview PO PDF</a></div>';

        // Notes editor
        html += '<div style="margin-top:24px;border-top:1px solid #1e2d42;padding-top:16px;">';
        html += '<form method="POST" action="/admin/supplier-pos/' + po.id + '/notes-update">';
        html += textareaField('Notes', 'notes', po.notes, 3);
        html += '<button type="submit" class="btn btn-outline btn-sm">Save Notes</button>';
        html += '</form></div>';
      }

      // ---------- LINES TAB ----------
      if (activeTab === 'lines') {
        if (linesR.recordset.length === 0) {
          html += '<div style="text-align:center;color:#7a8a9a;padding:24px;">No lines on this PO yet.</div>';
        } else {
          html += '<table><thead><tr>' +
            '<th>#</th><th>NSN/Part</th><th>Item</th><th>Cond</th><th>Qty</th><th>Received</th><th>Unit Cost</th><th>Line Total</th><th>Receive</th>' +
            '</tr></thead><tbody>';
          linesR.recordset.forEach(function(l) {
            const remaining = (l.quantity || 0) - (l.received_quantity || 0);
            const fullReceived = remaining <= 0;
            html += '<tr>' +
              '<td>' + l.line_number + '</td>' +
              '<td class="mono" style="color:#c8932a;">' + (l.nsn || l.part_number || '&mdash;') + '</td>' +
              '<td style="font-size:.8rem;">' + (l.item_name || '&mdash;') + '</td>' +
              '<td>' + (l.condition_code || '&mdash;') + '</td>' +
              '<td style="font-weight:600;">' + l.quantity + '</td>' +
              '<td>' + (l.received_quantity || 0) + ' / ' + l.quantity + (fullReceived ? ' <span style="color:#4caf50;">&#10004;</span>' : '') + '</td>' +
              '<td>' + currency(l.unit_cost) + '</td>' +
              '<td style="font-weight:600;">' + currency(l.line_total) + '</td>' +
              '<td>';
            if (!fullReceived) {
              html += '<form method="POST" action="/admin/supplier-pos/' + po.id + '/lines/' + l.id + '/receive" style="display:flex;gap:4px;align-items:center;">' +
                '<input type="number" name="qty" min="1" max="' + remaining + '" value="' + remaining + '" style="width:70px;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:4px 6px;font-size:.8rem;"/>' +
                '<button type="submit" class="btn btn-gold btn-sm" style="font-size:.7rem;padding:5px 10px;">Receive</button>' +
              '</form>';
            } else {
              html += '<span style="color:#4caf50;font-size:.78rem;">Complete</span>';
            }
            html += '</td></tr>';
          });
          html += '</tbody></table>';
          html += '<div style="margin-top:14px;font-size:.78rem;color:#7a8a9a;">When all PO lines are fully received, the PO auto-marks <strong>Received</strong> and the linked order line gets a <strong>received_at</strong> date. When all order lines are received, the order auto-progresses to <strong>Ready to Ship</strong>.</div>';
        }
      }

      // ---------- PAYMENT TAB ----------
      if (activeTab === 'payment') {
        const isPaid = !!po.paid_at;
        html += '<div class="detail-grid">';
        html += '<div class="detail-item"><div class="detail-label">PO Total</div><div class="detail-value" style="font-weight:600;">' + currency(po.total) + '</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">' + (isPaid ? '<span style="color:#4caf50;font-weight:600;">&#10004; Paid</span>' : '<span style="color:#e05050;font-weight:600;">Unpaid</span>') + '</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Method</div><div class="detail-value">' + (po.payment_method || '&mdash;') + '</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Reference</div><div class="detail-value" style="font-family:monospace;">' + (po.payment_reference || '&mdash;') + '</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Paid Date</div><div class="detail-value">' + shortDateTime(po.paid_at) + '</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Payment Terms</div><div class="detail-value">' + (po.supplier_payment_terms || '&mdash;') + '</div></div>';
        html += '</div>';

        if (!isPaid) {
          html += '<div style="margin-top:24px;border-top:1px solid #1e2d42;padding-top:16px;">';
          html += '<div style="font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;color:#c8932a;margin-bottom:10px;">Mark Paid</div>';
          html += '<form method="POST" action="/admin/supplier-pos/' + po.id + '/mark-paid" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;align-items:flex-end;">';
          html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:4px;">Method</div><select name="payment_method"><option>Wire Transfer</option><option>ACH</option><option>Check</option><option>Credit Card</option><option>Other</option></select></div>';
          html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:4px;">Date</div><input type="date" name="paid_date" value="' + new Date().toISOString().slice(0,10) + '" style="width:100%;"/></div>';
          html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:4px;">Reference</div><input type="text" name="payment_reference" placeholder="Wire ref / check #" style="width:100%;"/></div>';
          html += '<div style="grid-column:1/-1;"><button type="submit" class="btn btn-gold">&#10004; Mark PO Paid</button></div>';
          html += '</form>';
          html += '</div>';
        } else {
          html += '<div class="alert alert-success" style="margin-top:16px;">This PO has been paid to the supplier.</div>';
        }
      }

      // ---------- DOCUMENTS TAB ----------
      if (activeTab === 'documents') {
        // Upload form (always visible)
        html += '<div style="background:rgba(200,147,42,0.06);border:1px solid rgba(200,147,42,0.3);padding:16px;border-radius:6px;margin-bottom:20px;">';
        html += '<div style="font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;color:#c8932a;margin-bottom:12px;">&#128206; Upload Document</div>';
        html += '<form id="docUploadForm" enctype="multipart/form-data" style="display:grid;grid-template-columns:1fr 1fr 2fr auto;gap:10px;align-items:flex-end;">';
        html += '<input type="hidden" name="related_to_type" value="supplier_po"/>';
        html += '<input type="hidden" name="related_to_id" value="' + po.id + '"/>';
        html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:4px;">Document Type</div>';
        html += '<select name="doc_type" required style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:8px 10px;">' +
          '<option value="">-- Select --</option>' +
          '<option value="8130">FAA 8130-3</option>' +
          '<option value="CoC">Certificate of Conformance</option>' +
          '<option value="Trace">Traceability</option>' +
          '<option value="PackingSlip">Packing Slip</option>' +
          '<option value="Invoice">Supplier Invoice</option>' +
          '<option value="Quote">Supplier Quote</option>' +
          '<option value="Other">Other</option>' +
          '</select></div>';
        html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:4px;">File (max 25MB)</div>';
        html += '<input type="file" name="file" required style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:6px 8px;font-size:.82rem;"/></div>';
        html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:4px;">Notes (optional)</div>';
        html += '<input type="text" name="notes" placeholder="Line ref, cert details..." style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:8px 10px;"/></div>';
        html += '<button type="button" onclick="uploadDoc()" class="btn btn-gold">Upload</button>';
        html += '</form>';
        html += '<div id="uploadStatus" style="margin-top:10px;font-size:.85rem;"></div>';
        html += '</div>';

        html += '<script>function uploadDoc(){var f=document.getElementById("docUploadForm");var fd=new FormData(f);var st=document.getElementById("uploadStatus");st.innerHTML="<span style=\"color:#c8932a;\">Uploading...</span>";fetch("/admin/api/documents/upload",{method:"POST",body:fd,credentials:"same-origin"}).then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j};});}).then(function(res){if(res.ok){st.innerHTML="<span style=\"color:#4caf50;\">&#10004; Uploaded. Reloading...</span>";setTimeout(function(){location.reload();},800);}else{st.innerHTML="<span style=\"color:#e05050;\">Error: "+(res.j.error||"Upload failed")+"</span>";}}).catch(function(err){st.innerHTML="<span style=\"color:#e05050;\">Network error: "+err.message+"</span>";});}</script>';

        // Document list
        if (docsR.recordset.length === 0) {
          html += '<div style="text-align:center;color:#7a8a9a;padding:24px;">No documents uploaded yet.</div>';
        } else {
          html += '<table><thead><tr><th>Type</th><th>File</th><th>Uploaded</th><th>Notes</th><th></th></tr></thead><tbody>';
          docsR.recordset.forEach(function(d) {
            html += '<tr>' +
              '<td>' + statusBadge(d.doc_type) + '</td>' +
              '<td><a href="' + d.file_url + '" target="_blank" style="color:#c8932a;">&#128206; ' + d.file_name + '</a></td>' +
              '<td style="color:#7a8a9a;font-size:.78rem;">' + shortDateTime(d.uploaded_at) + '</td>' +
              '<td style="color:#7a8a9a;font-size:.82rem;">' + (d.notes || '&mdash;') + '</td>' +
              '<td><button onclick="if(confirm(\'Delete this document?\')){fetch(\'/admin/api/documents/' + d.id + '/delete\',{method:\'POST\',credentials:\'same-origin\'}).then(function(){location.reload();});}" class="btn btn-outline btn-sm" style="font-size:.7rem;padding:4px 8px;color:#e05050;border-color:#e05050;">Delete</button></td>' +
            '</tr>';
          });
          html += '</tbody></table>';
        }
      }

      html += '</div></div>';

      res.send(page(po.po_number + ' \u2014 Supplier PO', 'supplier-pos', html));
    } catch(err) {
      console.error('PO detail error:', err);
      res.send(page('Supplier PO', 'supplier-pos', '<div class="alert alert-error">' + err.message + '</div>'));
    }
  });

  // ==========================================================================
  // POST /supplier-pos/:id/status - update status
  // ==========================================================================
  router.post('/supplier-pos/:id/status', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const newStatus = req.body.status;
      const setIssued = (newStatus === 'Sent') ? ", issued_at=ISNULL(issued_at, GETDATE())" : '';
      const setReceived = (newStatus === 'Received') ? ", received_at=ISNULL(received_at, GETDATE())" : '';

      await pool.request()
        .input('id', sql.BigInt, req.params.id)
        .input('s', sql.NVarChar(30), newStatus)
        .query("UPDATE supplier_pos SET status=@s" + setIssued + setReceived + ", updated_at=GETDATE() WHERE id=@id");

      // If marking Received, mark all lines as received-in-full and cascade to order_lines
      if (newStatus === 'Received') {
        await pool.request().input('id', sql.BigInt, req.params.id)
          .query("UPDATE supplier_po_lines SET received_quantity = quantity, received_at = ISNULL(received_at, GETDATE()) WHERE supplier_po_id=@id");

        // Cascade to linked order_lines
        await pool.request().input('id', sql.BigInt, req.params.id)
          .query("UPDATE ol SET ol.received_at = ISNULL(ol.received_at, GETDATE()) FROM order_lines ol INNER JOIN supplier_po_lines pl ON pl.order_line_id = ol.id WHERE pl.supplier_po_id = @id");

        // Check if all order_lines for the linked order are now received -> mark order Ready to Ship
        await maybeMarkOrderReadyToShip(pool, req.params.id);
      }

      res.redirect('/admin/supplier-pos/' + req.params.id + '?saved=1');
    } catch(err) {
      console.error('PO status error:', err);
      res.redirect('/admin/supplier-pos/' + req.params.id + '?error=' + encodeURIComponent(err.message));
    }
  });

  // ==========================================================================
  // POST /supplier-pos/:id/notes-update
  // ==========================================================================
  router.post('/supplier-pos/:id/notes-update', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      await pool.request()
        .input('id', sql.BigInt, req.params.id)
        .input('n', sql.NVarChar(sql.MAX), req.body.notes || null)
        .query('UPDATE supplier_pos SET notes=@n, updated_at=GETDATE() WHERE id=@id');
      res.redirect('/admin/supplier-pos/' + req.params.id + '?saved=1');
    } catch(err) {
      res.redirect('/admin/supplier-pos/' + req.params.id + '?error=' + encodeURIComponent(err.message));
    }
  });

  // ==========================================================================
  // POST /supplier-pos/:id/lines/:lid/receive - receive partial qty
  // ==========================================================================
  router.post('/supplier-pos/:id/lines/:lid/receive', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const qty = parseInt(req.body.qty || 0);
      if (qty <= 0) return res.redirect('/admin/supplier-pos/' + req.params.id + '?tab=lines&error=Invalid+qty');

      // Update PO line
      await pool.request()
        .input('lid', sql.BigInt, req.params.lid)
        .input('q', sql.Int, qty)
        .query("UPDATE supplier_po_lines SET received_quantity = received_quantity + @q, received_at = CASE WHEN received_quantity + @q >= quantity THEN ISNULL(received_at, GETDATE()) ELSE received_at END WHERE id = @lid");

      // If this line is now fully received, set order_lines.received_at
      await pool.request().input('lid', sql.BigInt, req.params.lid)
        .query("UPDATE ol SET ol.received_at = ISNULL(ol.received_at, GETDATE()) FROM order_lines ol INNER JOIN supplier_po_lines pl ON pl.order_line_id = ol.id WHERE pl.id = @lid AND pl.received_quantity >= pl.quantity");

      // Check if all PO lines fully received -> mark PO as Received
      const allReceivedR = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT COUNT(*) AS pending FROM supplier_po_lines WHERE supplier_po_id=@id AND received_quantity < quantity');
      const allReceived = allReceivedR.recordset[0].pending === 0;
      if (allReceived) {
        await pool.request().input('id', sql.BigInt, req.params.id)
          .query("UPDATE supplier_pos SET status = 'Received', received_at = ISNULL(received_at, GETDATE()), updated_at = GETDATE() WHERE id = @id");
      }

      // Try to mark order Ready to Ship
      await maybeMarkOrderReadyToShip(pool, req.params.id);

      res.redirect('/admin/supplier-pos/' + req.params.id + '?tab=lines&saved=1');
    } catch(err) {
      console.error('Receive error:', err);
      res.redirect('/admin/supplier-pos/' + req.params.id + '?tab=lines&error=' + encodeURIComponent(err.message));
    }
  });

  // ==========================================================================
  // POST /supplier-pos/:id/mark-paid
  // ==========================================================================
  router.post('/supplier-pos/:id/mark-paid', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const b = req.body;
      const paidAt = b.paid_date ? new Date(b.paid_date) : new Date();
      await pool.request()
        .input('id', sql.BigInt, req.params.id)
        .input('pa', sql.DateTime, paidAt)
        .input('pm', sql.NVarChar(50), b.payment_method || null)
        .input('pr', sql.NVarChar(100), b.payment_reference || null)
        .query('UPDATE supplier_pos SET paid_at=@pa, payment_method=@pm, payment_reference=@pr, updated_at=GETDATE() WHERE id=@id');
      res.redirect('/admin/supplier-pos/' + req.params.id + '?tab=payment&saved=1');
    } catch(err) {
      res.redirect('/admin/supplier-pos/' + req.params.id + '?tab=payment&error=' + encodeURIComponent(err.message));
    }
  });

  // ==========================================================================
  // GET /supplier-pos/:id/pdf - stream PO PDF
  // ==========================================================================
  router.get('/supplier-pos/:id/pdf', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const r = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT po_number FROM supplier_pos WHERE id=@id');
      if (!r.recordset.length) return res.status(404).send('PO not found');
      const poNumber = r.recordset[0].po_number;

      // PDF_BUFFER_FIX_V1: ensure we have a real Buffer with Content-Length set,
      // otherwise some browsers reject the stream and show "Failed to load PDF document"
      const pdfRaw = await generatePoPdf(req.params.id);
      const pdfBuffer = Buffer.isBuffer(pdfRaw) ? pdfRaw : Buffer.from(pdfRaw);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Content-Disposition', 'inline; filename="' + poNumber + '.pdf"');
      res.setHeader('Cache-Control', 'no-store');
      res.end(pdfBuffer);
    } catch(err) {
      console.error('PO PDF error:', err);
      res.status(500).send('PDF generation failed: ' + err.message);
    }
  });

  // ==========================================================================
  // POST /supplier-pos/:id/send - SEND_PO_HANDLER_V1
  // Generates PDF, emails it to supplier, sets status=Sent
  // ==========================================================================
  router.post('/supplier-pos/:id/send', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const emailTo = (req.body.email_to || '').trim();
      const emailCc = (req.body.email_cc || '').trim();

      if (!emailTo) {
        return res.redirect('/admin/supplier-pos/' + req.params.id + '?error=Email+recipient+required');
      }

      // Fetch PO + supplier info
      const poR = await pool.request().input('id', sql.BigInt, req.params.id).query(`
        SELECT p.po_number, p.total, p.expected_delivery, p.notes,
               s.company_name AS supplier_name, s.contact_name AS supplier_contact,
               o.order_number
        FROM supplier_pos p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN orders o ON p.order_id = o.id
        WHERE p.id = @id
      `);
      if (!poR.recordset.length) return res.redirect('/admin/supplier-pos/' + req.params.id + '?error=PO+not+found');
      const po = poR.recordset[0];

      // Generate PDF
      const pdfBuffer = await generatePoPdf(req.params.id);

      // STEP9_3_MAILER_FIX: use env vars known to exist in production (SendGrid via .env)
      const smtpHost = process.env.SMTP_HOST || 'smtp.sendgrid.net';
      const smtpPort = parseInt(process.env.SMTP_PORT || '587');
      const smtpUser = process.env.SMTP_USER || 'apikey';
      const smtpPass = process.env.SMTP_PASS;
      // SendGrid requires a verified sender. ADMIN_EMAIL is the verified one.
      const fromAddr = process.env.ADMIN_EMAIL || process.env.RFQ_NOTIFY_EMAIL || 'DTorchia@jupiteroneusa.com';

      if (!smtpPass) {
        throw new Error('SMTP_PASS not configured in environment');
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      const contactName = po.supplier_contact || 'Sir/Madam';
      const orderRef = po.order_number ? ' (customer ref: ' + po.order_number + ')' : '';
      const expectedLine = po.expected_delivery
        ? '<p>Expected delivery: <b>' + new Date(po.expected_delivery).toLocaleDateString('en-US') + '</b>.</p>'
        : '';
      const notesLine = po.notes ? '<p><b>Notes:</b><br/>' + String(po.notes).replace(/\n/g, '<br/>') + '</p>' : '';

      const htmlBody = '<div style="font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;max-width:600px;">' +
        '<p>Dear ' + contactName + ',</p>' +
        '<p>Please find attached Purchase Order <b>' + po.po_number + '</b> from Jupiter One USA' + orderRef + '.</p>' +
        '<p>PO Total: <b style="color:#c8932a;">$' + parseFloat(po.total || 0).toFixed(2) + '</b></p>' +
        expectedLine +
        notesLine +
        '<p>Please confirm receipt and provide an order acknowledgment with expected ship date. All applicable certifications (8130-3, CoC, traceability) must accompany the shipment.</p>' +
        '<p>Reply to this email or call (347) 821-7412 with any questions.</p>' +
        '<p style="margin-top:24px;">Best regards,<br/>' +
        '<b>Derek Torchia</b><br/>' +
        'Key Account Manager<br/>' +
        'Jupiter One USA<br/>' +
        '(347) 821-7412 · DTorchia@JupiterOneUSA.com</p>' +
        '</div>';

      // SENDGRID_LOG_V1: capture response to log/verify delivery
      const sendResult = await transporter.sendMail({
        from: '"Derek Torchia - Jupiter One USA" <' + fromAddr + '>',
        to: emailTo,
        cc: emailCc || undefined,
        bcc: 'DTorchia@JupiterOneUSA.com',
        subject: 'Jupiter One USA - Purchase Order ' + po.po_number,
        html: htmlBody,
        attachments: [{
          filename: po.po_number + '.pdf',
          content: pdfBuffer,
          contentType: 'application/pdf'
        }]
      });

      console.log('[PO Send] SMTP response:', {
        messageId: sendResult && sendResult.messageId,
        accepted: sendResult && sendResult.accepted,
        rejected: sendResult && sendResult.rejected,
        response: sendResult && sendResult.response
      });

      // Update PO: status=Sent, sent_at, email_to, issued_at if null
      await pool.request()
        .input('id', sql.BigInt, req.params.id)
        .input('et', sql.NVarChar(255), emailTo)
        .query("UPDATE supplier_pos SET status='Sent', sent_at=GETDATE(), email_to=@et, issued_at=ISNULL(issued_at, GETDATE()), updated_at=GETDATE() WHERE id=@id");

      res.redirect('/admin/supplier-pos/' + req.params.id + '?saved=1');
    } catch(err) {
      console.error('Send PO error:', err);
      res.redirect('/admin/supplier-pos/' + req.params.id + '?error=' + encodeURIComponent('Send failed: ' + err.message));
    }
  });

  // PODETAILS_SCOPE_FIX_V3: moved out of maybeMarkOrderReadyToShip helper into setup scope
  // PO_DETAIL_EDIT_V1: POST /supplier-pos/:id/po-details — update expected delivery + shipping
  router.post('/supplier-pos/:id/po-details', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const b = req.body;
      const shipCost = parseFloat(b.shipping_cost) || 0;
      // Recompute total if subtotal known
      const cur = await pool.request().input('id', sql.BigInt, req.params.id).query('SELECT subtotal FROM supplier_pos WHERE id=@id');
      const sub = parseFloat((cur.recordset[0] && cur.recordset[0].subtotal) || 0);
      const total = sub + shipCost;
      await pool.request()
        .input('id', sql.BigInt, req.params.id)
        .input('exp', sql.Date, b.expected_delivery || null)
        .input('ship', sql.Decimal(12,2), shipCost)
        .input('shipT', sql.NVarChar(255), b.shipping_terms || null)
        .input('tot', sql.Decimal(12,2), total)
        .query('UPDATE supplier_pos SET expected_delivery=@exp, shipping_cost=@ship, shipping_terms=@shipT, total=@tot, updated_at=GETDATE() WHERE id=@id');
      res.redirect('/admin/supplier-pos/' + req.params.id + '?saved=1');
    } catch(err) {
      console.error('PO details update error:', err);
      res.redirect('/admin/supplier-pos/' + req.params.id + '?error=' + encodeURIComponent(err.message));
    }
  });
}

// ==========================================================================
// Helper: when all order_lines for an order are received, mark order Ready to Ship
// ==========================================================================
async function maybeMarkOrderReadyToShip(pool, supplierPoId) {
  try {
    // Get the linked order
    const oR = await pool.request().input('id', sql.BigInt, supplierPoId).query('SELECT order_id FROM supplier_pos WHERE id=@id');
    const orderId = oR.recordset[0] && oR.recordset[0].order_id;
    if (!orderId) return;

    // Are all order_lines received?
    const checkR = await pool.request().input('oid', sql.BigInt, orderId)
      .query('SELECT COUNT(*) AS pending FROM order_lines WHERE order_id=@oid AND received_at IS NULL');
    if (checkR.recordset[0].pending > 0) return;

    // All received - update order
    await pool.request().input('oid', sql.BigInt, orderId)
      .query("UPDATE orders SET status = CASE WHEN status IN ('Confirmed','Processing') THEN 'Ready to Ship' ELSE status END, ready_to_ship_at = ISNULL(ready_to_ship_at, GETDATE()), updated_at = GETDATE() WHERE id=@oid");
    await pool.request().input('oid', sql.BigInt, orderId)
      .query("INSERT INTO order_status_log (order_id, new_status, note) VALUES (@oid, 'Ready to Ship', 'All order lines received from suppliers - ready for fulfillment')");
  } catch(err) {
    console.error('maybeMarkOrderReadyToShip error:', err);
  }

}
