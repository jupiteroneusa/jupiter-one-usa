// services/ccAuthPdfService.js
// CC_AUTH_PDF_v1
// Generates a signed Credit Card Authorization PDF from a cc_authorizations row.
// Pulls auth + proforma + customer info, renders with jsPDF, returns Buffer.
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
           o.order_number,
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
  const midGray = [120, 120, 120];
  const lightGray = [220, 220, 220];

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = 215.9;
  const pageH = 279.4;
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = 12;

  // Gold top bar
  doc.setFillColor.apply(doc, gold);
  doc.rect(0, 0, pageW, 1.5, 'F');

  // Header: Company name + logo placeholder
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, navy);
  doc.text('JUPITER ONE USA', margin, y + 5);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor.apply(doc, midGray);
  doc.text('400 N Tampa St, Suite 1550, Tampa FL', margin, y + 10);
  doc.text('(347) 821-7412  ·  contact@jupiteroneusa.com', margin, y + 14);

  // Right side: doc title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, gold);
  doc.text('CREDIT CARD', pageW - margin, y + 5, { align: 'right' });
  doc.text('AUTHORIZATION', pageW - margin, y + 11, { align: 'right' });

  y += 22;

  // Divider
  doc.setDrawColor.apply(doc, gold);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // Reference block
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, navy);
  doc.text('Reference', margin, y);
  y += 5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('Proforma #:', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.text(a.proforma_number || '—', margin + 28, y);
  doc.setFont('helvetica', 'normal');
  doc.text('Order #:', margin + 90, y);
  doc.setFont('helvetica', 'bold');
  doc.text(a.order_number || '—', margin + 110, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text('Date Signed:', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.text(fmtDateTime(a.signed_at), margin + 28, y);
  y += 8;

  // Cardholder block
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, navy);
  doc.text('Cardholder Information', margin, y);
  y += 5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);

  function row(label, val) {
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'bold');
    doc.text(String(val || '—'), margin + 38, y);
    doc.setFont('helvetica', 'normal');
    y += 5;
  }
  row('Cardholder Name:', a.cardholder_name);
  row('Company:', a.cardholder_company || a.company);
  row('Email:', a.cardholder_email || a.email);
  if (a.cardholder_title) row('Title:', a.cardholder_title);
  y += 3;

  // Card block
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, navy);
  doc.text('Card Details', margin, y);
  y += 5;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  const cardLine = (a.card_type ? a.card_type + ' ' : '') + 'ending in ' + (a.card_last4 || '••••');
  row('Card:', cardLine);
  const expStr = (a.exp_month && a.exp_year) ? String(a.exp_month).padStart(2, '0') + ' / ' + a.exp_year : '—';
  row('Expiration:', expStr);
  row('Billing Address:', a.billing_address1);
  const cityLine = [a.billing_city, a.billing_state, a.billing_zip].filter(Boolean).join(', ');
  row('City/State/Zip:', cityLine);
  if (a.billing_country) row('Country:', a.billing_country);
  y += 3;

  // Amount authorized block
  doc.setFillColor.apply(doc, gold);
  doc.rect(margin, y, contentW, 14, 'F');
  doc.setTextColor.apply(doc, navy);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('AMOUNT AUTHORIZED:', margin + 4, y + 9);
  doc.setFontSize(13);
  doc.text(fmtMoney(a.amount_authorized || a.proforma_total || 0), pageW - margin - 4, y + 9, { align: 'right' });
  y += 18;

  // Authorization statement
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  const statement = 'I, ' + (a.cardholder_name || 'the undersigned') + ', authorize Jupiter One USA, LLC to charge the credit card listed above for the amount shown for proforma invoice ' + (a.proforma_number || '—') + '. I confirm that I am the authorized cardholder and that the information provided is accurate. This authorization will remain in effect for this transaction only.';
  const stmtLines = doc.splitTextToSize(statement, contentW);
  doc.text(stmtLines, margin, y);
  y += stmtLines.length * 4 + 4;

  // Signature block
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor.apply(doc, navy);
  doc.text('Signature', margin, y);
  y += 6;

  // Render signature: either image or typed
  if (a.signature_image && a.signature_image.indexOf('data:image') === 0) {
    try {
      // signature_image is data URL e.g. data:image/png;base64,...
      const sigW = 80;
      const sigH = 25;
      // jsPDF accepts data URLs in addImage
      doc.addImage(a.signature_image, 'PNG', margin, y, sigW, sigH);
      y += sigH + 2;
    } catch (e) {
      // Fallback to typed if image fails
      doc.setFontSize(14);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor.apply(doc, navy);
      doc.text(a.signature_typed || a.cardholder_name || '', margin + 2, y + 8);
      y += 14;
    }
  } else if (a.signature_typed) {
    // Typed signature, render in script-style italic
    doc.setFontSize(16);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor.apply(doc, navy);
    doc.text(a.signature_typed, margin + 2, y + 8);
    y += 14;
  } else {
    // Neither typed nor image — show a placeholder
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor.apply(doc, midGray);
    doc.text('(no signature recorded)', margin, y + 6);
    y += 10;
  }

  // Signature line + audit info
  doc.setDrawColor.apply(doc, lightGray);
  doc.setLineWidth(0.2);
  doc.line(margin, y, margin + 90, y);
  y += 4;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor.apply(doc, midGray);
  doc.text('Signed: ' + fmtDateTime(a.signed_at), margin, y);
  if (a.signer_ip) {
    doc.text('IP: ' + a.signer_ip, margin + 90, y);
  }
  y += 4;
  if (a.signer_user_agent) {
    const uaLine = 'User-Agent: ' + a.signer_user_agent.substring(0, 100);
    doc.text(uaLine, margin, y);
    y += 4;
  }

  // Captured block (if charged)
  if (a.captured_at) {
    y += 4;
    doc.setFillColor(240, 248, 240);
    doc.rect(margin, y, contentW, 16, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(76, 175, 80);
    doc.text('✓ CHARGED', margin + 4, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text('Date: ' + fmtDate(a.captured_at), margin + 4, y + 11);
    if (a.captured_amount) doc.text('Amount: ' + fmtMoney(a.captured_amount), margin + 50, y + 11);
    if (a.captured_reference) doc.text('Ref: ' + a.captured_reference, margin + 100, y + 11);
    y += 20;
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor.apply(doc, midGray);
  doc.text(
    'This document was generated by Jupiter One USA admin system. For inquiries: contact@jupiteroneusa.com',
    pageW / 2,
    pageH - 8,
    { align: 'center' }
  );

  // Convert to Buffer
  const arr = doc.output('arraybuffer');
  return Buffer.from(arr);
}
