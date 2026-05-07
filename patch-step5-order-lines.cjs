// patch-step5-order-lines.cjs
// Wires renderLinesTab, loads suppliers query, adds /lines/:lineId/update POST.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/orderRoutes.js';
const BACKUP = 'admin/orderRoutes.js.step5.bak';

console.log('Step 5: Order Lines Tab Enhancement');
console.log('===================================');

if (!fs.existsSync(TARGET)) { console.error('! Missing: ' + TARGET); process.exit(1); }
if (!fs.existsSync('admin/orderLinesBlock.js')) {
  console.error('! Missing: admin/orderLinesBlock.js');
  process.exit(1);
}

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('renderLinesTab')) {
  console.log('- Already patched.');
  process.exit(0);
}

// PATCH 1: import
const importAnchor = "import { renderPaymentTab } from './orderPaymentBlock.js';";
src = src.replace(importAnchor, importAnchor + "\nimport { renderLinesTab } from './orderLinesBlock.js';");

// PATCH 2: load suppliers list (right after payments query)
const queryAnchor = "const payments = await pool.request().input('idP', sql.BigInt, req.params.id).query('SELECT id, amount, payment_method, payment_reference, received_at, notes FROM payments WHERE order_id=@idP ORDER BY received_at DESC');";
const newQuery = queryAnchor + "\n      const suppliers = await pool.request().query(\"SELECT id, name, country FROM suppliers WHERE status='Active' ORDER BY name ASC\");";

if (!src.includes(queryAnchor)) {
  console.error('! Could not find payments query anchor');
  process.exit(1);
}
src = src.replace(queryAnchor, function() { return newQuery; });

// PATCH 3: replace lines block content
const startMarker = "} else if (activeTab === 'lines') {";
const endMarker = "} else if (activeTab === 'shipping') {";

const startIdx = src.indexOf(startMarker);
const endIdx = src.indexOf(endMarker);
if (startIdx === -1 || endIdx === -1) {
  console.error('! Could not locate lines block boundaries');
  process.exit(1);
}

src = src.substring(0, startIdx) +
      "} else if (activeTab === 'lines') {\n        html += renderLinesTab(o, oLines, suppliers);\n      " +
      src.substring(endIdx);

// PATCH 4: add /lines/:lineId/update route before /mark-paid
const routeAnchor = "router.post('/orders/:id/mark-paid', async (req, res) => {";
if (!src.includes(routeAnchor)) {
  console.error('! Could not find /mark-paid anchor');
  process.exit(1);
}

const newRoute =
  "router.post('/orders/:id/lines/:lineId/update', async (req, res) => {\n" +
  "    if (!requireAuth(req, res)) return;\n" +
  "    try {\n" +
  "      const pool = await getPool();\n" +
  "      const b = req.body;\n" +
  "      await pool.request()\n" +
  "        .input('id', sql.BigInt, req.params.lineId)\n" +
  "        .input('oid', sql.BigInt, req.params.id)\n" +
  "        .input('supId', sql.BigInt, b.supplier_id ? parseInt(b.supplier_id) : null)\n" +
  "        .input('supCost', sql.Decimal(10,2), b.supplier_cost ? parseFloat(b.supplier_cost) : null)\n" +
  "        .input('leadDays', sql.Int, b.supplier_lead_time_days ? parseInt(b.supplier_lead_time_days) : null)\n" +
  "        .input('lotNum', sql.NVarChar(100), b.lot_number || null)\n" +
  "        .input('coo', sql.NVarChar(50), b.country_of_origin || null)\n" +
  "        .input('rcvAt', sql.DateTime, b.received_at ? new Date(b.received_at) : null)\n" +
  "        .input('serials', sql.NVarChar(sql.MAX), b.serial_numbers || null)\n" +
  "        .input('cert8R', sql.Bit, b.cert_8130_required === '1' ? 1 : 0)\n" +
  "        .input('cert8G', sql.Bit, b.cert_8130_received === '1' ? 1 : 0)\n" +
  "        .input('cocR', sql.Bit, b.coc_required === '1' ? 1 : 0)\n" +
  "        .input('cocG', sql.Bit, b.coc_received === '1' ? 1 : 0)\n" +
  "        .query('UPDATE order_lines SET supplier_id=@supId, supplier_cost=@supCost, supplier_lead_time_days=@leadDays, lot_number=@lotNum, country_of_origin=@coo, received_at=@rcvAt, serial_numbers=@serials, cert_8130_required=@cert8R, cert_8130_received=@cert8G, coc_required=@cocR, coc_received=@cocG WHERE id=@id AND order_id=@oid');\n" +
  "      res.redirect('/admin/orders/'+req.params.id+'?tab=lines&saved=1');\n" +
  "    } catch(err) { console.error('Line update error:', err); res.redirect('/admin/orders/'+req.params.id+'?tab=lines&error='+encodeURIComponent(err.message)); }\n" +
  "  });\n\n" +
  "  ";

src = src.replace(routeAnchor, function() { return newRoute + routeAnchor; });

// Backup, write, syntax-check
fs.writeFileSync(BACKUP, original);
console.log('+ Backup saved: ' + BACKUP);

fs.writeFileSync(TARGET, src);
console.log('+ Wrote patched ' + TARGET);

console.log('  Running syntax check...');
try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  execSync('node -c "admin/orderLinesBlock.js"', { stdio: 'pipe' });
  console.log('+ Syntax check PASSED on both files');
  console.log('');
  console.log('===================================');
  console.log('SUCCESS - safe to commit and push.');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('');
  console.error('===================================');
  console.error('! SYNTAX ERROR - changes REVERTED.');
  console.error('');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
