// patch-proforma-admin.cjs
// Adds admin-side proforma flow:
//   1. New service: services/proformaPdfService.js (jsPDF generator)
//   2. New admin block: admin/orderProformaBlock.js (UI for Proforma tab)
//   3. Adds 'proforma' tab to order detail page
//   4. POST /admin/orders/:id/send-proforma route
//   5. Updates mailer with sendProformaEmail()

const fs = require('fs');
const { execSync } = require('child_process');

const log = [];
function ok(msg) { log.push('+ ' + msg); }
function bad(msg) { log.push('! ' + msg); console.error(msg); process.exit(1); }

// ============================================================
// 1) Create services/proformaPdfService.js
// ============================================================
const proformaService = `// services/proformaPdfService.js
// Generates proforma invoice PDF using jsPDF (matches invoice style)

import { jsPDF } from 'jspdf';
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

export async function generateProformaPdf(proformaId) {
  const pool = await getPool();

  const pfR = await pool.request().input('id', sql.BigInt, proformaId).query(\`
    SELECT pf.*, o.order_number, o.quote_id,
           c.first_name, c.last_name, c.email, c.phone, c.company,
           c.ship_to_address1 AS bill_address1, c.ship_to_city AS bill_city,
           c.ship_to_state AS bill_state, c.ship_to_zip AS bill_zip,
           c.ship_to_country AS bill_country,
           q.quote_number
    FROM proformas pf
    INNER JOIN orders o ON o.id = pf.order_id
    INNER JOIN customers c ON c.id = o.customer_id
    LEFT JOIN quotes q ON q.id = o.quote_id
    WHERE pf.id = @id
  \`);
  if (!pfR.recordset.length) throw new Error('Proforma not found: ' + proformaId);
  const pf = pfR.recordset[0];

  const linesR = await pool.request().input('oid', sql.BigInt, pf.order_id)
    .query('SELECT * FROM order_lines WHERE order_id=@oid ORDER BY line_number');
  const lines = linesR.recordset;

  // Brand colors
  const gold = [200, 147, 42];
  const navy = [10, 22, 40];
  const midGray = [120, 120, 120];

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = 215.9;
  const margin = 14;
  const contentW = pageW - margin * 2;

  // === HEADER ===
  doc.setFillColor(...gold);
  doc.rect(0, 0, pageW, 1.5, 'F');

  let y = 12;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...navy);
  doc.text('JUPITER ONE USA', margin, y);
  y += 5;
  doc.setFontSize(7);
  doc.setTextColor(...gold);
  doc.text('AEROSPACE & DEFENSE PARTS SUPPLY', margin, y);
  y += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  // EDIT-ME: Company header address
  doc.text('1101 Porter Ave NW', margin, y); y += 4;
  doc.text('Palm Bay, FL 32907', margin, y); y += 4;
  doc.text('(347) 821-7412 \\u00B7 DTorchia@JupiterOneUSA.com', margin, y);

  // Proforma label box (right)
  doc.setFontSize(7);
  doc.setTextColor(...midGray);
  doc.text('PROFORMA INVOICE', pageW - margin, 12, { align: 'right' });
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...gold);
  doc.text(pf.proforma_number, pageW - margin, 19, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  let metaY = 25;
  doc.text('Date: ' + fmtDate(pf.sent_at || new Date()), pageW - margin, metaY, { align: 'right' }); metaY += 4;
  if (pf.order_number) { doc.text('Order: ' + pf.order_number, pageW - margin, metaY, { align: 'right' }); metaY += 4; }
  if (pf.quote_number) { doc.text('Quote: ' + pf.quote_number, pageW - margin, metaY, { align: 'right' }); metaY += 4; }
  doc.text('Payment: ' + pf.payment_method, pageW - margin, metaY, { align: 'right' });

  y = 42;
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);

  // === BILL TO ===
  y += 7;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...gold);
  doc.text('BILL TO', margin, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...navy);
  doc.text(pf.company || (pf.first_name + ' ' + pf.last_name), margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  if (pf.company) { doc.text('Attn: ' + pf.first_name + ' ' + pf.last_name, margin, y); y += 4; }
  if (pf.bill_address1) { doc.text(pf.bill_address1, margin, y); y += 4; }
  const cityLine = [pf.bill_city, pf.bill_state, pf.bill_zip].filter(Boolean).join(', ');
  if (cityLine) { doc.text(cityLine, margin, y); y += 4; }
  if (pf.bill_country) { doc.text(pf.bill_country, margin, y); y += 4; }
  if (pf.email) { doc.text(pf.email, margin, y); y += 4; }
  if (pf.phone) { doc.text(pf.phone, margin, y); y += 4; }

  y += 4;

  // === LINE ITEMS ===
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...gold);
  doc.text('LINE ITEMS', margin, y);
  y += 3;

  doc.setFillColor(...navy);
  doc.rect(margin, y, contentW, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);

  const colX = {
    num:   margin + 2,
    part:  margin + 10,
    desc:  margin + 45,
    cond:  margin + 105,
    qty:   margin + 120,
    cost:  margin + 138,
    total: margin + 165
  };
  y += 5;
  doc.text('#',       colX.num, y);
  doc.text('NSN/PN',  colX.part, y);
  doc.text('Description', colX.desc, y);
  doc.text('Cond',    colX.cond, y, { align: 'center' });
  doc.text('Qty',     colX.qty, y, { align: 'center' });
  doc.text('Unit',    colX.cost + 15, y, { align: 'right' });
  doc.text('Total',   colX.total + 22, y, { align: 'right' });
  y += 5;

  doc.setFont('helvetica', 'normal');
  let alt = false;
  lines.forEach(function(l) {
    if (y > 240) { doc.addPage(); y = 20; }
    if (alt) {
      doc.setFillColor(248, 248, 248);
      doc.rect(margin, y - 4, contentW, 7, 'F');
    }
    alt = !alt;
    doc.setTextColor(40, 40, 40);
    doc.text(String(l.line_number), colX.num, y);
    doc.setTextColor(...gold);
    doc.setFont('helvetica', 'bold');
    doc.text(String(l.nsn || l.part_number || '\\u2014').substring(0, 18), colX.part, y);
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'normal');
    doc.text(String(l.item_name || '\\u2014').substring(0, 32), colX.desc, y);
    doc.text(String(l.condition_code || '\\u2014'), colX.cond, y, { align: 'center' });
    doc.text(String(l.quantity_ordered || 0), colX.qty, y, { align: 'center' });
    doc.text(fmtMoney(l.unit_price), colX.cost + 15, y, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(fmtMoney(l.line_total), colX.total + 22, y, { align: 'right' });
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.1);
    doc.line(margin, y + 2, pageW - margin, y + 2);
    y += 7;
  });

  y += 4;

  // === TOTALS ===
  if (y > 220) { doc.addPage(); y = 20; }
  const totalsX = pageW - margin - 60;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text('Subtotal:', totalsX, y);
  doc.setTextColor(40, 40, 40);
  doc.text(fmtMoney(pf.subtotal), pageW - margin, y, { align: 'right' });
  y += 5;
  doc.setTextColor(60, 60, 60);
  doc.text('Shipping & Handling:', totalsX, y);
  doc.setTextColor(40, 40, 40);
  doc.text(fmtMoney(pf.shipping_cost), pageW - margin, y, { align: 'right' });
  y += 5;

  if (parseFloat(pf.cc_fee_amount || 0) > 0) {
    doc.setTextColor(60, 60, 60);
    doc.text('CC Convenience Fee (' + pf.cc_fee_percent + '%):', totalsX, y);
    doc.setTextColor(40, 40, 40);
    doc.text(fmtMoney(pf.cc_fee_amount), pageW - margin, y, { align: 'right' });
    y += 5;
  }

  y += 1;
  doc.setFillColor(...gold);
  doc.rect(totalsX - 4, y - 5, pageW - margin - totalsX + 4, 8, 'F');
  doc.setTextColor(...navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL DUE:', totalsX, y);
  doc.text(fmtMoney(pf.total), pageW - margin, y, { align: 'right' });
  y += 12;

  // === PAYMENT INSTRUCTIONS ===
  if (y > 230) { doc.addPage(); y = 20; }
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...gold);
  doc.text('PAYMENT INSTRUCTIONS', margin, y);
  y += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);

  let payText = '';
  if (pf.payment_method === 'Credit Card') {
    payText = 'A signed credit card authorization form is required. A secure e-sign link has been emailed to you with this proforma. 3.5% convenience fee included in the total above.';
  } else if (pf.payment_method === 'Wire Transfer') {
    payText = 'Wire transfer instructions will be provided separately. Contact DTorchia@JupiterOneUSA.com to request wire details.';
  } else {
    payText = pf.payment_method + ': Payment terms apply. Reference Proforma ' + pf.proforma_number + ' on all correspondence.';
  }
  const payLines = doc.splitTextToSize(payText, contentW);
  payLines.forEach(function(line) { doc.text(line, margin, y); y += 4; });
  y += 4;

  if (pf.notes) {
    doc.setFillColor(254, 249, 236);
    doc.rect(margin, y - 4, contentW, 14, 'F');
    doc.setDrawColor(...gold);
    doc.setLineWidth(1.5);
    doc.line(margin, y - 4, margin, y + 10);
    doc.setTextColor(...gold);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', margin + 3, y);
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(String(pf.notes), contentW - 10);
    doc.text(noteLines.slice(0, 2), margin + 3, y + 4);
    y += 18;
  }

  // === FOOTER ===
  doc.setFillColor(...navy);
  doc.rect(0, 282, pageW, 15, 'F');
  doc.setFontSize(7);
  doc.setTextColor(180, 180, 180);
  doc.text('Jupiter One USA \\u00B7 This is a PROFORMA INVOICE \\u2014 a final invoice will be issued upon shipment',
    pageW / 2, 290, { align: 'center' });

  return Buffer.from(doc.output('arraybuffer'));
}
`;

fs.writeFileSync('services/proformaPdfService.js', proformaService);
ok('Created services/proformaPdfService.js');

// ============================================================
// 2) Create admin/orderProformaBlock.js
// ============================================================
const proformaBlock = `// admin/orderProformaBlock.js
// Renders Proforma tab on order detail page.

import { currency, shortDate, statusBadge } from './uiHelpers.js';

export function renderProformaTab(o, proformas, authorizations, baseUrl) {
  let html = '';

  // === EXISTING PROFORMAS ===
  if (proformas && proformas.length) {
    html += '<div class="card" style="margin-bottom:20px;"><div class="card-header">Proformas Sent</div>';
    html += '<div style="overflow-x:auto;"><table style="min-width:900px;"><thead><tr>';
    html += '<th>Proforma #</th><th>Sent</th><th>Method</th><th>Subtotal</th><th>Shipping</th><th>CC Fee</th><th>Total</th><th>Status</th><th>CC Auth</th>';
    html += '</tr></thead><tbody>';
    proformas.forEach(function(pf) {
      const auth = (authorizations || []).find(function(a) { return a.proforma_id === pf.id; });
      const authCell = auth
        ? (auth.status === 'Signed'
            ? '<span style="color:#4caf50;">\\u2713 Signed ' + shortDate(auth.signed_at) + (auth.card_last4 ? ' \\u00B7 ending ' + auth.card_last4 : '') + '</span>'
            : '<span style="color:#7a8a9a;">Pending</span>')
        : (pf.payment_method === 'Credit Card' ? '<span style="color:#7a8a9a;">Awaiting signature</span>' : '<span style="color:#7a8a9a;">N/A</span>');
      html += '<tr>';
      html += '<td class="mono"><a href="/admin/proformas/' + pf.id + '/pdf" target="_blank" style="color:#c8932a;">' + pf.proforma_number + '</a></td>';
      html += '<td style="font-size:.78rem;">' + shortDate(pf.sent_at) + '</td>';
      html += '<td>' + pf.payment_method + '</td>';
      html += '<td>' + currency(pf.subtotal) + '</td>';
      html += '<td>' + currency(pf.shipping_cost) + '</td>';
      html += '<td>' + (parseFloat(pf.cc_fee_amount) > 0 ? currency(pf.cc_fee_amount) : '\\u2014') + '</td>';
      html += '<td style="font-weight:600;color:#c8932a;">' + currency(pf.total) + '</td>';
      html += '<td>' + statusBadge(pf.status) + '</td>';
      html += '<td style="font-size:.78rem;">' + authCell + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div></div>';
  }

  // === SEND NEW PROFORMA FORM ===
  html += '<div class="card"><div class="card-header">Send Proforma to Customer</div><div class="card-body">';
  html += '<p style="font-size:.85rem;color:#7a8a9a;margin-bottom:14px;">Generate a proforma invoice with payment instructions. For CC payments, customer receives an e-sign link to authorize the charge (no full card data is stored).</p>';
  html += '<form method="POST" action="/admin/orders/' + o.id + '/send-proforma" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">';

  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Payment Method</div>';
  html += '<select name="payment_method" id="pf_method" onchange="window._pfCalc&&window._pfCalc()" style="width:100%;">';
  html += '<option value="Credit Card">Credit Card (adds 3.5% fee)</option>';
  html += '<option value="Wire Transfer">Wire Transfer</option>';
  html += '<option value="Net 30">Net 30</option>';
  html += '</select></div>';

  html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Estimated Shipping Cost ($)</div>';
  html += '<input type="number" step="0.01" min="0" name="shipping_cost" id="pf_ship" value="' + (o.shipping_cost || 0) + '" onchange="window._pfCalc&&window._pfCalc()" style="width:100%;"/></div>';

  html += '<div style="grid-column:1/-1;"><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Notes (optional)</div>';
  html += '<textarea name="notes" rows="2" style="width:100%;" placeholder="Optional notes for the customer..."></textarea></div>';

  // Calc preview
  html += '<div style="grid-column:1/-1;background:#0a1628;padding:14px;border:1px solid #1e2d42;">';
  html += '<div style="font-size:.7rem;letter-spacing:.15em;text-transform:uppercase;color:#c8932a;margin-bottom:10px;font-weight:700;">Total Preview</div>';
  html += '<div style="display:grid;grid-template-columns:1fr auto;gap:6px;font-size:.9rem;">';
  html += '<div style="color:#7a8a9a;">Subtotal:</div><div id="pf_sub" style="text-align:right;">' + currency(o.subtotal || 0) + '</div>';
  html += '<div style="color:#7a8a9a;">Shipping:</div><div id="pf_ship_d" style="text-align:right;">' + currency(o.shipping_cost || 0) + '</div>';
  html += '<div style="color:#7a8a9a;" id="pf_fee_label">CC Fee (3.5%):</div><div id="pf_fee" style="text-align:right;">$0.00</div>';
  html += '<div style="border-top:1px solid #1e2d42;padding-top:8px;margin-top:6px;color:#c8932a;font-weight:700;">TOTAL DUE:</div>';
  html += '<div id="pf_total" style="border-top:1px solid #1e2d42;padding-top:8px;margin-top:6px;text-align:right;color:#c8932a;font-weight:700;font-size:1.1rem;">$0.00</div>';
  html += '</div></div>';

  html += '<div style="grid-column:1/-1;"><button type="submit" class="btn btn-gold">Generate &amp; Send Proforma</button></div>';
  html += '</form>';

  // Live calc script
  html += '<script>(function(){var sub=' + parseFloat(o.subtotal || 0) + ';';
  html += 'window._pfCalc=function(){';
  html += 'var ship=parseFloat(document.getElementById("pf_ship").value)||0;';
  html += 'var method=document.getElementById("pf_method").value;';
  html += 'var feePercent=(method==="Credit Card")?3.5:0;';
  html += 'var preFeeTotal=sub+ship;';
  html += 'var fee=preFeeTotal*feePercent/100;';
  html += 'var total=preFeeTotal+fee;';
  html += 'var fmt=function(v){return"$"+v.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});};';
  html += 'document.getElementById("pf_ship_d").textContent=fmt(ship);';
  html += 'document.getElementById("pf_fee_label").textContent=feePercent>0?"CC Fee ("+feePercent+"%):":"CC Fee (N/A):";';
  html += 'document.getElementById("pf_fee").textContent=fmt(fee);';
  html += 'document.getElementById("pf_total").textContent=fmt(total);';
  html += '};window._pfCalc();})();</script>';

  html += '</div></div>';

  return html;
}
`;

fs.writeFileSync('admin/orderProformaBlock.js', proformaBlock);
ok('Created admin/orderProformaBlock.js');

// ============================================================
// 3) Patch admin/orderRoutes.js — add tab + handler + PDF route
// ============================================================
const routesPath = 'admin/orderRoutes.js';
const origRoutes = fs.readFileSync(routesPath, 'utf8');
let r = origRoutes;

if (r.includes('PROFORMA_ROUTES_V1')) {
  console.log('- orderRoutes already patched');
} else {
  // 3a) Add import at top
  const oldImports = `import { renderShippingTab } from './orderShippingBlock.js';`;
  const newImports = `import { renderShippingTab } from './orderShippingBlock.js';
import { renderProformaTab } from './orderProformaBlock.js';
import { generateProformaPdf } from '../services/proformaPdfService.js';
import crypto from 'crypto';
// PROFORMA_ROUTES_V1`;

  if (!r.includes(oldImports)) {
    bad('Could not find shipping block import');
  }
  r = r.replace(oldImports, newImports);
  ok('Added imports for proforma');

  // 3b) Add Proforma tab to the tab nav (after 'shipping' tab)
  // Find the tabLink for 'shipping' and add proforma tab before payment
  const oldTabNav = "tabLink('shipping','&#128666; Shipping'";
  if (!r.includes(oldTabNav)) bad('Shipping tab anchor not found');
  // Insert proforma tab after shipping line
  const oldTabRow = "tabLink('shipping','&#128666; Shipping') +";
  const newTabRow = "tabLink('shipping','&#128666; Shipping') + tabLink('proforma','&#129534; Proforma') +";
  if (!r.includes(oldTabRow)) {
    // try without trailing +
    const alt = "tabLink('shipping','&#128666; Shipping')";
    r = r.replace(alt, alt + " + tabLink('proforma','&#129534; Proforma')");
  } else {
    r = r.replace(oldTabRow, newTabRow);
  }
  ok('Added Proforma tab to nav');

  // 3c) Add tab content handler: in the activeTab branches, add proforma branch.
  // Find "} else if (activeTab === 'payment')" and inject before it.
  const oldPaymentBranch = "} else if (activeTab === 'payment') {";
  if (!r.includes(oldPaymentBranch)) bad('Payment branch anchor not found');
  const newPaymentBranch = `} else if (activeTab === 'proforma') {
        const pfR = await pool.request().input('oid', sql.BigInt, req.params.id)
          .query('SELECT * FROM proformas WHERE order_id=@oid ORDER BY id DESC');
        const authR = await pool.request().input('oid2', sql.BigInt, req.params.id)
          .query('SELECT * FROM cc_authorizations WHERE order_id=@oid2 ORDER BY id DESC');
        html += renderProformaTab(o, pfR.recordset, authR.recordset, '');
      } else if (activeTab === 'payment') {`;
  r = r.replace(oldPaymentBranch, newPaymentBranch);
  ok('Added Proforma tab branch in detail route');

  // 3d) Inject POST /orders/:id/send-proforma + GET /proformas/:id/pdf at the end before the closing }
  // Find the function close — last line is "}" alone after all the routes
  const handlerCode = `
  // PROFORMA_ROUTES_V1: Send proforma
  router.post('/orders/:id/send-proforma', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const b = req.body;
      const orderId = parseInt(req.params.id);

      const oR = await pool.request().input('id', sql.BigInt, orderId).query(\`
        SELECT o.*, c.first_name, c.last_name, c.email, c.company
        FROM orders o INNER JOIN customers c ON c.id = o.customer_id
        WHERE o.id = @id
      \`);
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
        .query(\`INSERT INTO proformas (order_id, proforma_number, status, payment_method,
                  subtotal, shipping_cost, cc_fee_amount, cc_fee_percent, total, notes, auth_token)
                OUTPUT INSERTED.id
                VALUES (@oid, @pfn, 'Sent', @pm, @sub, @ship, @feeAmt, @feePct, @tot, @notes, @tok)\`);
      const proformaId = insR.recordset[0].id;

      // Also save shipping cost back to order
      await pool.request()
        .input('id', sql.BigInt, orderId)
        .input('sc', sql.Decimal(12,2), shippingCost)
        .input('tot', sql.Decimal(12,2), total)
        .query('UPDATE orders SET shipping_cost=@sc, total_amount=@tot, updated_at=GETDATE() WHERE id=@id');

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
          '<p>Hi ' + o.first_name + ',</p>' +
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
          '<p style="color:#555;font-size:11px;margin:0;">Jupiter One USA LLC | 1101 Porter Ave NW, Palm Bay, FL 32907 | (347) 821-7412</p>' +
          '</div></div>';

        const mailOpts = {
          from: '"Derek Torchia - Jupiter One USA" <' + (process.env.ADMIN_EMAIL || 'DTorchia@jupiteroneusa.com') + '>',
          to: o.email,
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

      res.redirect('/admin/orders/' + orderId + '?tab=proforma&saved=1');
    } catch (err) {
      console.error('Send proforma error:', err);
      res.redirect('/admin/orders/' + req.params.id + '?tab=proforma&error=' + encodeURIComponent(err.message));
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

`;

  // Inject before the final '}' that closes the export function
  // Find the LAST occurrence of '\n}\n' (function close)
  const lastBraceIdx = r.lastIndexOf('\n}');
  if (lastBraceIdx < 0) bad('Could not find function close');
  r = r.slice(0, lastBraceIdx) + handlerCode + r.slice(lastBraceIdx);
  ok('Injected POST /send-proforma and GET /proformas/:id/pdf routes');

  // Verify
  if (!r.includes('PROFORMA_ROUTES_V1')) bad('Verification failed - marker missing');

  fs.writeFileSync(routesPath + '.proforma.bak', origRoutes);
  fs.writeFileSync(routesPath, r);
  try {
    execSync('node -c "' + routesPath + '"', { stdio: 'pipe' });
    ok('orderRoutes.js syntax OK');
  } catch (err) {
    fs.writeFileSync(routesPath, origRoutes);
    bad('SYNTAX ERROR — reverted: ' + err.message);
  }
}

// ============================================================
// Done
// ============================================================
log.forEach(l => console.log(l));
console.log('SUCCESS');
