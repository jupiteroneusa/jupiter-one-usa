// patch-step9-2-po-send-pdf-upload.cjs
// Step 9 — Complete:
//   1. Create services/poPdfService.js — Puppeteer PO PDF generator
//   2. Add POST /supplier-pos/:id/send route — emails PDF to supplier, sets status=Sent
//   3. Add "Send to Supplier" button on Overview tab when status=Draft
//   4. Replace Documents tab placeholder with real upload form

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================
// PART A: Create services/poPdfService.js
// ============================================================
const PDF_SERVICE_PATH = 'services/poPdfService.js';
const PDF_SERVICE_BACKUP = PDF_SERVICE_PATH + '.step9-2.bak';

if (!fs.existsSync('services')) {
  console.error('! services/ folder missing. Create it first.');
  process.exit(1);
}

const pdfServiceCode = `// services/poPdfService.js
// Generates a Purchase Order PDF (matches invoice style: white bg, gold/navy accents)
// Uses Puppeteer (same as invoice generator).

import puppeteer from 'puppeteer';
import { getPool, sql } from '../db/connect.js';

function fmtMoney(n) {
  const v = parseFloat(n || 0);
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function generatePoPdf(poId) {
  const pool = await getPool();

  const poR = await pool.request().input('id', sql.BigInt, poId).query(\`
    SELECT p.*, s.company_name AS supplier_name, s.contact_name AS supplier_contact,
           s.email AS supplier_email, s.phone AS supplier_phone,
           s.address1 AS supplier_address1, s.address2 AS supplier_address2,
           s.city AS supplier_city, s.state AS supplier_state, s.zip AS supplier_zip, s.country AS supplier_country,
           s.payment_terms AS supplier_payment_terms,
           o.order_number
    FROM supplier_pos p
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN orders o ON p.order_id = o.id
    WHERE p.id = @id
  \`);
  if (!poR.recordset.length) throw new Error('PO not found: ' + poId);
  const po = poR.recordset[0];

  const linesR = await pool.request().input('id', sql.BigInt, poId)
    .query('SELECT * FROM supplier_po_lines WHERE supplier_po_id=@id ORDER BY line_number');
  const lines = linesR.recordset;

  const linesHtml = lines.map(l => \`
    <tr>
      <td class="num">\${l.line_number}</td>
      <td><div class="pn">\${esc(l.nsn || l.part_number || '—')}</div><div class="item">\${esc(l.item_name || '')}</div></td>
      <td class="ctr">\${esc(l.condition_code || '—')}</td>
      <td class="ctr">\${l.quantity}</td>
      <td class="right">\${fmtMoney(l.unit_cost)}</td>
      <td class="right strong">\${fmtMoney(l.line_total)}</td>
    </tr>\`).join('');

  const supplierAddr = [
    po.supplier_address1,
    po.supplier_address2,
    [po.supplier_city, po.supplier_state, po.supplier_zip].filter(Boolean).join(', '),
    po.supplier_country
  ].filter(Boolean).map(esc).join('<br/>');

  const html = \`<!doctype html><html><head><meta charset="utf-8"/><style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: Helvetica, Arial, sans-serif; color: #1a1a1a; background: #fff; padding: 40px 50px; font-size: 11pt; line-height: 1.4; }
.header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #c8932a; padding-bottom: 20px; margin-bottom: 30px; }
.brand-block .logo { font-size: 22pt; font-weight: 700; color: #0a1628; letter-spacing: -0.5px; }
.brand-block .tagline { font-size: 8pt; letter-spacing: 0.2em; color: #c8932a; text-transform: uppercase; margin-top: 2px; font-weight: 600; }
.brand-block .addr { font-size: 9pt; color: #555; margin-top: 8px; line-height: 1.5; }
.po-box { text-align: right; }
.po-box .label { font-size: 8pt; letter-spacing: 0.2em; color: #7a8a9a; text-transform: uppercase; }
.po-box .number { font-size: 18pt; font-weight: 700; color: #c8932a; margin-top: 4px; font-family: monospace; letter-spacing: 1px; }
.po-box .meta { font-size: 9pt; color: #555; margin-top: 10px; line-height: 1.6; }
.po-box .meta b { color: #1a1a1a; }
.section { margin-bottom: 24px; }
.two-col { display: flex; gap: 30px; }
.two-col > div { flex: 1; }
.section-title { font-size: 8pt; letter-spacing: 0.2em; text-transform: uppercase; color: #c8932a; font-weight: 700; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px; }
.supplier-name { font-size: 12pt; font-weight: 700; color: #0a1628; }
.supplier-detail { font-size: 9pt; color: #555; margin-top: 4px; line-height: 1.6; }
table.lines { width: 100%; border-collapse: collapse; margin-top: 8px; }
table.lines thead th { background: #0a1628; color: #fff; padding: 9px 8px; font-size: 8.5pt; letter-spacing: 0.1em; text-transform: uppercase; text-align: left; font-weight: 600; }
table.lines thead th.ctr { text-align: center; }
table.lines thead th.right { text-align: right; }
table.lines tbody td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-size: 10pt; vertical-align: top; }
table.lines tbody td.num { color: #7a8a9a; font-size: 9pt; }
table.lines tbody td.ctr { text-align: center; }
table.lines tbody td.right { text-align: right; }
table.lines tbody td.strong { font-weight: 700; }
table.lines tbody .pn { font-family: monospace; color: #c8932a; font-weight: 700; font-size: 10pt; }
table.lines tbody .item { color: #555; font-size: 9pt; margin-top: 2px; }
.totals { margin-top: 16px; display: flex; justify-content: flex-end; }
.totals table { width: 280px; }
.totals td { padding: 6px 0; font-size: 10pt; }
.totals td:first-child { color: #555; }
.totals td:last-child { text-align: right; font-weight: 600; }
.totals tr.grand td { font-size: 13pt; color: #c8932a; font-weight: 700; border-top: 2px solid #c8932a; padding-top: 10px; margin-top: 4px; }
.notes-box { background: #fef9ec; border-left: 3px solid #c8932a; padding: 12px 14px; margin-top: 24px; font-size: 9.5pt; color: #444; line-height: 1.5; }
.terms { margin-top: 30px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
.terms ol { padding-left: 18px; font-size: 8.5pt; color: #666; line-height: 1.6; }
.terms li { margin-bottom: 3px; }
.footer { margin-top: 40px; text-align: center; font-size: 8pt; color: #7a8a9a; letter-spacing: 0.1em; }
</style></head><body>

<div class="header">
  <div class="brand-block">
    <div class="logo">JUPITER ONE USA</div>
    <div class="tagline">Aerospace &amp; Defense Parts Supply</div>
    <div class="addr">400 N Tampa St, Suite 1550<br/>Tampa, FL 33602<br/>(347) 821-7412 · DTorchia@JupiterOneUSA.com</div>
  </div>
  <div class="po-box">
    <div class="label">Purchase Order</div>
    <div class="number">\${esc(po.po_number)}</div>
    <div class="meta">
      <b>Date Issued:</b> \${fmtDate(po.issued_at || new Date())}<br/>
      \${po.expected_delivery ? '<b>Expected:</b> ' + fmtDate(po.expected_delivery) + '<br/>' : ''}
      \${po.order_number ? '<b>Customer Ref:</b> ' + esc(po.order_number) + '<br/>' : ''}
      <b>Status:</b> \${esc(po.status)}
    </div>
  </div>
</div>

<div class="section two-col">
  <div>
    <div class="section-title">Supplier</div>
    <div class="supplier-name">\${esc(po.supplier_name || '—')}</div>
    <div class="supplier-detail">
      \${po.supplier_contact ? esc(po.supplier_contact) + '<br/>' : ''}
      \${supplierAddr || ''}
      \${po.supplier_email ? '<br/>' + esc(po.supplier_email) : ''}
      \${po.supplier_phone ? '<br/>' + esc(po.supplier_phone) : ''}
    </div>
  </div>
  <div>
    <div class="section-title">Ship To</div>
    <div class="supplier-name">Jupiter One USA</div>
    <div class="supplier-detail">
      400 N Tampa St, Suite 1550<br/>
      Tampa, FL 33602<br/>
      USA<br/>
      Attn: Receiving / Derek Torchia
    </div>
  </div>
</div>

<div class="section">
  <div class="section-title">Line Items</div>
  <table class="lines">
    <thead><tr>
      <th style="width:30px;">#</th>
      <th>NSN / Part / Description</th>
      <th class="ctr" style="width:50px;">Cond</th>
      <th class="ctr" style="width:50px;">Qty</th>
      <th class="right" style="width:90px;">Unit Cost</th>
      <th class="right" style="width:100px;">Line Total</th>
    </tr></thead>
    <tbody>\${linesHtml || '<tr><td colspan="6" style="text-align:center;color:#999;padding:20px;">No lines</td></tr>'}</tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>Subtotal</td><td>\${fmtMoney(po.subtotal)}</td></tr>
      <tr><td>Shipping</td><td>\${fmtMoney(po.shipping_cost)}</td></tr>
      <tr class="grand"><td>TOTAL</td><td>\${fmtMoney(po.total)}</td></tr>
    </table>
  </div>
</div>

\${po.notes ? '<div class="notes-box"><b style="color:#c8932a;">Notes:</b><br/>' + esc(po.notes).replace(/\\n/g, '<br/>') + '</div>' : ''}

<div class="terms">
  <div class="section-title">Terms &amp; Conditions</div>
  <ol>
    <li>All parts must include applicable certifications: FAA 8130-3 (when required), Certificate of Conformance, and full traceability documentation.</li>
    <li>Payment terms: \${esc(po.supplier_payment_terms || 'NET 30')}. Invoice to be sent to DTorchia@JupiterOneUSA.com.</li>
    <li>Acknowledgment of this PO is requested within 48 hours. Acknowledgment constitutes acceptance of these terms.</li>
    <li>Reference PO number \${esc(po.po_number)} on all packing slips, invoices, and correspondence.</li>
    <li>Parts subject to inspection upon receipt; non-conforming product may be rejected at supplier's expense.</li>
  </ol>
</div>

<div class="footer">Jupiter One USA · CAGE Code on request · This PO is electronically issued and valid without signature</div>

</body></html>\`;

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  try {
    const pageP = await browser.newPage();
    await pageP.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await pageP.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}
`;

if (fs.existsSync(PDF_SERVICE_PATH)) {
  console.log('- ' + PDF_SERVICE_PATH + ' already exists, backing up and overwriting...');
  fs.copyFileSync(PDF_SERVICE_PATH, PDF_SERVICE_BACKUP);
}
fs.writeFileSync(PDF_SERVICE_PATH, pdfServiceCode);
try {
  execSync('node -c "' + PDF_SERVICE_PATH + '"', { stdio: 'pipe' });
  console.log('+ services/poPdfService.js created (' + pdfServiceCode.length + ' bytes)');
} catch (err) {
  if (fs.existsSync(PDF_SERVICE_BACKUP)) fs.copyFileSync(PDF_SERVICE_BACKUP, PDF_SERVICE_PATH);
  else fs.unlinkSync(PDF_SERVICE_PATH);
  console.error('! poPdfService.js syntax error - REVERTED');
  console.error(err.message);
  process.exit(1);
}

// ============================================================
// PART B: Patch admin/supplierPoRoutes.js
//   - Add imports for PDF service + mailer
//   - Add POST /supplier-pos/:id/send route
//   - Add "Send to Supplier" button on Overview tab
//   - Replace Documents tab "coming in Step 9" placeholder with upload form
// ============================================================
const TARGET = 'admin/supplierPoRoutes.js';
const BACKUP = TARGET + '.step9-2.bak';

if (!fs.existsSync(TARGET)) {
  console.error('! ' + TARGET + ' not found');
  process.exit(1);
}

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('SEND_PO_HANDLER_V1')) {
  console.log('- supplierPoRoutes already patched.');
  process.exit(0);
}

// B1: Add imports after the existing imports block
const oldImports = `import { getPool, sql } from '../db/connect.js';
import { generateNumber } from '../db/numbering.js';
import { currency, shortDate, shortDateTime, statusBadge, inputField, selectField, textareaField } from './uiHelpers.js';`;

const newImports = `import { getPool, sql } from '../db/connect.js';
import { generateNumber } from '../db/numbering.js';
import { currency, shortDate, shortDateTime, statusBadge, inputField, selectField, textareaField } from './uiHelpers.js';
import { generatePoPdf } from '../services/poPdfService.js';
import nodemailer from 'nodemailer';`;

if (!src.includes(oldImports)) {
  console.error('! imports anchor not found');
  process.exit(1);
}
src = src.replace(oldImports, function(){ return newImports; });

// B2: Add the "Send PO" button on overview tab — inject AFTER status update form, BEFORE notes editor
const oldOverviewEnd = `        html += '<div style="font-size:.78rem;color:#7a8a9a;margin-top:10px;">Setting status to <strong>Received</strong> will mark all lines as fully received and update the linked order.</div>';
        html += '</div>';

        // Notes editor`;

const newOverviewEnd = `        html += '<div style="font-size:.78rem;color:#7a8a9a;margin-top:10px;">Setting status to <strong>Received</strong> will mark all lines as fully received and update the linked order.</div>';
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

        // Notes editor`;

if (!src.includes(oldOverviewEnd)) {
  console.error('! overview-end anchor not found');
  process.exit(1);
}
src = src.replace(oldOverviewEnd, function(){ return newOverviewEnd; });

// B3: Replace documents tab placeholder with upload form + improved list
const oldDocsTab = `      // ---------- DOCUMENTS TAB ----------
      if (activeTab === 'documents') {
        if (docsR.recordset.length === 0) {
          html += '<div style="text-align:center;color:#7a8a9a;padding:24px;">No documents attached. Upload UI coming in Step 9.</div>';
        } else {
          html += '<table><thead><tr><th>Type</th><th>File</th><th>Uploaded</th><th>Notes</th></tr></thead><tbody>';
          docsR.recordset.forEach(function(d) {
            html += '<tr>' +
              '<td>' + statusBadge(d.doc_type) + '</td>' +
              '<td><a href="' + d.file_url + '" target="_blank" style="color:#c8932a;">' + d.file_name + '</a></td>' +
              '<td style="color:#7a8a9a;font-size:.78rem;">' + shortDateTime(d.uploaded_at) + '</td>' +
              '<td style="color:#7a8a9a;">' + (d.notes || '&mdash;') + '</td>' +
            '</tr>';
          });
          html += '</tbody></table>';
        }
      }`;

const newDocsTab = `      // ---------- DOCUMENTS TAB ----------
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

        html += '<script>function uploadDoc(){var f=document.getElementById("docUploadForm");var fd=new FormData(f);var st=document.getElementById("uploadStatus");st.innerHTML="<span style=\\"color:#c8932a;\\">Uploading...</span>";fetch("/api/documents/upload",{method:"POST",body:fd,credentials:"same-origin"}).then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j};});}).then(function(res){if(res.ok){st.innerHTML="<span style=\\"color:#4caf50;\\">&#10004; Uploaded. Reloading...</span>";setTimeout(function(){location.reload();},800);}else{st.innerHTML="<span style=\\"color:#e05050;\\">Error: "+(res.j.error||"Upload failed")+"</span>";}}).catch(function(err){st.innerHTML="<span style=\\"color:#e05050;\\">Network error: "+err.message+"</span>";});}</script>';

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
              '<td><button onclick="if(confirm(\\'Delete this document?\\')){fetch(\\'/api/documents/' + d.id + '\\',{method:\\'DELETE\\',credentials:\\'same-origin\\'}).then(function(){location.reload();});}" class="btn btn-outline btn-sm" style="font-size:.7rem;padding:4px 8px;color:#e05050;border-color:#e05050;">Delete</button></td>' +
            '</tr>';
          });
          html += '</tbody></table>';
        }
      }`;

if (!src.includes(oldDocsTab)) {
  console.error('! documents tab anchor not found');
  process.exit(1);
}
src = src.replace(oldDocsTab, function(){ return newDocsTab; });

// B4: Add new routes — GET /pdf and POST /send — before the closing brace of mountSupplierPoRoutes
// Anchor: the existing /mark-paid route is the last one in the export. Add new routes after it.
const lastRoute = `  // ==========================================================================
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

}`;

const newRoutes = `  // ==========================================================================
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

      const pdfBuffer = await generatePoPdf(req.params.id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="' + poNumber + '.pdf"');
      res.send(pdfBuffer);
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
      const poR = await pool.request().input('id', sql.BigInt, req.params.id).query(\`
        SELECT p.po_number, p.total, p.expected_delivery, p.notes,
               s.company_name AS supplier_name, s.contact_name AS supplier_contact,
               o.order_number
        FROM supplier_pos p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        LEFT JOIN orders o ON p.order_id = o.id
        WHERE p.id = @id
      \`);
      if (!poR.recordset.length) return res.redirect('/admin/supplier-pos/' + req.params.id + '?error=PO+not+found');
      const po = poR.recordset[0];

      // Generate PDF
      const pdfBuffer = await generatePoPdf(req.params.id);

      // Build mailer
      const smtpUser = process.env.SMTP_USER || process.env.MAIL_USER;
      const smtpPass = process.env.SMTP_PASS || process.env.MAIL_PASS;
      const smtpHost = process.env.SMTP_HOST || process.env.MAIL_HOST || 'smtp.office365.com';
      const smtpPort = parseInt(process.env.SMTP_PORT || process.env.MAIL_PORT || '587');
      const fromAddr = process.env.SMTP_FROM || process.env.MAIL_FROM || smtpUser || 'DTorchia@JupiterOneUSA.com';

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
      });

      const contactName = po.supplier_contact || 'Sir/Madam';
      const orderRef = po.order_number ? ' (customer ref: ' + po.order_number + ')' : '';
      const expectedLine = po.expected_delivery
        ? '<p>Expected delivery: <b>' + new Date(po.expected_delivery).toLocaleDateString('en-US') + '</b>.</p>'
        : '';
      const notesLine = po.notes ? '<p><b>Notes:</b><br/>' + String(po.notes).replace(/\\n/g, '<br/>') + '</p>' : '';

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

      await transporter.sendMail({
        from: fromAddr,
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

}`;

if (!src.includes(lastRoute)) {
  console.error('! last-route anchor (mark-paid + closing brace) not found');
  process.exit(1);
}
src = src.replace(lastRoute, function(){ return newRoutes; });

// Write + verify
fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);
try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ Imports: poPdfService + nodemailer');
  console.log('+ Overview tab: "Send to Supplier" form (when status=Draft)');
  console.log('+ Overview tab: "Sent" confirmation banner (after send)');
  console.log('+ Overview tab: "Preview PO PDF" button always shown');
  console.log('+ Documents tab: upload form (file picker + doc_type dropdown)');
  console.log('+ Documents tab: delete buttons on each row');
  console.log('+ New route: GET /supplier-pos/:id/pdf');
  console.log('+ New route: POST /supplier-pos/:id/send');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! syntax error - REVERTED');
  console.error(err.message);
  process.exit(1);
}
