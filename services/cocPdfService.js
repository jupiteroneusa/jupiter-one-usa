// services/cocPdfService.js
// COC_PDF_v1
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
const GOLD = [200, 147, 42];

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

  const doc = new jsPDF({ unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const M = 40;                 // margin
  let y = M;

  // ---- Header band ----
  doc.setFillColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.rect(0, 0, pageW, 70, 'F');
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text(COMPANY.name, M, 30);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  doc.text(COMPANY.addr1 + '  |  ' + COMPANY.addr2, M, 45);
  doc.text('Tel: ' + COMPANY.phone + '   ' + COMPANY.email + '   ' + COMPANY.web, M, 57);

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text('ATA Spec 106', pageW - M, 30, { align: 'right' });
  doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text('Part or Material Certification Form', pageW - M, 44, { align: 'right' });
  doc.setTextColor(GOLD[0], GOLD[1], GOLD[2]); doc.setFont('helvetica', 'bold');
  doc.text(S(c.coc_number), pageW - M, 58, { align: 'right' });

  y = 90;
  doc.setTextColor(0, 0, 0);

  // helper: labeled box cell
  const boxH = 34;
  function cell(x, w, num, label, value) {
    doc.setDrawColor(180); doc.setLineWidth(0.5);
    doc.rect(x, y, w, boxH);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(90);
    doc.text((num ? num + '. ' : '') + label, x + 4, y + 9);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0);
    doc.text(doc.splitTextToSize(S(value), w - 8), x + 4, y + 22);
  }
  const fullW = pageW - 2 * M;

  // Row: 2 Seller / 3 Reference
  cell(M, fullW * 0.6, '2', 'Seller / Organization', COMPANY.name);
  cell(M + fullW * 0.6, fullW * 0.4, '3', 'Reference Number', c.reference_number);
  y += boxH;
  // Row: 5a Seller Contract / 5b Buyer Contract
  cell(M, fullW * 0.5, '5a', 'Seller Contract #', c.seller_contract_number);
  cell(M + fullW * 0.5, fullW * 0.5, '5b', 'Buyer Contract #', c.buyer_contract_number);
  y += boxH;
  // Row: 6 Item / 7 Description / 8 Manufacturer & PN
  cell(M, fullW * 0.12, '6', 'Item', c.item_number);
  cell(M + fullW * 0.12, fullW * 0.5, '7', 'Description', c.description);
  cell(M + fullW * 0.62, fullW * 0.38, '8', 'Manufacturer & PN', c.manufacturer_pn);
  y += boxH;
  // Row: 9 Eligibility / 10 Qty / 11 Serial-Batch / 12 Status
  cell(M, fullW * 0.34, '9', 'Eligibility', c.eligibility);
  cell(M + fullW * 0.34, fullW * 0.14, '10', 'Qty', c.quantity);
  cell(M + fullW * 0.48, fullW * 0.30, '11', 'Serial/Batch Number', c.serial_batch_number);
  cell(M + fullW * 0.78, fullW * 0.22, '12', 'Status', c.status_code);
  y += boxH;
  // Row: 13a Remarks (tall)
  doc.setDrawColor(180); doc.rect(M, y, fullW, boxH + 10);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(90);
  doc.text('13a. Remarks', M + 4, y + 9);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(0);
  doc.text(doc.splitTextToSize(S(c.remarks), fullW - 8), M + 4, y + 22);
  y += boxH + 10;
  // Row: 13b Obtained From / 13c Last Certified Agency
  cell(M, fullW * 0.5, '13b', 'Obtained From', c.obtained_from);
  cell(M + fullW * 0.5, fullW * 0.5, '13c', 'Last Certified Agency', c.last_certified_agency);
  y += boxH + 8;

  // ---- Block 14 ----
  doc.setFillColor(240, 240, 240); doc.rect(M, y, fullW, 16, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text('14. NEW PARTS / MATERIAL VERIFICATION', M + 4, y + 11);
  y += 16;
  doc.setTextColor(60); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
  doc.text(doc.splitTextToSize('The following signature attests that the part(s) or material(s) identified above was/were manufactured by an FAA Production Approval Holder (PAH), or to an industry or commercial standard.', fullW - 8), M + 4, y + 10);
  y += 26;
  cell(M, fullW * 0.45, '', 'Signature', c.block14_signature);
  cell(M + fullW * 0.45, fullW * 0.35, '', 'Name', c.block14_name);
  cell(M + fullW * 0.80, fullW * 0.20, '', 'Date', fmtDate(c.block14_date));
  y += boxH + 8;

  // ---- Block 18 ----
  doc.setFillColor(240, 240, 240); doc.rect(M, y, fullW, 16, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text('18. NEW / USED / REPAIRED / OVERHAULED / SURPLUS VERIFICATION', M + 4, y + 11);
  y += 16;
  doc.setTextColor(60); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
  doc.text(doc.splitTextToSize('The following signature attests the documentation specified above and attached is accurate with regard to the item(s) described.', fullW - 8), M + 4, y + 10);
  y += 20;
  cell(M, fullW * 0.45, '', 'Signature', c.block18_signature);
  cell(M + fullW * 0.45, fullW * 0.35, '', 'Name', c.block18_name);
  cell(M + fullW * 0.80, fullW * 0.20, '', 'Date', fmtDate(c.block18_date));
  y += boxH + 20;

  doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(130);
  doc.text('Certificate ' + S(c.coc_number) + ' - Status: ' + S(c.status) + ' - Generated ' + fmtDate(new Date()), M, doc.internal.pageSize.getHeight() - 24);

  const ab = doc.output('arraybuffer');
  return Buffer.from(ab);
}
