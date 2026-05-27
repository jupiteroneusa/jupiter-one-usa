// services/invoicePdfService.js
// INVOICE_REDESIGN_v1
// Generates the customer-facing Invoice PDF in the original Jupiter One style.
import { jsPDF } from 'jspdf';
import { getPool, sql } from '../db/connect.js';

function fmtMoney(n) {
  const v = parseFloat(n || 0);
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return (dt.getMonth() + 1).toString().padStart(2, '0') + '/' +
         dt.getDate().toString().padStart(2, '0') + '/' +
         dt.getFullYear();
}

export async function generateInvoicePdf(invoiceId, options) {
  options = options || {};
  const userNotes = options.notes || null;

  const pool = await getPool();

  const invR = await pool.request().input('id', sql.BigInt, invoiceId).query(`
    SELECT i.*,
           o.order_number, o.customer_id, o.quote_id, o.shipping_cost AS o_shipping,
           o.total_amount AS o_total, o.subtotal AS o_subtotal,
           o.ship_to_address1, o.ship_to_address2, o.ship_to_city, o.ship_to_state,
           o.ship_to_zip, o.ship_to_country,
           o.buyer_name, o.buyer_email, o.buyer_phone,
           o.bill_to_address1, o.bill_to_city, o.bill_to_state, o.bill_to_zip, o.bill_to_country,
           o.customer_po_number,
           c.first_name, c.last_name, c.email, c.phone, c.company,
           c.billing_address1 AS c_billing_address1, c.billing_address2 AS c_billing_address2,
           c.billing_city AS c_billing_city, c.billing_state AS c_billing_state,
           c.billing_zip AS c_billing_zip, c.billing_country AS c_billing_country,
           q.quote_number
    FROM invoices i
    INNER JOIN orders o ON o.id = i.order_id
    INNER JOIN customers c ON c.id = o.customer_id
    LEFT JOIN quotes q ON q.id = o.quote_id
    WHERE i.id = @id
  `);
  if (!invR.recordset.length) throw new Error('Invoice not found: ' + invoiceId);
  const inv = invR.recordset[0];

  const linesR = await pool.request().input('oid', sql.BigInt, inv.order_id)
    .query('SELECT * FROM order_lines WHERE order_id=@oid ORDER BY line_number');
  const lines = linesR.recordset || [];

  const isPaidInFull = (inv.status === 'Paid') || (parseFloat(inv.balance_due || 0) === 0 && parseFloat(inv.total_amount || 0) > 0);

  const gold = [200, 147, 42];
  const navy = [10, 22, 40];
  const dark = [30, 30, 30];

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = 215.9;
  const pageH = 279.4;
  const margin = 14;
  const contentW = pageW - margin * 2;

  doc.setFillColor.apply(doc, gold);
  doc.rect(0, 0, pageW, 1.2, 'F');

  let y = 14;
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, gold);
  doc.text('JUPITER ONE USA', margin, y);
  y += 5;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('AEROSPACE & DEFENSE PARTS SUPPLY', margin, y);
  y += 6;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('400 N Tampa St, Suite 1550', margin, y); y += 4;
  doc.text('Tampa, FL 33602', margin, y); y += 4;
  doc.text('Phone: (347) 821-7412 \u00B7 contact@jupiteroneusa.com', margin, y); y += 4;

  let ry = 14;
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, navy);
  doc.text('INVOICE', pageW - margin, ry, { align: 'right' });
  ry += 5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, gold);
  doc.text('# ' + (inv.invoice_number || ''), pageW - margin, ry, { align: 'right' });
  ry += 6;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('Invoice Date: ' + fmtDate(inv.issue_date || inv.created_at), pageW - margin, ry, { align: 'right' });
  ry += 4;
  doc.text('Due Date: ' + (isPaidInFull ? 'PAID' : fmtDate(inv.due_date)), pageW - margin, ry, { align: 'right' });
  ry += 4;
  doc.text('Terms: ' + (inv.payment_terms || 'Due on Receipt'), pageW - margin, ry, { align: 'right' });
  ry += 4;

  if (isPaidInFull) {
    doc.setFillColor(76, 175, 80);
    doc.roundedRect(pageW - margin - 34, ry, 34, 6, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('PAID IN FULL', pageW - margin - 17, ry + 4.2, { align: 'center' });
    ry += 8;
  }

  y = Math.max(y, ry) + 4;
  doc.setDrawColor.apply(doc, gold);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  y += 7;

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.rect(margin, y - 4, contentW, 14, 'S');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, gold);
  doc.text('CUSTOMER PURCHASE ORDER #', margin + 3, y);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, navy);
  doc.text(String(inv.customer_po_number || '\u2014'), margin + 3, y + 6);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('PO Date: ' + fmtDate(inv.issue_date || inv.created_at), pageW - margin - 3, y, { align: 'right' });
  if (inv.quote_number) {
    doc.text('Quote Reference: ' + inv.quote_number, pageW - margin - 3, y + 6, { align: 'right' });
  }
  y += 16;

  const boxW = (contentW - 4) / 2;
  const boxH = 36;

  doc.setDrawColor(220, 220, 220);
  doc.rect(margin, y, boxW, boxH, 'S');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, gold);
  doc.text('BILL TO', margin + 3, y + 4);

  const billName = (inv.buyer_name && String(inv.buyer_name).trim())
    ? String(inv.buyer_name).trim()
    : (inv.company || ((inv.first_name || '') + ' ' + (inv.last_name || '')).trim() || '\u2014');
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, dark);
  doc.text(billName, margin + 3, y + 10);

  let by = y + 14;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);

  if (inv.buyer_name && inv.company) {
    doc.text('Attn: ' + inv.buyer_name, margin + 3, by); by += 4;
  } else if (inv.company && (inv.first_name || inv.last_name)) {
    doc.text('Attn: ' + ((inv.first_name || '') + ' ' + (inv.last_name || '')).trim(), margin + 3, by); by += 4;
  }

  const billAddr1 = inv.bill_to_address1 || inv.c_billing_address1 || '';
  const billCity = inv.bill_to_city || inv.c_billing_city || '';
  const billState = inv.bill_to_state || inv.c_billing_state || '';
  const billZip = inv.bill_to_zip || inv.c_billing_zip || '';
  const billCountry = inv.bill_to_country || inv.c_billing_country || '';

  if (billAddr1) { doc.text(billAddr1, margin + 3, by); by += 4; }
  const billCityLine = [billCity, billState, billZip].filter(Boolean).join(', ');
  if (billCityLine) { doc.text(billCityLine, margin + 3, by); by += 4; }
  if (billCountry) { doc.text(billCountry, margin + 3, by); by += 4; }
  const billPhone = inv.buyer_phone || inv.phone;
  if (billPhone) { doc.text('Phone: ' + billPhone, margin + 3, by); by += 4; }
  const billEmail = inv.buyer_email || inv.email;
  if (billEmail) { doc.text('Email: ' + billEmail, margin + 3, by); by += 4; }

  const shipX = margin + boxW + 4;
  doc.setDrawColor(220, 220, 220);
  doc.rect(shipX, y, boxW, boxH, 'S');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, gold);
  doc.text('SHIP TO', shipX + 3, y + 4);

  const shipName = inv.company || ((inv.first_name || '') + ' ' + (inv.last_name || '')).trim() || '\u2014';
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, dark);
  doc.text(shipName, shipX + 3, y + 10);

  let sy = y + 14;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  if (inv.company && (inv.first_name || inv.last_name)) {
    doc.text('Attn: ' + ((inv.first_name || '') + ' ' + (inv.last_name || '')).trim(), shipX + 3, sy); sy += 4;
  }
  if (inv.ship_to_address1) { doc.text(inv.ship_to_address1, shipX + 3, sy); sy += 4; }
  if (inv.ship_to_address2) { doc.text(inv.ship_to_address2, shipX + 3, sy); sy += 4; }
  const shipCityLine = [inv.ship_to_city, inv.ship_to_state, inv.ship_to_zip].filter(Boolean).join(', ');
  if (shipCityLine) { doc.text(shipCityLine, shipX + 3, sy); sy += 4; }
  if (inv.ship_to_country) { doc.text(inv.ship_to_country, shipX + 3, sy); sy += 4; }
  if (inv.phone) { doc.text('Phone: ' + inv.phone, shipX + 3, sy); sy += 4; }

  y += boxH + 6;

  const cols = {
    line:  { x: margin + 2 },
    part:  { x: margin + 14 },
    desc:  { x: margin + 48 },
    cond:  { x: margin + 120 },
    qty:   { x: margin + 134 },
    price: { x: margin + 148 },
    total: { x: pageW - margin - 2 }
  };

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text('LINE', cols.line.x, y);
  doc.text('PART # / NSN', cols.part.x, y);
  doc.text('DESCRIPTION', cols.desc.x, y);
  doc.text('COND', cols.cond.x, y);
  doc.text('QTY', cols.qty.x, y);
  doc.text('UNIT PRICE', cols.price.x, y);
  doc.text('LINE TOTAL', cols.total.x, y, { align: 'right' });
  y += 2;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 4;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor.apply(doc, dark);

  let lineIdx = 1;
  for (const l of lines) {
    if (y > pageH - 80) { doc.addPage(); y = 20; }
    const partTxt = String(l.part_number || l.nsn || '\u2014').substring(0, 18);
    const descTxt = String(l.item_name || l.description || '\u2014').substring(0, 38);
    const condTxt = String(l.condition_code || 'NE');
    const qty = (l.quantity_ordered != null) ? l.quantity_ordered : (l.quantity || 0);

    doc.setFont('helvetica', 'normal');
    doc.text(String(lineIdx), cols.line.x, y);
    doc.setFont('helvetica', 'bold');
    doc.text(partTxt, cols.part.x, y);
    doc.setFont('helvetica', 'normal');
    doc.text(descTxt, cols.desc.x, y);
    doc.text(condTxt, cols.cond.x, y);
    doc.text(String(qty), cols.qty.x, y);
    doc.text(fmtMoney(l.unit_price || 0), cols.price.x, y);
    doc.setFont('helvetica', 'bold');
    doc.text(fmtMoney(l.line_total || 0), cols.total.x, y, { align: 'right' });
    y += 5;

    if (l.manufacturer || l.cert_provided) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(120, 120, 120);
      let subY = y;
      if (l.manufacturer) { doc.text('Mfg: ' + String(l.manufacturer).substring(0, 32), cols.desc.x, subY); subY += 3.5; }
      if (l.cert_provided) { doc.text(String(l.cert_provided).substring(0, 32) + ' Provided', cols.desc.x, subY); subY += 3.5; }
      y = subY + 1;
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor.apply(doc, dark);
    }
    y += 1;
    lineIdx++;
  }

  y += 6;
  const subtotal = parseFloat(inv.o_subtotal || 0);
  const shipping = parseFloat(inv.o_shipping || 0);
  const total = parseFloat(inv.o_total || inv.total_amount || 0);
  const preFee = subtotal + shipping;
  const ccFee = (inv.payment_method && inv.payment_method.indexOf('Credit') !== -1)
    ? Math.max(0, total - preFee) : 0;

  const totalsX = pageW - margin - 70;
  const totalsW = 70;

  function totalRow(label, value, opts) {
    opts = opts || {};
    if (opts.italic) doc.setFont('helvetica', 'italic'); else if (opts.bold) doc.setFont('helvetica', 'bold'); else doc.setFont('helvetica', 'normal');
    if (opts.color) doc.setTextColor.apply(doc, opts.color); else doc.setTextColor(60, 60, 60);
    if (opts.size) doc.setFontSize(opts.size); else doc.setFontSize(9);
    doc.text(label, totalsX + 2, y);
    doc.text(value, pageW - margin - 2, y, { align: 'right' });
    y += opts.gap || 5;
  }

  totalRow('Subtotal:', fmtMoney(subtotal));
  totalRow('Shipping & Handling:', fmtMoney(shipping));
  totalRow('Tax (Resale Exempt):', fmtMoney(0), { italic: true, color: [120, 120, 120] });

  if (ccFee > 0.005) {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(totalsX, y - 2, pageW - margin, y - 2);
    totalRow('Subtotal:', fmtMoney(preFee));
    totalRow('Credit Card Convenience Fee (3.5%):', fmtMoney(ccFee), { italic: true, color: [120, 120, 120], size: 8 });
  }

  y += 1;
  if (isPaidInFull) {
    doc.setDrawColor.apply(doc, gold);
    doc.setLineWidth(0.7);
    doc.rect(totalsX, y - 4, totalsW, 12, 'S');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor.apply(doc, navy);
    doc.text('AMOUNT PAID', totalsX + 3, y);
    doc.text(fmtMoney(total), pageW - margin - 2, y, { align: 'right' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text('USD' + (inv.payment_method ? ' - ' + inv.payment_method : ''), totalsX + 3, y + 4);
    y += 14;
    doc.setFillColor(232, 245, 233);
    doc.rect(totalsX, y - 4, totalsW, 6, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(46, 125, 50);
    doc.text('BALANCE DUE', totalsX + 3, y);
    doc.text('$0.00', pageW - margin - 2, y, { align: 'right' });
    y += 8;
  } else {
    doc.setDrawColor.apply(doc, gold);
    doc.setLineWidth(0.7);
    doc.rect(totalsX, y - 4, totalsW, 12, 'S');
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor.apply(doc, navy);
    doc.text('TOTAL DUE', totalsX + 3, y);
    doc.text(fmtMoney(total), pageW - margin - 2, y, { align: 'right' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text('USD' + (inv.payment_method ? ' - ' + inv.payment_method : ''), totalsX + 3, y + 4);
    y += 16;
  }

  if (!isPaidInFull) {
    const piH = 22;
    doc.setDrawColor.apply(doc, gold);
    doc.setLineWidth(0.5);
    doc.rect(margin, y, contentW, piH, 'S');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor.apply(doc, gold);
    doc.text('PAYMENT INSTRUCTIONS \u2014 ' + (inv.payment_method ? inv.payment_method.toUpperCase() : 'CREDIT CARD OR WIRE'), margin + 3, y + 5);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text('Please contact our office to provide credit card details for processing:', margin + 3, y + 11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor.apply(doc, dark);
    doc.text('Phone: (347) 821-7412  \u00B7  Email: contact@jupiteroneusa.com', margin + 3, y + 16);
    if (ccFee > 0.005) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 120);
      doc.text('A 3.5% convenience fee has been included in the total above. Reference Customer PO# on all correspondence.', margin + 3, y + 20);
    }
    y += piH + 6;
  } else {
    const tyH = 16;
    doc.setDrawColor(76, 175, 80);
    doc.setLineWidth(0.5);
    doc.rect(margin, y, contentW, tyH, 'S');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(46, 125, 50);
    doc.text('PAYMENT RECEIVED \u2014 THANK YOU', margin + 3, y + 5);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text('This invoice has been paid in full. Reference Customer PO# on all future correspondence.', margin + 3, y + 11);
    y += tyH + 6;
  }

  if (userNotes) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const noteLines = doc.splitTextToSize('Notes: ' + userNotes, contentW);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 4 + 2;
  }

  if (y > pageH - 60) { doc.addPage(); y = 20; }
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  doc.text('TERMS & CONDITIONS', margin, y);
  y += 4;
  const terms = [
    '1. Payment is due upon receipt. Past due invoices may be subject to interest at 1.5% per month.',
    '2. All sales are final. Returns require prior written authorization (RMA) within 10 days of receipt.',
    '3. Buyer is responsible for compliance with all applicable U.S. export control laws (ITAR, EAR). Re-export of these items may require U.S. Government authorization.',
    '4. Jupiter One USA LLC is not liable for delays caused by force majeure, supplier shortages, or customs clearance.',
    '5. Reference invoice number and customer PO number on all correspondence and payments.'
  ];
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  for (const t of terms) {
    const lns = doc.splitTextToSize(t, contentW);
    doc.text(lns, margin, y);
    y += lns.length * 3.4 + 0.5;
  }

  doc.setDrawColor.apply(doc, gold);
  doc.setLineWidth(0.3);
  doc.line(margin, pageH - 14, pageW - margin, pageH - 14);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('Jupiter One USA LLC  \u00B7  400 N Tampa St, Suite 1550, Tampa FL 33602', margin, pageH - 9);
  doc.text('Thank you for your business.', pageW - margin, pageH - 9, { align: 'right' });

  const arr = doc.output('arraybuffer');
  return Buffer.from(arr);
}
