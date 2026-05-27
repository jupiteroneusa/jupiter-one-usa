// services/ccAuthPdfService.js
// CC_AUTH_PDF_v2
// Redesigned to match original Jupiter One CC Authorization form.
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
function fmtDateTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export async function generateCcAuthPdf(authId) {
  const pool = await getPool();
  const r = await pool.request().input('id', sql.BigInt, authId).query(`
    SELECT a.*,
           pf.proforma_number, pf.total AS proforma_total, pf.payment_method,
           pf.cc_fee_amount, pf.subtotal AS pf_subtotal, pf.shipping_cost AS pf_shipping,
           o.order_number, o.customer_po_number,
           o.buyer_name, o.buyer_email, o.buyer_phone,
           c.first_name, c.last_name, c.email, c.company
    FROM cc_authorizations a
    LEFT JOIN proformas pf ON pf.id = a.proforma_id
    LEFT JOIN orders o ON o.id = a.order_id
    LEFT JOIN customers c ON c.id = o.customer_id
    WHERE a.id = @id
  `);
  if (!r.recordset.length) throw new Error('CC authorization not found: ' + authId);
  const a = r.recordset[0];

  const gold = [200, 147, 42];
  const navy = [10, 22, 40];
  const lineGray = [180, 180, 180];

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
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, navy);
  doc.text('CREDIT CARD', pageW - margin, ry, { align: 'right' });
  ry += 6;
  doc.text('AUTHORIZATION', pageW - margin, ry, { align: 'right' });
  ry += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, gold);
  doc.text('For Invoice ' + (a.proforma_number || '\u2014'), pageW - margin, ry, { align: 'right' });
  ry += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('Date Signed: ' + fmtDate(a.signed_at), pageW - margin, ry, { align: 'right' });
  ry += 4;
  if (a.order_number) { doc.text('Order #: ' + a.order_number, pageW - margin, ry, { align: 'right' }); ry += 4; }
  if (a.customer_po_number) { doc.text('Customer PO: ' + a.customer_po_number, pageW - margin, ry, { align: 'right' }); ry += 4; }

  y = Math.max(y, ry) + 3;
  doc.setDrawColor.apply(doc, gold);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  const amtBoxH = 22;
  doc.setDrawColor.apply(doc, gold);
  doc.setLineWidth(0.7);
  doc.rect(margin, y, contentW, amtBoxH, 'S');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, gold);
  doc.text('AMOUNT AUTHORIZED', margin + 4, y + 6);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, navy);
  doc.text(fmtMoney(a.amount_authorized || a.proforma_total || 0), margin + 4, y + 17);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('Invoice: ' + (a.proforma_number || '\u2014'), pageW - margin - 4, y + 6, { align: 'right' });
  if (a.cc_fee_amount && parseFloat(a.cc_fee_amount) > 0) {
    doc.setFontSize(7.5);
    doc.text('Includes 3.5% credit card convenience fee', pageW - margin - 4, y + 11, { align: 'right' });
  }
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 120, 120);
  doc.text('USD', pageW - margin - 4, y + 17, { align: 'right' });
  y += amtBoxH + 8;

  function sectionHeader(num, title) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor.apply(doc, navy);
    doc.text(num + '. ' + title, margin, y);
    doc.setDrawColor.apply(doc, gold);
    doc.setLineWidth(0.3);
    doc.line(margin, y + 1.5, margin + 60, y + 1.5);
    y += 6;
  }
  function field(label, value, x, fieldW) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(label, x, y);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    doc.text(String(value || '').substring(0, 60), x, y + 5);
    doc.setDrawColor.apply(doc, lineGray);
    doc.setLineWidth(0.2);
    doc.line(x, y + 6, x + fieldW, y + 6);
  }

  sectionHeader('1', 'CARDHOLDER INFORMATION');
  field('CARDHOLDER NAME (as shown on card)', a.cardholder_name, margin, 90);
  field('COMPANY', a.cardholder_company || a.company || '', margin + 100, 84);
  y += 10;
  field('BILLING ADDRESS', a.billing_address1 || '', margin, contentW);
  y += 10;
  field('CITY', a.billing_city || '', margin, 60);
  field('STATE', a.billing_state || '', margin + 70, 30);
  field('ZIP CODE', a.billing_zip || '', margin + 110, 30);
  y += 10;
  field('PHONE', a.buyer_phone || '', margin, 75);
  field('EMAIL', a.cardholder_email || a.buyer_email || a.email || '', margin + 85, 99);
  y += 12;

  sectionHeader('2', 'CARD INFORMATION');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('CARD TYPE (check one)', margin, y);
  y += 5;
  const types = ['Visa', 'MasterCard', 'American Express', 'Discover'];
  const cardType = (a.card_type || '').toLowerCase();
  let cx = margin;
  for (const t of types) {
    const isChecked = cardType.indexOf(t.toLowerCase().substring(0, 4)) !== -1;
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.3);
    doc.rect(cx, y - 3, 3, 3, 'S');
    if (isChecked) {
      doc.setLineWidth(0.6);
      doc.line(cx + 0.5, y - 2.5, cx + 2.5, y - 0.5);
      doc.line(cx + 2.5, y - 2.5, cx + 0.5, y - 0.5);
    }
    doc.setFontSize(9);
    doc.setFont('helvetica', isChecked ? 'bold' : 'normal');
    doc.setTextColor(isChecked ? 30 : 80, isChecked ? 30 : 80, isChecked ? 30 : 80);
    doc.text(t, cx + 5, y);
    cx += t === 'American Express' ? 50 : 40;
  }
  y += 8;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('CARD NUMBER', margin, y);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);
  const cardMask = a.card_last4 ? ('**** **** **** ' + a.card_last4) : '';
  doc.text(cardMask, margin, y + 5);
  doc.setDrawColor.apply(doc, lineGray);
  doc.setLineWidth(0.2);
  doc.line(margin, y + 6, pageW - margin, y + 6);
  y += 10;
  const expStr = (a.exp_month && a.exp_year)
    ? String(a.exp_month).padStart(2, '0') + ' / ' + a.exp_year : '';
  field('EXPIRATION DATE (MM/YY)', expStr, margin, 55);
  field('SECURITY CODE (CVV)', '', margin + 65, 55);
  field('BILLING ZIP (for verification)', a.billing_zip || '', margin + 130, 50);
  y += 12;

  if (y > pageH - 80) { doc.addPage(); y = 20; }
  sectionHeader('3', 'AUTHORIZATION');

  const authText = 'By signing below, I (the cardholder) authorize Jupiter One USA, LLC to charge the credit card listed above for the amount of ' +
    fmtMoney(a.amount_authorized || a.proforma_total || 0) +
    ' in payment of Invoice ' + (a.proforma_number || '\u2014') +
    (a.customer_po_number ? ' (Customer PO ' + a.customer_po_number + ')' : '') + '.';
  const authText2 = 'I certify that I am the authorized cardholder and have the authority to make this purchase on behalf of the company listed above. I acknowledge this charge is for goods or services received and I waive my right to chargeback for non-receipt unless reported in writing to Jupiter One USA LLC within ten (10) days of delivery. I have reviewed the referenced invoice and approve the total amount being charged, which includes the disclosed 3.5% credit card convenience fee.';

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);
  const lines1 = doc.splitTextToSize(authText, contentW - 8);
  const lines2 = doc.splitTextToSize(authText2, contentW - 8);
  const totalLines = lines1.length + 1 + lines2.length;
  const boxH = totalLines * 4 + 6;

  doc.setFillColor(248, 248, 248);
  doc.rect(margin, y - 4, contentW, boxH, 'F');
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.rect(margin, y - 4, contentW, boxH, 'S');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(40, 40, 40);
  doc.text(lines1, margin + 3, y);
  y += lines1.length * 4 + 3;
  doc.text(lines2, margin + 3, y);
  y += lines2.length * 4 + 4;

  y += 4;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('CARDHOLDER SIGNATURE', margin, y);
  doc.text('DATE', margin + 130, y);
  y += 4;

  let sigDrawn = false;
  if (a.signature_image && typeof a.signature_image === 'string' && a.signature_image.indexOf('data:image') === 0) {
    try { doc.addImage(a.signature_image, 'PNG', margin, y, 80, 16); sigDrawn = true; } catch (e) {}
  }
  if (!sigDrawn && a.signature_typed) {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor.apply(doc, navy);
    doc.text(String(a.signature_typed), margin + 2, y + 10);
  }
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);
  doc.text(fmtDate(a.signed_at), margin + 130, y + 10);

  y += 16;
  doc.setDrawColor.apply(doc, lineGray);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + 100, y);
  doc.line(margin + 130, y, pageW - margin, y);
  y += 6;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text('PRINT NAME', margin, y);
  doc.text('TITLE', margin + 130, y);
  y += 4;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);
  doc.text(String(a.cardholder_name || ''), margin, y + 4);
  if (a.cardholder_title) doc.text(String(a.cardholder_title), margin + 130, y + 4);
  y += 8;
  doc.setDrawColor.apply(doc, lineGray);
  doc.line(margin, y, margin + 100, y);
  doc.line(margin + 130, y, pageW - margin, y);
  y += 8;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(140, 140, 140);
  let auditLine = 'Signed: ' + fmtDateTime(a.signed_at);
  if (a.signer_ip) auditLine += '   \u00B7   IP: ' + a.signer_ip;
  doc.text(auditLine, margin, y);
  y += 3.5;
  if (a.signer_user_agent) {
    const ua = 'User-Agent: ' + String(a.signer_user_agent).substring(0, 120);
    doc.text(ua, margin, y);
    y += 3.5;
  }

  if (a.captured_at) {
    y += 4;
    doc.setFillColor(232, 245, 233);
    doc.rect(margin, y - 3, contentW, 12, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(46, 125, 50);
    doc.text('\u2713 CHARGED', margin + 4, y + 3);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    let charged = 'Date: ' + fmtDate(a.captured_at);
    if (a.captured_amount) charged += '   \u00B7   Amount: ' + fmtMoney(a.captured_amount);
    if (a.captured_reference) charged += '   \u00B7   Ref: ' + a.captured_reference;
    doc.text(charged, margin + 4, y + 8);
    y += 14;
  }

  const retY = pageH - 28;
  doc.setDrawColor.apply(doc, gold);
  doc.setLineWidth(0.5);
  doc.rect(margin, retY, contentW, 16, 'S');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, gold);
  doc.text('RETURN COMPLETED FORM', margin + 3, retY + 5);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('Email completed and signed form to:', margin + 3, retY + 10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, navy);
  doc.text('contact@jupiteroneusa.com', margin + 60, retY + 10);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text('This form contains sensitive payment information. Please send via secure email or call (347) 821-7412 to provide details directly.', margin + 3, retY + 14);

  const arr = doc.output('arraybuffer');
  return Buffer.from(arr);
}
