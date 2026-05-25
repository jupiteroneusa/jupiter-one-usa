// QUOTE_PDF_v1 - generateQuotePdf rewritten with jsPDF (modeled on poPdfService.js)
// services/pdfService.js
// No puppeteer, no chromium. Pure Node, works on Azure.

import { jsPDF } from 'jspdf';

function fmtMoney(n) {
  const v = parseFloat(n || 0);
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ============================================================================
// generateQuotePdf({ quote, lines })
// Expects:
//   quote: row from SELECT q.*, c.first_name+' '+c.last_name AS customer_name,
//          c.email, c.company FROM quotes q JOIN customers c ...
//   lines: rows from SELECT * FROM quote_lines WHERE quote_id=...
//          ORDER BY line_number
// Returns: Buffer (binary PDF) or null on error.
// ============================================================================
export async function generateQuotePdf({ quote, lines }) {
  try {
    if (!quote) {
      console.error('generateQuotePdf: missing quote argument');
      return null;
    }
    const q = quote;
    const ls = Array.isArray(lines) ? lines : [];

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
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...gold);
    doc.text('AEROSPACE & DEFENSE PARTS SUPPLY', margin, y);
    y += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text('1101 Porter Ave NW', margin, y); y += 4;
    doc.text('Palm Bay, FL 32907', margin, y); y += 4;
    doc.text('(347) 821-7412 | DTorchia@JupiterOneUSA.com', margin, y);

    // Quote number block (right side)
    doc.setFontSize(7);
    doc.setTextColor(...midGray);
    doc.text('QUOTE', pageW - margin, 12, { align: 'right' });
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...gold);
    doc.text(String(q.quote_number || ''), pageW - margin, 19, { align: 'right' });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    let metaY = 25;
    doc.text('Issued: ' + fmtDate(q.created_at || new Date()), pageW - margin, metaY, { align: 'right' });
    metaY += 4;
    if (q.valid_until) {
      doc.text('Valid Until: ' + fmtDate(q.valid_until), pageW - margin, metaY, { align: 'right' });
      metaY += 4;
    }
    if (q.version) {
      doc.text('Version: v' + q.version, pageW - margin, metaY, { align: 'right' });
      metaY += 4;
    }
    doc.text('Status: ' + (q.status || 'Sent'), pageW - margin, metaY, { align: 'right' });

    // Header divider
    y = 42;
    doc.setDrawColor(...gold);
    doc.setLineWidth(0.8);
    doc.line(margin, y, pageW - margin, y);

    // === CUSTOMER BLOCK ===
    y += 7;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...gold);
    doc.text('PREPARED FOR', margin, y);
    y += 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...navy);
    doc.text(String(q.customer_name || ''), margin, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    if (q.company) { doc.text(String(q.company), margin, y); y += 4; }
    if (q.email)   { doc.text(String(q.email), margin, y); y += 4; }
    y += 4;

    // === PERSONAL MESSAGE (optional) ===
    if (q.personal_message) {
      const wrapped = doc.splitTextToSize(String(q.personal_message), contentW);
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(9);
      const truncated = wrapped.slice(0, 4);
      truncated.forEach(function(line) {
        doc.text(line, margin, y);
        y += 4;
      });
      y += 3;
    }

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
    doc.setFont('helvetica', 'bold');

    const colX = {
      num:   margin + 2,
      part:  margin + 10,
      desc:  margin + 45,
      cond:  margin + 100,
      qty:   margin + 117,
      price: margin + 138,
      total: margin + 165
    };
    y += 5;
    doc.text('#',        colX.num, y);
    doc.text('NSN/PN',   colX.part, y);
    doc.text('Description', colX.desc, y);
    doc.text('Cond',     colX.cond, y, { align: 'center' });
    doc.text('Qty',      colX.qty, y, { align: 'center' });
    doc.text('Unit $',   colX.price + 15, y, { align: 'right' });
    doc.text('Total',    colX.total + 22, y, { align: 'right' });
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    let alt = false;
    let subtotalCalc = 0;

    ls.forEach(function(l) {
      if (y > 240) { doc.addPage(); y = 20; }

      if (alt) {
        doc.setFillColor(248, 248, 248);
        doc.rect(margin, y - 4, contentW, 7, 'F');
      }
      alt = !alt;

      const lineTotal = parseFloat(l.line_total || (l.quantity * l.unit_price) || 0);
      subtotalCalc += lineTotal;

      doc.setTextColor(40, 40, 40);
      doc.text(String(l.line_number || ''), colX.num, y);

      doc.setTextColor(...gold);
      doc.setFont('helvetica', 'bold');
      doc.text(String(l.nsn || l.part_number || '').substring(0, 18), colX.part, y);

      doc.setTextColor(60, 60, 60);
      doc.setFont('helvetica', 'normal');
      /* QUOTE_PDF_WRAP_v1: wrap long descriptions, track extra row height */
const __descRaw = String(l.item_name || '');
const __descLines = doc.splitTextToSize(__descRaw, 53);
for (let __di = 0; __di < __descLines.length; __di++) {
  doc.text(__descLines[__di], colX.desc, y + (__di * 3.2));
}
const __descExtraY = Math.max(0, (__descLines.length - 1) * 3.2);
      if (l.lead_time_text) {
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        doc.text('Lead: ' + String(l.lead_time_text).substring(0, 30), colX.desc, y + 3 + __descExtraY);
        doc.setFontSize(8);
        doc.setTextColor(60, 60, 60);
      }

      doc.text(String(l.condition_code || ''), colX.cond, y, { align: 'center' });
      doc.text(String(l.quantity || 0), colX.qty, y, { align: 'center' });
      doc.text(fmtMoney(l.unit_price), colX.price + 15, y, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.text(fmtMoney(lineTotal), colX.total + 22, y, { align: 'right' });

      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.1);
      doc.line(margin, y + 2 + __descExtraY, pageW - margin, y + 2 + __descExtraY);
      y += 8 + __descExtraY;
    });

    y += 4;

    // === TOTALS ===
    if (y > 230) { doc.addPage(); y = 20; }

    const totalsX = pageW - margin - 60;
    const displaySubtotal = (q.subtotal != null) ? q.subtotal : subtotalCalc;
    const displayTotal = (q.total_amount != null) ? q.total_amount : subtotalCalc;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text('Subtotal:', totalsX, y);
    doc.setTextColor(40, 40, 40);
    doc.text(fmtMoney(displaySubtotal), pageW - margin, y, { align: 'right' });
    y += 6;

    // Gold total bar
    doc.setFillColor(...gold);
    doc.rect(totalsX - 4, y - 5, pageW - margin - totalsX + 4, 8, 'F');
    doc.setTextColor(...navy);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('TOTAL:', totalsX, y);
    doc.text(fmtMoney(displayTotal), pageW - margin, y, { align: 'right' });
    y += 12;

    // === NOTES (optional) ===
    if (q.notes) {
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
      const noteLines = doc.splitTextToSize(String(q.notes), contentW - 10);
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

    const validUntilStr = q.valid_until ? fmtDate(q.valid_until) : '30 days from issue';
    const terms = [
      '1. Quote valid until ' + validUntilStr + '. Pricing subject to change after this date.',
      '2. Payment terms: ' + (q.payment_terms || 'Credit Card or Wire Transfer') + '.',
      '3. Lead times are estimates and subject to supplier confirmation upon order placement.',
      '4. Reference quote number ' + (q.quote_number || '') + ' on all correspondence and purchase orders.',
      '5. All certifications (8130-3, CoC, traceability) provided when applicable per item.'
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
      'Jupiter One USA | CAGE Code on request | Quote issued electronically',
      pageW / 2, 290, { align: 'center' }
    );

    const arrayBuffer = doc.output('arraybuffer');
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error('generateQuotePdf error:', err && err.stack ? err.stack : err);
    return null;
  }
}

// Invoice generator stub kept (not part of this fix; lives in pdfInvoiceService or similar).
export async function generateInvoicePdf({ invoice, lines, customer }) {
  console.warn('generateInvoicePdf is not implemented in pdfService.js - use the invoice route directly.');
  return null;
}
