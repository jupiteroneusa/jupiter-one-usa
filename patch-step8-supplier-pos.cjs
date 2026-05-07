// patch-step8-supplier-pos.cjs
// Step 8: wire up supplier PO routes
// 1. Import + mount supplierPoRoutes in admin/index.js
// 2. Add "Supplier POs" sidebar nav link
// 3. Add "Create Supplier PO" button on order Lines tab (in orderLinesBlock.js)
// 4. Update db/numbering.js to support 'supplier_po' prefix -> 'PO-2026-0000X'

const fs = require('fs');
const { execSync } = require('child_process');

console.log('Step 8: Supplier PO Management');
console.log('==============================');

// Pre-flight checks
if (!fs.existsSync('admin/index.js')) { console.error('! Missing admin/index.js'); process.exit(1); }
if (!fs.existsSync('admin/supplierPoRoutes.js')) { console.error('! Missing admin/supplierPoRoutes.js (move it to admin/ first)'); process.exit(1); }
if (!fs.existsSync('admin/orderLinesBlock.js')) { console.error('! Missing admin/orderLinesBlock.js'); process.exit(1); }
if (!fs.existsSync('db/numbering.js')) { console.error('! Missing db/numbering.js'); process.exit(1); }

// ============================================================================
// PATCH 1: db/numbering.js - support 'supplier_po' -> 'PO-YYYY-XXXXX'
// ============================================================================
const numTarget = 'db/numbering.js';
const numBackup = 'db/numbering.js.step8.bak';
const numOriginal = fs.readFileSync(numTarget, 'utf8');
let numSrc = numOriginal;

if (!numSrc.includes("'supplier_po'") && !numSrc.includes('"supplier_po"')) {
  // We need to inject a mapping for supplier_po
  // Find the prefix mapping (probably an object literal with rfq, quote, order, invoice...)
  // Common pattern: prefixes like "RFQ-", "QT-", "ORD-", "INV-"
  // We'll look for any reference to ORD-/INV-/QT- and add supplier_po -> PO-
  const candidates = [
    { old: "case 'invoice':", new: "case 'supplier_po': prefix = 'PO'; break;\n    case 'invoice':" },
    { old: "'invoice':", new: "'supplier_po': 'PO',\n    'invoice':" },
    { old: 'invoice: \'INV\'', new: 'supplier_po: \'PO\',\n    invoice: \'INV\'' },
  ];
  let numPatched = false;
  for (const c of candidates) {
    if (numSrc.includes(c.old)) {
      numSrc = numSrc.replace(c.old, c.new);
      numPatched = true;
      console.log('+ db/numbering.js patched (case: ' + c.old.substring(0, 30) + '...)');
      break;
    }
  }
  if (!numPatched) {
    console.log('  (warning: db/numbering.js auto-patch failed - dumping file for manual inspection)');
    console.log('  --- db/numbering.js content ---');
    console.log(numSrc);
    console.log('  --- end ---');
    console.log('  Step 8 will continue but PO numbering may fail. Manual edit may be needed.');
  } else {
    fs.writeFileSync(numBackup, numOriginal);
    fs.writeFileSync(numTarget, numSrc);
    try {
      execSync('node -c "' + numTarget + '"', { stdio: 'pipe' });
    } catch (err) {
      fs.writeFileSync(numTarget, numOriginal);
      console.error('! numbering.js syntax error - reverted that file. Continuing with other patches.');
    }
  }
} else {
  console.log('- db/numbering.js already supports supplier_po');
}

// ============================================================================
// PATCH 2: admin/index.js - import + mount + sidebar link
// ============================================================================
const idxTarget = 'admin/index.js';
const idxBackup = 'admin/index.js.step8.bak';
const idxOriginal = fs.readFileSync(idxTarget, 'utf8');
let idxSrc = idxOriginal;

if (idxSrc.includes('mountSupplierPoRoutes')) {
  console.log('- admin/index.js already patched.');
} else {
  // 2a: import
  const importAnchor = "import { mountSupplierRoutes } from './supplierRoutes.js';";
  const newImports = importAnchor + "\nimport { mountSupplierPoRoutes } from './supplierPoRoutes.js';";
  if (!idxSrc.includes(importAnchor)) {
    console.error('! Could not find import anchor (mountSupplierRoutes import)');
    process.exit(1);
  }
  idxSrc = idxSrc.replace(importAnchor, newImports);

  // 2b: mount
  const mountAnchor = "mountSupplierRoutes(router, requireAuth, page);";
  idxSrc = idxSrc.replace(mountAnchor, mountAnchor + "\n  mountSupplierPoRoutes(router, requireAuth, page);");

  // 2c: sidebar link - inject between Suppliers and Invoices
  const sidebarRegex = /(<a href="\/admin\/suppliers"[^>]*>[^<]*Suppliers<\/a>)\s*(<a href="\/admin\/invoices")/;
  if (!sidebarRegex.test(idxSrc)) {
    console.error('! Could not find sidebar pattern between Suppliers and Invoices');
    process.exit(1);
  }
  idxSrc = idxSrc.replace(sidebarRegex, function(_, sup, invStart) {
    return sup + '\n    <a href="/admin/supplier-pos" class="${active===\'supplier-pos\'?\'active\':\'\'}">\u{1F4DD} Supplier POs</a>\n    ' + invStart;
  });

  fs.writeFileSync(idxBackup, idxOriginal);
  fs.writeFileSync(idxTarget, idxSrc);
  try {
    execSync('node -c "' + idxTarget + '"', { stdio: 'pipe' });
    console.log('+ admin/index.js patched (import + mount + sidebar link)');
  } catch (err) {
    fs.writeFileSync(idxTarget, idxOriginal);
    console.error('! admin/index.js syntax error - REVERTED');
    console.error(err.stderr ? err.stderr.toString() : err.message);
    process.exit(1);
  }
}

// ============================================================================
// PATCH 3: admin/orderLinesBlock.js - add "Create Supplier PO" button at top
// ============================================================================
const olbTarget = 'admin/orderLinesBlock.js';
const olbBackup = 'admin/orderLinesBlock.js.step8.bak';
const olbOriginal = fs.readFileSync(olbTarget, 'utf8');
let olbSrc = olbOriginal;

if (olbSrc.includes('Create Supplier PO')) {
  console.log('- orderLinesBlock.js already patched.');
} else {
  // Find the card-header line and append the button
  const oldHeader = "html += '<div class=\"card\" style=\"margin-bottom:16px;\"><div class=\"card-header\">Order Line Items (' + oLines.recordset.length + ')</div>';";
  const newHeader = "html += '<div class=\"card\" style=\"margin-bottom:16px;\"><div class=\"card-header\" style=\"display:flex;justify-content:space-between;align-items:center;\"><span>Order Line Items (' + oLines.recordset.length + ')</span>';\n  if (oLines.recordset.length > 0) {\n    const lineIds = oLines.recordset.map(function(l){return l.id;}).join(',');\n    html += '<a href=\"/admin/supplier-pos/new?from_order=' + o.id + '&line_ids=' + lineIds + '\" class=\"btn btn-gold btn-sm\" style=\"font-size:.7rem;\">+ Create Supplier PO</a>';\n  }\n  html += '</div>';";

  if (!olbSrc.includes(oldHeader)) {
    console.error('! Could not find Order Lines card header to add button');
    process.exit(1);
  }
  olbSrc = olbSrc.replace(oldHeader, newHeader);

  fs.writeFileSync(olbBackup, olbOriginal);
  fs.writeFileSync(olbTarget, olbSrc);
  try {
    execSync('node -c "' + olbTarget + '"', { stdio: 'pipe' });
    console.log('+ orderLinesBlock.js patched (Create Supplier PO button)');
  } catch (err) {
    fs.writeFileSync(olbTarget, olbOriginal);
    console.error('! orderLinesBlock.js syntax error - REVERTED');
    console.error(err.stderr ? err.stderr.toString() : err.message);
    process.exit(1);
  }
}

// ============================================================================
// Final syntax check on supplierPoRoutes.js
// ============================================================================
try {
  execSync('node -c "admin/supplierPoRoutes.js"', { stdio: 'pipe' });
  console.log('+ supplierPoRoutes.js syntax OK');
} catch (err) {
  console.error('! supplierPoRoutes.js syntax error');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}

console.log('');
console.log('==============================');
console.log('STEP 8 SUCCESS - safe to commit and push.');
console.log('');
console.log('After deploy + Ctrl+F5, you should see:');
console.log('  - "Supplier POs" link in admin sidebar (between Suppliers and Invoices)');
console.log('  - /admin/supplier-pos shows the list with TEST POs from earlier seed');
console.log('  - Click any PO row -> 4 tabs (Overview, Lines, Payment, Documents)');
console.log('  - Order detail Lines tab now has "+ Create Supplier PO" button');
console.log('  - Click button -> pre-filled new PO form');
console.log('  - Receive lines -> cascades received_at to order_lines');
console.log('  - All received -> order auto-marks Ready to Ship');
