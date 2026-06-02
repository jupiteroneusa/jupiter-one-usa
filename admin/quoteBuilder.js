// SLINE_FIX_V1
// LEAD_TIME_CHAIN_V1
// admin/quoteBuilder.js
// Rewired quote builder with supplier sourcing per line + multi-source splits.
// Replaces inline GET/POST quote-review + POST quote-save handlers in admin/index.js.
//
// Mounted by admin/index.js: mountQuoteBuilder(router, requireAuth, page)
//
// Form contract:
//   lines[N][rfq_line_id]
//   lines[N][fulfillment_part]
//   lines[N][original_nsn]
//   lines[N][original_part]
//   lines[N][condition_code]
//   lines[N][item_name]
//   lines[N][quantity]                       <-- total customer-facing qty
//   lines[N][unit_price]                     <-- price to customer
//   lines[N][lead_time_text]                 <-- free-form ("5-7 days", "EST 2 weeks", ...)
//   lines[N][sources][M][supplier_id]
//   lines[N][sources][M][allocated_qty]
//   lines[N][sources][M][unit_cost]
//   lines[N][sources][M][lead_days]          <-- numeric, internal-only
//   lines[N][sources][M][has_8130]
//   lines[N][sources][M][has_coc]
//   lines[N][sources][M][has_trace]
//   lines[N][sources][M][notes]
// At least 1 source per line. SUM(allocated_qty) must equal line quantity.

import { getPool, sql } from '../db/connect.js';
import { generateNumber } from '../db/numbering.js';
import { sendQuoteToCustomer } from '../services/mailer.js';
import { generateQuotePdf } from '../services/pdfService.js';

export function mountQuoteBuilder(router, requireAuth, page) {

  // ==========================================================================
  // GET /rfqs/:id/quote-review
  // Initial blank quote builder with supplier+cost columns + split UI
  // ==========================================================================
  router.get('/rfqs/:id/quote-review', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const ctx = await loadContext(req.params.id);
      if (!ctx) return res.redirect('/admin/rfqs');
      const errMsg = req.query.error ? '<div class="alert alert-error" style="margin-bottom:14px;">' + decodeURIComponent(req.query.error) + '</div>' : '';
      res.send(page('New Quote', 'rfqs', errMsg + renderForm(ctx, null)));
    } catch (err) {
      console.error('quote-review GET error:', err);
      res.send(page('Quote Review', 'rfqs', '<div class="alert alert-error">' + err.message + '</div>'));
    }
  });

  // ==========================================================================
  // POST /rfqs/:id/quote-review
  // Review screen - re-renders the form with whatever was submitted
  // (used as a "preview / continue editing" path before final save)
  // ==========================================================================
  router.post('/rfqs/:id/quote-review', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const ctx = await loadContext(req.params.id);
      if (!ctx) return res.redirect('/admin/rfqs');
      res.send(page('Quote Review', 'rfqs', renderForm(ctx, req.body)));
    } catch (err) {
      console.error('quote-review POST error:', err);
      res.send(page('Quote Review', 'rfqs', '<div class="alert alert-error">' + err.message + '</div>'));
    }
  });

  // ==========================================================================
  // POST /rfqs/:id/quote - SAVE
  // Validates + creates quote + quote_lines + quote_line_sources atomically
  // ==========================================================================
  router.post('/rfqs/:id/quote', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const result = await saveQuote(req.params.id, req.body, req.adminId);
      res.redirect('/admin/quotes/' + result.quote_id + '?saved=1');
    } catch (err) {
      console.error('quote save error:', err);
      res.redirect('/admin/rfqs/' + req.params.id + '/quote-review?error=' + encodeURIComponent(err.message));
    }
  });


  // ==========================================================================
  // SAVE_DRAFT_v1: POST /rfqs/:id/quote-draft-full  (save in-progress work)
  // ==========================================================================
  router.post('/rfqs/:id/quote-draft-full', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const result = await saveQuoteDraftFull(req.params.id, req.body);
      res.json({ ok: true, quote_id: result.quote_id, quote_number: result.quote_number });
    } catch (err) {
      console.error('quote-draft-full save error:', err);
      res.json({ ok: false, error: err.message });
    }
  });

  // ==========================================================================
  // SAVE_DRAFT_v1: GET /rfqs/:id/quote-review-draft-full  (resume saved work)
  // ==========================================================================
  router.get('/rfqs/:id/quote-review-draft-full', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const ctx = await loadContext(req.params.id);
      if (!ctx) return res.redirect('/admin/rfqs');
      const submitted = await loadDraftAsSubmitted(req.params.id, ctx);
      if (!submitted) return res.redirect('/admin/rfqs/' + req.params.id + '/quote-review');
      const banner = '<div class="alert" style="background:rgba(76,175,80,0.1);border-color:#4caf50;color:#4caf50;margin-bottom:14px;">Resuming saved draft &mdash; ' + escHtml(submitted.__draftNumber || '') + '</div>';
      res.send(page('Resume Draft', 'rfqs', banner + renderForm(ctx, submitted)));
    } catch (err) {
      console.error('quote-review-draft-full error:', err);
      res.send(page('Resume Draft', 'rfqs', '<div class="alert alert-error">' + err.message + '</div>'));
    }
  });


  // ==========================================================================
  // INITIATE_ORDER_v1: POST /rfqs/:id/initiate-order
  // Save the quote, then create an order from it (lines + selected sourcing).
  // ==========================================================================
  router.post('/rfqs/:id/initiate-order', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const saved = await saveQuoteDraftFull(req.params.id, req.body);
      const result = await createOrderFromQuote(saved.quote_id, req.adminId);
      res.json({ ok: true, order_id: result.order_id, order_number: result.order_number });
    } catch (err) {
      console.error('initiate-order error:', err);
      res.json({ ok: false, error: err.message });
    }
  });

}

// ============================================================================
// loadContext - fetch RFQ + lines + suppliers (for dropdowns)
// ============================================================================
async function loadContext(rfqId) {
  const pool = await getPool();
  const h = await pool.request().input('id', sql.BigInt, rfqId)
    .query("SELECT h.*, c.id AS customer_id, c.first_name+' '+c.last_name AS customer_name, c.company, c.email FROM rfq_headers h JOIN customers c ON c.id=h.customer_id WHERE h.id=@id");
  if (!h.recordset.length) return null;
  const rfq = h.recordset[0];

  const dbLines = await pool.request().input('id2', sql.BigInt, rfqId)
    .query('SELECT * FROM rfq_lines WHERE rfq_id=@id2 ORDER BY line_number');

  const sup = await pool.request()
    .query("SELECT id, company_name FROM suppliers WHERE status='Active' ORDER BY company_name ASC");

  return { rfq, rfqLines: dbLines.recordset, suppliers: sup.recordset };
}

// ============================================================================
// renderForm - build the quote builder HTML
// ============================================================================
function renderForm(ctx, submitted) {
  const { rfq, rfqLines, suppliers } = ctx;
  const sub = submitted ? (submitted.lines || {}) : {};

  // Build supplier <option> string used in every dropdown
  const supplierOpts = '<option value="">-- Select supplier --</option>' +
    suppliers.map(function(s) { return '<option value="' + s.id + '">' + escHtml(s.company_name) + '</option>'; }).join('');

  // Render each RFQ line as a "line group" (parent line + 1+ source rows)
  let lineGroupsHtml = '';
  rfqLines.forEach(function(rl, lineIdx) {
    const sLine = sub[lineIdx] || {};
    const part = (sLine.fulfillment_part || rl.nsn || rl.part_number || '').toUpperCase();
    const desc = sLine.item_name || rl.item_name || '';
    const qty = parseInt(sLine.quantity || rl.quantity || 1);
    const unitPrice = sLine.unit_price || '';
    const leadText = sLine.lead_time_text || '';

    // Sources for this line - use submitted if present, else 1 blank source
    let sources = [];
    if (sLine.sources) {
      sources = Object.values(sLine.sources);
    }
    if (sources.length === 0) {
      sources = [{ supplier_id: '', allocated_qty: qty, unit_cost: '', lead_days: '', has_8130: '', has_coc: '', has_trace: '', notes: '' }];
    }

    lineGroupsHtml += '<div class="line-group" data-line-idx="' + lineIdx + '" data-line-num="' + rl.line_number + '" style="border:1px solid #1e2d42;background:#0a1628;margin-bottom:14px;">';

    // Header (customer-facing fields)
    lineGroupsHtml += '<div style="padding:12px;background:#111e30;border-bottom:1px solid #1e2d42;">';
    lineGroupsHtml += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">';
    lineGroupsHtml += '<div style="font-weight:700;color:#c8932a;font-size:.9rem;">Line ' + rl.line_number + '</div>';
    lineGroupsHtml += '<div style="font-size:.7rem;color:#7a8a9a;">Customer requested: ' + escHtml(rl.nsn || rl.part_number || '\u2014') + '</div>';
    lineGroupsHtml += '</div>';

    // Hidden fields for line meta
    lineGroupsHtml += '<input type="hidden" name="lines[' + lineIdx + '][rfq_line_id]" value="' + rl.id + '"/>';
    lineGroupsHtml += '<input type="hidden" name="lines[' + lineIdx + '][original_nsn]" value="' + escAttr(rl.nsn || '') + '"/>';
    lineGroupsHtml += '<input type="hidden" name="lines[' + lineIdx + '][original_part]" value="' + escAttr(rl.part_number || '') + '"/>';
    lineGroupsHtml += '<input type="hidden" name="lines[' + lineIdx + '][condition_code]" value="' + escAttr(rl.condition_code || 'NE') + '"/>';

    // Customer-facing inputs grid
    lineGroupsHtml += '<div style="display:grid;grid-template-columns:170px 1fr 80px 110px 130px;gap:8px;align-items:end;">';
    lineGroupsHtml += inputCell('NSN/Part #', 'lines[' + lineIdx + '][fulfillment_part]', part, 'text', 'style="text-transform:uppercase;font-family:monospace;color:#c8932a;" oninput="this.value=this.value.toUpperCase()"');
    lineGroupsHtml += inputCell('Description', 'lines[' + lineIdx + '][item_name]', desc, 'text', '');
    lineGroupsHtml += inputCell('Qty', 'lines[' + lineIdx + '][quantity]', qty, 'number', 'min="1" required class="line-qty" data-line-idx="' + lineIdx + '" oninput="recalcLine(' + lineIdx + ')"');
    lineGroupsHtml += inputCell('Unit Price ($)', 'lines[' + lineIdx + '][unit_price]', unitPrice, 'number', 'step="0.01" min="0" required class="line-price" data-line-idx="' + lineIdx + '" oninput="recalcLine(' + lineIdx + ')"');
    lineGroupsHtml += inputCell('Lead Time (customer)', 'lines[' + lineIdx + '][lead_time_text]', leadText, 'text', 'placeholder="e.g. 7-10 days"');
    lineGroupsHtml += '</div>';

    // Margin display for this line
    lineGroupsHtml += '<div class="line-margin" data-line-idx="' + lineIdx + '" style="margin-top:8px;font-size:.78rem;color:#7a8a9a;">' +
      '<span class="margin-label">Margin: <span class="margin-pct">--</span></span>' +
      '<span style="margin-left:14px;">Total Cost: <span class="margin-cost">$0.00</span></span>' +
      '<span style="margin-left:14px;">Line Total: <span class="margin-total">$0.00</span></span>' +
      '<span style="margin-left:14px;">Margin $: <span class="margin-amount">$0.00</span></span>' +
      '</div>';

    lineGroupsHtml += '</div>'; // end header

    // Sources sub-table
    lineGroupsHtml += '<div style="padding:10px 12px 14px;">';
    lineGroupsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
    lineGroupsHtml += '<div style="font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:#c8932a;font-weight:700;">Sources (Internal Only)</div>';
    lineGroupsHtml += '<div style="font-size:.7rem;color:#7a8a9a;">Sum allocated qty must equal line qty <span class="alloc-status" data-line-idx="' + lineIdx + '"></span></div>';
    lineGroupsHtml += '</div>';

    lineGroupsHtml += '<table style="width:100%;font-size:.82rem;"><thead><tr style="text-align:left;">' +
      '<th style="padding:4px 6px;color:#7a8a9a;font-size:.65rem;letter-spacing:.1em;">SUPPLIER</th>' +
      '<th style="padding:4px 6px;color:#7a8a9a;font-size:.65rem;width:70px;">QTY</th>' +
      '<th style="padding:4px 6px;color:#7a8a9a;font-size:.65rem;width:90px;">COST ($)</th>' +
      '<th style="padding:4px 6px;color:#7a8a9a;font-size:.65rem;width:80px;">LEAD (d)</th>' +
      '<th style="padding:4px 6px;color:#7a8a9a;font-size:.65rem;width:60px;text-align:center;">8130</th>' +
      '<th style="padding:4px 6px;color:#7a8a9a;font-size:.65rem;width:50px;text-align:center;">CoC</th>' +
      '<th style="padding:4px 6px;color:#7a8a9a;font-size:.65rem;width:60px;text-align:center;">Trace</th>' +
      '<th style="padding:4px 6px;color:#7a8a9a;font-size:.65rem;">NOTES</th>' +
      '<th style="padding:4px 6px;color:#c8932a;font-size:.65rem;width:50px;text-align:center;font-weight:700;">USE?</th>' +
      '<th style="padding:4px 6px;width:30px;"></th>' +
      '</tr></thead><tbody class="sources-tbody" data-line-idx="' + lineIdx + '">';

    sources.forEach(function(s, sIdx) {
      lineGroupsHtml += renderSourceRow(lineIdx, sIdx, s, supplierOpts);
    });

    lineGroupsHtml += '</tbody></table>';
    lineGroupsHtml += '<button type="button" class="btn btn-outline btn-sm" style="margin-top:8px;font-size:.75rem;" onclick="addSource(' + lineIdx + ')">+ Split: Add Another Supplier</button>';
    lineGroupsHtml += '</div>'; // end sources section

    lineGroupsHtml += '</div>'; // end line-group
  });

  // Header values (customer-facing quote settings)
  const pt = (submitted && submitted.payment_terms) || 'Credit Card or Wire Transfer';
  const vd = (submitted && submitted.valid_days) || 30;
  const nt = (submitted && submitted.notes) || '';
  const pm = (submitted && submitted.personal_message) || '';
  const cc = (submitted && submitted.cc_emails) || '';

  // Top of form
  let html = '';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
  html += '<div class="page-title">New Quote &mdash; ' + escHtml(rfq.rfq_number) + '</div>';
  html += '<a href="/admin/rfqs/' + rfq.id + '" class="btn btn-outline btn-sm">&larr; Back to RFQ</a></div>';
  html += '<div class="page-sub">Build quote with internal supplier sourcing &middot; customer never sees sources/costs</div>';

  html += '<div class="detail-grid" style="margin-bottom:20px;">';
  html += '<div class="detail-item"><div class="detail-label">Customer</div><div class="detail-value"><a href="/admin/customers/' + rfq.customer_id + '" style="color:#c8932a;">' + escHtml(rfq.customer_name) + '</a></div></div>';
  html += '<div class="detail-item"><div class="detail-label">Company</div><div class="detail-value">' + escHtml(rfq.company || '\u2014') + '</div></div>';
  html += '<div class="detail-item"><div class="detail-label">Email</div><div class="detail-value"><a href="mailto:' + escAttr(rfq.email) + '" style="color:#c8932a;">' + escHtml(rfq.email) + '</a></div></div>';
  html += '<div class="detail-item"><div class="detail-label">RFQ #</div><div class="detail-value">' + escHtml(rfq.rfq_number) + '</div></div>';
  html += '</div>';

  html += '<form id="quote-send-form" method="POST" action="/admin/rfqs/' + rfq.id + '/quote">';

  html += '<div class="card" style="margin-bottom:20px;"><div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">' +
    '<span>Line Items</span>' +
    '<span style="font-size:.72rem;color:#7a8a9a;font-weight:400;">Each line tracks its own supplier source(s) internally</span>' +
    '</div>' +
    '<div class="card-body" style="padding:14px;">' + lineGroupsHtml + '</div></div>';

  // Footer fields
  html += '<div class="card" style="margin-bottom:20px;"><div class="card-header">Quote Settings (Customer-Facing)</div><div class="card-body">';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">';
  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Payment Terms</div><input type="text" name="payment_terms" value="' + escAttr(pt) + '" style="width:100%;"/></div>';
  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Valid Days</div><input type="number" name="valid_days" value="' + escAttr(vd) + '" style="width:100%;"/></div></div>';
  html += '<div style="margin-bottom:12px;"><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Terms / Notes</div><textarea name="notes" rows="3" style="width:100%;">' + escHtml(nt) + '</textarea></div>';
  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Personal Message <span style="color:#555;">(optional &mdash; shown at top of email)</span></div>';
  html += '<textarea name="personal_message" rows="3" style="width:100%;border-color:#c8932a;" placeholder="Hi, great speaking with you...">' + escHtml(pm) + '</textarea></div>';
  html += '<div style="margin-top:12px;"><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Additional Recipients</div><input type="text" name="cc_emails" value="' + escAttr(cc) + '" placeholder="e.g. john@co.com, jane@co.com" style="width:100%;"/></div>';
  html += '<div style="margin-top:12px;display:flex;align-items:center;gap:8px;"><input type="checkbox" name="attach_pdf" id="attach_pdf" value="1" style="width:auto;accent-color:#c8932a;"/><label for="attach_pdf" style="font-size:.85rem;cursor:pointer;">Attach quote as PDF</label></div>';
  html += '</div></div>';

  html += '<div style="display:flex;gap:10px;">';
  html += '<button type="submit" class="btn btn-gold" style="padding:12px 28px;">Save &amp; Send Quote &rarr;</button>';
  html += '<button type="button" id="save-draft-btn" class="btn btn-outline" style="padding:12px 20px;border-color:#4caf50;color:#4caf50;" onclick="saveDraftFull()">Save</button>';
  html += '<button type="button" id="initiate-order-btn" class="btn" style="padding:12px 22px;background:#1d9e75;color:#fff;border:none;" onclick="initiateOrder()">Initiate Sales Order &rarr;</button>';
  html += '<button type="button" id="preview-pdf-btn" class="btn btn-outline" style="padding:12px 20px;border-color:#c8932a;color:#c8932a;" onclick="previewQuotePdf()">Preview PDF</button>';
  html += '<a href="/admin/rfqs/' + rfq.id + '" class="btn btn-outline" style="padding:12px 20px;">Cancel</a>';
  html += '</div>';
  html += '</form>';

  // Embed supplier opts as a hidden datalist for client-side row creation
  html += '<select id="supplier-template" style="display:none;">' + supplierOpts + '</select>';

  // Client-side scripts: add/remove sources, recalc margins, validate sums on submit
  html += renderClientScript(rfqLines.length);
  html += '<script>(function(){window.previewQuotePdf=function(){var f=document.getElementById("quote-send-form");if(!f)return;var b=document.getElementById("preview-pdf-btn");if(b){b.textContent="Generating...";b.disabled=true;}var fd=new URLSearchParams(new FormData(f));fetch("/admin/rfqs/' + rfq.id + '/quote-draft-full",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:fd.toString()}).then(function(r){return r.json();}).then(function(j){if(b){b.textContent="Preview PDF";b.disabled=false;}if(j.ok&&j.quote_id){window.open("/admin/quotes/"+j.quote_id+"/pdf-view","_blank");}else{alert(j.error||"Could not generate preview");}}).catch(function(){if(b){b.textContent="Preview PDF";b.disabled=false;}alert("Network error generating preview");});};})();</scr'+'ipt>';
  html += '<script>(function(){window.initiateOrder=function(){if(!confirm("Create a sales order from this quote? You can change suppliers and details on the order afterward."))return;var f=document.getElementById("quote-send-form");if(!f)return;var b=document.getElementById("initiate-order-btn");if(b){b.textContent="Creating order...";b.disabled=true;}var fd=new URLSearchParams(new FormData(f));fetch("/admin/rfqs/' + rfq.id + '/initiate-order",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:fd.toString()}).then(function(r){return r.json();}).then(function(j){if(j.ok&&j.order_id){window.__skipUnload=true;window.location="/admin/orders/"+j.order_id;}else{alert(j.error||"Failed to create order");if(b){b.textContent="Initiate Sales Order \u2192";b.disabled=false;}}}).catch(function(){alert("Network error creating order");if(b){b.textContent="Initiate Sales Order \u2192";b.disabled=false;}});};})();</scr'+'ipt>';
  html += '<script>(function(){var d=false;document.querySelectorAll("#quote-send-form input,#quote-send-form select,#quote-send-form textarea").forEach(function(el){el.addEventListener("input",function(){d=true;});el.addEventListener("change",function(){d=true;});});window.saveDraftFull=function(){var f=document.getElementById("quote-send-form");if(!f)return;var fd=new URLSearchParams(new FormData(f));var b=document.getElementById("save-draft-btn");if(b){b.textContent="Saving...";}fetch("/admin/rfqs/' + rfq.id + '/quote-draft-full",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:fd.toString()}).then(function(r){return r.json();}).then(function(j){d=false;if(b){b.textContent=j.ok?"Draft Saved \u2713":"Save Failed";b.style.color=j.ok?"#4caf50":"#e05050";setTimeout(function(){b.textContent="Save Draft";b.style.color="#4caf50";},2500);}}).catch(function(){if(b){b.textContent="Save Failed";b.style.color="#e05050";}});};var ff=document.getElementById("quote-send-form");if(ff){ff.addEventListener("submit",function(){d=false;});}window.addEventListener("beforeunload",function(e){if(d&&!window.__skipUnload){e.preventDefault();e.returnValue="";}});})();</scr'+'ipt>';

  return html;
}

// ============================================================================
// renderSourceRow - one row of the per-line sources table
// ============================================================================
function renderSourceRow(lineIdx, sIdx, s, supplierOpts) {
  const sid = s.supplier_id || '';
  const qty = s.allocated_qty || '';
  const cost = s.unit_cost || '';
  const lead = s.lead_days || '';
  const has8130 = s.has_8130 ? 'checked' : '';
  const hasCoc = s.has_coc ? 'checked' : '';
  const hasTrace = s.has_trace ? 'checked' : '';
  const notes = s.notes || '';

  // Build dropdown with this row's supplier preselected
  let dd = '<option value="">-- Select --</option>';
  // Re-parse supplierOpts to add 'selected' to the matching one
  // (cheaper than re-building from suppliers array - just text replace)
  const selectedOpts = supplierOpts.replace('value="' + sid + '"', 'value="' + sid + '" selected').replace('-- Select supplier --', '-- Select --');

  let html = '<tr class="source-row" data-line-idx="' + lineIdx + '" data-source-idx="' + sIdx + '">';
  html += '<td style="padding:4px 6px;"><select name="lines[' + lineIdx + '][sources][' + sIdx + '][supplier_id]" required style="width:100%;font-size:.82rem;">' + selectedOpts + '</select></td>';
  html += '<td style="padding:4px 6px;"><input type="number" min="1" required name="lines[' + lineIdx + '][sources][' + sIdx + '][allocated_qty]" value="' + escAttr(qty) + '" class="src-qty" data-line-idx="' + lineIdx + '" oninput="recalcLine(' + lineIdx + ')" style="width:100%;font-size:.82rem;"/></td>';
  html += '<td style="padding:4px 6px;"><input type="number" step="0.01" min="0" required name="lines[' + lineIdx + '][sources][' + sIdx + '][unit_cost]" value="' + escAttr(cost) + '" class="src-cost" data-line-idx="' + lineIdx + '" oninput="recalcLine(' + lineIdx + ')" style="width:100%;font-size:.82rem;"/></td>';
  html += '<td style="padding:4px 6px;"><input type="number" min="0" name="lines[' + lineIdx + '][sources][' + sIdx + '][lead_days]" value="' + escAttr(lead) + '" placeholder="days" style="width:100%;font-size:.82rem;"/></td>';
  html += '<td style="padding:4px 6px;text-align:center;"><input type="checkbox" name="lines[' + lineIdx + '][sources][' + sIdx + '][has_8130]" value="1" ' + has8130 + ' style="accent-color:#c8932a;"/></td>';
  html += '<td style="padding:4px 6px;text-align:center;"><input type="checkbox" name="lines[' + lineIdx + '][sources][' + sIdx + '][has_coc]" value="1" ' + hasCoc + ' style="accent-color:#c8932a;"/></td>';
  html += '<td style="padding:4px 6px;text-align:center;"><input type="checkbox" name="lines[' + lineIdx + '][sources][' + sIdx + '][has_trace]" value="1" ' + hasTrace + ' style="accent-color:#c8932a;"/></td>';
  html += '<td style="padding:4px 6px;"><input type="text" name="lines[' + lineIdx + '][sources][' + sIdx + '][notes]" value="' + escAttr(notes) + '" style="width:100%;font-size:.78rem;" placeholder="optional"/></td>';
  // [Rewire 7] USE checkbox - default checked
  const _isUsed = (s.is_selected === undefined || s.is_selected === null) ? true : !!s.is_selected;
  html += '<td style="padding:4px 6px;text-align:center;"><input type="checkbox" name="lines[' + lineIdx + '][sources][' + sIdx + '][is_selected]" value="1" ' + (_isUsed ? 'checked' : '') + ' class="src-use" data-line-idx="' + lineIdx + '" onchange="recalcLine(' + lineIdx + ')" style="accent-color:#4caf50;width:18px;height:18px;"/></td>';
  html += '<td style="padding:4px 6px;text-align:center;"><button type="button" onclick="removeSource(this, ' + lineIdx + ')" class="btn btn-outline btn-sm" style="color:#e05050;font-size:.7rem;padding:2px 6px;">X</button></td>';
  html += '</tr>';
  return html;
}

// ============================================================================
// renderClientScript - JS for: addSource, removeSource, recalcLine, validateSubmit
// ============================================================================
function renderClientScript(lineCount) {
  return '<script>\n' +
'  (function(){\n' +
'    var supplierTemplate = document.getElementById("supplier-template").innerHTML;\n' +
'    var nextSourceIdx = {};\n' +
'    for (var i=0; i<' + lineCount + '; i++) {\n' +
'      var tbody = document.querySelector(".sources-tbody[data-line-idx=\\""+i+"\\"]");\n' +
'      nextSourceIdx[i] = tbody ? tbody.querySelectorAll("tr.source-row").length : 1;\n' +
'    }\n' +
'\n' +
'    window.addSource = function(lineIdx) {\n' +
'      var tbody = document.querySelector(".sources-tbody[data-line-idx=\\""+lineIdx+"\\"]");\n' +
'      if (!tbody) return;\n' +
'      var sIdx = nextSourceIdx[lineIdx]++;\n' +
'      var tr = document.createElement("tr");\n' +
'      tr.className = "source-row";\n' +
'      tr.setAttribute("data-line-idx", lineIdx);\n' +
'      tr.setAttribute("data-source-idx", sIdx);\n' +
'      tr.innerHTML =\n' +
'        \'<td style="padding:4px 6px;"><select name="lines[\'+lineIdx+\'][sources][\'+sIdx+\'][supplier_id]" required style="width:100%;font-size:.82rem;">\'+supplierTemplate+\'</select></td>\' +\n' +
'        \'<td style="padding:4px 6px;"><input type="number" min="1" required name="lines[\'+lineIdx+\'][sources][\'+sIdx+\'][allocated_qty]" class="src-qty" data-line-idx="\'+lineIdx+\'" oninput="recalcLine(\'+lineIdx+\')" style="width:100%;font-size:.82rem;"/></td>\' +\n' +
'        \'<td style="padding:4px 6px;"><input type="number" step="0.01" min="0" required name="lines[\'+lineIdx+\'][sources][\'+sIdx+\'][unit_cost]" class="src-cost" data-line-idx="\'+lineIdx+\'" oninput="recalcLine(\'+lineIdx+\')" style="width:100%;font-size:.82rem;"/></td>\' +\n' +
'        \'<td style="padding:4px 6px;"><input type="number" min="0" name="lines[\'+lineIdx+\'][sources][\'+sIdx+\'][lead_days]" placeholder="days" style="width:100%;font-size:.82rem;"/></td>\' +\n' +
'        \'<td style="padding:4px 6px;text-align:center;"><input type="checkbox" name="lines[\'+lineIdx+\'][sources][\'+sIdx+\'][has_8130]" value="1" style="accent-color:#c8932a;"/></td>\' +\n' +
'        \'<td style="padding:4px 6px;text-align:center;"><input type="checkbox" name="lines[\'+lineIdx+\'][sources][\'+sIdx+\'][has_coc]" value="1" style="accent-color:#c8932a;"/></td>\' +\n' +
'        \'<td style="padding:4px 6px;text-align:center;"><input type="checkbox" name="lines[\'+lineIdx+\'][sources][\'+sIdx+\'][has_trace]" value="1" style="accent-color:#c8932a;"/></td>\' +\n' +
'        \'<td style="padding:4px 6px;"><input type="text" name="lines[\'+lineIdx+\'][sources][\'+sIdx+\'][notes]" style="width:100%;font-size:.78rem;" placeholder="optional"/></td>\' +\n' +
'        \'<td style="padding:4px 6px;text-align:center;"><input type="checkbox" name="lines[\'+lineIdx+\'][sources][\'+sIdx+\'][is_selected]" value="1" checked class="src-use" data-line-idx="\'+lineIdx+\'" onchange="recalcLine(\'+lineIdx+\')" style="accent-color:#4caf50;width:18px;height:18px;"/></td>\' +\n' +
'        \'<td style="padding:4px 6px;text-align:center;"><button type="button" onclick="removeSource(this, \'+lineIdx+\')" class="btn btn-outline btn-sm" style="color:#e05050;font-size:.7rem;padding:2px 6px;">X</button></td>\';\n' +
'      tbody.appendChild(tr);\n' +
'      recalcLine(lineIdx);\n' +
'    };\n' +
'\n' +
'    window.removeSource = function(btn, lineIdx) {\n' +
'      var tbody = document.querySelector(".sources-tbody[data-line-idx=\\""+lineIdx+"\\"]");\n' +
'      if (tbody && tbody.querySelectorAll("tr.source-row").length > 1) {\n' +
'        btn.closest("tr").remove();\n' +
'        recalcLine(lineIdx);\n' +
'      } else {\n' +
'        alert("Each line must have at least one supplier source.");\n' +
'      }\n' +
'    };\n' +
'\n' +
'    window.recalcLine = function(lineIdx) {\n' +
'      var qtyInput = document.querySelector(".line-qty[data-line-idx=\\""+lineIdx+"\\"]");\n' +
'      var priceInput = document.querySelector(".line-price[data-line-idx=\\""+lineIdx+"\\"]");\n' +
'      var marginBox = document.querySelector(".line-margin[data-line-idx=\\""+lineIdx+"\\"]");\n' +
'      var allocStatus = document.querySelector(".alloc-status[data-line-idx=\\""+lineIdx+"\\"]");\n' +
'      if (!qtyInput || !priceInput || !marginBox) return;\n' +
'\n' +
'      var lineQty = parseFloat(qtyInput.value) || 0;\n' +
'      var unitPrice = parseFloat(priceInput.value) || 0;\n' +
'      var lineTotal = lineQty * unitPrice;\n' +
'\n' +
'      var srcQtys = document.querySelectorAll(".src-qty[data-line-idx=\\""+lineIdx+"\\"]");\n' +
'      var srcCosts = document.querySelectorAll(".src-cost[data-line-idx=\\""+lineIdx+"\\"]");\n' +
'      var srcUses = document.querySelectorAll(".src-use[data-line-idx=\\""+lineIdx+"\\"]");\n' +
'      var totalAlloc = 0, totalCost = 0;\n' +
'      for (var i=0; i<srcQtys.length; i++) {\n' +
'        var isUsed = srcUses[i] ? srcUses[i].checked : true;\n' +
'        if (!isUsed) continue;\n' +
'        var q = parseFloat(srcQtys[i].value) || 0;\n' +
'        var c = parseFloat(srcCosts[i].value) || 0;\n' +
'        totalAlloc += q;\n' +
'        totalCost += q * c;\n' +
'      }\n' +
'\n' +
'      // Margin display\n' +
'      var marginAmt = lineTotal - totalCost;\n' +
'      var marginPct = lineTotal > 0 ? (marginAmt / lineTotal * 100) : 0;\n' +
'      var pctEl = marginBox.querySelector(".margin-pct");\n' +
'      var costEl = marginBox.querySelector(".margin-cost");\n' +
'      var totEl = marginBox.querySelector(".margin-total");\n' +
'      var amtEl = marginBox.querySelector(".margin-amount");\n' +
'      pctEl.textContent = marginPct.toFixed(1) + "%";\n' +
'      pctEl.style.color = marginPct < 0 ? "#e05050" : (marginPct < 10 ? "#c8932a" : "#4caf50");\n' +
'      pctEl.style.fontWeight = "700";\n' +
'      costEl.textContent = "$" + totalCost.toFixed(2);\n' +
'      totEl.textContent = "$" + lineTotal.toFixed(2);\n' +
'      amtEl.textContent = "$" + marginAmt.toFixed(2);\n' +
'\n' +
'      // Allocation status\n' +
'      if (allocStatus) {\n' +
'        if (lineQty === 0) {\n' +
'          allocStatus.textContent = "";\n' +
'        } else if (totalAlloc === lineQty) {\n' +
'          allocStatus.innerHTML = \' <span style="color:#4caf50;">\\u2713 \' + totalAlloc + \'/\' + lineQty + \'</span>\';\n' +
'        } else {\n' +
'          allocStatus.innerHTML = \' <span style="color:#e05050;">\\u26A0 \' + totalAlloc + \'/\' + lineQty + \'</span>\';\n' +
'        }\n' +
'      }\n' +
'    };\n' +
'\n' +
'    // On submit: validate every line has SUM(allocated_qty) === quantity\n' +
'    var form = document.getElementById("quote-send-form");\n' +
'    if (form) {\n' +
'      form.addEventListener("submit", function(e){\n' +
'        var groups = document.querySelectorAll(".line-group");\n' +
'        for (var i=0; i<groups.length; i++) {\n' +
'          var lineIdx = groups[i].getAttribute("data-line-idx");\n' +
'          var lineNum = groups[i].getAttribute("data-line-num");\n' +
'          var qtyInput = document.querySelector(".line-qty[data-line-idx=\\""+lineIdx+"\\"]");\n' +
'          var lineQty = parseFloat(qtyInput.value) || 0;\n' +
'          var srcQtys = document.querySelectorAll(".src-qty[data-line-idx=\\""+lineIdx+"\\"]");\n' +
'          var srcUses = document.querySelectorAll(".src-use[data-line-idx=\\""+lineIdx+"\\"]");\n' +
'          var totalAlloc = 0;\n' +
'          for (var j=0; j<srcQtys.length; j++) {\n' +
'            var isUsed = srcUses[j] ? srcUses[j].checked : true;\n' +
'            if (isUsed) totalAlloc += parseFloat(srcQtys[j].value) || 0;\n' +
'          }\n' +
'          if (totalAlloc !== lineQty) {\n' +
'            e.preventDefault();\n' +
'            alert("Line " + lineNum + ": supplier sources allocate " + totalAlloc + " units, but line quantity is " + lineQty + ". Please adjust.");\n' +
'            return false;\n' +
'          }\n' +
'        }\n' +
'      });\n' +
'    }\n' +
'\n' +
'    // Initial recalc for all lines\n' +
'    for (var k=0; k<' + lineCount + '; k++) recalcLine(k);\n' +
'  })();\n' +
'</script>';
}

// ============================================================================
// saveQuote - validate + INSERT quote, quote_lines, quote_line_sources
// ============================================================================
async function saveQuote(rfqId, body, adminId) {
  const pool = await getPool();
  const linesObj = body.lines || {};
  const lineKeys = Object.keys(linesObj).sort(function(a,b){ return parseInt(a) - parseInt(b); });
  if (lineKeys.length === 0) throw new Error('No lines submitted');

  // Build processed lines with validation
  const processedLines = [];
  let subtotal = 0, totalCost = 0;

  lineKeys.forEach(function(k, idx) {
    const lineNum = idx + 1;
    const line = linesObj[k];
    const lineQty = parseInt(line.quantity || 0);
    const unitPrice = parseFloat(line.unit_price || 0);
    if (lineQty <= 0) throw new Error('Line ' + lineNum + ': quantity must be > 0');
    if (unitPrice < 0) throw new Error('Line ' + lineNum + ': unit price cannot be negative');

    const sourcesObj = line.sources || {};
    const sourceKeys = Object.keys(sourcesObj);
    if (sourceKeys.length === 0) throw new Error('Line ' + lineNum + ': at least one supplier source required');

    const sources = sourceKeys.map(function(sk) { return sourcesObj[sk]; });
    // [Rewire 7] Only checked sources count toward allocation
    let allocSum = 0, costSum = 0, selectedCount = 0;
    sources.forEach(function(s, sIdx) {
      const sq = parseInt(s.allocated_qty || 0);
      const sc = parseFloat(s.unit_cost || 0);
      const isUsed = s.is_selected === '1' || s.is_selected === 1 || s.is_selected === true;
      if (!s.supplier_id) throw new Error('Line ' + lineNum + ' source ' + (sIdx + 1) + ': supplier required');
      if (sq <= 0) throw new Error('Line ' + lineNum + ' source ' + (sIdx + 1) + ': allocated qty must be > 0');
      if (sc < 0) throw new Error('Line ' + lineNum + ' source ' + (sIdx + 1) + ': cost cannot be negative');
      if (isUsed) {
        allocSum += sq;
        costSum += sq * sc;
        selectedCount++;
      }
    });
    if (selectedCount === 0) throw new Error('Line ' + lineNum + ': at least one supplier must be checked (USE)');
    if (allocSum !== lineQty) throw new Error('Line ' + lineNum + ': checked sources allocate ' + allocSum + ' but line qty is ' + lineQty);

    const lineTotal = unitPrice * lineQty;
    const lineMargin = lineTotal - costSum;
    const avgUnitCost = lineQty > 0 ? (costSum / lineQty) : 0;
    const marginPct = lineTotal > 0 ? (lineMargin / lineTotal * 100) : 0;
    // MARKUP_CLAMP_V1: clamp to decimal(5,2) range to avoid DB overflow
        const _rawMarkup = avgUnitCost > 0 ? ((unitPrice - avgUnitCost) / avgUnitCost * 100) : 0;
        const markupPct = Math.min(999.99, Math.max(-999.99, Number.isFinite(_rawMarkup) ? _rawMarkup : 0));

    subtotal += lineTotal;
    totalCost += costSum;

    processedLines.push({
      line_number: lineNum,
      rfq_line_id: line.rfq_line_id ? parseInt(line.rfq_line_id) : null,
      nsn: line.original_nsn || null,
      part_number: line.fulfillment_part || line.original_part || null,
      item_name: line.item_name || null,
      condition_code: line.condition_code || 'NE',
      quantity: lineQty,
      unit_cost: avgUnitCost,
      unit_price: unitPrice,
      line_total: lineTotal,
      line_cost: costSum,
      line_margin: lineMargin,
      margin_pct: marginPct,
      markup_pct: markupPct,
      lead_time_text: line.lead_time_text || null,
      sources: sources
    });
  });

  // Get RFQ + customer info
  const rfqR = await pool.request().input('id', sql.BigInt, rfqId)
    .query('SELECT * FROM rfq_headers WHERE id=@id');
  if (!rfqR.recordset.length) throw new Error('RFQ not found');
  const rfq = rfqR.recordset[0];

  const totalMargin = subtotal - totalCost;
  const validDays = parseInt(body.valid_days || 30);
  const validUntil = new Date(Date.now() + validDays * 86400 * 1000);
  const quoteNumber = await generateNumber('QT');

  // Insert quote header
  const qhR = await pool.request()
    .input('rfqId', sql.BigInt, rfqId)
    .input('cid', sql.BigInt, rfq.customer_id)
    .input('qn', sql.NVarChar(20), quoteNumber)
    .input('sub', sql.Decimal(12,2), subtotal)
    .input('tot', sql.Decimal(12,2), subtotal)
    .input('tc', sql.Decimal(12,2), totalCost)
    .input('tm', sql.Decimal(12,2), totalMargin)
    .input('vu', sql.Date, validUntil)
    .input('pt', sql.NVarChar(100), body.payment_terms || 'Credit Card or Wire Transfer')
    .input('nt', sql.NVarChar(sql.MAX), body.notes || null)
    .input('pm', sql.NVarChar(sql.MAX), body.personal_message || null)
    .query("INSERT INTO quotes (rfq_id, customer_id, quote_number, subtotal, total_amount, total_cost, total_margin, valid_until, payment_terms, notes, personal_message, status) OUTPUT INSERTED.id VALUES (@rfqId, @cid, @qn, @sub, @tot, @tc, @tm, @vu, @pt, @nt, @pm, 'Sent')");
  const quoteId = qhR.recordset[0].id;

  // Insert each quote line + its sources
  for (const pl of processedLines) {
    const qlR = await pool.request()
      .input('qid', sql.BigInt, quoteId)
      .input('rli', sql.BigInt, pl.rfq_line_id)
      .input('ln', sql.Int, pl.line_number)
      .input('nsn', sql.NVarChar(20), pl.nsn)
      .input('pn', sql.NVarChar(100), pl.part_number)
      .input('iname', sql.NVarChar(255), pl.item_name)
      .input('cond', sql.NVarChar(5), pl.condition_code)
      .input('qty', sql.Int, pl.quantity)
      .input('uc', sql.Decimal(10,2), pl.unit_cost)
      .input('mkp', sql.Decimal(5,2), pl.markup_pct)
      .input('up', sql.Decimal(10,2), pl.unit_price)
      .input('lt', sql.Decimal(12,2), pl.line_total)
      .input('lc', sql.Decimal(12,2), pl.line_cost)
      .input('lm', sql.Decimal(12,2), pl.line_margin)
      .input('mpct', sql.Decimal(5,2), pl.margin_pct)
      .input('ltt', sql.NVarChar(100), pl.lead_time_text)
      .query("INSERT INTO quote_lines (quote_id, rfq_line_id, line_number, nsn, part_number, item_name, condition_code, quantity, unit_cost, markup_pct, unit_price, line_total, line_cost, line_margin, margin_pct, lead_time_text) OUTPUT INSERTED.id VALUES (@qid, @rli, @ln, @nsn, @pn, @iname, @cond, @qty, @uc, @mkp, @up, @lt, @lc, @lm, @mpct, @ltt)");
    const quoteLineId = qlR.recordset[0].id;

    // [Rewire 7] Ensure is_selected column exists
    try {
      await pool.request().query("IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('quote_line_sources') AND name='is_selected') ALTER TABLE quote_line_sources ADD is_selected BIT NOT NULL DEFAULT 1");
    } catch(e) { console.error('is_selected col check:', e.message); }
    let sortOrder = 1;
    for (const s of pl.sources) {
      await pool.request()
        .input('qli', sql.BigInt, quoteLineId)
        .input('sid', sql.BigInt, parseInt(s.supplier_id))
        .input('aq', sql.Int, parseInt(s.allocated_qty))
        .input('uc', sql.Decimal(10,2), parseFloat(s.unit_cost))
        .input('ld', sql.Int, s.lead_days ? parseInt((s.lead_days+'').replace(/[^0-9]/g,'')) || null : null)
        .input('ltt', sql.NVarChar(sql.MAX), s.lead_time_text || s.lead_days || pl.lead_time_text || null)
        .input('h81', sql.Bit, s.has_8130 ? 1 : 0)
        .input('hcoc', sql.Bit, s.has_coc ? 1 : 0)
        .input('htr', sql.Bit, s.has_trace ? 1 : 0)
        .input('nt', sql.NVarChar(500), s.notes || null)
        .input('so', sql.Int, sortOrder++)
        .input('issel', sql.Bit, (s.is_selected === '1' || s.is_selected === 1 || s.is_selected === true) ? 1 : 0)
        .query("INSERT INTO quote_line_sources (quote_line_id, supplier_id, allocated_qty, unit_cost, supplier_lead_time_days, lead_time_text, has_8130, has_coc, has_trace, notes, sort_order, is_selected) VALUES (@qli, @sid, @aq, @uc, @ld, @ltt, @h81, @hcoc, @htr, @nt, @so, @issel)");
    }
  }

  // Update RFQ status
  await pool.request().input('rid', sql.BigInt, rfqId)
    .query("UPDATE rfq_headers SET status='Quoted', updated_at=GETDATE() WHERE id=@rid");

  // Try to send PDF + email (best-effort, don't fail save if email fails)
  try {
    const linesR = await pool.request().input('qid', sql.BigInt, quoteId)
      .query('SELECT * FROM quote_lines WHERE quote_id=@qid ORDER BY line_number');
    const custR = await pool.request().input('cid', sql.BigInt, rfq.customer_id)
      .query('SELECT first_name, last_name, email FROM customers WHERE id=@cid');
    const quoteRow = (await pool.request().input('id', sql.BigInt, quoteId)
      .query('SELECT * FROM quotes WHERE id=@id')).recordset[0];

    /* QUOTE_INITIAL_SEND_v1: capture PDF Buffer + pass cc_emails through */
    const pdfBuf = await generateQuotePdf({ quote: quoteRow, lines: linesR.recordset });
    // Mark quote as sent (sent_at). pdf_url left null; we attach the buffer directly to email.
    await pool.request().input('id', sql.BigInt, quoteId)
      .query('UPDATE quotes SET sent_at=GETDATE() WHERE id=@id');
    if (custR.recordset.length) {
      const ccEmails = (body && body.cc_emails) ? String(body.cc_emails).trim() : '';
      const attachPdf = !!(body && (body.attach_pdf === '1' || body.attach_pdf === 'on' || body.attach_pdf === 1 || body.attach_pdf === true));
      sendQuoteToCustomer({
        customer: custR.recordset[0],
        quote: quoteRow,
        lines: linesR.recordset,
        ccEmails: ccEmails,
        attachPdf: attachPdf,
        pdfBuffer: pdfBuf
      }).catch(function(e){ console.error('Email error:', e.message); });
    }
  } catch (sendErr) {
    console.error('PDF/email best-effort error:', sendErr.message);
  }

  return { quote_id: quoteId, quote_number: quoteNumber };
}

// ============================================================================
// HTML escape helpers
// ============================================================================
async function saveQuoteDraftFull(rfqId, body) {
  const pool = await getPool();
  const rfqR = await pool.request().input('id', sql.BigInt, rfqId)
    .query('SELECT h.*, c.id AS customer_id FROM rfq_headers h JOIN customers c ON c.id=h.customer_id WHERE h.id=@id');
  if (!rfqR.recordset.length) throw new Error('RFQ not found');
  const rfq = rfqR.recordset[0];

  const linesObj = body.lines || {};
  const lineKeys = Object.keys(linesObj).sort(function(a, b) { return parseInt(a) - parseInt(b); });

  let subtotal = 0, totalCost = 0;
  const processedLines = lineKeys.map(function(k, i) {
    const l = linesObj[k] || {};
    const qty = parseInt(l.quantity) || 1;
    const unitPrice = parseFloat(l.unit_price) || 0;
    const fulfillPart = (l.fulfillment_part || '').trim().toUpperCase();
    const isNSN = /^\d{4}-\d{2}-\d{3}-\d{4}$/.test(fulfillPart);

    const srcObj = l.sources || {};
    const srcArr = Object.keys(srcObj).map(function(sk) { return srcObj[sk]; })
      .filter(function(s) { return s && s.supplier_id; });

    let lineCost = 0, alloc = 0;
    const sources = srcArr.map(function(s) {
      const aq = parseInt(s.allocated_qty) || 0;
      const uc = parseFloat(s.unit_cost) || 0;
      const used = (s.is_selected === '1' || s.is_selected === 1 || s.is_selected === true);
      if (used) { alloc += aq; lineCost += aq * uc; }
      return {
        supplier_id: parseInt(s.supplier_id),
        allocated_qty: aq,
        unit_cost: uc,
        lead_days: s.lead_days ? (parseInt(('' + s.lead_days).replace(/[^0-9]/g, '')) || null) : null,
        lead_time_text: ('' + (s.lead_days || '')) || null,
        has_8130: s.has_8130 ? 1 : 0,
        has_coc: s.has_coc ? 1 : 0,
        has_trace: s.has_trace ? 1 : 0,
        notes: s.notes || null,
        is_selected: used ? 1 : 0
      };
    });

    const lineTotal = unitPrice * qty;
    const avgUnitCost = alloc > 0 ? (lineCost / alloc) : 0;
    const rawMarkup = avgUnitCost > 0 ? ((unitPrice - avgUnitCost) / avgUnitCost * 100) : 0;
    const markupPct = Math.min(999.99, Math.max(-999.99, Number.isFinite(rawMarkup) ? rawMarkup : 0));
    const lineMargin = lineTotal - lineCost;
    const marginPct = lineTotal > 0 ? Math.min(999.99, Math.max(-999.99, (lineMargin / lineTotal * 100))) : 0;
    subtotal += lineTotal; totalCost += lineCost;

    return {
      line_number: i + 1,
      rfq_line_id: l.rfq_line_id ? parseInt(l.rfq_line_id) : null,
      nsn: isNSN ? fulfillPart : (l.original_nsn || null),
      part_number: (!isNSN && fulfillPart) ? fulfillPart : (l.original_part || null),
      item_name: l.item_name || null,
      condition_code: l.condition_code || 'NE',
      quantity: qty,
      unit_cost: avgUnitCost,
      unit_price: unitPrice,
      line_total: lineTotal,
      line_cost: lineCost,
      line_margin: lineMargin,
      markup_pct: markupPct,
      margin_pct: marginPct,
      lead_time_text: l.lead_time_text || null,
      sources: sources
    };
  });

  const validUntil = new Date(Date.now() + 30 * 86400 * 1000);
  const quoteNumber = (rfq.rfq_number || 'RFQ-0').replace(/^RFQ-/, 'QT-') + '-D';

  const existing = await pool.request().input('rfqId', sql.BigInt, rfqId)
    .query("SELECT id FROM quotes WHERE rfq_id=@rfqId AND status='Draft' AND quote_number LIKE '%-D'");
  let quoteId;
  if (existing.recordset.length) {
    quoteId = existing.recordset[0].id;
    await pool.request()
      .input('id', sql.BigInt, quoteId)
      .input('sub', sql.Decimal(12, 2), subtotal)
      .input('tot', sql.Decimal(12, 2), subtotal)
      .input('tc', sql.Decimal(12, 2), totalCost)
      .input('tm', sql.Decimal(12, 2), subtotal - totalCost)
      .input('vu', sql.Date, validUntil)
      .input('pt', sql.NVarChar(100), body.payment_terms || 'Credit Card or Wire Transfer')
      .input('nt', sql.NVarChar(sql.MAX), body.notes || null)
      .input('pm', sql.NVarChar(sql.MAX), body.personal_message || null)
      .query("UPDATE quotes SET subtotal=@sub,total_amount=@tot,total_cost=@tc,total_margin=@tm,valid_until=@vu,payment_terms=@pt,notes=@nt,personal_message=@pm,updated_at=GETDATE() WHERE id=@id");
    await pool.request().input('qid', sql.BigInt, quoteId)
      .query("DELETE FROM quote_line_sources WHERE quote_line_id IN (SELECT id FROM quote_lines WHERE quote_id=@qid)");
    await pool.request().input('qid', sql.BigInt, quoteId)
      .query("DELETE FROM quote_lines WHERE quote_id=@qid");
  } else {
    const qh = await pool.request()
      .input('rfqId', sql.BigInt, rfqId)
      .input('cid', sql.BigInt, rfq.customer_id)
      .input('qn', sql.NVarChar(20), quoteNumber)
      .input('sub', sql.Decimal(12, 2), subtotal)
      .input('tot', sql.Decimal(12, 2), subtotal)
      .input('tc', sql.Decimal(12, 2), totalCost)
      .input('tm', sql.Decimal(12, 2), subtotal - totalCost)
      .input('vu', sql.Date, validUntil)
      .input('pt', sql.NVarChar(100), body.payment_terms || 'Credit Card or Wire Transfer')
      .input('nt', sql.NVarChar(sql.MAX), body.notes || null)
      .input('pm', sql.NVarChar(sql.MAX), body.personal_message || null)
      .query("INSERT INTO quotes (rfq_id,customer_id,quote_number,subtotal,total_amount,total_cost,total_margin,valid_until,payment_terms,notes,personal_message,status) OUTPUT INSERTED.id VALUES (@rfqId,@cid,@qn,@sub,@tot,@tc,@tm,@vu,@pt,@nt,@pm,'Draft')");
    quoteId = qh.recordset[0].id;
  }

  for (const pl of processedLines) {
    const qlR = await pool.request()
      .input('qid', sql.BigInt, quoteId)
      .input('rli', sql.BigInt, pl.rfq_line_id)
      .input('ln', sql.Int, pl.line_number)
      .input('nsn', sql.NVarChar(20), pl.nsn)
      .input('pn', sql.NVarChar(100), pl.part_number)
      .input('iname', sql.NVarChar(255), pl.item_name)
      .input('cond', sql.NVarChar(5), pl.condition_code)
      .input('qty', sql.Int, pl.quantity)
      .input('uc', sql.Decimal(10, 2), pl.unit_cost)
      .input('mkp', sql.Decimal(5, 2), pl.markup_pct)
      .input('up', sql.Decimal(10, 2), pl.unit_price)
      .input('lt', sql.Decimal(12, 2), pl.line_total)
      .input('lc', sql.Decimal(12, 2), pl.line_cost)
      .input('lm', sql.Decimal(12, 2), pl.line_margin)
      .input('mpct', sql.Decimal(5, 2), pl.margin_pct)
      .input('ltt', sql.NVarChar(100), pl.lead_time_text)
      .query("INSERT INTO quote_lines (quote_id,rfq_line_id,line_number,nsn,part_number,item_name,condition_code,quantity,unit_cost,markup_pct,unit_price,line_total,line_cost,line_margin,margin_pct,lead_time_text) OUTPUT INSERTED.id VALUES (@qid,@rli,@ln,@nsn,@pn,@iname,@cond,@qty,@uc,@mkp,@up,@lt,@lc,@lm,@mpct,@ltt)");
    const quoteLineId = qlR.recordset[0].id;
    let sortOrder = 1;
    for (const s of pl.sources) {
      await pool.request()
        .input('qli', sql.BigInt, quoteLineId)
        .input('sid', sql.BigInt, s.supplier_id)
        .input('aq', sql.Int, s.allocated_qty)
        .input('uc', sql.Decimal(10, 2), s.unit_cost)
        .input('ld', sql.Int, s.lead_days)
        .input('ltt', sql.NVarChar(sql.MAX), s.lead_time_text)
        .input('h81', sql.Bit, s.has_8130)
        .input('hcoc', sql.Bit, s.has_coc)
        .input('htr', sql.Bit, s.has_trace)
        .input('nt', sql.NVarChar(500), s.notes)
        .input('so', sql.Int, sortOrder++)
        .input('issel', sql.Bit, s.is_selected)
        .query("INSERT INTO quote_line_sources (quote_line_id,supplier_id,allocated_qty,unit_cost,supplier_lead_time_days,lead_time_text,has_8130,has_coc,has_trace,notes,sort_order,is_selected) VALUES (@qli,@sid,@aq,@uc,@ld,@ltt,@h81,@hcoc,@htr,@nt,@so,@issel)");
    }
  }

  return { quote_id: quoteId, quote_number: quoteNumber };
}

async function loadDraftAsSubmitted(rfqId, ctx) {
  const pool = await getPool();
  const dq = await pool.request().input('rfqId', sql.BigInt, rfqId)
    .query("SELECT TOP 1 * FROM quotes WHERE rfq_id=@rfqId AND status='Draft' AND quote_number LIKE '%-D' ORDER BY updated_at DESC, created_at DESC");
  if (!dq.recordset.length) return null;
  const draft = dq.recordset[0];

  const ql = await pool.request().input('qid', sql.BigInt, draft.id)
    .query('SELECT * FROM quote_lines WHERE quote_id=@qid ORDER BY line_number');
  const qs = await pool.request().input('qid2', sql.BigInt, draft.id)
    .query('SELECT s.* FROM quote_line_sources s JOIN quote_lines l ON l.id=s.quote_line_id WHERE l.quote_id=@qid2 ORDER BY s.quote_line_id, s.sort_order');

  const srcByLine = {};
  qs.recordset.forEach(function(s) {
    (srcByLine[s.quote_line_id] = srcByLine[s.quote_line_id] || []).push(s);
  });

  const submitted = {
    lines: {},
    payment_terms: draft.payment_terms || 'Credit Card or Wire Transfer',
    valid_days: 30,
    notes: draft.notes || '',
    personal_message: draft.personal_message || '',
    cc_emails: '',
    __draftNumber: draft.quote_number
  };

  ql.recordset.forEach(function(qline) {
    let idx = ctx.rfqLines.findIndex(function(rl) { return rl.id === qline.rfq_line_id; });
    if (idx < 0) idx = (qline.line_number || 1) - 1;
    const srcs = srcByLine[qline.id] || [];
    const sourcesMap = {};
    srcs.forEach(function(s, j) {
      sourcesMap[j] = {
        supplier_id: s.supplier_id,
        allocated_qty: s.allocated_qty,
        unit_cost: s.unit_cost,
        lead_days: s.supplier_lead_time_days,
        has_8130: s.has_8130,
        has_coc: s.has_coc,
        has_trace: s.has_trace,
        notes: s.notes,
        is_selected: s.is_selected
      };
    });
    submitted.lines[idx] = {
      fulfillment_part: qline.nsn || qline.part_number || '',
      item_name: qline.item_name || '',
      quantity: qline.quantity || 1,
      unit_price: (qline.unit_price !== null && qline.unit_price !== undefined) ? qline.unit_price : '',
      lead_time_text: qline.lead_time_text || '',
      original_nsn: qline.nsn || '',
      original_part: qline.part_number || '',
      condition_code: qline.condition_code || 'NE',
      sources: sourcesMap
    };
  });

  return submitted;
}

async function createOrderFromQuote(quoteId, adminId) {
  const pool = await getPool();
  const qR = await pool.request().input('id', sql.BigInt, quoteId)
    .query('SELECT * FROM quotes WHERE id=@id');
  if (!qR.recordset.length) throw new Error('Quote not found');
  const quote = qR.recordset[0];

  const orderNumber = await generateNumber('ORD');
  const oR = await pool.request()
    .input('quoteId',     sql.BigInt,        quoteId)
    .input('rfqId',       sql.BigInt,        quote.rfq_id)
    .input('customerId',  sql.BigInt,        quote.customer_id)
    .input('orderNumber', sql.NVarChar(20),  orderNumber)
    .input('customerPo',  sql.NVarChar(100), null)
    .input('subtotal',    sql.Decimal(12,2), quote.subtotal || 0)
    .input('taxAmount',   sql.Decimal(12,2), quote.tax_amount || 0)
    .input('totalAmount', sql.Decimal(12,2), quote.total_amount || 0)
    .input('paymentTerms',sql.NVarChar(100), quote.payment_terms || null)
    .input('addr1',       sql.NVarChar(150), null)
    .input('city',        sql.NVarChar(100), null)
    .input('state',       sql.NVarChar(50),  null)
    .input('zip',         sql.NVarChar(20),  null)
    .input('country',     sql.NVarChar(50),  'USA')
    .input('notes',       sql.NVarChar(sql.MAX), null)
    .input('createdBy',   sql.BigInt,        adminId || null)
    .query("INSERT INTO orders (quote_id, rfq_id, customer_id, order_number, customer_po, subtotal, tax_amount, total_amount, payment_terms, ship_to_address1, ship_to_city, ship_to_state, ship_to_zip, ship_to_country, notes, created_by) OUTPUT INSERTED.id VALUES (@quoteId, @rfqId, @customerId, @orderNumber, @customerPo, @subtotal, @taxAmount, @totalAmount, @paymentTerms, @addr1, @city, @state, @zip, @country, @notes, @createdBy)");
  const orderId = oR.recordset[0].id;

  const qlR = await pool.request().input('qid', sql.BigInt, quoteId)
    .query('SELECT * FROM quote_lines WHERE quote_id=@qid ORDER BY line_number');
  for (const ql of qlR.recordset) {
    const olR = await pool.request()
      .input('orderId', sql.BigInt,        orderId)
      .input('qlId',    sql.BigInt,        ql.id)
      .input('lineNum', sql.Int,           ql.line_number)
      .input('nsn',     sql.NVarChar(20),  ql.nsn)
      .input('pn',      sql.NVarChar(100), ql.part_number)
      .input('name',    sql.NVarChar(255), ql.item_name)
      .input('cond',    sql.NVarChar(5),   ql.condition_code || 'NE')
      .input('qty',     sql.Int,           ql.quantity)
      .input('price',   sql.Decimal(10,2), ql.unit_price || 0)
      .input('total',   sql.Decimal(12,2), ql.line_total || 0)
      .query("INSERT INTO order_lines (order_id, quote_line_id, line_number, nsn, part_number, item_name, condition_code, quantity_ordered, unit_price, line_total) OUTPUT INSERTED.id VALUES (@orderId, @qlId, @lineNum, @nsn, @pn, @name, @cond, @qty, @price, @total)");
    const orderLineId = olR.recordset[0].id;

    const srcR = await pool.request().input('qlid', sql.BigInt, ql.id)
      .query('SELECT * FROM quote_line_sources WHERE quote_line_id=@qlid AND is_selected=1 ORDER BY sort_order');
    let so = 1;
    for (const s of srcR.recordset) {
      await pool.request()
        .input('olId',  sql.BigInt,        orderLineId)
        .input('sup',   sql.BigInt,        s.supplier_id)
        .input('aq',    sql.Int,           s.allocated_qty || 0)
        .input('uc',    sql.Decimal(10,2), s.unit_cost || 0)
        .input('lead',  sql.NVarChar(255), s.lead_time_text || null)
        .input('h8',    sql.Bit,           s.has_8130 ? 1 : 0)
        .input('hc',    sql.Bit,           s.has_coc ? 1 : 0)
        .input('ht',    sql.Bit,           s.has_trace ? 1 : 0)
        .input('so',    sql.Int,           so++)
        .query("INSERT INTO order_line_sources (order_line_id, supplier_id, allocated_qty, received_qty, unit_cost, lead_time_text, has_8130_required, has_8130_received, has_coc_required, has_coc_received, has_trace_required, has_trace_received, sort_order, created_at, updated_at) VALUES (@olId, @sup, @aq, 0, @uc, @lead, @h8, 0, @hc, 0, @ht, 0, @so, GETDATE(), GETDATE())");
    }
  }

  await pool.request().input('orderId', sql.BigInt, orderId)
    .query("INSERT INTO order_status_log (order_id, new_status, note) VALUES (@orderId, 'Confirmed', 'Sales order initiated from quote')");

  await pool.request().input('qid', sql.BigInt, quoteId)
    .query("UPDATE quotes SET status='Accepted', updated_at=GETDATE() WHERE id=@qid");

  return { order_id: orderId, order_number: orderNumber };
}

function escHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function inputCell(label, name, value, type, extra) {
  return '<div>' +
    '<div style="font-size:.65rem;color:#7a8a9a;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px;">' + escHtml(label) + '</div>' +
    '<input type="' + type + '" name="' + escAttr(name) + '" value="' + escAttr(value) + '" ' + extra + ' style="width:100%;"/>' +
    '</div>';
}
