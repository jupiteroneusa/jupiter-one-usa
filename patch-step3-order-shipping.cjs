// patch-step3-order-shipping.cjs
// Wires the new shipping block into admin/orderRoutes.js
// Also updates the /tracking POST route to capture new fields
// Adds /shipments/:sid/deliver route
// Safety: backs up, syntax-checks, auto-reverts on failure.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/orderRoutes.js';
const BACKUP = 'admin/orderRoutes.js.step3.bak';

console.log('Step 3: Order Shipping Tab Enhancement');
console.log('======================================');

if (!fs.existsSync(TARGET)) { console.error('! Missing: ' + TARGET); process.exit(1); }
if (!fs.existsSync('admin/orderShippingBlock.js')) {
  console.error('! Missing: admin/orderShippingBlock.js');
  process.exit(1);
}

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('renderShippingTab')) {
  console.log('- Already patched. Nothing to do.');
  process.exit(0);
}

// ============================================================================
// PATCH 1: Add the import
// ============================================================================
const importAnchor = "import { renderOverviewTab } from './orderOverviewBlock.js';";
const newImports = importAnchor + "\nimport { renderShippingTab } from './orderShippingBlock.js';";

if (!src.includes(importAnchor)) {
  console.error('! Could not find Step 2 import anchor');
  process.exit(1);
}
src = src.replace(importAnchor, newImports);

// ============================================================================
// PATCH 2: Replace shipping block content with renderShippingTab(o, ships)
// Block: starts at "} else if (activeTab === 'shipping') {"
//        ends at   "} else if (activeTab === 'payment') {"
// ============================================================================
const startMarker = "} else if (activeTab === 'shipping') {";
const endMarker = "} else if (activeTab === 'payment') {";

const startIdx = src.indexOf(startMarker);
const endIdx = src.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
  console.error('! Could not locate shipping block boundaries');
  process.exit(1);
}

const before = src.substring(0, startIdx);
const after = src.substring(endIdx);
const replacement = "} else if (activeTab === 'shipping') {\n        html += renderShippingTab(o, ships);\n      ";

src = before + replacement + after;

// ============================================================================
// PATCH 3: Update /tracking POST to capture new fields
// Replace the existing INSERT INTO shipments query to include new columns
// ============================================================================
const oldInsert = "query(\"INSERT INTO shipments (order_id,shipment_number,carrier,tracking_number,tracking_url,ship_date,estimated_delivery,status) VALUES (@orderId,@shipNum,@carrier,@tracking,@trackingUrl,@shipDate,@estDelivery,'Shipped')\");";
const newInsert =
  ".input('weight', sql.Decimal(8,2), parseFloat(b.weight_lbs)||null)\n" +
  "        .input('dims', sql.NVarChar(50), b.dimensions||null)\n" +
  "        .input('pkgs', sql.Int, parseInt(b.package_count)||1)\n" +
  "        .input('sigReq', sql.Bit, b.signature_required==='1'?1:0)\n" +
  "        .input('ins', sql.Decimal(12,2), parseFloat(b.insurance_value)||null)\n" +
  "        .query(\"INSERT INTO shipments (order_id,shipment_number,carrier,tracking_number,tracking_url,ship_date,estimated_delivery,weight_lbs,dimensions,package_count,signature_required,insurance_value,status) VALUES (@orderId,@shipNum,@carrier,@tracking,@trackingUrl,@shipDate,@estDelivery,@weight,@dims,@pkgs,@sigReq,@ins,'Shipped')\");";

if (!src.includes(oldInsert)) {
  console.error('! Could not find /tracking INSERT to update');
  process.exit(1);
}
src = src.replace(oldInsert, newInsert);

// Also: when /tracking inserts, we now want shipped_at on the order set
const shippedAtAnchor = "query(\"UPDATE orders SET status='Shipped',updated_at=GETDATE() WHERE id=@id\");";
const shippedAtNew = "query(\"UPDATE orders SET status='Shipped',shipped_at=ISNULL(shipped_at,GETDATE()),updated_at=GETDATE() WHERE id=@id\");";
if (src.includes(shippedAtAnchor)) {
  src = src.replace(shippedAtAnchor, shippedAtNew);
}

// ============================================================================
// PATCH 4: Add /shipments/:sid/deliver route
// Insert it just before the existing /mark-paid route
// ============================================================================
const routeAnchor = "router.post('/orders/:id/mark-paid', async (req, res) => {";
if (!src.includes(routeAnchor)) {
  console.error('! Could not find /mark-paid anchor for new deliver route');
  process.exit(1);
}

const newRoute =
  "router.post('/orders/:id/shipments/:sid/deliver', async (req, res) => {\n" +
  "    if (!requireAuth(req, res)) return;\n" +
  "    try {\n" +
  "      const pool = await getPool();\n" +
  "      const b = req.body;\n" +
  "      await pool.request()\n" +
  "        .input('sid', sql.BigInt, req.params.sid)\n" +
  "        .input('delAt', sql.DateTime, b.actual_delivery_at ? new Date(b.actual_delivery_at) : new Date())\n" +
  "        .input('rcvBy', sql.NVarChar(100), b.received_by_name||null)\n" +
  "        .input('proof', sql.NVarChar(500), b.delivery_proof_url||null)\n" +
  "        .query(\"UPDATE shipments SET actual_delivery_at=@delAt, received_by_name=@rcvBy, delivery_proof_url=@proof, status='Delivered' WHERE id=@sid\");\n" +
  "      await pool.request()\n" +
  "        .input('id', sql.BigInt, req.params.id)\n" +
  "        .input('delAt2', sql.DateTime, b.actual_delivery_at ? new Date(b.actual_delivery_at) : new Date())\n" +
  "        .query(\"UPDATE orders SET status='Delivered', delivered_at=ISNULL(delivered_at,@delAt2), updated_at=GETDATE() WHERE id=@id\");\n" +
  "      await pool.request().input('id', sql.BigInt, req.params.id)\n" +
  "        .query(\"INSERT INTO order_status_log (order_id,new_status,note) VALUES (@id,'Delivered','Delivery confirmed')\");\n" +
  "      res.redirect('/admin/orders/'+req.params.id+'?tab=shipping&saved=1');\n" +
  "    } catch(err) { res.redirect('/admin/orders/'+req.params.id+'?tab=shipping&error='+encodeURIComponent(err.message)); }\n" +
  "  });\n\n" +
  "  ";

src = src.replace(routeAnchor, function() { return newRoute + routeAnchor; });

// ============================================================================
// Backup, write, syntax-check
// ============================================================================
fs.writeFileSync(BACKUP, original);
console.log('+ Backup saved: ' + BACKUP);

fs.writeFileSync(TARGET, src);
console.log('+ Wrote patched ' + TARGET);

console.log('  Running syntax check...');
try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  execSync('node -c "admin/orderShippingBlock.js"', { stdio: 'pipe' });
  console.log('+ Syntax check PASSED on both files');
  console.log('');
  console.log('======================================');
  console.log('SUCCESS - safe to commit and push.');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('');
  console.error('======================================');
  console.error('! SYNTAX ERROR - changes REVERTED.');
  console.error('');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
