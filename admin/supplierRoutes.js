// admin/supplierRoutes.js
// Routes for /admin/suppliers/:id and create/edit forms
// Mounted by admin/index.js via mountSupplierRoutes(router, requireAuth, page)

import { getPool, sql } from '../db/connect.js';
import { currency, shortDate, shortDateTime, statusBadge, inputField, selectField, textareaField, checkboxField } from './uiHelpers.js';

export function mountSupplierRoutes(router, requireAuth, page) {

  // ==========================================================================
  // GET /suppliers/new - blank create form
  // ==========================================================================
  router.get('/suppliers/new', async (req, res) => {
    if (!requireAuth(req, res)) return;
    const errorMsg = req.query.error ? '<div class="alert alert-error" style="margin-bottom:16px;">' + decodeURIComponent(req.query.error) + '</div>' : '';

    let html = errorMsg;
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
    html += '<div class="page-title">New Supplier</div>';
    html += '<a href="/admin/suppliers" class="btn btn-outline btn-sm">&larr; Back</a></div>';
    html += '<div class="page-sub">Add a new supplier to your network</div>';

    html += '<form method="POST" action="/admin/suppliers/create"><div class="card"><div class="card-body">';
    html += '<div class="detail-grid">';
    html += inputField('Company Name *', 'company_name', '', 'text', 'required');
    html += inputField('DBA Name', 'dba_name', '');
    html += inputField('Contact Name', 'contact_name', '');
    html += inputField('Email', 'email', '', 'email');
    html += inputField('Phone', 'phone', '');
    html += inputField('Website', 'website', '');
    html += inputField('CAGE Code', 'cage_code', '');
    html += inputField('Tax ID / EIN', 'tax_id', '');
    html += inputField('Country', 'country', 'USA');
    html += selectField('Currency', 'currency', 'USD', ['USD','EUR','GBP','CAD','MXN','JPY','AUD']);
    html += inputField('Payment Terms', 'payment_terms', 'Net 30');
    html += inputField('Default Lead Time (days)', 'lead_time_default_days', '', 'number', 'min="0"');
    html += '</div>';
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">';
    html += checkboxField('Certified to issue 8130-3', 'is_certified_8130', false);
    html += checkboxField('FAR Flow-Down Eligible', 'is_far_flow_eligible', false);
    html += '</div>';
    html += '<div style="margin-top:12px;">' + textareaField('Internal Notes', 'internal_notes', '', 4) + '</div>';
    html += '<button type="submit" class="btn btn-gold" style="margin-top:12px;">Create Supplier</button>';
    html += '</div></div></form>';

    res.send(page('New Supplier', 'suppliers', html));
  });

  router.post('/suppliers/create', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const b = req.body;
      if (!b.company_name) return res.redirect('/admin/suppliers/new?error=Company+name+required');
      const r = await pool.request()
        .input('cn', sql.NVarChar(150), b.company_name.trim())
        .input('dba', sql.NVarChar(150), b.dba_name || null)
        .input('cont', sql.NVarChar(100), b.contact_name || null)
        .input('em', sql.NVarChar(150), b.email || null)
        .input('ph', sql.NVarChar(30), b.phone || null)
        .input('web', sql.NVarChar(150), b.website || null)
        .input('cage', sql.NVarChar(10), b.cage_code || null)
        .input('tax', sql.NVarChar(50), b.tax_id || null)
        .input('cty', sql.NVarChar(50), b.country || null)
        .input('cur', sql.NVarChar(10), b.currency || 'USD')
        .input('pt', sql.NVarChar(50), b.payment_terms || null)
        .input('lt', sql.Int, b.lead_time_default_days ? parseInt(b.lead_time_default_days) : null)
        .input('c8', sql.Bit, b.is_certified_8130 === '1' ? 1 : 0)
        .input('cff', sql.Bit, b.is_far_flow_eligible === '1' ? 1 : 0)
        .input('notes', sql.NVarChar(sql.MAX), b.internal_notes || null)
        .query(`INSERT INTO suppliers (company_name, dba_name, contact_name, email, phone, website, cage_code, tax_id, country, currency, payment_terms, lead_time_default_days, is_certified_8130, is_far_flow_eligible, internal_notes, status)
          OUTPUT INSERTED.id
          VALUES (@cn, @dba, @cont, @em, @ph, @web, @cage, @tax, @cty, @cur, @pt, @lt, @c8, @cff, @notes, 'Active')`);
      res.redirect('/admin/suppliers/' + r.recordset[0].id + '?saved=1');
    } catch(err) {
      console.error('Create supplier error:', err);
      res.redirect('/admin/suppliers/new?error=' + encodeURIComponent(err.message));
    }
  });

  // ==========================================================================
  // GET /suppliers/:id - detail page with tabs
  // ==========================================================================
  router.get('/suppliers/:id', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const sR = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT * FROM suppliers WHERE id=@id');
      if (!sR.recordset.length) return res.send(page('Supplier', 'suppliers', '<div class="alert alert-error">Supplier not found.</div>'));
      const s = sR.recordset[0];

      const contacts = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT * FROM supplier_contacts WHERE supplier_id=@id ORDER BY is_primary DESC, name ASC');

      const pos = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT id, po_number, status, total, issued_at, sent_at, expected_delivery, received_at FROM supplier_pos WHERE supplier_id=@id ORDER BY created_at DESC');

      const docs = await pool.request().input('id', sql.BigInt, req.params.id)
        .query("SELECT id, doc_type, file_name, file_url, uploaded_at, notes FROM documents WHERE related_to_type='supplier' AND related_to_id=@id ORDER BY uploaded_at DESC");

      // Performance metrics calculated on the fly
      const perfR = await pool.request().input('id', sql.BigInt, req.params.id).query(`
        SELECT
          COUNT(*) AS total_pos,
          SUM(CASE WHEN status IN ('Received','Closed') THEN 1 ELSE 0 END) AS completed_pos,
          SUM(CASE WHEN received_at IS NOT NULL AND expected_delivery IS NOT NULL AND CAST(received_at AS DATE) <= expected_delivery THEN 1 ELSE 0 END) AS on_time_pos,
          SUM(CASE WHEN received_at IS NOT NULL AND expected_delivery IS NOT NULL THEN 1 ELSE 0 END) AS rated_pos,
          ISNULL(SUM(total),0) AS total_spent,
          ISNULL(AVG(CASE WHEN received_at IS NOT NULL AND issued_at IS NOT NULL THEN DATEDIFF(day, issued_at, received_at) END),0) AS avg_lead_time
        FROM supplier_pos WHERE supplier_id=@id
      `);
      const perf = perfR.recordset[0];
      const onTimeRate = perf.rated_pos > 0 ? ((perf.on_time_pos / perf.rated_pos) * 100).toFixed(1) : null;

      const activeTab = req.query.tab || 'overview';
      const successMsg = req.query.saved ? '<div class="alert alert-success" style="margin-bottom:16px;">&#10004; Saved.</div>' :
        req.query.error ? '<div class="alert alert-error" style="margin-bottom:16px;">' + decodeURIComponent(req.query.error || '') + '</div>' : '';

      function tabLink(t, label) {
        return '<a href="/admin/suppliers/' + s.id + '?tab=' + t + '" style="display:inline-block;padding:8px 18px;font-size:.82rem;font-weight:600;letter-spacing:.04em;border-bottom:2px solid ' + (activeTab === t ? '#c8932a' : 'transparent') + ';color:' + (activeTab === t ? '#c8932a' : '#7a8a9a') + ';text-decoration:none;white-space:nowrap;">' + label + '</a>';
      }

      let html = successMsg;
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:8px;">';
      html += '<div><div class="page-title">' + s.company_name + '</div>';
      html += '<div class="page-sub" style="margin-bottom:0;">' + (s.dba_name ? 'DBA: ' + s.dba_name + ' &middot; ' : '') + (s.cage_code ? 'CAGE: ' + s.cage_code + ' &middot; ' : '') + statusBadge(s.status) + '</div></div>';
      html += '<a href="/admin/suppliers" class="btn btn-outline btn-sm">&larr; Back</a></div>';

      html += '<div style="border-bottom:1px solid #1e2d42;margin-bottom:24px;overflow-x:auto;white-space:nowrap;">';
      html += tabLink('overview', '&#127970; Overview');
      html += tabLink('contacts', '&#128100; Contacts (' + contacts.recordset.length + ')');
      html += tabLink('performance', '&#128202; Performance');
      html += tabLink('pos', '&#128221; POs (' + pos.recordset.length + ')');
      html += tabLink('documents', '&#128196; Documents (' + docs.recordset.length + ')');
      html += '</div>';

      html += '<div class="card"><div class="card-body">';

      if (activeTab === 'overview') {
        html += '<form method="POST" action="/admin/suppliers/' + s.id + '/update">';
        html += '<div class="detail-grid">';
        html += inputField('Company Name *', 'company_name', s.company_name, 'text', 'required');
        html += inputField('DBA Name', 'dba_name', s.dba_name);
        html += inputField('Contact Name', 'contact_name', s.contact_name);
        html += inputField('Email', 'email', s.email, 'email');
        html += inputField('Phone', 'phone', s.phone);
        html += inputField('Website', 'website', s.website);
        html += inputField('CAGE Code', 'cage_code', s.cage_code);
        html += inputField('Tax ID / EIN', 'tax_id', s.tax_id);
        html += inputField('Account # With Us', 'account_number_with_us', s.account_number_with_us);
        html += inputField('Address Line 1', 'address1', s.address1 || s.billing_address1);
        html += inputField('City', 'city', s.city);
        html += inputField('State', 'state', s.state);
        html += inputField('ZIP', 'zip', s.zip);
        html += inputField('Country', 'country', s.country);
        html += selectField('Currency', 'currency', s.currency || 'USD', ['USD','EUR','GBP','CAD','MXN','JPY','AUD']);
        html += inputField('Payment Terms', 'payment_terms', s.payment_terms);
        html += inputField('Min Order Value', 'min_order_value', s.min_order_value, 'number', 'step="0.01" min="0"');
        html += inputField('Default Lead Time (days)', 'lead_time_default_days', s.lead_time_default_days, 'number', 'min="0"');
        html += selectField('Status', 'status', s.status || 'Active', ['Active','Inactive','Suspended','Pending']);
        html += '</div>';
        html += '<div style="margin-top:12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">';
        html += checkboxField('Preferred Supplier', 'is_preferred', s.is_preferred);
        html += checkboxField('Certified 8130-3', 'is_certified_8130', s.is_certified_8130);
        html += checkboxField('FAR Flow-Down Eligible', 'is_far_flow_eligible', s.is_far_flow_eligible);
        html += '</div>';
        html += '<div style="margin-top:12px;">' + textareaField('Internal Notes', 'internal_notes', s.internal_notes, 4) + '</div>';
        html += '<button type="submit" class="btn btn-gold" style="margin-top:12px;">Save Supplier</button>';
        html += '</form>';
      }

      if (activeTab === 'contacts') {
        // Add contact form
        html += '<div style="margin-bottom:20px;padding:14px;background:#0a1628;border:1px solid #1e2d42;">';
        html += '<div style="font-size:.72rem;color:#c8932a;letter-spacing:.15em;text-transform:uppercase;margin-bottom:10px;">Add Contact</div>';
        html += '<form method="POST" action="/admin/suppliers/' + s.id + '/contacts/add" style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:8px;align-items:flex-end;">';
        html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:3px;">Name *</div><input type="text" name="name" required style="width:100%;background:#111e30;border:1px solid #1e2d42;color:#eef1f5;padding:6px 10px;font-size:.85rem;"/></div>';
        html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:3px;">Role</div><input type="text" name="role" placeholder="Sales / AP / Shipping" style="width:100%;background:#111e30;border:1px solid #1e2d42;color:#eef1f5;padding:6px 10px;font-size:.85rem;"/></div>';
        html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:3px;">Email</div><input type="email" name="email" style="width:100%;background:#111e30;border:1px solid #1e2d42;color:#eef1f5;padding:6px 10px;font-size:.85rem;"/></div>';
        html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:3px;">Phone</div><input type="text" name="phone" style="width:100%;background:#111e30;border:1px solid #1e2d42;color:#eef1f5;padding:6px 10px;font-size:.85rem;"/></div>';
        html += '<button type="submit" class="btn btn-gold btn-sm">Add</button>';
        html += '</form></div>';

        // Contacts table
        if (contacts.recordset.length === 0) {
          html += '<div style="text-align:center;color:#7a8a9a;padding:24px;">No contacts yet.</div>';
        } else {
          html += '<table><thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Phone</th><th>Primary</th><th></th></tr></thead><tbody>';
          contacts.recordset.forEach(function(c) {
            html += '<tr>';
            html += '<td style="font-weight:600;">' + c.name + '</td>';
            html += '<td style="color:#7a8a9a;">' + (c.role || '&mdash;') + '</td>';
            html += '<td>' + (c.email ? '<a href="mailto:' + c.email + '" style="color:#c8932a;">' + c.email + '</a>' : '&mdash;') + '</td>';
            html += '<td style="color:#7a8a9a;">' + (c.phone || '&mdash;') + '</td>';
            html += '<td>' + (c.is_primary ? '<span style="color:#c8932a;font-weight:600;">&#10003; Primary</span>' : '<form method="POST" action="/admin/suppliers/' + s.id + '/contacts/' + c.id + '/set-primary" style="display:inline;"><button type="submit" class="btn btn-outline btn-sm" style="font-size:.7rem;">Set Primary</button></form>') + '</td>';
            html += '<td><form method="POST" action="/admin/suppliers/' + s.id + '/contacts/' + c.id + '/delete" style="display:inline;" onsubmit="return confirm(\'Delete this contact?\')"><button type="submit" class="btn btn-outline btn-sm" style="color:#e05050;border-color:#e05050;font-size:.7rem;">&#10005;</button></form></td>';
            html += '</tr>';
          });
          html += '</tbody></table>';
        }
      }

      if (activeTab === 'performance') {
        html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px;">';
        html += '<div class="stat"><div class="stat-num">' + perf.total_pos + '</div><div class="stat-label">Total POs</div></div>';
        html += '<div class="stat"><div class="stat-num">' + perf.completed_pos + '</div><div class="stat-label">Completed</div></div>';
        html += '<div class="stat"><div class="stat-num">' + (onTimeRate !== null ? onTimeRate + '%' : '&mdash;') + '</div><div class="stat-label">On-Time Rate</div></div>';
        html += '<div class="stat"><div class="stat-num">' + currency(perf.total_spent) + '</div><div class="stat-label">Total Spent</div></div>';
        html += '</div>';
        html += '<div class="detail-grid">';
        html += '<div class="detail-item"><div class="detail-label">Average Lead Time</div><div class="detail-value">' + (perf.avg_lead_time ? Math.round(perf.avg_lead_time) + ' days' : 'No data yet') + '</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Manual Quality Score</div><div class="detail-value">' + (s.avg_quality_score != null ? parseFloat(s.avg_quality_score).toFixed(1) + ' / 5.0' : 'Not rated') + '</div></div>';
        html += '<div class="detail-item"><div class="detail-label">First PO</div><div class="detail-value">' + (perf.total_pos > 0 ? 'See PO list' : 'No POs yet') + '</div></div>';
        html += '<div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">' + statusBadge(s.status) + '</div></div>';
        html += '</div>';
        html += '<div style="margin-top:16px;font-size:.78rem;color:#7a8a9a;">On-time rate calculated from POs with both expected_delivery and received_at populated. Avg lead time from issue to receipt.</div>';
      }

      if (activeTab === 'pos') {
        if (pos.recordset.length === 0) {
          html += '<div style="text-align:center;color:#7a8a9a;padding:24px;">No purchase orders yet.</div>';
        } else {
          html += '<table><thead><tr><th>PO #</th><th>Status</th><th>Total</th><th>Issued</th><th>Sent</th><th>Expected</th><th>Received</th></tr></thead><tbody>';
          pos.recordset.forEach(function(p) {
            html += '<tr>';
            html += '<td class="mono"><a href="/admin/supplier-pos/' + p.id + '" style="color:#c8932a;">' + p.po_number + '</a></td>';
            html += '<td>' + statusBadge(p.status) + '</td>';
            html += '<td style="font-weight:600;">' + currency(p.total) + '</td>';
            html += '<td style="color:#7a8a9a;font-size:.78rem;">' + shortDate(p.issued_at) + '</td>';
            html += '<td style="color:' + (p.sent_at ? '#4caf50' : '#7a8a9a') + ';font-size:.78rem;">' + (p.sent_at ? shortDate(p.sent_at) : '&mdash;') + '</td>';
            html += '<td style="color:#7a8a9a;font-size:.78rem;">' + shortDate(p.expected_delivery) + '</td>';
            html += '<td style="color:#7a8a9a;font-size:.78rem;">' + shortDate(p.received_at) + '</td>';
            html += '</tr>';
          });
          html += '</tbody></table>';
        }
      }

      if (activeTab === 'documents') {
        // STEP9_4_SUPPLIER_DOCS upload form
        html += '<div style="background:rgba(200,147,42,0.06);border:1px solid rgba(200,147,42,0.3);padding:16px;border-radius:6px;margin-bottom:20px;">';
        html += '<div style="font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;color:#c8932a;margin-bottom:12px;">&#128206; Upload Document</div>';
        html += '<form id="docUploadForm" enctype="multipart/form-data" style="display:grid;grid-template-columns:1fr 1fr 2fr auto;gap:10px;align-items:flex-end;">';
        html += '<input type="hidden" name="related_to_type" value="supplier"/>';
        html += '<input type="hidden" name="related_to_id" value="' + s.id + '"/>';
        html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:4px;">Document Type</div>';
        html += '<select name="doc_type" required style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:8px 10px;">' +
          '<option value="">-- Select --</option>' +
          '<option value="W9">W-9</option>' +
          '<option value="NDA">NDA</option>' +
          '<option value="Agreement">Supplier Agreement</option>' +
          '<option value="Certification">Certification</option>' +
          '<option value="Insurance">Certificate of Insurance</option>' +
          '<option value="QualityCert">Quality Cert (ISO/AS9100)</option>' +
          '<option value="Capability">Capability Statement</option>' +
          '<option value="PriceList">Price List / Catalog</option>' +
          '<option value="Other">Other</option>' +
          '</select></div>';
        html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:4px;">File (max 25MB)</div>';
        html += '<input type="file" name="file" required style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:6px 8px;font-size:.82rem;"/></div>';
        html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:4px;">Notes (optional)</div>';
        html += '<input type="text" name="notes" placeholder="Expiry date, version, etc..." style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:8px 10px;"/></div>';
        html += '<button type="button" onclick="uploadSupDoc()" class="btn btn-gold">Upload</button>';
        html += '</form>';
        html += '<div id="uploadStatus" style="margin-top:10px;font-size:.85rem;"></div>';
        html += '</div>';

        html += '<script>function uploadSupDoc(){var f=document.getElementById("docUploadForm");var fd=new FormData(f);var st=document.getElementById("uploadStatus");st.innerHTML="<span style=\"color:#c8932a;\">Uploading...</span>";fetch("/admin/api/documents/upload",{method:"POST",body:fd,credentials:"same-origin"}).then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j};});}).then(function(res){if(res.ok){st.innerHTML="<span style=\"color:#4caf50;\">&#10004; Uploaded. Reloading...</span>";setTimeout(function(){location.reload();},800);}else{st.innerHTML="<span style=\"color:#e05050;\">Error: "+(res.j.error||"Upload failed")+"</span>";}}).catch(function(err){st.innerHTML="<span style=\"color:#e05050;\">Network error: "+err.message+"</span>";});}</script>';

        if (docs.recordset.length === 0) {
          html += '<div style="text-align:center;color:#7a8a9a;padding:24px;">No documents uploaded yet.</div>';
        } else {
          html += '<table><thead><tr><th>Type</th><th>File</th><th>Uploaded</th><th>Notes</th><th></th></tr></thead><tbody>';
          docs.recordset.forEach(function(d) {
            html += '<tr>';
            html += '<td>' + statusBadge(d.doc_type) + '</td>';
            html += '<td><a href="' + d.file_url + '" target="_blank" style="color:#c8932a;">&#128206; ' + d.file_name + '</a></td>';
            html += '<td style="color:#7a8a9a;font-size:.78rem;">' + shortDateTime(d.uploaded_at) + '</td>';
            html += '<td style="color:#7a8a9a;font-size:.82rem;">' + (d.notes || '&mdash;') + '</td>';
            html += '<td><button onclick="if(confirm(\'Delete this document?\')){fetch(\'/admin/api/documents/' + d.id + '/delete\',{method:\'POST\',credentials:\'same-origin\'}).then(function(){location.reload();});}" class="btn btn-outline btn-sm" style="font-size:.7rem;padding:4px 8px;color:#e05050;border-color:#e05050;">Delete</button></td>';
            html += '</tr>';
          });
          html += '</tbody></table>';
        }
      }

      html += '</div></div>';
      res.send(page(s.company_name + ' \u2014 Supplier', 'suppliers', html));
    } catch(err) {
      console.error('Supplier detail error:', err);
      res.send(page('Supplier', 'suppliers', '<div class="alert alert-error">' + err.message + '</div>'));
    }
  });

  // ==========================================================================
  // POST /suppliers/:id/update
  // ==========================================================================
  router.post('/suppliers/:id/update', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const b = req.body;
      await pool.request()
        .input('id', sql.BigInt, req.params.id)
        .input('cn', sql.NVarChar(150), b.company_name || null)
        .input('dba', sql.NVarChar(150), b.dba_name || null)
        .input('cont', sql.NVarChar(100), b.contact_name || null)
        .input('em', sql.NVarChar(150), b.email || null)
        .input('ph', sql.NVarChar(30), b.phone || null)
        .input('web', sql.NVarChar(150), b.website || null)
        .input('cage', sql.NVarChar(10), b.cage_code || null)
        .input('tax', sql.NVarChar(50), b.tax_id || null)
        .input('acct', sql.NVarChar(50), b.account_number_with_us || null)
        .input('addr', sql.NVarChar(150), b.address1 || null)
        .input('city', sql.NVarChar(100), b.city || null)
        .input('st', sql.NVarChar(50), b.state || null)
        .input('zip', sql.NVarChar(20), b.zip || null)
        .input('cty', sql.NVarChar(50), b.country || null)
        .input('cur', sql.NVarChar(10), b.currency || 'USD')
        .input('pt', sql.NVarChar(50), b.payment_terms || null)
        .input('mov', sql.Decimal(12,2), b.min_order_value ? parseFloat(b.min_order_value) : null)
        .input('lt', sql.Int, b.lead_time_default_days ? parseInt(b.lead_time_default_days) : null)
        .input('stat', sql.NVarChar(20), b.status || 'Active')
        .input('pref', sql.Bit, b.is_preferred === '1' ? 1 : 0)
        .input('c8', sql.Bit, b.is_certified_8130 === '1' ? 1 : 0)
        .input('cff', sql.Bit, b.is_far_flow_eligible === '1' ? 1 : 0)
        .input('notes', sql.NVarChar(sql.MAX), b.internal_notes || null)
        .query(`UPDATE suppliers SET company_name=@cn, dba_name=@dba, contact_name=@cont, email=@em, phone=@ph, website=@web, cage_code=@cage, tax_id=@tax, account_number_with_us=@acct, address1=@addr, city=@city, state=@st, zip=@zip, country=@cty, currency=@cur, payment_terms=@pt, min_order_value=@mov, lead_time_default_days=@lt, status=@stat, is_preferred=@pref, is_certified_8130=@c8, is_far_flow_eligible=@cff, internal_notes=@notes, updated_at=GETDATE() WHERE id=@id`);
      res.redirect('/admin/suppliers/' + req.params.id + '?tab=overview&saved=1');
    } catch(err) {
      console.error('Update supplier error:', err);
      res.redirect('/admin/suppliers/' + req.params.id + '?error=' + encodeURIComponent(err.message));
    }
  });

  // ==========================================================================
  // Contacts CRUD
  // ==========================================================================
  router.post('/suppliers/:id/contacts/add', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const b = req.body;
      if (!b.name) return res.redirect('/admin/suppliers/' + req.params.id + '?tab=contacts&error=Name+required');
      // Check if any primary exists
      const existsR = await pool.request().input('id', sql.BigInt, req.params.id).query('SELECT COUNT(*) AS c FROM supplier_contacts WHERE supplier_id=@id');
      const isFirst = existsR.recordset[0].c === 0;
      await pool.request()
        .input('sid', sql.BigInt, req.params.id)
        .input('nm', sql.NVarChar(150), b.name.trim())
        .input('rl', sql.NVarChar(100), b.role || null)
        .input('em', sql.NVarChar(150), b.email || null)
        .input('ph', sql.NVarChar(30), b.phone || null)
        .input('pri', sql.Bit, isFirst ? 1 : 0)
        .query('INSERT INTO supplier_contacts (supplier_id,name,role,email,phone,is_primary) VALUES (@sid,@nm,@rl,@em,@ph,@pri)');
      res.redirect('/admin/suppliers/' + req.params.id + '?tab=contacts&saved=1');
    } catch(err) {
      res.redirect('/admin/suppliers/' + req.params.id + '?tab=contacts&error=' + encodeURIComponent(err.message));
    }
  });

  router.post('/suppliers/:id/contacts/:cid/delete', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      await pool.request().input('cid', sql.BigInt, req.params.cid).query('DELETE FROM supplier_contacts WHERE id=@cid');
      res.redirect('/admin/suppliers/' + req.params.id + '?tab=contacts&saved=1');
    } catch(err) {
      res.redirect('/admin/suppliers/' + req.params.id + '?tab=contacts&error=' + encodeURIComponent(err.message));
    }
  });

  router.post('/suppliers/:id/contacts/:cid/set-primary', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      await pool.request().input('sid', sql.BigInt, req.params.id).query('UPDATE supplier_contacts SET is_primary=0 WHERE supplier_id=@sid');
      await pool.request().input('cid', sql.BigInt, req.params.cid).query('UPDATE supplier_contacts SET is_primary=1 WHERE id=@cid');
      res.redirect('/admin/suppliers/' + req.params.id + '?tab=contacts&saved=1');
    } catch(err) {
      res.redirect('/admin/suppliers/' + req.params.id + '?tab=contacts&error=' + encodeURIComponent(err.message));
    }
  });

}
