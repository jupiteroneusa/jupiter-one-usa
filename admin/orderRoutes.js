// LEAD_TIME_CHAIN_V1
// admin/orderRoutes.js
// Order detail routes for admin panel
import { getPool, sql } from '../db/connect.js';
import { generateNumber } from '../db/numbering.js';
import { renderOverviewTab } from './orderOverviewBlock.js';
import { renderShippingTab } from './orderShippingBlock.js';
import { renderProformaTab } from './orderProformaBlock.js';
import { generateProformaPdf } from '../services/proformaPdfService.js';
import { generateCcAuthPdf } from '../services/ccAuthPdfService.js';
import { generateInvoicePdf } from '../services/invoicePdfService.js'; // INVOICE_REDESIGN_v1 // CC_AUTH_PDF_v1
import crypto from 'crypto';
// PROFORMA_ROUTES_V1
import { renderPaymentTab } from './orderPaymentBlock.js';
import { renderLinesTab } from './orderLinesBlock.js';
import { logAudit, getIp } from '../middleware/audit.js'; /* AUDIT_ACTIONS_B_v1 */

// ORDER_DOCS_TAB_v1: Documents tab renderer (uses /api/documents endpoints)
function renderDocumentsTab(o) {
  var oid = o.id;
  var docTypes = ['8130 Cert','Certificate of Conformance (CoC)','Packing Slip','Supplier Quote','Supplier PO','Customer PO','Invoice','Trace Document','Other'];
  var opts = docTypes.map(function(t){ return '<option value="'+t+'">'+t+'</option>'; }).join('');
  var h = '';
  h += '<div style="font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:#c8932a;font-weight:700;margin-bottom:12px;">Documents</div>';
  h += '<div style="background:#0e1828;border:1px solid #1e2d42;border-radius:6px;padding:16px;margin-bottom:18px;">';
  h += '<div style="font-size:.8rem;color:#cfd5dc;margin-bottom:10px;">Upload a file for this order (certs, packing slips, POs, etc.)</div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">';
  h += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:4px;">File</div><input type="file" id="doc-file" style="width:100%;color:#cfd5dc;font-size:.82rem;"/></div>';
  h += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:4px;">Document Type</div><select id="doc-type" style="width:100%;">'+opts+'</select></div>';
  h += '</div>';
  h += '<div style="margin-bottom:10px;"><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:4px;">Notes (optional)</div><input type="text" id="doc-notes" placeholder="e.g. 8130 for line 2, lot 4471" style="width:100%;"/></div>';
  h += '<label style="display:flex;align-items:center;gap:8px;font-size:.8rem;color:#cfd5dc;margin-bottom:12px;cursor:pointer;"><input type="checkbox" id="doc-custvis" style="width:auto;"/> Visible to customer in their portal</label>';
  h += '<button type="button" class="btn btn-gold" id="doc-upload-btn" onclick="uploadOrderDoc('+oid+')">Upload</button>';
  h += '<span id="doc-upload-msg" style="margin-left:12px;font-size:.82rem;"></span>';
  h += '</div>';
  h += '<div id="doc-list"><div style="color:#7a8a9a;font-size:.82rem;padding:10px;">Loading documents&hellip;</div></div>';
  var js = '';
  js += 'function fmtSize(b){ if(b==null) return ""; if(b<1024) return b+" B"; if(b<1048576) return (b/1024).toFixed(0)+" KB"; return (b/1048576).toFixed(1)+" MB"; }';
  js += 'window.loadOrderDocs=function(oid){';
  js += '  fetch("/api/documents/order/"+oid,{credentials:"same-origin"}).then(function(r){return r.json();}).then(function(list){';
  js += '    var box=document.getElementById("doc-list"); if(!box) return;';
  js += '    if(!Array.isArray(list)||!list.length){ box.innerHTML="<div style=\\"color:#7a8a9a;font-size:.82rem;padding:10px;\\">No documents uploaded yet.</div>"; return; }';
  js += '    var rows=list.map(function(d){';
  js += '      var when = d.uploaded_at ? new Date(d.uploaded_at).toLocaleString() : (d.created_at ? new Date(d.created_at).toLocaleString() : "");';
  js += '      var vis = d.is_customer_visible ? "<span style=\\"color:#4caf50;font-size:.68rem;\\">customer-visible</span>" : "<span style=\\"color:#7a8a9a;font-size:.68rem;\\">internal</span>";';
  js += '      return "<tr>"+';
  js += '        "<td style=\\"padding:6px 10px;\\"><a href=\\"/api/documents/"+d.id+"/download\\" target=\\"_blank\\" style=\\"color:#c8932a;\\">"+(d.file_name||"file")+"</a></td>"+';
  js += '        "<td style=\\"padding:6px 10px;color:#cfd5dc;font-size:.8rem;\\">"+(d.doc_type||"")+"</td>"+';
  js += '        "<td style=\\"padding:6px 10px;color:#7a8a9a;font-size:.78rem;\\">"+fmtSize(d.file_size_bytes)+"</td>"+';
  js += '        "<td style=\\"padding:6px 10px;\\">"+vis+"</td>"+';
  js += '        "<td style=\\"padding:6px 10px;color:#7a8a9a;font-size:.74rem;\\">"+when+"</td>"+';
  js += '        "<td style=\\"padding:6px 10px;\\"><button type=\\"button\\" onclick=\\"deleteOrderDoc("+d.id+","+oid+")\\" style=\\"background:#3b1d1d;border:1px solid #5a2828;color:#e05050;padding:3px 8px;cursor:pointer;border-radius:3px;font-size:.72rem;\\">Delete</button></td>"+';
  js += '        "</tr>";';
  js += '    }).join("");';
  js += '    box.innerHTML="<table style=\\"width:100%;border-collapse:collapse;\\"><thead><tr style=\\"border-bottom:1px solid #1e2d42;\\"><th style=\\"text-align:left;padding:6px 10px;font-size:.68rem;color:#7a8a9a;text-transform:uppercase;\\">File</th><th style=\\"text-align:left;padding:6px 10px;font-size:.68rem;color:#7a8a9a;text-transform:uppercase;\\">Type</th><th style=\\"text-align:left;padding:6px 10px;font-size:.68rem;color:#7a8a9a;text-transform:uppercase;\\">Size</th><th style=\\"text-align:left;padding:6px 10px;font-size:.68rem;color:#7a8a9a;text-transform:uppercase;\\">Visibility</th><th style=\\"text-align:left;padding:6px 10px;font-size:.68rem;color:#7a8a9a;text-transform:uppercase;\\">Uploaded</th><th></th></tr></thead><tbody>"+rows+"</tbody></table>";';
  js += '  }).catch(function(){ var box=document.getElementById("doc-list"); if(box) box.innerHTML="<div style=\\"color:#e05050;font-size:.82rem;padding:10px;\\">Could not load documents.</div>"; });';
  js += '};';
  js += 'window.uploadOrderDoc=function(oid){';
  js += '  var f=document.getElementById("doc-file"); var msg=document.getElementById("doc-upload-msg"); var btn=document.getElementById("doc-upload-btn");';
  js += '  if(!f||!f.files||!f.files.length){ if(msg){msg.style.color="#e05050";msg.textContent="Choose a file first.";} return; }';
  js += '  var fd=new FormData(); fd.append("file",f.files[0]); fd.append("related_to_type","order"); fd.append("related_to_id",oid);';
  js += '  fd.append("doc_type",document.getElementById("doc-type").value); fd.append("notes",document.getElementById("doc-notes").value);';
  js += '  fd.append("is_customer_visible", document.getElementById("doc-custvis").checked ? "true":"false");';
  js += '  if(btn){btn.disabled=true;btn.textContent="Uploading...";} if(msg){msg.style.color="#7a8a9a";msg.textContent="";}';
  js += '  fetch("/api/documents/upload",{method:"POST",credentials:"same-origin",body:fd}).then(function(r){return r.json().then(function(j){return {ok:r.ok,j:j};});}).then(function(res){';
  js += '    if(btn){btn.disabled=false;btn.textContent="Upload";}';
  js += '    if(res.ok){ if(msg){msg.style.color="#4caf50";msg.textContent="Uploaded.";} f.value=""; document.getElementById("doc-notes").value=""; document.getElementById("doc-custvis").checked=false; window.loadOrderDocs(oid); }';
  js += '    else { if(msg){msg.style.color="#e05050";msg.textContent=(res.j&&res.j.error)?res.j.error:"Upload failed.";} }';
  js += '  }).catch(function(){ if(btn){btn.disabled=false;btn.textContent="Upload";} if(msg){msg.style.color="#e05050";msg.textContent="Network error.";} });';
  js += '};';
  js += 'window.deleteOrderDoc=function(id,oid){';
  js += '  if(!confirm("Delete this document? This cannot be undone.")) return;';
  js += '  fetch("/api/documents/"+id,{method:"DELETE",credentials:"same-origin"}).then(function(r){ if(r.ok){ window.loadOrderDocs(oid); } else { alert("Delete failed."); } }).catch(function(){ alert("Network error."); });';
  js += '};';
  js += 'window.loadOrderDocs('+oid+');';
  h += '<scr'+'ipt>(function(){' + js + '})();<\/scr'+'ipt>';
  return h;
}
// COMPLETION_GATE_v1: renders the four-track completion checklist + Mark Complete button
function renderCompletionChecklist(o, lines, invoices, pos) {
  function esc(t){ return String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  var alreadyComplete = (o.status === 'Complete' || o.status === 'Completed' || o.status === 'Closed');
  // Track 1: lines terminal (fully shipped or cancelled)
  var openLines = (lines||[]).filter(function(l){
    if ((l.status||'') === 'Cancelled') return false;
    return (l.quantity_shipped||0) < (l.quantity_ordered||0);
  });
  var t1ok = (lines && lines.length > 0) && openLines.length === 0;
  var t1msg = t1ok ? 'All lines shipped or cancelled' : (openLines.length + ' line(s) not fully shipped');
  // Track 2: money in - at least one invoice, all Paid
  var unpaidInv = (invoices||[]).filter(function(iv){ return (iv.status||'') !== 'Paid'; });
  var t2ok = (invoices && invoices.length > 0) && unpaidInv.length === 0;
  var t2msg = (!invoices || invoices.length === 0) ? 'No invoice yet' : (t2ok ? 'All invoices paid' : (unpaidInv.length + ' invoice(s) unpaid'));
  // Track 3: money out - all supplier POs terminal (Received/Paid/Closed or Cancelled)
  var openPos = (pos||[]).filter(function(p){
    var st = (p.status||'');
    return !(st === 'Paid' || st === 'Closed' || st === 'Cancelled' || st === 'Received');
  });
  var unpaidPos = (pos||[]).filter(function(p){
    var st = (p.status||'');
    return !(st === 'Paid' || st === 'Closed' || st === 'Cancelled');
  });
  var t3ok = unpaidPos.length === 0;
  var t3msg = (!pos || pos.length === 0) ? 'No supplier POs' : (t3ok ? 'All supplier POs settled' : (unpaidPos.length + ' PO(s) not yet paid/closed'));
  // Track 4: certs - every line requiring a cert has it received
  var missingCerts = (lines||[]).filter(function(l){
    if ((l.status||'') === 'Cancelled') return false;
    var need8130 = (l.cert_8130_required ? true : false) && !(l.cert_8130_received);
    var needCoc  = (l.coc_required ? true : false) && !(l.coc_received);
    return need8130 || needCoc;
  });
  var t4ok = missingCerts.length === 0;
  var t4msg = t4ok ? 'Required certs on file (or none required)' : (missingCerts.length + ' line(s) missing required certs');
  var allOk = t1ok && t2ok && t3ok && t4ok;
  function row(ok, label, msg) {
    var icon = ok ? '<span style="color:#4caf50;font-weight:700;">&#10004;</span>' : '<span style="color:#e0a050;font-weight:700;">&#9888;</span>';
    var color = ok ? '#cfd5dc' : '#e0a050';
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #16223a;">' +
      '<div style="width:20px;text-align:center;">' + icon + '</div>' +
      '<div style="flex:1;"><span style="color:#eef1f5;font-size:.86rem;">' + label + '</span>' +
      '<span style="color:' + color + ';font-size:.78rem;margin-left:8px;">' + esc(msg) + '</span></div></div>';
  }
  var h = '';
  h += '<div style="background:#0e1828;border:1px solid ' + (alreadyComplete ? '#4caf50' : (allOk ? '#4caf50' : '#1e2d42')) + ';border-radius:8px;padding:16px 18px;margin-bottom:20px;">';
  if (alreadyComplete) {
    h += '<div style="display:flex;align-items:center;gap:10px;"><span style="color:#4caf50;font-size:1.1rem;font-weight:700;">&#10004; Order Complete</span>';
    h += '<span style="color:#7a8a9a;font-size:.8rem;">' + (o.completed_at ? ('Completed ' + new Date(o.completed_at).toLocaleString()) : '') + '</span></div>';
    h += '</div>';
    return h;
  }
  h += '<div style="font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:#c8932a;font-weight:700;margin-bottom:10px;">Completion Checklist</div>';
  h += row(t1ok, 'Fulfillment', t1msg);
  h += row(t2ok, 'Payment received (money in)', t2msg);
  h += row(t3ok, 'Suppliers paid (money out)', t3msg);
  h += row(t4ok, 'Certs / documents', t4msg);
  h += '<div style="margin-top:14px;display:flex;align-items:center;gap:12px;">';
  if (allOk) {
    h += '<form method="POST" action="/admin/orders/' + o.id + '/complete" onsubmit="return confirm(\u0027Mark this order Complete? All checks passed.\u0027);" style="margin:0;">';
    h += '<button type="submit" class="btn btn-gold">&#10004; Mark Order Complete</button></form>';
    h += '<span style="color:#4caf50;font-size:.8rem;">All checks passed &mdash; ready to complete.</span>';
  } else {
    h += '<form method="POST" action="/admin/orders/' + o.id + '/complete" onsubmit="return confirm(\u0027Some checks are not complete. Mark complete anyway? The open items will be recorded.\u0027);" style="margin:0;">';
    h += '<input type="hidden" name="force" value="1"/>';
    h += '<button type="submit" class="btn btn-outline" style="border-color:#e0a050;color:#e0a050;">Mark Complete Anyway</button></form>';
    h += '<span style="color:#e0a050;font-size:.8rem;">Finish the open items above, or complete anyway (recorded).</span>';
  }
  h += '</div></div>';
  return h;
}
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
      const statuses = ['Confirmed','Processing','Ready to Ship','Partially Shipped','Shipped','Delivered','Complete','Cancelled']; /* COMPLETION_GATE_v1 */
      const statusOpts = statuses.map(function(st) { return '<option value="'+st+'"'+(o.status===st?' selected':'')+'>'+st+'</option>'; }).join('');
      function tabLink(tab, label) {
        return '<a href="/admin/orders/'+o.id+'?tab='+tab+'" style="display:inline-block;padding:8px 18px;font-size:.82rem;font-weight:600;border-bottom:2px solid '+(activeTab===tab?'#c8932a':'transparent')+';color:'+(activeTab===tab?'#c8932a':'#7a8a9a')+';text-decoration:none;white-space:nowrap;">'+label+'</a>';
      }
      let html = successMsg;
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:8px;">';
      html += '<div><div class="page-title">'+o.order_number+'</div><div class="page-sub" style="margin-bottom:0;">'+o.customer_name+' &middot; '+(o.company||'')+'</div></div>';
      html += '<a href="/admin/orders" class="btn btn-outline btn-sm">&#8592; Back</a></div>';
      html += '<div style="border-bottom:1px solid #1e2d42;margin-bottom:24px;overflow-x:auto;white-space:nowrap;">';
      html += tabLink('overview','&#128203; Overview')+tabLink('lines','&#128230; Lines')+tabLink('shipping','&#128666; Shipping') + tabLink('proforma','&#129534; Proforma')+tabLink('payment','&#128179; Payment')+tabLink('documents','&#128206; Documents'); /* ORDER_DOCS_TAB_v1 */
      html += '</div><div class="card"><div class="card-body">';
      if (activeTab === 'overview') {
        /* COMPLETION_GATE_v1: four-track completion checklist */
        try {
          const _pos = await pool.request().input('oidG', sql.BigInt, req.params.id)
            .query("SELECT status FROM supplier_pos WHERE order_id=@oidG");
          html += renderCompletionChecklist(o, oLines.recordset, invoices.recordset, _pos.recordset);
        } catch (_gateErr) { console.error('COMPLETION_GATE_v1 render:', _gateErr.message); }
        html += renderOverviewTab(o, sLog);
      } else if (activeTab === 'lines') {
        // [Rewire 4] One-click Create Supplier POs button
        const _pendingSourcesR = await pool.request().input('idCSP', sql.BigInt, req.params.id).query("SELECT COUNT(*) AS pending FROM order_line_sources ols INNER JOIN order_lines ol ON ol.id = ols.order_line_id WHERE ol.order_id=@idCSP AND ols.supplier_po_line_id IS NULL");
        const _pending = _pendingSourcesR.recordset[0].pending;
        if (_pending > 0) {
          html += '<div style="background:rgba(200,147,42,0.1);border:1px solid #c8932a;padding:14px 18px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">';
          html += '<div><div style="font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:#c8932a;font-weight:700;margin-bottom:4px;">\u26A1 Ready for Supplier POs</div>';
          html += '<div style="color:#cfd5dc;font-size:.85rem;">' + _pending + ' supplier source(s) on this order have no PO yet. One click creates Draft POs (one per supplier).</div></div>';
          // PO_BUTTON_GET_V1
          html += '<form method="GET" action="/admin/orders/' + req.params.id + '/create-supplier-pos-from-order" style="margin:0;">';
          html += '<button type="submit" class="btn btn-gold" title="Review and edit POs before commit">+ Create Supplier POs (' + _pending + ')</button>';
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
      } else if (activeTab === 'documents') {
        html += renderDocumentsTab(o);
      }
      html += '</div></div>';
      res.send(page('Order '+o.order_number, 'orders', html));
    } catch(err) {
      res.send(page('Order','orders','<div class="alert alert-error">'+err.message+'</div>'));
    }
  });

    // SOURCES_UPDATE_HANDLER_V1: save per-source edits + recompute line cost
  router.post('/orders/:id/lines/:lineId/sources-update', async (req, res) => {
    // ORDER_SOURCES_FIX_v1: full add/update/delete support, correct column names
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const b = req.body || {};
      const orderId = parseInt(req.params.id);
      const lineId = parseInt(req.params.lineId);

      // Scan submitted rows (no src_count needed). A row is "present" if
      // at minimum src_X_supplier_id is in the body (Add Source rows lack id).
      const submitted = [];
      for (let i = 0; i < 200; i++) {
        const hasId = (b['src_' + i + '_id'] !== undefined);
        const hasSup = (b['src_' + i + '_supplier_id'] !== undefined);
        if (!hasId && !hasSup) {
          // Not necessarily the end — there can be gaps. Continue scanning a few more.
          let foundAhead = false;
          for (let j = i + 1; j < i + 8 && j < 200; j++) {
            if (b['src_' + j + '_id'] !== undefined || b['src_' + j + '_supplier_id'] !== undefined) {
              foundAhead = true; break;
            }
          }
          if (!foundAhead) break;
          continue;
        }
        submitted.push({
          idx: i,
          id: hasId && b['src_' + i + '_id'] !== '' ? parseInt(b['src_' + i + '_id']) : null,
          supplier_id: parseInt(b['src_' + i + '_supplier_id']) || null,
          qty: parseInt(b['src_' + i + '_qty']) || 0,
          cost: parseFloat(b['src_' + i + '_cost']) || 0,
          lead: b['src_' + i + '_lead'] || null,
          h8: (b['src_' + i + '_8130'] === 'on' || b['src_' + i + '_8130'] === '1') ? 1 : 0,
          hc: (b['src_' + i + '_coc'] === 'on' || b['src_' + i + '_coc'] === '1') ? 1 : 0,
          ht: (b['src_' + i + '_trace'] === 'on' || b['src_' + i + '_trace'] === '1') ? 1 : 0
        });
      }

      // Validate: every row must have a supplier_id and qty > 0
      const validRows = submitted.filter(function(r){ return r.supplier_id && r.qty > 0; });
      if (validRows.length === 0) {
        return res.redirect('/admin/orders/' + orderId + '?tab=lines&error=No+sources');
      }

      // Fetch existing DB rows for this line so we know what to UPDATE/DELETE
      const existR = await pool.request().input('lineId', sql.BigInt, lineId)
        .query('SELECT id, supplier_po_line_id FROM order_line_sources WHERE order_line_id=@lineId');
      const existing = existR.recordset || [];
      const submittedIds = new Set(validRows.filter(function(r){ return r.id; }).map(function(r){ return r.id; }));

      // Determine rows to DELETE (in DB but not in submission). Skip rows that
      // already have a supplier_po_line_id — those are PO'd and protected.
      const toDelete = existing.filter(function(row){
        return !submittedIds.has(row.id) && !row.supplier_po_line_id;
      });

      // Compute totals for line cost recalc, and the next sort_order for INSERTs
      let totalQty = 0, totalCost = 0;
      const maxSortR = await pool.request().input('lineId', sql.BigInt, lineId)
        .query('SELECT ISNULL(MAX(sort_order),0) AS maxs FROM order_line_sources WHERE order_line_id=@lineId');
      let nextSort = (maxSortR.recordset[0] && maxSortR.recordset[0].maxs) || 0;

      // UPDATE / INSERT each submitted valid row
      for (let k = 0; k < validRows.length; k++) {
        const r = validRows[k];
        totalQty += r.qty;
        totalCost += r.qty * r.cost;

        if (r.id) {
          // UPDATE existing
          await pool.request()
            .input('id', sql.BigInt, r.id)
            .input('sup', sql.BigInt, r.supplier_id)
            .input('qty', sql.Int, r.qty)
            .input('cost', sql.Decimal(10, 2), r.cost)
            .input('lead', sql.NVarChar(sql.MAX), r.lead)
            .input('h8', sql.Bit, r.h8)
            .input('hc', sql.Bit, r.hc)
            .input('ht', sql.Bit, r.ht)
            .query("UPDATE order_line_sources SET supplier_id=@sup, allocated_qty=@qty, unit_cost=@cost, lead_time_text=@lead, has_8130_required=@h8, has_coc_required=@hc, has_trace_required=@ht, updated_at=GETDATE() WHERE id=@id");
        } else {
          // INSERT new (Add Source path). line_cost is COMPUTED — do not insert.
          nextSort += 1;
          await pool.request()
            .input('olId', sql.BigInt, lineId)
            .input('sup', sql.BigInt, r.supplier_id)
            .input('qty', sql.Int, r.qty)
            .input('cost', sql.Decimal(10, 2), r.cost)
            .input('lead', sql.NVarChar(sql.MAX), r.lead)
            .input('h8', sql.Bit, r.h8)
            .input('hc', sql.Bit, r.hc)
            .input('ht', sql.Bit, r.ht)
            .input('sortO', sql.Int, nextSort)
            .query("INSERT INTO order_line_sources (order_line_id, supplier_id, allocated_qty, received_qty, unit_cost, lead_time_text, has_8130_required, has_8130_received, has_coc_required, has_coc_received, has_trace_required, has_trace_received, sort_order, created_at, updated_at) VALUES (@olId, @sup, @qty, 0, @cost, @lead, @h8, 0, @hc, 0, @ht, 0, @sortO, GETDATE(), GETDATE())");
        }
      }

      // DELETE removed rows
      for (let d = 0; d < toDelete.length; d++) {
        await pool.request()
          .input('delId', sql.BigInt, toDelete[d].id)
          .query('DELETE FROM order_line_sources WHERE id=@delId');
      }

      // Recompute line's supplier_cost (weighted average across remaining sources)
      const newLineUnitCost = totalQty > 0 ? totalCost / totalQty : 0;
      await pool.request()
        .input('id', sql.BigInt, lineId)
        .input('uc', sql.Decimal(10, 2), newLineUnitCost)
        .query('UPDATE order_lines SET supplier_cost=@uc WHERE id=@id');

      const summary = 'Sources+updated+%28' + validRows.filter(function(r){return !r.id;}).length + '+added%2C+' + toDelete.length + '+removed%29';
      res.redirect('/admin/orders/' + orderId + '?tab=lines&saved=' + summary);
    } catch (err) {
      console.error('Sources update error:', err);
      res.redirect('/admin/orders/' + req.params.id + '?tab=lines&error=' + encodeURIComponent(err.message));
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

  // SHIPPING_TERMS_PERSIST_V1
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
        .input('shipTerms', sql.NVarChar(255), b.shipping_terms||null)
        .query('UPDATE orders SET shipping_cost=@shipping,total_amount=@total,ship_to_address1=@addr1,ship_to_city=@city,ship_to_state=@state,ship_to_zip=@zip,ship_to_country=@country,shipping_terms=@shipTerms,updated_at=GETDATE() WHERE id=@id');
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
      const _shipResult = await pool.request()
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
        .query("INSERT INTO shipments (order_id,shipment_number,carrier,tracking_number,tracking_url,ship_date,estimated_delivery,weight_lbs,dimensions,package_count,signature_required,insurance_value,status) OUTPUT INSERTED.id VALUES (@orderId,@shipNum,@carrier,@tracking,@trackingUrl,@shipDate,@estDelivery,@weight,@dims,@pkgs,@sigReq,@ins,'Shipped')");

      /* SHIP_UPDATES_LINES_v1: record line-level fulfillment + roll up order status */
      try {
        const _shipId = (typeof _shipResult !== 'undefined' && _shipResult.recordset && _shipResult.recordset[0]) ? _shipResult.recordset[0].id : null;
        // Lines with remaining quantity to ship
        const _invLines = []; /* PER_SHIPMENT_INVOICE_v1: collect shipped lines for invoicing */
        const _linesR = await pool.request().input('oid', sql.BigInt, req.params.id)
          .query("SELECT id, quantity_ordered, ISNULL(quantity_shipped,0) AS shipped_so_far, status, unit_price, nsn, part_number, item_name, condition_code, line_number FROM order_lines WHERE order_id=@oid AND status<>'Cancelled'");
        for (const _ln of _linesR.recordset) {
          const _remaining = (_ln.quantity_ordered || 0) - (_ln.shipped_so_far || 0);
          if (_remaining <= 0) continue;
          if (_shipId) {
            await pool.request()
              .input('sid', sql.BigInt, _shipId)
              .input('olid', sql.BigInt, _ln.id)
              .input('qty', sql.Int, _remaining)
              .query("INSERT INTO shipment_lines (shipment_id, order_line_id, quantity_shipped, created_at) VALUES (@sid, @olid, @qty, GETDATE())");
          }
          await pool.request()
            .input('olid2', sql.BigInt, _ln.id)
            .input('qty2', sql.Int, _remaining)
            .query("UPDATE order_lines SET quantity_shipped=ISNULL(quantity_shipped,0)+@qty2, status='Shipped' WHERE id=@olid2");
          _invLines.push({ order_line_id: _ln.id, qty: _remaining, unit_price: parseFloat(_ln.unit_price || 0), nsn: _ln.nsn, part_number: _ln.part_number, item_name: _ln.item_name, condition_code: _ln.condition_code, line_number: _ln.line_number }); /* PER_SHIPMENT_INVOICE_v1 */
        }
        // Roll up order status from line reality
        const _rollR = await pool.request().input('oid2', sql.BigInt, req.params.id)
          .query("SELECT COUNT(*) AS total, SUM(CASE WHEN status='Cancelled' THEN 1 ELSE 0 END) AS cancelled, SUM(CASE WHEN ISNULL(quantity_shipped,0) >= quantity_ordered THEN 1 ELSE 0 END) AS fully FROM order_lines WHERE order_id=@oid2");
        const _rr = _rollR.recordset[0] || { total:0, cancelled:0, fully:0 };
        const _active = (_rr.total || 0) - (_rr.cancelled || 0);
        const _allShipped = _active > 0 && (_rr.fully || 0) >= _active;
        if (_allShipped) {
          await pool.request().input('id', sql.BigInt, req.params.id).query("UPDATE orders SET status='Shipped', shipped_at=ISNULL(shipped_at,GETDATE()), updated_at=GETDATE() WHERE id=@id");
          await pool.request().input('id', sql.BigInt, req.params.id).query("INSERT INTO order_status_log (order_id,new_status,note) VALUES (@id,'Shipped','All lines shipped')");
        } else {
          await pool.request().input('id', sql.BigInt, req.params.id).query("UPDATE orders SET status='Partially Shipped', shipped_at=ISNULL(shipped_at,GETDATE()), updated_at=GETDATE() WHERE id=@id");
          await pool.request().input('id', sql.BigInt, req.params.id).query("INSERT INTO order_status_log (order_id,new_status,note) VALUES (@id,'Partially Shipped','Partial shipment recorded')");
        }
        /* PER_SHIPMENT_INVOICE_v1: generate an invoice for exactly what shipped in this shipment */
        if (_shipId && _invLines.length > 0) {
          try {
            const _custR = await pool.request().input('oidC', sql.BigInt, req.params.id).query("SELECT customer_id FROM orders WHERE id=@oidC");
            const _custId = _custR.recordset.length ? _custR.recordset[0].customer_id : null;
            const _subtotal = _invLines.reduce(function(sum, l){ return sum + (l.qty * l.unit_price); }, 0);
            const _invNumber = await generateNumber('INV');
            const _issue = new Date();
            const _due = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Net 30
            const _invR = await pool.request()
              .input('orderId', sql.BigInt, req.params.id)
              .input('customerId', sql.BigInt, _custId)
              .input('shipmentId', sql.BigInt, _shipId)
              .input('invNumber', sql.NVarChar(20), _invNumber)
              .input('subtotal', sql.Decimal(12,2), _subtotal)
              .input('total', sql.Decimal(12,2), _subtotal)
              .input('balance', sql.Decimal(12,2), _subtotal)
              .input('issueDate', sql.Date, _issue)
              .input('dueDate', sql.Date, _due)
              .query("INSERT INTO invoices (order_id, customer_id, shipment_id, invoice_number, subtotal, shipping_amount, total_amount, amount_paid, balance_due, status, issue_date, due_date) OUTPUT INSERTED.id VALUES (@orderId, @customerId, @shipmentId, @invNumber, @subtotal, 0, @total, 0, @balance, 'Open', @issueDate, @dueDate)");
            const _newInvId = _invR.recordset[0].id;
            for (const _il of _invLines) {
              await pool.request()
                .input('invId', sql.BigInt, _newInvId)
                .input('olId', sql.BigInt, _il.order_line_id)
                .input('lineNum', sql.Int, _il.line_number || 1)
                .input('desc', sql.NVarChar(255), _il.item_name || null)
                .input('nsn', sql.NVarChar(20), _il.nsn || null)
                .input('pn', sql.NVarChar(100), _il.part_number || null)
                .input('cond', sql.NVarChar(5), _il.condition_code || null)
                .input('qty', sql.Int, _il.qty)
                .input('price', sql.Decimal(12,2), _il.unit_price)
                .input('ltot', sql.Decimal(12,2), _il.qty * _il.unit_price)
                .query("INSERT INTO invoice_lines (invoice_id, order_line_id, line_number, description, nsn, part_number, condition_code, quantity, unit_price, line_total) VALUES (@invId, @olId, @lineNum, @desc, @nsn, @pn, @cond, @qty, @price, @ltot)");
            }
            await pool.request().input('id', sql.BigInt, req.params.id).input('inv', sql.NVarChar(20), _invNumber)
              .query("INSERT INTO order_status_log (order_id,new_status,note) VALUES (@id,'Invoice Generated', 'Invoice ' + @inv + ' generated for shipment')");
            try { await logAudit({ userType:'admin', userId:req.adminId, userEmail:req.adminEmail, action:'invoice_generated', entityType:'invoice', entityId:_newInvId, summary:'Invoice ' + _invNumber + ' generated for shipment', ipAddress:getIp(req) }); } catch(e) { console.error('audit invoice_generated:', e.message); }
          } catch (_invErr) {
            console.error('PER_SHIPMENT_INVOICE_v1 error:', _invErr.message);
          }
        }
      } catch (_shipLineErr) {
        console.error('SHIP_UPDATES_LINES_v1 error:', _shipLineErr.message);
        // Fallback: at least flip the order to Shipped as before, so behavior never regresses
        await pool.request().input('id', sql.BigInt, req.params.id).query("UPDATE orders SET status='Shipped',shipped_at=ISNULL(shipped_at,GETDATE()),updated_at=GETDATE() WHERE id=@id");
        await pool.request().input('id', sql.BigInt, req.params.id).query("INSERT INTO order_status_log (order_id,new_status,note) VALUES (@id,'Shipped','Shipment added')");
      }
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

  // COMPLETION_GATE_v1: mark order complete (forgiving; records open items if forced)
  router.post('/orders/:id/complete', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const forced = (req.body && req.body.force === '1');
      const note = forced ? 'Order marked Complete (forced - some checks were open)' : 'Order marked Complete - all checks passed';
      await pool.request().input('id', sql.BigInt, req.params.id)
        .query("UPDATE orders SET status='Complete', completed_at=ISNULL(completed_at,GETDATE()), updated_at=GETDATE() WHERE id=@id");
      await pool.request().input('id', sql.BigInt, req.params.id).input('n', sql.NVarChar(500), note)
        .query("INSERT INTO order_status_log (order_id,new_status,note) VALUES (@id,'Complete',@n)");
      try { await logAudit({ userType:'admin', userId:req.adminId, userEmail:req.adminEmail, action:'order_completed', entityType:'order', entityId:req.params.id, summary:note, ipAddress:getIp(req) }); } catch(e) { console.error('audit order_completed:', e.message); }
      res.redirect('/admin/orders/' + req.params.id + '?tab=overview&saved=1');
    } catch (err) {
      console.error('Order complete error:', err);
      res.redirect('/admin/orders/' + req.params.id + '?tab=overview&error=' + encodeURIComponent(err.message));
    }
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
      // LINE_EDIT_CASCADE_V1: update basics + cascade to invoice if exists
      const newNsn  = (b.nsn != null) ? b.nsn : null;
      const newPn   = (b.part_number != null) ? b.part_number : null;
      const newName = (b.item_name != null) ? b.item_name : null;
      const newQty  = (b.quantity_ordered != null && b.quantity_ordered !== '') ? parseInt(b.quantity_ordered) : null;
      const newPrice = (b.unit_price != null && b.unit_price !== '') ? parseFloat(b.unit_price) : null;
      const newLineTotal = (newQty != null && newPrice != null) ? (newQty * newPrice) : null;

      await pool.request()
        .input('id', sql.BigInt, req.params.lineId)
        .input('oid', sql.BigInt, req.params.id)
        .input('supId', sql.BigInt, b.supplier_id ? parseInt(b.supplier_id) : null)
        .input('supCost', sql.Decimal(10,2), b.supplier_cost ? parseFloat(b.supplier_cost) : null)
        .input('leadDays', sql.Int, b.supplier_lead_time_days ? parseInt((b.supplier_lead_time_days+'').replace(/[^0-9]/g,'')) || null : null)
        .input('nsn', sql.NVarChar(20), newNsn)
        .input('pn', sql.NVarChar(100), newPn)
        .input('nm', sql.NVarChar(255), newName)
        .input('qty', sql.Int, newQty)
        .input('price', sql.Decimal(10,2), newPrice)
        .input('ltot', sql.Decimal(12,2), newLineTotal)
        .input('lotNum', sql.NVarChar(100), b.lot_number || null)
        .input('coo', sql.NVarChar(50), b.country_of_origin || null)
        .input('rcvAt', sql.DateTime, b.received_at ? new Date(b.received_at) : null)
        .input('serials', sql.NVarChar(sql.MAX), b.serial_numbers || null)
        .input('cert8R', sql.Bit, b.cert_8130_required === '1' ? 1 : 0)
        .input('cert8G', sql.Bit, b.cert_8130_received === '1' ? 1 : 0)
        .input('cocR', sql.Bit, b.coc_required === '1' ? 1 : 0)
        .input('cocG', sql.Bit, b.coc_received === '1' ? 1 : 0)
        .query(`UPDATE order_lines SET
                supplier_id=@supId, supplier_cost=@supCost, supplier_lead_time_days=@leadDays,
                nsn = COALESCE(@nsn, nsn),
                part_number = COALESCE(@pn, part_number),
                item_name = COALESCE(@nm, item_name),
                quantity_ordered = COALESCE(@qty, quantity_ordered),
                unit_price = COALESCE(@price, unit_price),
                line_total = COALESCE(@ltot, line_total),
                lot_number=@lotNum, country_of_origin=@coo, received_at=@rcvAt, serial_numbers=@serials,
                cert_8130_required=@cert8R, cert_8130_received=@cert8G,
                coc_required=@cocR, coc_received=@cocG
              WHERE id=@id AND order_id=@oid`);

      // Cascade to invoice_lines if an invoice exists for this order
      try {
        const invR = await pool.request().input('oid', sql.BigInt, req.params.id)
          .query('SELECT id FROM invoices WHERE order_id=@oid');
        if (invR.recordset.length) {
          const invId = invR.recordset[0].id;
          await pool.request()
            .input('invId', sql.BigInt, invId)
            .input('olid', sql.BigInt, req.params.lineId)
            .input('nsn', sql.NVarChar(20), newNsn)
            .input('pn', sql.NVarChar(100), newPn)
            .input('nm', sql.NVarChar(255), newName)
            .input('qty', sql.Int, newQty)
            .input('price', sql.Decimal(10,2), newPrice)
            .input('ltot', sql.Decimal(12,2), newLineTotal)
            .query(`UPDATE invoice_lines SET
                      nsn = COALESCE(@nsn, nsn),
                      part_number = COALESCE(@pn, part_number),
                      description = COALESCE(@nm, description),
                      quantity = COALESCE(@qty, quantity),
                      unit_price = COALESCE(@price, unit_price),
                      line_total = COALESCE(@ltot, line_total)
                    WHERE invoice_id=@invId AND order_line_id=@olid`);
        }
      } catch(invCascadeErr) { console.error('Invoice line cascade error:', invCascadeErr.message); }
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
      /* PAID_IN_FULL_v1: handle due_days='paid_in_full' as zero-balance prepaid invoice */
      const dueDaysRaw = req.body.due_days || '0';
      const isPaidInFull = (dueDaysRaw === 'paid_in_full');
      const dueDays = isPaidInFull ? 0 : (parseInt(dueDaysRaw) || 0);
      const issueDate = new Date();
      const dueDate = new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000);
      const invResult = await pool.request()
        .input('orderId', sql.BigInt, req.params.id)
        .input('customerId', sql.BigInt, o.customer_id)
        .input('invNumber', sql.NVarChar(20), invoiceNumber)
        .input('subtotal', sql.Decimal(12,2), o.subtotal||0)
        .input('shipAmt', sql.Decimal(12,2), o.shipping_cost||0)
        .input('total', sql.Decimal(12,2), o.total_amount||0)
        .input('balance', sql.Decimal(12,2), isPaidInFull ? 0 : (o.total_amount || 0)) /* PAID_IN_FULL_v1 */
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
      /* PAID_IN_FULL_v1: if paid in full, mark invoice paid + record payment + mark order paid */
      if (isPaidInFull) {
        const fullAmt = parseFloat(o.total_amount || 0);
        await pool.request().input('invId', sql.BigInt, invoiceId)
          .query("UPDATE invoices SET status='Paid', balance_due=0 WHERE id=@invId");
        await pool.request()
          .input('oid', sql.BigInt, req.params.id)
          .input('iid', sql.BigInt, invoiceId)
          .input('cid', sql.BigInt, o.customer_id)
          .input('amt', sql.Decimal(12, 2), fullAmt)
          .input('pm',  sql.NVarChar(50), req.body.paid_in_full_method || 'Pre-paid')
          .input('pref',sql.NVarChar(100), req.body.paid_in_full_ref || 'Pre-payment')
          .input('rcv', sql.DateTime, issueDate)
          .input('notes', sql.NVarChar(500), 'Invoice generated as Paid in Full')
          .query('INSERT INTO payments (order_id,invoice_id,customer_id,amount,payment_method,payment_reference,received_at,notes) VALUES (@oid,@iid,@cid,@amt,@pm,@pref,@rcv,@notes)');
        await pool.request()
          .input('id', sql.BigInt, req.params.id)
          .input('paidAt', sql.DateTime, issueDate)
          .input('paidAmt', sql.Decimal(12, 2), fullAmt)
          .query("UPDATE orders SET status='Paid', paid_at=ISNULL(paid_at,@paidAt), paid_amount=@paidAmt, updated_at=GETDATE() WHERE id=@id");
      }
      let pdfBuffer = null;
      try {
        /* INVOICE_REDESIGN_v1: invoice PDF now built by services/invoicePdfService.js */
        pdfBuffer = await generateInvoicePdf(invoiceId, { notes: req.body.notes });
      } catch(pdfErr) { console.error('Invoice PDF error:', pdfErr.message); }
      try {
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.default.createTransport({ host: process.env.SMTP_HOST, port: parseInt(process.env.SMTP_PORT)||587, secure: false, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
        const emailHtml = '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;"><div style="background:#0a1628;padding:20px;border-bottom:3px solid #c8932a;"><h2 style="color:#c8932a;margin:0;">JUPITER ONE USA LLC</h2><p style="color:#aaa;margin:4px 0 0;font-size:12px;">Aerospace &amp; Defense Component Supplier</p></div><div style="background:#fff;padding:28px;"><p>Hi '+o.first_name+',</p><p>'+(isPaidInFull ? '<strong style="color:#2e7d32;">Thank you for your payment.</strong> Please find your paid invoice <strong>'+invoiceNumber+'</strong> for order <strong>'+o.order_number+'</strong> attached as your receipt.' : 'Please find your invoice <strong>'+invoiceNumber+'</strong> for order <strong>'+o.order_number+'</strong> attached.')+'</p><table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;"><tr><td style="color:#888;padding:4px 0;width:120px;">Invoice #</td><td><strong>'+invoiceNumber+'</strong></td></tr><tr><td style="color:#888;padding:4px 0;">Order #</td><td>'+o.order_number+'</td></tr><tr><td style="color:#888;padding:4px 0;">'+(isPaidInFull?'Amount Paid':'Total Due')+'</td><td style="font-weight:bold;color:'+(isPaidInFull?'#2e7d32':'#c8932a')+';font-size:1.1rem;">$'+parseFloat(o.total_amount||0).toFixed(2)+(isPaidInFull?' <span style="background:#4caf50;color:#fff;padding:2px 8px;border-radius:3px;font-size:.7rem;margin-left:6px;">PAID</span>':'')+'</td></tr><tr><td style="color:#888;padding:4px 0;">Due Date</td><td>'+dueDate.toLocaleDateString()+'</td></tr></table>'+(isPaidInFull?'<p style="font-size:13px;color:#555;">This invoice has been paid in full. If you have any questions about your order or payment, reply to this email or call (347) 821-7412.</p>':'<p style="font-size:13px;color:#555;">Payment accepted via Credit Card or Wire Transfer (3.5% CC fee). Please contact us at contact@jupiteroneusa.com to arrange payment.</p>')+'</div><div style="background:#0a1628;padding:14px 20px;"><p style="color:#555;font-size:11px;margin:0;">Jupiter One USA LLC | 400 N Tampa St, Suite 1550, Tampa FL | +1 (347) 821-7412</p></div></div>';
        const mailOpts = { from: '"Jupiter One USA" <DTorchia@jupiteroneusa.com>', to: o.email, bcc: 'DTorchia@jupiteroneusa.com', subject: (isPaidInFull ? 'PAID: Invoice ' : 'Invoice ')+invoiceNumber+' — Jupiter One USA', html: emailHtml };
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
  // PO_REVIEW_V1
  // GET review screen: shows draft POs grouped by sourced supplier, with editable
  // lines + checkboxes. User reviews, unchecks unwanted, edits qty/cost, then commits.
  router.get('/orders/:id/create-supplier-pos-from-order', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();

      const oR = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT * FROM orders WHERE id=@id');
      if (!oR.recordset.length) return res.redirect('/admin/orders/' + req.params.id + '?error=Order+not+found');
      const order = oR.recordset[0];

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
        return res.redirect('/admin/orders/' + req.params.id + '?error=No+pending+sources+to+PO+(all+already+PO%27d)');
      }

      // Group by supplier
      const bySupplier = {};
      sourcesR.recordset.forEach(function(s2) {
        if (!bySupplier[s2.supplier_id]) bySupplier[s2.supplier_id] = { name: s2.supplier_name, lines: [] };
        bySupplier[s2.supplier_id].lines.push(s2);
      });

      let html = '';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
        '<div class="page-title">Review Supplier POs</div>' +
        '<a href="/admin/orders/' + order.id + '" class="btn btn-outline btn-sm">&larr; Cancel</a></div>';
      html += '<div class="page-sub" style="margin-bottom:16px;">For order ' + order.order_number + ' &middot; Uncheck lines to exclude, edit qty/cost as needed, then commit.</div>';

      html += '<form method="POST" action="/admin/orders/' + order.id + '/create-supplier-pos-commit">';

      Object.keys(bySupplier).forEach(function(sid, supIdx) {
        const grp = bySupplier[sid];
        let grpSubtotal = 0;
        html += '<div class="card" style="margin-bottom:18px;">';
        html += '<div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">';
        html += '<div><label style="cursor:pointer;display:flex;align-items:center;gap:8px;">' +
          '<input type="checkbox" name="po_supplier_enabled_' + sid + '" value="1" checked onchange="toggleSup(' + sid + ')"/>' +
          '<span style="color:#c8932a;font-weight:700;">' + grp.name + '</span></label></div>';
        html += '<div style="font-size:.78rem;color:#7a8a9a;">' + grp.lines.length + ' line(s)</div>';
        html += '</div>';
        html += '<div class="card-body" id="sup-body-' + sid + '"><table style="width:100%;"><thead><tr>' +
          '<th style="width:30px;"></th><th>#</th><th>NSN/Part</th><th>Item</th><th>Cond</th><th>Qty</th><th>Unit Cost</th><th>Lead Time</th><th>Line Total</th>' +
          '</tr></thead><tbody>';

        grp.lines.forEach(function(l, idx) {
          const cost = parseFloat(l.unit_cost || 0);
          const qty = parseInt(l.allocated_qty || 0);
          const lineTotal = cost * qty;
          grpSubtotal += lineTotal;
          const rowKey = sid + '_' + l.id;
          html += '<tr class="sup-' + sid + '-row">';
          html += '<td><input type="checkbox" name="line_enabled_' + rowKey + '" value="1" checked onchange="recalcSup(' + sid + ')"/></td>';
          html += '<input type="hidden" name="src_id_' + rowKey + '" value="' + l.id + '"/>';
          html += '<td>' + l.oline_num + '</td>';
          html += '<td class="mono" style="font-size:.78rem;">' + (l.nsn || l.part_number || '\u2014') + '</td>';
          html += '<td style="font-size:.8rem;">' + (l.item_name || '\u2014') + '</td>';
          html += '<td>' + (l.condition_code || '\u2014') + '</td>';
          html += '<td><input type="number" name="qty_' + rowKey + '" value="' + qty + '" min="1" data-rowkey="' + rowKey + '" data-supid="' + sid + '" onchange="recalcRow(\'' + rowKey + '\',' + sid + ')" style="width:80px;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;"/></td>';
          html += '<td><input type="number" step="0.01" min="0" name="cost_' + rowKey + '" value="' + cost.toFixed(2) + '" data-rowkey="' + rowKey + '" data-supid="' + sid + '" onchange="recalcRow(\'' + rowKey + '\',' + sid + ')" style="width:100px;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;"/></td>';
          html += '<td><input type="text" name="lead_' + rowKey + '" value="' + (l.lead_time_text || '') + '" placeholder="e.g. 2-4 weeks" style="width:120px;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;font-size:.8rem;"/></td>';
          html += '<td class="line-total-' + rowKey + '" style="font-weight:600;color:#c8932a;">$' + lineTotal.toFixed(2) + '</td>';
          html += '</tr>';
        });

        html += '</tbody></table>';
        html += '<div style="text-align:right;margin-top:10px;padding-top:10px;border-top:1px solid #1e2d42;">';
        html += '<span style="color:#7a8a9a;font-size:.8rem;">Subtotal: </span>';
        html += '<span id="sup-total-' + sid + '" style="color:#c8932a;font-weight:700;font-size:1.05rem;">$' + grpSubtotal.toFixed(2) + '</span>';
        html += '</div>';

        // Shipping cost + terms for this PO
        html += '<div style="display:grid;grid-template-columns:1fr 2fr;gap:10px;margin-top:10px;padding-top:10px;border-top:1px solid #1e2d42;">';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Shipping Cost ($)</div>';
        html += '<input type="number" step="0.01" min="0" name="ship_cost_' + sid + '" value="0" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:6px 10px;"/></div>';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Shipping Terms (free text)</div>';
        html += '<input type="text" name="ship_terms_' + sid + '" placeholder="e.g. Pre-Pay and Add Ground" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:6px 10px;"/></div>';
        html += '</div>';

        // Expected delivery + notes
        html += '<div style="display:grid;grid-template-columns:1fr 2fr;gap:10px;margin-top:10px;">';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Expected Delivery</div>';
        html += '<input type="date" name="expected_delivery_' + sid + '" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:6px 10px;"/></div>';
        html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">PO Notes (optional)</div>';
        html += '<input type="text" name="notes_' + sid + '" placeholder="Optional notes for the supplier" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:6px 10px;"/></div>';
        html += '</div>';

        html += '</div></div>';
      });

      html += '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px;">';
      html += '<a href="/admin/orders/' + order.id + '" class="btn btn-outline">Cancel</a>';
      html += '<button type="submit" class="btn btn-gold">Commit Selected POs</button>';
      html += '</div></form>';

      html += '<script>';
      html += 'function toggleSup(sid){var ck=document.querySelector(\'input[name="po_supplier_enabled_\'+sid+\'"]\').checked;document.querySelectorAll(\'.sup-\'+sid+\'-row\').forEach(function(r){r.style.opacity=ck?"1":"0.4";});}';
      html += 'function recalcRow(rk,sid){var q=parseFloat(document.querySelector(\'input[name="qty_\'+rk+\'"]\').value)||0;var c=parseFloat(document.querySelector(\'input[name="cost_\'+rk+\'"]\').value)||0;document.querySelector(\'.line-total-\'+rk).textContent="$"+(q*c).toFixed(2);recalcSup(sid);}';
      html += 'function recalcSup(sid){var t=0;document.querySelectorAll(\'.sup-\'+sid+\'-row\').forEach(function(r){var ck=r.querySelector(\'input[type="checkbox"]\');if(!ck||!ck.checked)return;var inp=r.querySelector(\'input[name^="qty_"]\');var ci=r.querySelector(\'input[name^="cost_"]\');if(!inp||!ci)return;t+=(parseFloat(inp.value)||0)*(parseFloat(ci.value)||0);});document.getElementById("sup-total-"+sid).textContent="$"+t.toFixed(2);}';
      html += '</script>';

      res.send(page('Review Supplier POs', 'orders', html));
    } catch (err) {
      console.error('PO review error:', err);
      res.redirect('/admin/orders/' + req.params.id + '?error=' + encodeURIComponent(err.message));
    }
  });

  // POST commit — does the actual inserts based on what's checked
  router.post('/orders/:id/create-supplier-pos-commit', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const orderId = parseInt(req.params.id);
      const b = req.body;

      const oR = await pool.request().input('id', sql.BigInt, orderId)
        .query('SELECT * FROM orders WHERE id=@id');
      if (!oR.recordset.length) return res.redirect('/admin/orders/' + orderId + '?error=Order+not+found');
      const order = oR.recordset[0];

      // Re-fetch sources to validate IDs
      const sourcesR = await pool.request().input('oid', sql.BigInt, orderId).query(`
        SELECT ols.*, ol.line_number AS oline_num, ol.nsn, ol.part_number, ol.item_name, ol.condition_code,
               s.company_name AS supplier_name
        FROM order_line_sources ols
        INNER JOIN order_lines ol ON ol.id = ols.order_line_id
        INNER JOIN suppliers s ON s.id = ols.supplier_id
        WHERE ol.order_id = @oid AND ols.supplier_po_line_id IS NULL
        ORDER BY ols.supplier_id, ol.line_number
      `);
      if (!sourcesR.recordset.length) return res.redirect('/admin/orders/' + orderId + '?error=Nothing+pending');

      // Group by supplier with form-driven filtering
      const bySup = {};
      sourcesR.recordset.forEach(function(s2) {
        if (!bySup[s2.supplier_id]) bySup[s2.supplier_id] = { name: s2.supplier_name, lines: [] };
        bySup[s2.supplier_id].lines.push(s2);
      });

      const numberingMod = await import('../db/numbering.js');
      const generateNumber = numberingMod.generateNumber;

      const created = [];
      for (const sid of Object.keys(bySup)) {
        if (b['po_supplier_enabled_' + sid] !== '1') continue;
        const grp = bySup[sid];

        // Filter to checked lines only with form-edited qty/cost/lead
        const includedLines = [];
        for (const l of grp.lines) {
          const rk = sid + '_' + l.id;
          if (b['line_enabled_' + rk] !== '1') continue;
          const qty = parseInt(b['qty_' + rk]) || l.allocated_qty || 0;
          const cost = parseFloat(b['cost_' + rk]) || parseFloat(l.unit_cost) || 0;
          const lead = (b['lead_' + rk] || '').trim() || l.lead_time_text || null;
          includedLines.push({ src: l, qty: qty, cost: cost, lead: lead });
        }
        if (!includedLines.length) continue;

        let subtotal = 0;
        includedLines.forEach(function(il) { subtotal += il.cost * il.qty; });

        const shipCost = parseFloat(b['ship_cost_' + sid]) || 0;
        const shipTerms = (b['ship_terms_' + sid] || '').trim() || null;
        const expectedDelivery = b['expected_delivery_' + sid] || null;
        const notes = (b['notes_' + sid] || '').trim() || ('Auto-generated from order ' + order.order_number);
        const total = subtotal + shipCost;

        const poNumber = await generateNumber('PO');
        const phR = await pool.request()
          .input('oid', sql.BigInt, orderId)
          .input('sid', sql.BigInt, sid)
          .input('pn', sql.NVarChar(30), poNumber)
          .input('sub', sql.Decimal(12,2), subtotal)
          .input('ship', sql.Decimal(12,2), shipCost)
          .input('shipT', sql.NVarChar(255), shipTerms)
          .input('tot', sql.Decimal(12,2), total)
          .input('exp', sql.Date, expectedDelivery)
          .input('notes', sql.NVarChar(sql.MAX), notes)
          .query("INSERT INTO supplier_pos (order_id, supplier_id, po_number, status, subtotal, shipping_cost, shipping_terms, total, expected_delivery, notes) OUTPUT INSERTED.id VALUES (@oid, @sid, @pn, 'Draft', @sub, @ship, @shipT, @tot, @exp, @notes)");
        const poId = phR.recordset[0].id;

        let lineNum = 1;
        for (const il of includedLines) {
          const lineTotal = il.cost * il.qty;
          const polR = await pool.request()
            .input('poid', sql.BigInt, poId)
            .input('olid', sql.BigInt, il.src.order_line_id)
            .input('ln', sql.Int, lineNum++)
            .input('nsn', sql.NVarChar(20), il.src.nsn)
            .input('pn2', sql.NVarChar(100), il.src.part_number)
            .input('item', sql.NVarChar(255), il.src.item_name)
            .input('cond', sql.NVarChar(5), il.src.condition_code)
            .input('qty', sql.Int, il.qty)
            .input('cost', sql.Decimal(10,2), il.cost)
            .input('total', sql.Decimal(12,2), lineTotal)
            .input('lead', sql.Int, il.src.supplier_lead_time_days || null)
            .input('ltt', sql.NVarChar(sql.MAX), il.lead)
            .query('INSERT INTO supplier_po_lines (supplier_po_id, order_line_id, line_number, nsn, part_number, item_name, condition_code, quantity, unit_cost, line_total, expected_lead_time_days, lead_time_text) OUTPUT INSERTED.id VALUES (@poid, @olid, @ln, @nsn, @pn2, @item, @cond, @qty, @cost, @total, @lead, @ltt)');

          await pool.request()
            .input('olsId', sql.BigInt, il.src.id)
            .input('polId', sql.BigInt, polR.recordset[0].id)
            .query('UPDATE order_line_sources SET supplier_po_line_id=@polId, updated_at=GETDATE() WHERE id=@olsId');
        }

        created.push({ id: poId, number: poNumber, supplier: grp.name, line_count: includedLines.length });
      }

      if (!created.length) return res.redirect('/admin/orders/' + orderId + '?error=No+POs+selected');

      const summary = created.map(function(c) { return c.number + ' (' + c.supplier + ', ' + c.line_count + ' lines)'; }).join(', ');
      res.redirect('/admin/orders/' + orderId + '?saved=1&pos_created=' + encodeURIComponent(summary));
    } catch (err) {
      console.error('PO commit error:', err);
      res.redirect('/admin/orders/' + req.params.id + '?error=' + encodeURIComponent(err.message));
    }
  });

    // CC_AUTH_PDF_v1: GET /cc-authorizations/:id/pdf
  router.get('/cc-authorizations/:id/pdf', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const buf = await generateCcAuthPdf(parseInt(req.params.id));
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="cc-auth-' + req.params.id + '.pdf"');
      res.send(buf);
    } catch (err) {
      console.error('CC auth PDF error:', err);
      res.status(500).send('PDF generation failed: ' + err.message);
    }
  });
// PROFORMA_ROUTES_V1: Send proforma
    // ==========================================================================
  // BILL_TO_BUYER_v1: POST /orders/:id/buyer-update
  // Save optional buyer + bill-to fields on the order.
  // ==========================================================================
  router.post('/orders/:id/buyer-update', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const b = req.body;
      const trim = function(v) { return (v === undefined || v === null) ? null : (String(v).trim() || null); };
      await pool.request()
        .input('id', sql.BigInt, req.params.id)
        .input('bn',  sql.NVarChar(150), trim(b.buyer_name))
        .input('be',  sql.NVarChar(150), trim(b.buyer_email))
        .input('bp',  sql.NVarChar(30),  trim(b.buyer_phone))
        .input('ba1', sql.NVarChar(200), trim(b.bill_to_address1))
        .input('bc',  sql.NVarChar(100), trim(b.bill_to_city))
        .input('bs',  sql.NVarChar(50),  trim(b.bill_to_state))
        .input('bz',  sql.NVarChar(20),  trim(b.bill_to_zip))
        .input('bco', sql.NVarChar(50),  trim(b.bill_to_country))
        .query(`UPDATE orders SET
          buyer_name=@bn, buyer_email=@be, buyer_phone=@bp,
          bill_to_address1=@ba1, bill_to_city=@bc, bill_to_state=@bs,
          bill_to_zip=@bz, bill_to_country=@bco, updated_at=GETDATE()
          WHERE id=@id`);
      res.redirect('/admin/orders/' + req.params.id + '?tab=proforma&saved=1');
    } catch (err) {
      console.error('Buyer update error:', err);
      res.redirect('/admin/orders/' + req.params.id + '?tab=proforma&error=' + encodeURIComponent(err.message));
    }
  });

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
          '<p>Hi ' + ((o.buyer_name && String(o.buyer_name).split(/\s+/)[0]) || o.first_name) + ',</p>' /* BILL_TO_BUYER_v1 */ +
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
          '<p style="color:#555;font-size:11px;margin:0;">Jupiter One USA LLC | 400 N Tampa St, Suite 1550, Tampa FL | (347) 821-7412</p>' +
          '</div></div>';

        /* BILL_TO_BUYER_v1: route email to buyer if set, CC customer + extras */
        const _buyerEmail = (o.buyer_email && String(o.buyer_email).trim()) ? String(o.buyer_email).trim() : null;
        const _primaryTo = _buyerEmail || o.email;
        const _ccArr = [];
        if (_buyerEmail && o.email && o.email !== _buyerEmail) _ccArr.push(o.email); /* CC the customer when emailing buyer */
        if (b.cc_emails) {
          const extras = String(b.cc_emails).split(/[,;]/).map(function(s){return s.trim();}).filter(function(s){return s && s.indexOf('@') > 0;});
          for (const e of extras) if (_ccArr.indexOf(e) === -1) _ccArr.push(e);
        }
        const mailOpts = {
          from: '"Derek Torchia - Jupiter One USA" <' + (process.env.ADMIN_EMAIL || 'DTorchia@jupiteroneusa.com') + '>',
          to: _primaryTo,
          cc: _ccArr.length ? _ccArr : undefined,
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

      try { await logAudit({ userType: 'admin', userId: req.adminId, userEmail: req.adminEmail, action: 'proforma_sent', entityType: 'order', entityId: orderId, summary: 'Proforma ' + (proformaNumber || '') + ' sent', ipAddress: getIp(req) }); } catch(e) { console.error('audit proforma_sent:', e.message); }
      res.redirect('/admin/orders/' + orderId + '?tab=proforma&saved=1');
    } catch (err) {
      console.error('Send proforma error:', err);
      res.redirect('/admin/orders/' + req.params.id + '?tab=proforma&error=' + encodeURIComponent(err.message));
    }
  });


  // PROFORMA_PREVIEW_v1: side-effect-free preview (no DB row, no PF number, no email)
  router.post('/orders/:id/proforma-preview', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const b = req.body;
      const orderId = parseInt(req.params.id);
      const oR = await pool.request().input('id', sql.BigInt, orderId).query(`
        SELECT o.*, c.first_name, c.last_name, c.email, c.phone, c.company,
               o.ship_to_address1 AS bill_address1, o.ship_to_city AS bill_city,
               o.ship_to_state AS bill_state, o.ship_to_zip AS bill_zip,
               o.ship_to_country AS bill_country,
               o.buyer_name, o.buyer_email, o.buyer_phone,
               o.bill_to_address1, o.bill_to_city, o.bill_to_state, o.bill_to_zip, o.bill_to_country,
               q.quote_number
        FROM orders o
        INNER JOIN customers c ON c.id = o.customer_id
        LEFT JOIN quotes q ON q.id = o.quote_id
        WHERE o.id = @id
      `);
      if (!oR.recordset.length) return res.status(404).send('Order not found');
      const o = oR.recordset[0];

      // Mirror send-proforma totals math exactly
      const paymentMethod = b.payment_method || 'Credit Card';
      const shippingCost = parseFloat(b.shipping_cost) || 0;
      const subtotal = parseFloat(o.subtotal || 0);
      const preFeeTotal = subtotal + shippingCost;
      const ccFeePercent = (paymentMethod === 'Credit Card') ? 3.5 : 0;
      const ccFeeAmount = preFeeTotal * ccFeePercent / 100;
      const total = preFeeTotal + ccFeeAmount;

      // Build a preview pf object shaped like the saved proforma row + joined fields
      const previewPf = Object.assign({}, o, {
        order_id: orderId,
        proforma_number: 'PREVIEW',
        payment_method: paymentMethod,
        subtotal: subtotal,
        shipping_cost: shippingCost,
        cc_fee_amount: ccFeeAmount,
        cc_fee_percent: ccFeePercent,
        total: total,
        notes: b.notes || null
      });

      const pdfBuffer = await generateProformaPdf(null, previewPf);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Content-Disposition', 'inline; filename="proforma-preview.pdf"');
      res.send(pdfBuffer);
    } catch (err) {
      console.error('Proforma preview error:', err);
      res.status(500).send('Preview failed: ' + err.message);
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
