import { getPool, sql } from '../db/connect.js';
import { generateNumber } from '../db/numbering.js';
import { statusBadge, currency } from './uiHelpers.js';
import { sendReturnNotification } from '../services/mailer.js';

function esc(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function returnError(err) {
  return err && err.message && err.message.includes("Invalid object name")
    ? 'Returns database migration is not installed. Run db/returns.sql first.'
    : err.message;
}

export function mountReturnRoutes(router, requireAuth, page) {
  router.get('/returns', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const result = await pool.request().query(`
        SELECT r.*, o.order_number, c.first_name + ' ' + c.last_name AS customer_name,
          (SELECT COUNT(*) FROM return_lines rl WHERE rl.return_id = r.id) AS line_count
        FROM returns r JOIN orders o ON o.id = r.order_id JOIN customers c ON c.id = r.customer_id
        ORDER BY r.created_at DESC`);
      let html = '<div class="page-title">Returns / RMAs</div><div class="page-sub">Track customer returns without rewriting the original order or invoice.</div>';
      html += '<div style="margin-bottom:16px;"><a href="/admin/returns/new" class="btn btn-gold">+ Create RMA</a></div>';
      html += '<div class="card"><table><thead><tr><th>RMA</th><th>Order</th><th>Customer</th><th>Lines</th><th>Status</th><th>Requested</th><th></th></tr></thead><tbody>';
      html += result.recordset.map(r => '<tr><td class="mono text-gold">' + esc(r.rma_number) + '</td><td><a href="/admin/orders/' + r.order_id + '" class="text-gold">' + esc(r.order_number) + '</a></td><td>' + esc(r.customer_name) + '</td><td>' + r.line_count + '</td><td>' + statusBadge(r.status) + '</td><td class="text-muted">' + new Date(r.requested_at).toLocaleDateString() + '</td><td><a href="/admin/returns/' + r.id + '" class="btn btn-outline btn-sm">Open</a></td></tr>').join('') || '<tr><td colspan="7" style="text-align:center;color:#7a8a9a;padding:20px;">No returns yet.</td></tr>';
      html += '</tbody></table></div>';
      res.send(page('Returns / RMAs', 'returns', html));
    } catch (err) { res.send(page('Returns / RMAs', 'returns', '<div class="alert alert-error">' + esc(returnError(err)) + '</div>')); }
  });

  router.get('/returns/new', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const orders = await pool.request().query("SELECT TOP 100 o.id, o.order_number, c.first_name + ' ' + c.last_name AS customer_name FROM orders o JOIN customers c ON c.id=o.customer_id WHERE EXISTS (SELECT 1 FROM order_lines ol WHERE ol.order_id=o.id AND ISNULL(ol.quantity_shipped,0)>0) ORDER BY o.confirmed_at DESC");
      const selected = parseInt(req.query.order_id) || 0;
      const draftId = parseInt(req.query.draft_id) || 0;
      let draft = null;
      const draftLines = {};
      if (draftId) {
        const draftR = await pool.request().input('id', sql.BigInt, draftId).input('orderId', sql.BigInt, selected)
          .query("SELECT id, reason, notes FROM returns WHERE id=@id AND order_id=@orderId AND status='Draft'");
        if (draftR.recordset.length) {
          draft = draftR.recordset[0];
          const draftLineR = await pool.request().input('id', sql.BigInt, draftId)
            .query('SELECT order_line_id, quantity_requested FROM return_lines WHERE return_id=@id');
          draftLineR.recordset.forEach(line => { draftLines[line.order_line_id] = line; });
        }
      }
      let html = '<div class="page-title">Create Return / RMA</div><div class="page-sub">Choose an order, then select the shipped quantities being returned.</div>';
      html += '<form method="GET" action="/admin/returns/new" class="filter-bar"><select name="order_id" required><option value="">Select order...</option>' + orders.recordset.map(o => '<option value="' + o.id + '"' + (o.id === selected ? ' selected' : '') + '>' + esc(o.order_number + ' - ' + o.customer_name) + '</option>').join('') + '</select><button class="btn btn-outline" type="submit">Load Lines</button></form>';
      if (selected) {
        const lines = await pool.request().input('id', sql.BigInt, selected).query("SELECT o.id AS order_id, o.order_number, o.customer_id, ol.id, ol.line_number, ol.nsn, ol.part_number, ol.item_name, ol.quantity_shipped, ol.unit_price FROM orders o JOIN order_lines ol ON ol.order_id=o.id WHERE o.id=@id AND ISNULL(ol.quantity_shipped,0)>0 ORDER BY ol.line_number");
        if (!lines.recordset.length) return res.send(page('Create Return / RMA', 'returns', html + '<div class="alert alert-error">No shipped lines found for this order.</div>'));
        html += '<form method="POST" action="/admin/returns/create" id="returnForm"><input type="hidden" name="order_id" value="' + selected + '"/><input type="hidden" name="return_id" value="' + (draft ? draft.id : '') + '"/><input type="hidden" name="workflow_action" id="workflowAction" value="submit"/><div class="card"><div class="card-body"><label>Reason <input type="text" name="reason" value="' + esc(draft && draft.reason) + '" placeholder="Damaged, incorrect item, customer request..." required style="width:100%;margin:6px 0 14px;"/></label><label>Notes <textarea name="notes" rows="3" style="width:100%;margin:6px 0 14px;">' + esc(draft && draft.notes) + '</textarea></label><table><thead><tr><th>Return?</th><th>Line</th><th>NSN/Part</th><th>Shipped</th><th>Qty to Return</th><th>Unit Price</th><th>Extended Price</th></tr></thead><tbody>';
        html += lines.recordset.map(l => { const dl = draftLines[l.id]; return '<tr><td><input type="checkbox" name="line_' + l.id + '_selected" value="1"' + (dl ? ' checked' : '') + '/></td><td>' + l.line_number + '<input type="hidden" name="line_' + l.id + '_id" value="' + l.id + '"/></td><td>' + esc(l.nsn || l.part_number || l.item_name) + '</td><td>' + l.quantity_shipped + '</td><td><input class="return-qty" type="number" name="line_' + l.id + '_qty" min="1" max="' + l.quantity_shipped + '" value="' + (dl ? dl.quantity_requested : 1) + '" data-unit-price="' + Number(l.unit_price || 0).toFixed(2) + '" style="width:90px;"/></td><td>' + currency(l.unit_price) + '</td><td class="return-extended" style="font-weight:600;">' + currency(dl ? dl.quantity_requested * l.unit_price : 0) + '</td></tr>'; }).join('');
        html += '</tbody></table><div id="returnPreview" style="display:none;margin-top:16px;padding:14px;background:#0a1628;border:1px solid #1e2d42;"></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;"><button type="button" class="btn btn-outline" id="previewReturn">Preview Return</button><button type="submit" class="btn btn-outline" onclick="document.getElementById(\'workflowAction\').value=\'draft\';">Save Draft</button><button type="submit" class="btn btn-gold" onclick="document.getElementById(\'workflowAction\').value=\'submit\';">Submit Return for Approval</button></div></div></div></form>';
        html += '<script>(function(){function money(n){return "$" + Number(n||0).toFixed(2);}function recalc(){var total=0;document.querySelectorAll(".return-qty").forEach(function(input){var row=input.closest("tr");var checked=row.querySelector("input[type=checkbox]").checked;var ext=checked?(Number(input.value||0)*Number(input.dataset.unitPrice||0)):0;row.querySelector(".return-extended").textContent=money(ext);total+=ext;});return total;}document.querySelectorAll(".return-qty, input[type=checkbox]").forEach(function(el){el.addEventListener("input",recalc);el.addEventListener("change",recalc);});document.getElementById("previewReturn").addEventListener("click",function(){var total=recalc(),box=document.getElementById("returnPreview"),reason=document.querySelector("input[name=reason]").value||"—";box.innerHTML="<strong>Return Preview</strong><br/>Reason: "+reason.replace(/</g,"&lt;")+"<br/><strong>Requested return total: "+money(total)+"</strong><br/><span style=\"color:#7a8a9a;font-size:.8rem;\">Preview only. Nothing is submitted until you choose Save Draft or Submit Return.</span>";box.style.display="block";});recalc();})();</script>';
      }
      res.send(page('Create Return / RMA', 'returns', html));
    } catch (err) { res.send(page('Create Return / RMA', 'returns', '<div class="alert alert-error">' + esc(returnError(err)) + '</div>')); }
  });

  router.post('/returns/create', async (req, res) => {
    if (!requireAuth(req, res)) return;
    const pool = await getPool();
    const tx = pool.transaction();
    try {
      const orderId = parseInt(req.body.order_id);
      const workflowAction = req.body.workflow_action === 'draft' ? 'draft' : 'submit';
      const existingReturnId = parseInt(req.body.return_id) || 0;
      const orderR = await pool.request().input('id', sql.BigInt, orderId).query('SELECT id, customer_id FROM orders WHERE id=@id');
      if (!orderR.recordset.length) throw new Error('Order not found');
      const selected = Object.keys(req.body).filter(k => /^line_\d+_selected$/.test(k));
      if (!selected.length) throw new Error('Select at least one shipped line');
      await tx.begin();
      let returnId;
      let rma;
      if (existingReturnId) {
        const existingR = await new sql.Request(tx).input('id', sql.BigInt, existingReturnId).input('orderId', sql.BigInt, orderId).query("SELECT id, rma_number FROM returns WHERE id=@id AND order_id=@orderId AND status='Draft'");
        if (!existingR.recordset.length) throw new Error('Draft return not found');
        returnId = existingR.recordset[0].id;
        rma = existingR.recordset[0].rma_number;
        await new sql.Request(tx).input('id', sql.BigInt, returnId).input('reason', sql.VarChar(100), req.body.reason || null).input('notes', sql.NVarChar(sql.MAX), req.body.notes || null).query('UPDATE returns SET reason=@reason, notes=@notes, updated_at=GETDATE() WHERE id=@id');
        await new sql.Request(tx).input('id', sql.BigInt, returnId).query('DELETE FROM return_lines WHERE return_id=@id');
      } else {
        rma = await generateNumber('RMA');
        const returnR = await new sql.Request(tx).input('oid', sql.BigInt, orderId).input('cid', sql.BigInt, orderR.recordset[0].customer_id).input('rma', sql.VarChar(30), rma).input('status', sql.VarChar(30), workflowAction === 'draft' ? 'Draft' : 'Requested').input('reason', sql.VarChar(100), req.body.reason || null).input('notes', sql.NVarChar(sql.MAX), req.body.notes || null).input('by', sql.BigInt, req.adminId).query("INSERT INTO returns (order_id, customer_id, rma_number, status, reason, notes, created_by) OUTPUT INSERTED.id VALUES (@oid,@cid,@rma,@status,@reason,@notes,@by)");
        returnId = returnR.recordset[0].id;
      }
      for (const key of selected) {
        const lineId = parseInt(key.match(/^line_(\d+)_selected$/)[1]);
        const qty = parseInt(req.body['line_' + lineId + '_qty']) || 0;
        const lineR = await pool.request().input('id', sql.BigInt, lineId).input('oid', sql.BigInt, orderId).query('SELECT id, quantity_shipped, unit_price FROM order_lines WHERE id=@id AND order_id=@oid');
        if (!lineR.recordset.length || qty < 1 || qty > lineR.recordset[0].quantity_shipped) throw new Error('Invalid return quantity');
        await new sql.Request(tx).input('rid', sql.BigInt, returnId).input('olid', sql.BigInt, lineId).input('qty', sql.Int, qty).input('price', sql.Decimal(10,2), lineR.recordset[0].unit_price || 0).query('INSERT INTO return_lines (return_id, order_line_id, quantity_requested, unit_price) VALUES (@rid,@olid,@qty,@price)');
      }
      await new sql.Request(tx).input('rid', sql.BigInt, returnId).input('st', sql.VarChar(30), workflowAction === 'draft' ? 'Draft' : 'Requested').input('by', sql.BigInt, req.adminId).query('INSERT INTO return_events (return_id,new_status,created_by) VALUES (@rid,@st,@by)');
      await tx.commit();
      if (workflowAction === 'submit') {
        try {
          await sendReturnNotification({ returnRecord: { id: returnId, rma_number: rma }, orderNumber: 'Order #' + orderId, phase: 'Initiated', note: req.body.reason || null });
        } catch (mailErr) { console.error('Return initiation email error:', mailErr.message); }
      }
      res.redirect('/admin/returns/' + returnId + '?saved=1');
    } catch (err) { try { await tx.rollback(); } catch (_) {} res.redirect('/admin/returns/new?order_id=' + (req.body.order_id || '') + '&error=' + encodeURIComponent(returnError(err))); }
  });

  router.get('/returns/:id', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const r = await pool.request().input('id', sql.BigInt, req.params.id).query('SELECT r.*, o.order_number, o.id AS order_id, c.first_name + \' \' + c.last_name AS customer_name FROM returns r JOIN orders o ON o.id=r.order_id JOIN customers c ON c.id=r.customer_id WHERE r.id=@id');
      if (!r.recordset.length) return res.send(page('Return', 'returns', '<div class="alert alert-error">Return not found.</div>'));
      const ret = r.recordset[0];
      const lines = await pool.request().input('id', sql.BigInt, req.params.id).query('SELECT rl.*, ol.line_number, ol.nsn, ol.part_number, ol.item_name FROM return_lines rl JOIN order_lines ol ON ol.id=rl.order_line_id WHERE rl.return_id=@id ORDER BY ol.line_number');
      const memos = await pool.request().input('id', sql.BigInt, req.params.id).query('SELECT * FROM credit_memos WHERE return_id=@id ORDER BY created_at DESC');
      let html = '<div class="page-title">' + esc(ret.rma_number) + '</div><div class="page-sub">Order <a class="text-gold" href="/admin/orders/' + ret.order_id + '">' + esc(ret.order_number) + '</a> &middot; ' + esc(ret.customer_name) + '</div>';
      if (req.query.saved) html += '<div class="alert alert-success">Saved.</div>';
      if (ret.status === 'Draft') html += '<div style="margin-bottom:16px;"><a href="/admin/returns/new?order_id=' + ret.order_id + '&draft_id=' + ret.id + '" class="btn btn-gold">Edit Draft Return</a></div>';
      html += '<div class="detail-grid"><div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">' + statusBadge(ret.status) + '</div></div><div class="detail-item"><div class="detail-label">Reason</div><div class="detail-value">' + esc(ret.reason) + '</div></div></div>';
      const requestedTotal = lines.recordset.reduce((sum, l) => sum + (Number(l.quantity_requested || 0) * Number(l.unit_price || 0)), 0);
      const approvedTotal = lines.recordset.reduce((sum, l) => sum + (Number(l.quantity_approved || 0) * Number(l.unit_price || 0)), 0);
      html += '<div class="card"><div class="card-header">Return Lines</div><table><thead><tr><th>Line</th><th>Part</th><th>Requested</th><th>Received</th><th>Approved</th><th>Unit Price</th><th>Extended Price</th><th>Condition</th><th>Disposition</th></tr></thead><tbody>';
      html += lines.recordset.map(l => '<tr><td>' + l.line_number + '</td><td>' + esc(l.nsn || l.part_number || l.item_name) + '</td><td>' + l.quantity_requested + '</td><td>' + l.quantity_received + '</td><td>' + l.quantity_approved + '</td><td>' + currency(l.unit_price) + '</td><td style="font-weight:600;">' + currency(l.quantity_requested * l.unit_price) + '</td><td>' + esc(l.condition_received) + '</td><td>' + esc(l.disposition) + '</td></tr>').join('');
      html += '</tbody></table><div style="display:flex;justify-content:flex-end;gap:24px;padding:14px 18px;border-top:1px solid #1e2d42;"><span style="color:#7a8a9a;">Requested Return: <strong style="color:#eef1f5;">' + currency(requestedTotal) + '</strong></span><span style="color:#7a8a9a;">Approved Credit: <strong style="color:#c8932a;">' + currency(approvedTotal) + '</strong></span></div></div>';
      html += '<div class="card"><div class="card-header">Workflow</div><div class="card-body"><form method="POST" action="/admin/returns/' + ret.id + '/status" class="filter-bar"><select name="status">' + ['Requested','Approved','Received','Inspected','Completed','Rejected'].map(s => '<option value="' + s + '"' + (s === ret.status ? ' selected' : '') + '>' + s + '</option>').join('') + '</select><input type="text" name="note" placeholder="Status note..."/><button class="btn btn-gold">Save Status</button></form><div style="color:#7a8a9a;font-size:.8rem;">Receiving, inspection, and disposition details will be expanded in the next workflow slice.</div></div></div>';
      html += '<div class="card"><div class="card-header">Return Documents</div><div class="card-body"><form id="returnDocForm" enctype="multipart/form-data" style="display:flex;gap:8px;align-items:end;flex-wrap:wrap;"><input type="hidden" name="related_to_type" value="return"/><input type="hidden" name="related_to_id" value="' + ret.id + '"/><input type="file" name="file" required/><select name="doc_type"><option value="Return Authorization">Return Authorization</option><option value="Customer Photos">Customer Photos</option><option value="Inspection">Inspection</option><option value="Supplier Credit">Supplier Credit</option><option value="Other">Other</option></select><input type="text" name="notes" placeholder="Notes (optional)"/><button type="button" class="btn btn-outline" onclick="uploadReturnDoc()">Upload</button></form><div id="returnDocStatus" style="margin-top:8px;font-size:.8rem;"></div><div id="returnDocList" style="margin-top:12px;color:#7a8a9a;font-size:.8rem;">Loading documents...</div></div></div>';
      html += '<script>(function(){window.loadReturnDocs=function(){fetch("/admin/api/documents/return/' + ret.id + '",{credentials:"same-origin"}).then(function(r){return r.json();}).then(function(list){var box=document.getElementById("returnDocList");if(!Array.isArray(list)||!list.length){box.textContent="No return documents uploaded.";return;}box.innerHTML=list.map(function(d){return "<div style=\"padding:6px 0;border-bottom:1px solid #1e2d42;\"><a href=\"/admin/api/documents/"+d.id+"/download\" target=\"_blank\" style=\"color:#c8932a;\">"+(d.file_name||"document")+"</a> <span style=\"color:#7a8a9a;\">"+(d.doc_type||"")+" &middot; "+(d.notes||"")+"</span></div>";}).join("");}).catch(function(){document.getElementById("returnDocList").textContent="Could not load documents.";});};window.uploadReturnDoc=function(){var form=document.getElementById("returnDocForm"),status=document.getElementById("returnDocStatus"),fd=new FormData(form);status.textContent="Uploading...";fetch("/admin/api/documents/upload",{method:"POST",credentials:"same-origin",body:fd}).then(function(r){return r.json().then(function(j){return {ok:r.ok,data:j};});}).then(function(result){if(!result.ok)throw new Error(result.data.error||"Upload failed");status.style.color="#4caf50";status.textContent="Uploaded.";form.reset();loadReturnDocs();}).catch(function(e){status.style.color="#e05050";status.textContent=e.message;});};loadReturnDocs();})();</script>';
      html += '<div class="card"><div class="card-header">Credit Memo</div><div class="card-body">' + (memos.recordset.length ? memos.recordset.map(m => '<div>' + esc(m.memo_number) + ' &middot; ' + currency(m.amount) + ' &middot; ' + statusBadge(m.status) + '</div>').join('') : '<div style="color:#7a8a9a;">No credit memo created.</div>') + '<form method="POST" action="/admin/returns/' + ret.id + '/credit-memo" style="margin-top:12px;"><button class="btn btn-outline">Create Draft Credit Memo</button></form></div></div>';
      res.send(page('Return ' + ret.rma_number, 'returns', html));
    } catch (err) { res.send(page('Return', 'returns', '<div class="alert alert-error">' + esc(returnError(err)) + '</div>')); }
  });

  router.post('/returns/:id/status', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const old = await pool.request().input('id', sql.BigInt, req.params.id).query('SELECT status FROM returns WHERE id=@id');
      if (!old.recordset.length) throw new Error('Return not found');
      const oldStatus = old.recordset[0].status;
      const nextStatus = req.body.status;
      const approver = (process.env.RETURN_APPROVER_EMAIL || process.env.ADMIN_COPY_EMAIL || 'nicolle@jupiteroneusa.com').toLowerCase();
      const currentAdmin = (req.adminEmail || '').toLowerCase();
      if (nextStatus === 'Approved' && (!approver || currentAdmin !== approver)) {
        throw new Error('Only the configured return approver can approve returns');
      }
      if (!['Requested', 'Approved', 'Rejected'].includes(nextStatus) && oldStatus !== 'Approved') {
        throw new Error('Return must be approved before it can enter this phase');
      }
      await pool.request().input('id', sql.BigInt, req.params.id).input('old', sql.VarChar(30), old.recordset[0].status).input('status', sql.VarChar(30), req.body.status).input('note', sql.NVarChar(1000), req.body.note || null).input('by', sql.BigInt, req.adminId).query('UPDATE returns SET status=@status, approved_at=CASE WHEN @status=\'Approved\' THEN ISNULL(approved_at,GETDATE()) ELSE approved_at END, received_at=CASE WHEN @status=\'Received\' THEN ISNULL(received_at,GETDATE()) ELSE received_at END, inspected_at=CASE WHEN @status=\'Inspected\' THEN ISNULL(inspected_at,GETDATE()) ELSE inspected_at END, completed_at=CASE WHEN @status=\'Completed\' THEN ISNULL(completed_at,GETDATE()) ELSE completed_at END, updated_at=GETDATE() WHERE id=@id; INSERT INTO return_events (return_id,old_status,new_status,note,created_by) VALUES (@id,@old,@status,@note,@by)');
      try {
        const info = await pool.request().input('id', sql.BigInt, req.params.id).query('SELECT r.id, r.rma_number, o.order_number, c.first_name + \' \' + c.last_name AS customer_name FROM returns r JOIN orders o ON o.id=r.order_id JOIN customers c ON c.id=r.customer_id WHERE r.id=@id');
        if (info.recordset.length) await sendReturnNotification({ returnRecord: info.recordset[0], orderNumber: info.recordset[0].order_number, customerName: info.recordset[0].customer_name, phase: nextStatus, note: req.body.note || null });
      } catch (mailErr) { console.error('Return phase email error:', mailErr.message); }
      res.redirect('/admin/returns/' + req.params.id + '?saved=1');
    } catch (err) { res.redirect('/admin/returns/' + req.params.id + '?error=' + encodeURIComponent(returnError(err))); }
  });

  router.post('/returns/:id/credit-memo', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const ret = await pool.request().input('id', sql.BigInt, req.params.id).query('SELECT return_id=id, customer_id, order_id FROM returns WHERE id=@id');
      if (!ret.recordset.length) throw new Error('Return not found');
      const amount = await pool.request().input('id', sql.BigInt, req.params.id).query('SELECT ISNULL(SUM(quantity_approved * unit_price),0) AS amount FROM return_lines WHERE return_id=@id');
      const memo = await generateNumber('CM');
      await pool.request().input('rid', sql.BigInt, req.params.id).input('cid', sql.BigInt, ret.recordset[0].customer_id).input('memo', sql.VarChar(30), memo).input('amount', sql.Decimal(12,2), amount.recordset[0].amount).input('by', sql.BigInt, req.adminId).query('INSERT INTO credit_memos (return_id,customer_id,memo_number,amount,created_by) VALUES (@rid,@cid,@memo,@amount,@by)');
      res.redirect('/admin/returns/' + req.params.id + '?saved=1');
    } catch (err) { res.redirect('/admin/returns/' + req.params.id + '?error=' + encodeURIComponent(returnError(err))); }
  });
}
