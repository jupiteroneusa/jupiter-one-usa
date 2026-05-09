// patch-rewire-5-rfq-sourcing-tab.cjs
// Adds /admin/rfqs/:id/sourcing route - bid sheet view where admin
// records supplier responses (creates sourcing_quotes records).
//
// Includes:
//   - Bid sheet table (all supplier responses per RFQ line)
//   - Record supplier response form
//   - Quick "+ Add new supplier" inline (creates supplier on the fly)
//   - "Use this in quote" toggle (sets is_selected=1)
//   - Link to /admin/rfqs/:id/quote-review (with selected sources pre-loaded)

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/index.js';
const BACKUP = 'admin/index.js.rewire5.bak';

console.log('Rewire 5: RFQ Sourcing tab + bid sheet');
console.log('======================================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('/rfqs/:id/sourcing')) {
  console.log('- Already patched.');
  process.exit(0);
}

// We'll inject the new routes near other RFQ routes. Anchor: existing
// router.post('/rfqs/:id/quote', ...) which we just removed via rewire-1, OR
// alternatively just before the supplier mount calls.

// Safest anchor: mountQuoteBuilder line (added by rewire-1)
const mountAnchor = "mountQuoteBuilder(router, requireAuth, page);";
if (!src.includes(mountAnchor)) {
  console.error('! mountQuoteBuilder not found - run patch-rewire-1 first');
  process.exit(1);
}

const newRoutes = `
  // [Rewire 5] GET /admin/rfqs/:id/sourcing - bid sheet view
  router.get('/rfqs/:id/sourcing', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const h = await pool.request().input('id', sql.BigInt, req.params.id)
        .query("SELECT h.*, c.first_name+' '+c.last_name AS customer_name, c.company FROM rfq_headers h JOIN customers c ON c.id=h.customer_id WHERE h.id=@id");
      if (!h.recordset.length) return res.redirect('/admin/rfqs');
      const rfq = h.recordset[0];
      
      const linesR = await pool.request().input('id2', sql.BigInt, req.params.id)
        .query('SELECT * FROM rfq_lines WHERE rfq_id=@id2 ORDER BY line_number');
      
      // Load all sourcing_quotes for these RFQ lines
      const lineIds = linesR.recordset.map(function(l){return l.id;});
      let sqByLine = {};
      if (lineIds.length) {
        const sqR = await pool.request().query(
          "SELECT sq.*, s.company_name AS supplier_name, s.is_preferred FROM sourcing_quotes sq " +
          "JOIN suppliers s ON s.id = sq.supplier_id " +
          "WHERE sq.rfq_line_id IN (" + lineIds.join(',') + ") " +
          "ORDER BY sq.rfq_line_id, sq.unit_cost ASC"
        );
        sqR.recordset.forEach(function(q){
          if (!sqByLine[q.rfq_line_id]) sqByLine[q.rfq_line_id] = [];
          sqByLine[q.rfq_line_id].push(q);
        });
      }
      
      const sup = await pool.request().query("SELECT id, company_name FROM suppliers WHERE status='Active' ORDER BY company_name ASC");
      const supplierOpts = '<option value="">-- Select supplier --</option>' + sup.recordset.map(function(s){return '<option value="'+s.id+'">'+s.company_name+'</option>';}).join('');
      
      const successMsg = req.query.saved ? '<div class="alert alert-success" style="margin-bottom:16px;">\\u2713 Saved.</div>' :
        req.query.error ? '<div class="alert alert-error" style="margin-bottom:16px;">' + decodeURIComponent(req.query.error) + '</div>' : '';
      
      let html = successMsg;
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:8px;">';
      html += '<div><div class="page-title">Sourcing &mdash; ' + rfq.rfq_number + '</div>';
      html += '<div class="page-sub" style="margin-bottom:0;">' + (rfq.company || rfq.customer_name) + ' &middot; Record supplier responses, then build quote</div></div>';
      html += '<div style="display:flex;gap:8px;">';
      html += '<a href="/admin/rfqs/' + rfq.id + '" class="btn btn-outline btn-sm">&larr; Back to RFQ</a>';
      html += '<a href="/admin/rfqs/' + rfq.id + '/quote-review" class="btn btn-gold btn-sm">Build Quote &rarr;</a>';
      html += '</div></div>';
      
      // Per RFQ line: bid sheet + add response form
      linesR.recordset.forEach(function(rl){
        const responses = sqByLine[rl.id] || [];
        html += '<div class="card" style="margin-bottom:16px;"><div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">';
        html += '<span>Line ' + rl.line_number + ' &mdash; <span style="font-family:monospace;color:#c8932a;">' + (rl.nsn || rl.part_number || '\\u2014') + '</span> &middot; Qty: ' + rl.quantity + '</span>';
        html += '<span style="font-size:.72rem;color:#7a8a9a;font-weight:400;">' + responses.length + ' supplier response(s)</span>';
        html += '</div><div class="card-body" style="padding:14px;">';
        
        // Bid sheet
        if (responses.length === 0) {
          html += '<div style="color:#7a8a9a;text-align:center;padding:14px;font-size:.85rem;">No supplier responses yet. Add the first one below.</div>';
        } else {
          html += '<table style="width:100%;font-size:.82rem;"><thead><tr style="text-align:left;">';
          html += '<th style="padding:6px;color:#c8932a;font-size:.7rem;letter-spacing:.1em;">SUPPLIER</th>';
          html += '<th style="padding:6px;color:#c8932a;font-size:.7rem;">UNIT COST</th>';
          html += '<th style="padding:6px;color:#c8932a;font-size:.7rem;">AVAIL</th>';
          html += '<th style="padding:6px;color:#c8932a;font-size:.7rem;">LEAD</th>';
          html += '<th style="padding:6px;color:#c8932a;font-size:.7rem;">COND</th>';
          html += '<th style="padding:6px;color:#c8932a;font-size:.7rem;text-align:center;">8130</th>';
          html += '<th style="padding:6px;color:#c8932a;font-size:.7rem;text-align:center;">CoC</th>';
          html += '<th style="padding:6px;color:#c8932a;font-size:.7rem;text-align:center;">TRC</th>';
          html += '<th style="padding:6px;color:#c8932a;font-size:.7rem;">NOTES</th>';
          html += '<th style="padding:6px;color:#c8932a;font-size:.7rem;text-align:center;">USE?</th>';
          html += '</tr></thead><tbody>';
          responses.forEach(function(r){
            const checked = r.is_selected ? 'checked' : '';
            html += '<tr style="' + (r.is_selected ? 'background:rgba(76,175,80,0.06);' : '') + '">';
            html += '<td style="padding:6px;"><a href="/admin/suppliers/' + r.supplier_id + '" style="color:#c8932a;">' + r.supplier_name + '</a>' + (r.is_preferred ? ' <span style="color:#c8932a;font-size:.65rem;">\\u2605 Preferred</span>' : '') + '</td>';
            html += '<td style="padding:6px;font-weight:700;">$' + parseFloat(r.unit_cost||0).toFixed(2) + '</td>';
            html += '<td style="padding:6px;">' + (r.quantity_available || '\\u2014') + '</td>';
            html += '<td style="padding:6px;">' + (r.lead_time_days ? r.lead_time_days + ' days' : '\\u2014') + '</td>';
            html += '<td style="padding:6px;">' + (r.condition_code || '\\u2014') + '</td>';
            html += '<td style="padding:6px;text-align:center;">' + (r.has_8130 ? '<span style="color:#4caf50;">\\u2713</span>' : '\\u2014') + '</td>';
            html += '<td style="padding:6px;text-align:center;">' + (r.has_coc ? '<span style="color:#4caf50;">\\u2713</span>' : '\\u2014') + '</td>';
            html += '<td style="padding:6px;text-align:center;">' + (r.has_trace ? '<span style="color:#4caf50;">\\u2713</span>' : '\\u2014') + '</td>';
            html += '<td style="padding:6px;color:#7a8a9a;font-size:.78rem;">' + (r.notes || '\\u2014') + '</td>';
            html += '<td style="padding:6px;text-align:center;">';
            html += '<form method="POST" action="/admin/sourcing-quotes/' + r.id + '/toggle-select" style="margin:0;display:inline;">';
            html += '<input type="hidden" name="rfq_id" value="' + rfq.id + '"/>';
            html += '<button type="submit" class="btn btn-sm" style="font-size:.7rem;padding:3px 8px;background:' + (r.is_selected ? '#4caf50' : '#1e2d42') + ';color:' + (r.is_selected ? '#000' : '#cfd5dc') + ';">' + (r.is_selected ? '\\u2713 Selected' : 'Select') + '</button>';
            html += '</form></td>';
            html += '</tr>';
          });
          html += '</tbody></table>';
        }
        
        // Add response form
        html += '<div style="margin-top:14px;border-top:1px solid #1e2d42;padding-top:12px;">';
        html += '<div style="font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:#c8932a;margin-bottom:8px;font-weight:700;">+ Add Supplier Response</div>';
        html += '<form method="POST" action="/admin/rfqs/' + rfq.id + '/sourcing/add-response" style="display:grid;grid-template-columns:1.5fr 80px 80px 80px 80px 50px 50px 50px 1fr 100px;gap:6px;align-items:end;">';
        html += '<input type="hidden" name="rfq_line_id" value="' + rl.id + '"/>';
        html += '<div><div style="font-size:.62rem;color:#7a8a9a;margin-bottom:2px;">Supplier</div><select name="supplier_id" required style="width:100%;font-size:.78rem;">' + supplierOpts + '<option value="__new">+ Add new supplier...</option></select></div>';
        html += '<div><div style="font-size:.62rem;color:#7a8a9a;margin-bottom:2px;">Cost ($)</div><input type="number" step="0.01" min="0" name="unit_cost" required style="width:100%;font-size:.78rem;"/></div>';
        html += '<div><div style="font-size:.62rem;color:#7a8a9a;margin-bottom:2px;">Avail Qty</div><input type="number" min="0" name="quantity_available" placeholder="opt" style="width:100%;font-size:.78rem;"/></div>';
        html += '<div><div style="font-size:.62rem;color:#7a8a9a;margin-bottom:2px;">Lead (days)</div><input type="number" min="0" name="lead_time_days" placeholder="opt" style="width:100%;font-size:.78rem;"/></div>';
        html += '<div><div style="font-size:.62rem;color:#7a8a9a;margin-bottom:2px;">Cond</div><input type="text" maxlength="5" name="condition_code" placeholder="NE/SV" style="width:100%;font-size:.78rem;"/></div>';
        html += '<div><div style="font-size:.62rem;color:#7a8a9a;margin-bottom:2px;text-align:center;">8130</div><input type="checkbox" name="has_8130" value="1" style="margin:6px auto;display:block;accent-color:#c8932a;"/></div>';
        html += '<div><div style="font-size:.62rem;color:#7a8a9a;margin-bottom:2px;text-align:center;">CoC</div><input type="checkbox" name="has_coc" value="1" style="margin:6px auto;display:block;accent-color:#c8932a;"/></div>';
        html += '<div><div style="font-size:.62rem;color:#7a8a9a;margin-bottom:2px;text-align:center;">Trc</div><input type="checkbox" name="has_trace" value="1" style="margin:6px auto;display:block;accent-color:#c8932a;"/></div>';
        html += '<div><div style="font-size:.62rem;color:#7a8a9a;margin-bottom:2px;">Notes</div><input type="text" name="notes" placeholder="opt" style="width:100%;font-size:.78rem;"/></div>';
        html += '<div><button type="submit" class="btn btn-gold btn-sm" style="font-size:.78rem;padding:5px 10px;width:100%;">Add</button></div>';
        html += '</form>';
        html += '</div>';
        
        html += '</div></div>';
      });
      
      // Inline new-supplier modal trigger
      html += '<script>(function(){\\n' +
        'document.querySelectorAll(\\'select[name="supplier_id"]\\').forEach(function(sel){\\n' +
        '  sel.addEventListener("change", function(){\\n' +
        '    if (sel.value === "__new") {\\n' +
        '      const name = prompt("New supplier name (you can fill full details later in /admin/suppliers):");\\n' +
        '      if (!name) { sel.value = ""; return; }\\n' +
        '      const fd = new FormData();\\n' +
        '      fd.append("company_name", name);\\n' +
        '      fetch("/admin/suppliers/quick-create", {method: "POST", body: fd}).then(function(r){return r.json();}).then(function(data){\\n' +
        '        if (data.id) {\\n' +
        '          // Add new option to all selects\\n' +
        '          document.querySelectorAll(\\'select[name="supplier_id"]\\').forEach(function(s2){\\n' +
        '            const opt = document.createElement("option");\\n' +
        '            opt.value = data.id;\\n' +
        '            opt.textContent = name;\\n' +
        '            s2.insertBefore(opt, s2.querySelector(\\'option[value="__new"]\\'));\\n' +
        '          });\\n' +
        '          sel.value = data.id;\\n' +
        '        } else { alert("Failed to create supplier: " + (data.error || "unknown")); sel.value = ""; }\\n' +
        '      }).catch(function(e){ alert("Network error: " + e.message); sel.value = ""; });\\n' +
        '    }\\n' +
        '  });\\n' +
        '});\\n' +
        '})();</script>';
      
      res.send(page('Sourcing - ' + rfq.rfq_number, 'rfqs', html));
    } catch(err) {
      console.error('Sourcing tab error:', err);
      res.send(page('Sourcing', 'rfqs', '<div class="alert alert-error">' + err.message + '</div>'));
    }
  });
  
  // [Rewire 5] POST /admin/rfqs/:id/sourcing/add-response - record a supplier response
  router.post('/rfqs/:id/sourcing/add-response', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const b = req.body;
      if (!b.supplier_id || !b.unit_cost || !b.rfq_line_id) {
        return res.redirect('/admin/rfqs/' + req.params.id + '/sourcing?error=Missing+required+fields');
      }
      
      // Find or create a sourcing_request for this rfq_line_id
      const srR = await pool.request().input('rli', sql.BigInt, b.rfq_line_id)
        .query('SELECT id FROM sourcing_requests WHERE rfq_line_id=@rli');
      let sourcingId;
      if (srR.recordset.length) {
        sourcingId = srR.recordset[0].id;
      } else {
        const newSr = await pool.request()
          .input('rli', sql.BigInt, b.rfq_line_id)
          .input('rid', sql.BigInt, req.params.id)
          .query('INSERT INTO sourcing_requests (rfq_line_id, rfq_id, status) OUTPUT INSERTED.id VALUES (@rli, @rid, \\'In Progress\\')');
        sourcingId = newSr.recordset[0].id;
      }
      
      await pool.request()
        .input('si', sql.BigInt, sourcingId)
        .input('rli', sql.BigInt, b.rfq_line_id)
        .input('sid', sql.BigInt, parseInt(b.supplier_id))
        .input('uc', sql.Decimal(10,2), parseFloat(b.unit_cost))
        .input('qa', sql.Int, b.quantity_available ? parseInt(b.quantity_available) : null)
        .input('cc', sql.NVarChar(5), b.condition_code || null)
        .input('lt', sql.Int, b.lead_time_days ? parseInt(b.lead_time_days) : null)
        .input('h81', sql.Bit, b.has_8130 ? 1 : 0)
        .input('hcoc', sql.Bit, b.has_coc ? 1 : 0)
        .input('htr', sql.Bit, b.has_trace ? 1 : 0)
        .input('nt', sql.NVarChar(sql.MAX), b.notes || null)
        .query('INSERT INTO sourcing_quotes (sourcing_id, rfq_line_id, supplier_id, unit_cost, quantity_available, condition_code, lead_time_days, has_8130, has_coc, has_trace, notes) VALUES (@si, @rli, @sid, @uc, @qa, @cc, @lt, @h81, @hcoc, @htr, @nt)');
      
      res.redirect('/admin/rfqs/' + req.params.id + '/sourcing?saved=1');
    } catch(err) {
      console.error('Add response error:', err);
      res.redirect('/admin/rfqs/' + req.params.id + '/sourcing?error=' + encodeURIComponent(err.message));
    }
  });
  
  // [Rewire 5] POST /admin/sourcing-quotes/:id/toggle-select - flip is_selected
  router.post('/sourcing-quotes/:id/toggle-select', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      await pool.request().input('id', sql.BigInt, req.params.id)
        .query('UPDATE sourcing_quotes SET is_selected = CASE WHEN is_selected=1 THEN 0 ELSE 1 END, updated_at=GETDATE() WHERE id=@id');
      const rfqId = req.body.rfq_id;
      res.redirect('/admin/rfqs/' + rfqId + '/sourcing?saved=1');
    } catch(err) {
      res.redirect('/admin/rfqs/' + (req.body.rfq_id || '') + '/sourcing?error=' + encodeURIComponent(err.message));
    }
  });
  
  // [Rewire 5] POST /admin/suppliers/quick-create - inline supplier creation from sourcing
  router.post('/suppliers/quick-create', async (req, res) => {
    if (!requireAuth(req, res)) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const pool = await getPool();
      const name = (req.body.company_name || '').trim();
      if (!name) return res.json({ error: 'Name required' });
      const r = await pool.request()
        .input('cn', sql.NVarChar(255), name)
        .query("INSERT INTO suppliers (company_name, status) OUTPUT INSERTED.id VALUES (@cn, 'Active')");
      res.json({ id: r.recordset[0].id, name: name });
    } catch(err) {
      res.json({ error: err.message });
    }
  });

`;

src = src.replace(mountAnchor, mountAnchor + newRoutes);
console.log('+ Sourcing routes added');

// Also add a "Sourcing" link on the RFQ detail page (button next to other actions)
// Anchor: existing "/quote-review" link/button on rfq detail page. We'll add a Sourcing button next to it.
const rfqDetailAnchor = '<a href="/admin/rfqs/${rfq.id}/quote-review"';
if (src.includes(rfqDetailAnchor)) {
  const newButtons = '<a href="/admin/rfqs/${rfq.id}/sourcing" class="btn btn-outline btn-sm" style="margin-right:6px;">\\u{1F50D} Sourcing</a>' + rfqDetailAnchor;
  src = src.replace(rfqDetailAnchor, newButtons);
  console.log('+ Sourcing link added to RFQ detail');
} else {
  console.log('  (RFQ detail anchor not found - access via direct URL /admin/rfqs/X/sourcing)');
}

fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);

try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ Patched + syntax OK');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! Syntax error - reverted');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
