// services/poPdfService.js
// JSPDF_PO_V1 — Rewritten to use jsPDF (same as invoice generator).
// No Puppeteer / no Chromium dependency. Runs instantly on any platform.

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

  // Brand colors: gold #c8932a navy #0a1628
  const gold = [200, 147, 42];
  const navy = [10, 22, 40];
  const lightGray = [240, 240, 240];
  const midGray = [120, 120, 120];

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = 215.9; // letter width in mm
  const margin = 14;
  const contentW = pageW - margin * 2;

  // === HEADER ===
  // Top gold bar
  doc.setFillColor(...gold);
  doc.rect(0, 0, pageW, 1.5, 'F');

  // Brand area
  let y = 12;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...navy);
  doc.text('JUPITER ONE USA', margin, y);
  y += 5;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...gold);
  doc.text('AEROSPACE & DEFENSE PARTS SUPPLY', margin, y);
  y += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  // EDIT-ME: Company header address — appears top-left of every PO PDF
  doc.text('1101 Porter Ave NW', margin, y);
  y += 4;
  doc.text('Palm Bay, FL 32907', margin, y);
  y += 4;
  doc.text('(347) 821-7412 · DTorchia@JupiterOneUSA.com', margin, y);

  // PO number box (right side)
  doc.setFontSize(7);
  doc.setTextColor(...midGray);
  doc.text('PURCHASE ORDER', pageW - margin, 12, { align: 'right' });
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...gold);
  doc.text(po.po_number, pageW - margin, 19, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  let metaY = 25;
  doc.text('Issued: ' + fmtDate(po.issued_at || new Date()), pageW - margin, metaY, { align: 'right' }); metaY += 4;
  if (po.expected_delivery) { doc.text('Expected: ' + fmtDate(po.expected_delivery), pageW - margin, metaY, { align: 'right' }); metaY += 4; }
  if (po.order_number) { doc.text('Customer Ref: ' + po.order_number, pageW - margin, metaY, { align: 'right' }); metaY += 4; }
  doc.text('Status: ' + (po.status || 'Draft'), pageW - margin, metaY, { align: 'right' });

  // Header bottom divider
  y = 42;
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);

  // === SUPPLIER + SHIP TO ===
  y += 7;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...gold);
  doc.text('SUPPLIER', margin, y);
  doc.text('SHIP TO', margin + 100, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...navy);
  doc.text(po.supplier_name || '—', margin, y);
  doc.text('Jupiter One USA', margin + 100, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);

  let supLines = [];
  if (po.supplier_contact) supLines.push(po.supplier_contact);
  if (po.supplier_address1) supLines.push(po.supplier_address1);
  if (po.supplier_address2) supLines.push(po.supplier_address2);
  const cityLine = [po.supplier_city, po.supplier_state, po.supplier_zip].filter(Boolean).join(', ');
  if (cityLine) supLines.push(cityLine);
  if (po.supplier_country) supLines.push(po.supplier_country);
  if (po.supplier_email) supLines.push(po.supplier_email);
  if (po.supplier_phone) supLines.push(po.supplier_phone);

  // EDIT-ME: Ship-to address — where suppliers should ship parts
  const shipLines = [
    '1101 Porter Ave NW',
    'Palm Bay, FL 32907',
    'USA',
    'Attn: Receiving / Derek Torchia'
  ];

  const maxLines = Math.max(supLines.length, shipLines.length);
  let supY = y;
  for (let i = 0; i < maxLines; i++) {
    if (supLines[i])  doc.text(supLines[i], margin, supY);
    if (shipLines[i]) doc.text(shipLines[i], margin + 100, supY);
    supY += 4;
  }
  y = supY + 4;

  // === LINE ITEMS ===
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...gold);
  doc.text('LINE ITEMS', margin, y);
  y += 3;

  // Header row (navy background)
  doc.setFillColor(...navy);
  doc.rect(margin, y, contentW, 7, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');

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

  // Line rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
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
    doc.text(String(l.nsn || l.part_number || '—').substring(0, 18), colX.part, y);

    doc.setTextColor(60, 60, 60);
    doc.setFont('helvetica', 'normal');
    doc.text(String(l.item_name || '—').substring(0, 32), colX.desc, y);

    doc.text(String(l.condition_code || '—'), colX.cond, y, { align: 'center' });
    doc.text(String(l.quantity || 0), colX.qty, y, { align: 'center' });
    doc.text(fmtMoney(l.unit_cost), colX.cost + 15, y, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.text(fmtMoney(l.line_total), colX.total + 22, y, { align: 'right' });

    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.1);
    doc.line(margin, y + 2, pageW - margin, y + 2);
    y += 7;
  });

  y += 4;

  // === TOTALS ===
  if (y > 230) { doc.addPage(); y = 20; }

  const totalsX = pageW - margin - 60;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text('Subtotal:', totalsX, y);
  doc.setTextColor(40, 40, 40);
  doc.text(fmtMoney(po.subtotal), pageW - margin, y, { align: 'right' });
  y += 5;

  doc.setTextColor(60, 60, 60);
  doc.text('Shipping:', totalsX, y);
  doc.setTextColor(40, 40, 40);
  doc.text(fmtMoney(po.shipping_cost), pageW - margin, y, { align: 'right' });
  y += 6;

  // Gold total bar
  doc.setFillColor(...gold);
  doc.rect(totalsX - 4, y - 5, pageW - margin - totalsX + 4, 8, 'F');
  doc.setTextColor(...navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('TOTAL:', totalsX, y);
  doc.text(fmtMoney(po.total), pageW - margin, y, { align: 'right' });
  y += 12;

  // === NOTES ===
  if (po.notes) {
    if (y > 240) { doc.addPage(); y = 20; }
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
    const noteLines = doc.splitTextToSize(String(po.notes), contentW - 10);
    doc.text(noteLines.slice(0, 2), margin + 3, y + 4);
    y += 18;
  }

  // === TERMS ===
  if (y > 220) { doc.addPage(); y = 20; }
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...gold);
  doc.text('TERMS & CONDITIONS', margin, y);
  y += 4;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);

  const terms = [
    '1. All parts must include applicable certifications: FAA 8130-3 (when required), Certificate of Conformance, and full traceability documentation.',
    '2. Payment terms: ' + (po.supplier_payment_terms || 'NET 30') + '. Invoice to be sent to DTorchia@JupiterOneUSA.com.',
    '3. Acknowledgment of this PO is requested within 48 hours. Acknowledgment constitutes acceptance of these terms.',
    '4. Reference PO number ' + po.po_number + ' on all packing slips, invoices, and correspondence.',
    '5. Parts subject to inspection upon receipt; non-conforming product may be rejected at supplier\'s expense.'
  ];

  terms.forEach(function(t) {
    const wrap = doc.splitTextToSize(t, contentW);
    wrap.forEach(function(line) {
      if (y > 280) { doc.addPage(); y = 20; }
      doc.text(line, margin, y);
      y += 3.5;
    });
    y += 0.5;
  });

  // === FOOTER ===
  doc.setFillColor(...navy);
  doc.rect(0, 282, pageW, 15, 'F');
  doc.setFontSize(7);
  doc.setTextColor(180, 180, 180);
  doc.text(
    'Jupiter One USA · CAGE Code on request · This PO is electronically issued and valid without signature',
    pageW / 2, 290, { align: 'center' }
  );

  // Return as Buffer for the route to stream
  const arrayBuffer = doc.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}
