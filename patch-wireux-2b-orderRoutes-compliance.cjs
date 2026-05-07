// patch-wireux-2b-orderRoutes-compliance.cjs
// Companion to wire-ux-2: 
// 1) Load missingCerts in /admin/orders/:id route, pass to renderShippingTab
// 2) Update /tracking POST to honor compliance_override flag and log to status_log

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/orderRoutes.js';
const BACKUP = 'admin/orderRoutes.js.wireux2b.bak';

console.log('Wire UX 2b: orderRoutes compliance integration');
console.log('==============================================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('missingCerts')) { console.log('- Already patched.'); process.exit(0); }

// PATCH A: Load missingCerts before rendering shipping tab
// Find the line that loads ships
const oldShipsAnchor = "html += renderShippingTab(o, ships);";
if (!src.includes(oldShipsAnchor)) {
  console.error('! Could not find renderShippingTab call');
  process.exit(1);
}

const newShipsCall = 
  "const missingCertsR = await pool.request().input('idMc', sql.BigInt, req.params.id).query(\"SELECT line_number, COALESCE(NULLIF(part_number,''), nsn) AS part_number, nsn, cert_8130_required, cert_8130_received, coc_required, coc_received FROM order_lines WHERE order_id=@idMc AND ((cert_8130_required=1 AND cert_8130_received=0) OR (coc_required=1 AND coc_received=0))\");\n        html += renderShippingTab(o, ships, missingCertsR.recordset);";

src = src.replace(oldShipsAnchor, function() { return newShipsCall; });
console.log('+ Loaded missingCerts and passed to renderShippingTab');

// PATCH B: Update /tracking POST compliance check to log override and skip block when override=1
// Find the existing compliance gate (added in Phase A2)
const oldGate = "if (compR.recordset.length && req.body.compliance_override !== '1') {";
if (!src.includes(oldGate)) {
  console.error('! Could not find existing compliance gate (Phase A2 should have added it)');
  process.exit(1);
}

// We need to also: when override=1 with reason, log it
// Add a separate block AFTER the existing gate to log the override
const newGate = 
  "if (compR.recordset.length && req.body.compliance_override === '1') {\n" +
  "        // Log the override to status log\n" +
  "        const reason = (req.body.override_reason || '').substring(0, 500);\n" +
  "        await pool.request().input('id', sql.BigInt, req.params.id).input('n', sql.NVarChar(500), 'COMPLIANCE OVERRIDE: ' + reason)\n" +
  "          .query(\"INSERT INTO order_status_log (order_id, new_status, note) VALUES (@id, 'Compliance Override', @n)\");\n" +
  "      }\n" +
  "      " + oldGate;

src = src.replace(oldGate, function() { return newGate; });
console.log('+ Override logging added');

fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);

try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ Patched + syntax OK');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! Syntax error - reverted');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
