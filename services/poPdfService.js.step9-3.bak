// services/poPdfService.js
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

  const poR = await pool.request().input('id', sql.BigInt, poId).query(`
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
  `);
  if (!poR.recordset.length) throw new Error('PO not found: ' + poId);
  const po = poR.recordset[0];

  const linesR = await pool.request().input('id', sql.BigInt, poId)
    .query('SELECT * FROM supplier_po_lines WHERE supplier_po_id=@id ORDER BY line_number');
  const lines = linesR.recordset;

  const linesHtml = lines.map(l => `
    <tr>
      <td class="num">${l.line_number}</td>
      <td><div class="pn">${esc(l.nsn || l.part_number || '—')}</div><div class="item">${esc(l.item_name || '')}</div></td>
      <td class="ctr">${esc(l.condition_code || '—')}</td>
      <td class="ctr">${l.quantity}</td>
      <td class="right">${fmtMoney(l.unit_cost)}</td>
      <td class="right strong">${fmtMoney(l.line_total)}</td>
    </tr>`).join('');

  const supplierAddr = [
    po.supplier_address1,
    po.supplier_address2,
    [po.supplier_city, po.supplier_state, po.supplier_zip].filter(Boolean).join(', '),
    po.supplier_country
  ].filter(Boolean).map(esc).join('<br/>');

  const html = `<!doctype html><html><head><meta charset="utf-8"/><style>
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
    <div class="number">${esc(po.po_number)}</div>
    <div class="meta">
      <b>Date Issued:</b> ${fmtDate(po.issued_at || new Date())}<br/>
      ${po.expected_delivery ? '<b>Expected:</b> ' + fmtDate(po.expected_delivery) + '<br/>' : ''}
      ${po.order_number ? '<b>Customer Ref:</b> ' + esc(po.order_number) + '<br/>' : ''}
      <b>Status:</b> ${esc(po.status)}
    </div>
  </div>
</div>

<div class="section two-col">
  <div>
    <div class="section-title">Supplier</div>
    <div class="supplier-name">${esc(po.supplier_name || '—')}</div>
    <div class="supplier-detail">
      ${po.supplier_contact ? esc(po.supplier_contact) + '<br/>' : ''}
      ${supplierAddr || ''}
      ${po.supplier_email ? '<br/>' + esc(po.supplier_email) : ''}
      ${po.supplier_phone ? '<br/>' + esc(po.supplier_phone) : ''}
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
    <tbody>${linesHtml || '<tr><td colspan="6" style="text-align:center;color:#999;padding:20px;">No lines</td></tr>'}</tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>Subtotal</td><td>${fmtMoney(po.subtotal)}</td></tr>
      <tr><td>Shipping</td><td>${fmtMoney(po.shipping_cost)}</td></tr>
      <tr class="grand"><td>TOTAL</td><td>${fmtMoney(po.total)}</td></tr>
    </table>
  </div>
</div>

${po.notes ? '<div class="notes-box"><b style="color:#c8932a;">Notes:</b><br/>' + esc(po.notes).replace(/\n/g, '<br/>') + '</div>' : ''}

<div class="terms">
  <div class="section-title">Terms &amp; Conditions</div>
  <ol>
    <li>All parts must include applicable certifications: FAA 8130-3 (when required), Certificate of Conformance, and full traceability documentation.</li>
    <li>Payment terms: ${esc(po.supplier_payment_terms || 'NET 30')}. Invoice to be sent to DTorchia@JupiterOneUSA.com.</li>
    <li>Acknowledgment of this PO is requested within 48 hours. Acknowledgment constitutes acceptance of these terms.</li>
    <li>Reference PO number ${esc(po.po_number)} on all packing slips, invoices, and correspondence.</li>
    <li>Parts subject to inspection upon receipt; non-conforming product may be rejected at supplier's expense.</li>
  </ol>
</div>

<div class="footer">Jupiter One USA · CAGE Code on request · This PO is electronically issued and valid without signature</div>

</body></html>`;

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
