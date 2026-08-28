import { jsPDF } from 'jspdf';

function money(value) {
  return '$' + Number(value || 0).toFixed(2);
}

export function generateReturnPdf({ returnRecord, order, customer, lines }) {
  const doc = new jsPDF();
  const margin = 18;
  let y = 22;
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('JUPITER ONE USA LLC', margin, y);
  y += 9;
  doc.setFontSize(14);
  doc.text('RETURN MERCHANDISE AUTHORIZATION', margin, y);
  y += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`RMA: ${returnRecord.rma_number || 'Preview'}`, margin, y);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 130, y);
  y += 10;
  doc.setDrawColor(200, 147, 42);
  doc.line(margin, y, 192, y);
  y += 9;
  doc.setFont('helvetica', 'bold');
  doc.text('Buyer / Order Information', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.text(`${customer.first_name || ''} ${customer.last_name || ''}`, margin, y);
  doc.text(`Order: ${order.order_number || '—'}`, 110, y);
  y += 5;
  doc.text(customer.company || '—', margin, y);
  doc.text(`Customer PO: ${order.customer_po || '—'}`, 110, y);
  y += 5;
  doc.text(customer.email || '—', margin, y);
  doc.text(`Status: ${returnRecord.status || 'Preview'}`, 110, y);
  y += 9;
  doc.text(`Reason: ${returnRecord.reason || '—'}`, margin, y);
  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.text('Return Lines', margin, y);
  y += 7;
  doc.setFontSize(9);
  doc.text('Line', margin, y);
  doc.text('Part / Description', 35, y);
  doc.text('Qty', 123, y);
  doc.text('Unit Price', 143, y);
  doc.text('Extended', 172, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  let total = 0;
  for (const line of lines) {
    const extended = Number(line.quantity_requested || 0) * Number(line.unit_price || 0);
    total += extended;
    const label = String(line.nsn || line.part_number || line.item_name || '—').slice(0, 42);
    doc.text(String(line.line_number || '—'), margin, y);
    doc.text(label, 35, y);
    doc.text(String(line.quantity_requested || 0), 125, y);
    doc.text(money(line.unit_price), 143, y);
    doc.text(money(extended), 172, y);
    y += 6;
    if (y > 270) { doc.addPage(); y = 20; }
  }
  y += 4;
  doc.line(margin, y, 192, y);
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text(`Requested Return Total: ${money(total)}`, 130, y);
  y += 12;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('This document is for return authorization and processing. Final credit is subject to approval,', margin, y);
  doc.text('receipt, and inspection of the returned material.', margin, y + 5);
  return Buffer.from(doc.output('arraybuffer'));
}
