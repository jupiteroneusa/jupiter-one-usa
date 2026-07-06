// services/cocPdfService.js
// COC_PDF_v1 (r2: landscape, ink-light header, PO into 5a)
// Generates the Certificate of Conformance PDF (ATA Spec 106 - Part or Material Certification Form).
import { jsPDF } from 'jspdf';
import { getPool, sql } from '../db/connect.js';

const COMPANY = {
  name: 'Jupiter One USA LLC',
  addr1: '400 N Tampa St, Suite 1550',
  addr2: 'Tampa, FL 33602',
  phone: '+1 (347) 821-7412',
  email: 'DTorchia@jupiteroneusa.com',
  web: 'www.jupiteroneusa.com'
};
const NAVY = [10, 22, 40];
const GOLD = [176, 131, 26]; // slightly deeper gold, prints cleaner

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return String(dt.getMonth() + 1).padStart(2, '0') + '/' +
         String(dt.getDate()).padStart(2, '0') + '/' + dt.getFullYear();
}
function S(v) { return v == null ? '' : String(v); }

export async function generateCocPdf(cocId, options) {
  options = options || {};
  const pool = await getPool();
  const cr = await pool.request().input('id', sql.BigInt, cocId)
    .query('SELECT * FROM coc_certificates WHERE id=@id');
  if (!cr.recordset.length) return null;
  const c = cr.recordset[0];

  // Prefer PO number in 5a Seller Contract #. Pull it from remarks if that's where it lives.
  let sellerContract = c.seller_contract_number;
  if (!sellerContract && c.remarks) {
    const m = String(c.remarks).match(/PO[:#]?\s*([A-Za-z0-9\-]+)/i);
    if (m) sellerContract = m[1];
  }

  // ---- LANDSCAPE letter ----
  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 40;
  let y = M;

  // ---- Ink-light header: white background, navy company name, thin gold rule ----
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
  doc.text(COMPANY.name, M, y + 14);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80);
  doc.text(COMPANY.addr1 + '  |  ' + COMPANY.addr2, M, y + 28);
  doc.text('Tel: ' + COMPANY.phone + '    ' + COMPANY.email + '    ' + COMPANY.web, M, y + 39);

  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
  doc.text('ATA Spec 106', pageW - M, y + 12, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80);
  doc.text('Part or Material Certification Form', pageW - M, y + 25, { align: 'right' });
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text(S(c.coc_number), pageW - M, y + 39, { align: 'right' });

  // thin gold rule under header
  y += 50;
  doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]); doc.setLineWidth(1.5);
  doc.line(M, y, pageW - M, y);
  y += 14;
  doc.setTextColor(0, 0, 0);

  const boxH = 34;
  const fullW = pageW - 2 * M;
  function cell(x, w, num, label, value) {
    doc.setDrawColor(170); doc.setLineWidth(0.5);
    doc.rect(x, y, w, boxH);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(90);
    doc.text((num ? num + '. ' : '') + label, x + 4, y + 9);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0);
    doc.text(doc.splitTextToSize(S(value), w - 8), x + 4, y + 22);
  }

  cell(M, fullW * 0.6, '2', 'Seller / Organization', COMPANY.name);
  cell(M + fullW * 0.6, fullW * 0.4, '3', 'Reference Number', c.reference_number);
  y += boxH;
  cell(M, fullW * 0.5, '5a', 'Seller Contract # / Supplier PO', sellerContract);
  cell(M + fullW * 0.5, fullW * 0.5, '5b', 'Buyer Contract #', c.buyer_contract_number);
  y += boxH;
  cell(M, fullW * 0.10, '6', 'Item', c.item_number);
  cell(M + fullW * 0.10, fullW * 0.52, '7', 'Description', c.description);
  cell(M + fullW * 0.62, fullW * 0.38, '8', 'Manufacturer & PN', c.manufacturer_pn);
  y += boxH;
  cell(M, fullW * 0.34, '9', 'Eligibility', c.eligibility);
  cell(M + fullW * 0.34, fullW * 0.14, '10', 'Qty', c.quantity);
  cell(M + fullW * 0.48, fullW * 0.30, '11', 'Serial/Batch Number', c.serial_batch_number);
  cell(M + fullW * 0.78, fullW * 0.22, '12', 'Status', c.status_code);
  y += boxH;
  doc.setDrawColor(170); doc.rect(M, y, fullW, boxH);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(90);
  doc.text('13a. Remarks', M + 4, y + 9);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0);
  doc.text(doc.splitTextToSize(S(c.remarks), fullW - 8), M + 4, y + 22);
  y += boxH;
  cell(M, fullW * 0.5, '13b', 'Obtained From', c.obtained_from);
  cell(M + fullW * 0.5, fullW * 0.5, '13c', 'Last Certified Agency', c.last_certified_agency);
  y += boxH + 8;

  // ---- Block 14 (light gray band, thin) ----
  function blockHeader(txt) {
    doc.setFillColor(238, 238, 238); doc.rect(M, y, fullW, 15, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text(txt, M + 4, y + 10);
    y += 15;
  }
  function attest(txt) {
    doc.setTextColor(70); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    const lines = doc.splitTextToSize(txt, fullW - 8);
    doc.text(lines, M + 4, y + 9);
    y += (lines.length * 8) + 6;
  }
  blockHeader('14. NEW PARTS / MATERIAL VERIFICATION');
  attest('The following signature attests that the part(s) or material(s) identified above was/were manufactured by an FAA Production Approval Holder (PAH), or to an industry or commercial standard.');
  cell(M, fullW * 0.45, '', 'Signature', c.block14_signature);
  cell(M + fullW * 0.45, fullW * 0.35, '', 'Name', c.block14_name);
  cell(M + fullW * 0.80, fullW * 0.20, '', 'Date', fmtDate(c.block14_date));
  y += boxH + 8;

  blockHeader('18. NEW / USED / REPAIRED / OVERHAULED / SURPLUS VERIFICATION');
  attest('The following signature attests the documentation specified above and attached is accurate with regard to the item(s) described.');
  cell(M, fullW * 0.45, '', 'Signature', c.block18_signature);
  cell(M + fullW * 0.45, fullW * 0.35, '', 'Name', c.block18_name);
  cell(M + fullW * 0.80, fullW * 0.20, '', 'Date', fmtDate(c.block18_date));

  doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(130);
  doc.text('Certificate ' + S(c.coc_number) + ' - Status: ' + S(c.status) + ' - Generated ' + fmtDate(new Date()), M, pageH - 20);

  const ab = doc.output('arraybuffer');
  return Buffer.from(ab);
}
