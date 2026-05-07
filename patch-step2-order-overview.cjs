// patch-step2-order-overview.cjs
// Wires the new overview block into admin/orderRoutes.js
// Adds: import statement, replaces inline overview HTML with function call,
//       adds POST /orders/:id/overview-update route.
// Safety: backs up, syntax-checks, auto-reverts on failure.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/orderRoutes.js';
const BACKUP = 'admin/orderRoutes.js.step2.bak';

console.log('Step 2: Order Overview Tab Enhancement');
console.log('======================================');

if (!fs.existsSync(TARGET)) { console.error('! Missing: ' + TARGET); process.exit(1); }
if (!fs.existsSync('admin/orderOverviewBlock.js')) {
  console.error('! Missing: admin/orderOverviewBlock.js (move it to admin/ first)');
  process.exit(1);
}

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

// Already patched?
if (src.includes('renderOverviewTab')) {
  console.log('- Already patched. Nothing to do.');
  process.exit(0);
}

// ============================================================================
// PATCH 1: Add the import at the top
// ============================================================================
const importAnchor = "import { generateNumber } from '../db/numbering.js';";
const newImports = importAnchor + "\nimport { renderOverviewTab } from './orderOverviewBlock.js';";

if (!src.includes(importAnchor)) {
  console.error('! Could not find import anchor: ' + importAnchor);
  process.exit(1);
}
src = src.replace(importAnchor, newImports);

// ============================================================================
// PATCH 2: Replace the inline overview block with renderOverviewTab(o, sLog)
// The existing block starts with "if (activeTab === 'overview') {"
// and ends just before "} else if (activeTab === 'lines') {"
// ============================================================================
const startMarker = "if (activeTab === 'overview') {";
const endMarker = "} else if (activeTab === 'lines') {";

const startIdx = src.indexOf(startMarker);
const endIdx = src.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
  console.error('! Could not locate overview block boundaries');
  process.exit(1);
}

// Replace everything from startMarker to endMarker (exclusive) with our new code
const before = src.substring(0, startIdx);
const after = src.substring(endIdx);
const replacement = "if (activeTab === 'overview') {\n        html += renderOverviewTab(o, sLog);\n      ";

src = before + replacement + after;

// ============================================================================
// PATCH 3: Add the POST /orders/:id/overview-update route
// Insert it just before the existing /orders/:id/status route
// ============================================================================
const routeAnchor = "router.post('/orders/:id/status', async (req, res) => {";
if (!src.includes(routeAnchor)) {
  console.error('! Could not find /orders/:id/status anchor for new route');
  process.exit(1);
}

const newRoute =
  "router.post('/orders/:id/overview-update', async (req, res) => {\n" +
  "    if (!requireAuth(req, res)) return;\n" +
  "    try {\n" +
  "      const pool = await getPool();\n" +
  "      const b = req.body;\n" +
  "      await pool.request()\n" +
  "        .input('id', sql.BigInt, req.params.id)\n" +
  "        .input('priority', sql.NVarChar(20), b.priority || 'Standard')\n" +
  "        .input('assignedTo', sql.NVarChar(100), b.assigned_to || null)\n" +
  "        .input('contractNumber', sql.NVarChar(100), b.contract_number || null)\n" +
  "        .input('country', sql.NVarChar(50), b.country_of_destination || null)\n" +
  "        .input('endUseCert', sql.Bit, b.end_use_cert_required === '1' ? 1 : 0)\n" +
  "        .input('internalNotes', sql.NVarChar(sql.MAX), b.internal_notes || null)\n" +
  "        .query('UPDATE orders SET priority=@priority, assigned_to=@assignedTo, contract_number=@contractNumber, country_of_destination=@country, end_use_cert_required=@endUseCert, internal_notes=@internalNotes, updated_at=GETDATE() WHERE id=@id');\n" +
  "      res.redirect('/admin/orders/'+req.params.id+'?tab=overview&saved=1');\n" +
  "    } catch(err) { res.redirect('/admin/orders/'+req.params.id+'?error='+encodeURIComponent(err.message)); }\n" +
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
  console.log('+ Syntax check PASSED');
  // Also check the new module compiles
  execSync('node -c "admin/orderOverviewBlock.js"', { stdio: 'pipe' });
  console.log('+ orderOverviewBlock.js syntax OK');
  console.log('');
  console.log('======================================');
  console.log('SUCCESS - safe to commit and push.');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('');
  console.error('======================================');
  console.error('! SYNTAX ERROR - changes REVERTED. File restored from memory.');
  console.error('');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
