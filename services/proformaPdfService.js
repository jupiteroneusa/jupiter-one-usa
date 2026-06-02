// services/proformaPdfService.js
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

export async function generateProformaPdf(proformaId, previewPf /* PROFORMA_PREVIEW_v1 */) {
  const pool = await getPool();

  if (previewPf) { /* PROFORMA_PREVIEW_v1: render from supplied data, no DB row */
    const pf = previewPf;
    const linesR = await pool.request().input('oid', sql.BigInt, pf.order_id)
      .query('SELECT * FROM order_lines WHERE order_id=@oid ORDER BY line_number');
    const lines = linesR.recordset;
    return _renderProformaDoc(pf, lines);
  }

  const pfR = await pool.request().input('id', sql.BigInt, proformaId).query(`
    SELECT pf.*, o.order_number, o.quote_id,
           c.first_name, c.last_name, c.email, c.phone, c.company,
           o.ship_to_address1 AS bill_address1, o.ship_to_city AS bill_city,
           o.ship_to_state AS bill_state, o.ship_to_zip AS bill_zip,
           o.ship_to_country AS bill_country,
           o.buyer_name, o.buyer_email, o.buyer_phone,
           o.bill_to_address1, o.bill_to_city, o.bill_to_state, o.bill_to_zip, o.bill_to_country, /* BILL_TO_BUYER_v2 */
           q.quote_number
    FROM proformas pf
    INNER JOIN orders o ON o.id = pf.order_id
    INNER JOIN customers c ON c.id = o.customer_id
    LEFT JOIN quotes q ON q.id = o.quote_id
    WHERE pf.id = @id
  `);
  if (!pfR.recordset.length) throw new Error('Proforma not found: ' + proformaId);
  const pf = pfR.recordset[0];

  const linesR = await pool.request().input('oid', sql.BigInt, pf.order_id)
    .query('SELECT * FROM order_lines WHERE order_id=@oid ORDER BY line_number');
  const lines = linesR.recordset;
  return _renderProformaDoc(pf, lines); /* PROFORMA_PREVIEW_v1 */
}

function _renderProformaDoc(pf, lines) { /* PROFORMA_PREVIEW_v1: extracted renderer */
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
  doc.text('400 N Tampa St, Suite 1550', margin, y); y += 4;
  doc.text('Tampa, FL', margin, y); y += 4;
  doc.text('(347) 821-7412 \u00B7 contact@jupiteroneusa.com', margin, y);

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
  /* BILL_TO_BUYER_v2: prefer buyer over customer when set */
  doc.text((pf.buyer_name && String(pf.buyer_name).trim()) ? String(pf.buyer_name).trim() : (pf.company || (pf.first_name + ' ' + pf.last_name)), margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  /* BILL_TO_BUYER_v2: attn line uses buyer name when set */
  if (pf.company) { doc.text('Attn: ' + ((pf.buyer_name && String(pf.buyer_name).trim()) ? String(pf.buyer_name).trim() : (pf.first_name + ' ' + pf.last_name)), margin, y); y += 4; }
  if ((pf.bill_to_address1 || pf.bill_address1) /* BILL_TO_BUYER_v2 */) { doc.text((pf.bill_to_address1 || pf.bill_address1), margin, y); y += 4; /* BILL_TO_BUYER_v2 */ }
  const cityLine = [(pf.bill_to_city || pf.bill_city) /* BILL_TO_BUYER_v2 */, (pf.bill_to_state || pf.bill_state) /* BILL_TO_BUYER_v2 */, (pf.bill_to_zip || pf.bill_zip) /* BILL_TO_BUYER_v2 */].filter(Boolean).join(', ');
  if (cityLine) { doc.text(cityLine, margin, y); y += 4; }
  if ((pf.bill_to_country || pf.bill_country) /* BILL_TO_BUYER_v2 */) { doc.text((pf.bill_to_country || pf.bill_country), margin, y); y += 4; /* BILL_TO_BUYER_v2 */ }
  if (pf.buyer_email || pf.email) { doc.text(pf.buyer_email || pf.email, margin, y); y += 4; } /* BILL_TO_BUYER_v2 */
  if (pf.buyer_phone || pf.phone) { doc.text(pf.buyer_phone || pf.phone, margin, y); y += 4; } /* BILL_TO_BUYER_v2 */

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
    doc.text(String(l.nsn || l.part_number || '\u2014').substring(0, 18), colX.part, y);
    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'normal');
    doc.text(String(l.item_name || '\u2014').substring(0, 32), colX.desc, y);
    doc.text(String(l.condition_code || '\u2014'), colX.cond, y, { align: 'center' });
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
    payText = 'Wire transfer instructions will be provided separately. Contact contact@jupiteroneusa.com to request wire details.';
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
  doc.text('Jupiter One USA \u00B7 This is a PROFORMA INVOICE \u2014 a final invoice will be issued upon shipment',
    pageW / 2, 290, { align: 'center' });

  return Buffer.from(doc.output('arraybuffer'));
}
