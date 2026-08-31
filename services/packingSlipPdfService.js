// services/packingSlipPdfService.js
// PACKING_SLIP_v1 - Packing slip PDF (landscape, ink-light, box-by-box contents)
import { jsPDF } from 'jspdf';
import { getPool, sql } from '../db/connect.js';

const COMPANY = {
  name: 'Jupiter One USA LLC',
  addr1: '400 N Tampa St, Suite 1550',
  addr2: 'Tampa, FL 33602',
  phone: '+1 (347) 821-7412',
  email: 'nicolle@jupiteroneusa.com',
  web: 'www.jupiteroneusa.com'
};
const NAVY = [10, 22, 40];
const GOLD = [176, 131, 26];

function fmtDate(d){ if(!d) return ''; const t=new Date(d); return String(t.getMonth()+1).padStart(2,'0')+'/'+String(t.getDate()).padStart(2,'0')+'/'+t.getFullYear(); }
function S(v){ return v==null?'':String(v); }

export async function generatePackingSlipPdf(shipmentId) {
  const pool = await getPool();
  const shR = await pool.request().input('sid', sql.BigInt, shipmentId).query(`
    SELECT s.*, o.order_number, o.customer_po, o.contract_number,
           o.ship_to_address1, o.ship_to_city, o.ship_to_state, o.ship_to_zip, o.ship_to_country,
           o.buyer_name, c.first_name, c.last_name, c.company
    FROM shipments s
    INNER JOIN orders o ON o.id = s.order_id
    INNER JOIN customers c ON c.id = o.customer_id
    WHERE s.id = @sid`);
  if (!shR.recordset.length) return null;
  const sh = shR.recordset[0];

  const boxR = await pool.request().input('sid', sql.BigInt, shipmentId)
    .query('SELECT * FROM shipment_boxes WHERE shipment_id=@sid ORDER BY box_number');
  const boxes = boxR.recordset;

  const blR = await pool.request().input('sid', sql.BigInt, shipmentId)
    .query(`SELECT bl.box_id, bl.quantity, ol.line_number, ol.nsn, ol.part_number, ol.item_name
            FROM shipment_box_lines bl
            INNER JOIN shipment_boxes b ON b.id = bl.box_id
            INNER JOIN order_lines ol ON ol.id = bl.order_line_id
            WHERE b.shipment_id=@sid ORDER BY bl.box_id, ol.line_number`);
  const boxLines = {};
  blR.recordset.forEach(function(r){ if(!boxLines[r.box_id]) boxLines[r.box_id]=[]; boxLines[r.box_id].push(r); });

  const doc = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'landscape' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 40;
  let y = M;

  // Header (ink-light)
  doc.setTextColor(NAVY[0],NAVY[1],NAVY[2]); doc.setFont('helvetica','bold'); doc.setFontSize(20);
  doc.text(COMPANY.name, M, y+14);
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(80);
  doc.text(COMPANY.addr1+'  |  '+COMPANY.addr2, M, y+28);
  doc.text('Tel: '+COMPANY.phone+'    '+COMPANY.email+'    '+COMPANY.web, M, y+39);
  doc.setTextColor(NAVY[0],NAVY[1],NAVY[2]); doc.setFont('helvetica','bold'); doc.setFontSize(14);
  doc.text('PACKING SLIP', pageW-M, y+14, { align:'right' });
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(80);
  doc.text('Order: '+S(sh.order_number), pageW-M, y+28, { align:'right' });
  doc.text('Shipment: '+S(sh.shipment_number), pageW-M, y+39, { align:'right' });
  y += 50;
  doc.setDrawColor(GOLD[0],GOLD[1],GOLD[2]); doc.setLineWidth(1.5); doc.line(M, y, pageW-M, y);
  y += 16; doc.setTextColor(0,0,0);

  // Ship-to + meta
  const shipToName = (sh.buyer_name && String(sh.buyer_name).trim()) ? sh.buyer_name : (sh.company || ((sh.first_name||'')+' '+(sh.last_name||'')));
  const cityLine = [sh.ship_to_city, sh.ship_to_state, sh.ship_to_zip].filter(Boolean).join(', ');
  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(90);
  doc.text('SHIP TO', M, y);
  doc.setFont('helvetica','normal'); doc.setFontSize(10); doc.setTextColor(0);
  doc.text(S(shipToName), M, y+13);
  let sy = y+25; doc.setFontSize(9);
  if (sh.ship_to_address1) { doc.text(S(sh.ship_to_address1), M, sy); sy+=11; }
  if (cityLine) { doc.text(cityLine, M, sy); sy+=11; }
  if (sh.ship_to_country) { doc.text(S(sh.ship_to_country), M, sy); sy+=11; }

  // meta right
  const rx = pageW/2 + 20;
  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(90); doc.text('DETAILS', rx, y);
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(0);
  let ry = y+13;
  doc.text('Date: '+fmtDate(sh.ship_date || new Date()), rx, ry); ry+=11;
  if (sh.carrier) { doc.text('Carrier: '+S(sh.carrier), rx, ry); ry+=11; }
  if (sh.tracking_number) { doc.text('Tracking: '+S(sh.tracking_number), rx, ry); ry+=11; }
  if (sh.customer_po) { doc.text('Customer PO: '+S(sh.customer_po), rx, ry); ry+=11; }
  if (sh.contract_number) { doc.text('Contract #: '+S(sh.contract_number), rx, ry); ry+=11; }

  y = Math.max(sy, ry) + 14;

  // Boxes
  const fullW = pageW - 2*M;
  if (!boxes.length) {
    doc.setFont('helvetica','italic'); doc.setFontSize(10); doc.setTextColor(120);
    doc.text('No boxes defined for this shipment yet.', M, y);
  }
  boxes.forEach(function(box){
    // box header bar
    doc.setFillColor(238,238,238); doc.rect(M, y, fullW, 16, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(NAVY[0],NAVY[1],NAVY[2]);
    let bh = 'BOX ' + box.box_number;
    const bits = [];
    if (box.weight_lbs) bits.push(box.weight_lbs+' lbs');
    if (box.dimensions) bits.push(box.dimensions);
    if (box.tracking_number) bits.push('Trk: '+box.tracking_number);
    if (bits.length) bh += '   (' + bits.join('  |  ') + ')';
    doc.text(bh, M+4, y+11);
    y += 16;
    // line table header
    doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(90);
    doc.text('LINE', M+4, y+9); doc.text('NSN/PN', M+50, y+9); doc.text('DESCRIPTION', M+180, y+9); doc.text('QTY', pageW-M-40, y+9, {align:'right'});
    doc.setDrawColor(200); doc.line(M, y+12, pageW-M, y+12);
    y += 16;
    const rows = boxLines[box.id] || [];
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(0);
    if (!rows.length) {
      doc.setTextColor(130); doc.setFont('helvetica','italic'); doc.text('(empty)', M+4, y+2); y+=14;
    } else {
      rows.forEach(function(r){
        doc.setTextColor(0); doc.setFont('helvetica','normal');
        doc.text(S(r.line_number), M+4, y+2);
        doc.text(S(r.nsn || r.part_number || '').substring(0,22), M+50, y+2);
        doc.text(S(r.item_name || '').substring(0,60), M+180, y+2);
        doc.text(S(r.quantity), pageW-M-40, y+2, {align:'right'});
        y += 13;
        if (y > pageH - 40) { doc.addPage({ orientation:'landscape' }); y = M; }
      });
    }
    y += 8;
  });

  doc.setFont('helvetica','italic'); doc.setFontSize(7); doc.setTextColor(130);
  doc.text('Packing Slip - Order ' + S(sh.order_number) + ' - Shipment ' + S(sh.shipment_number) + ' - Generated ' + fmtDate(new Date()), M, pageH-20);

  return Buffer.from(doc.output('arraybuffer'));
}
