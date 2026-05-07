// patch-phaseA2-compliance-gate.cjs
// Phase A2: Block Mark Shipped if compliance certs are required but not received.
// Patches admin/orderRoutes.js /tracking POST route.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/orderRoutes.js';
const BACKUP = 'admin/orderRoutes.js.phaseA2.bak';

console.log('Phase A2: Compliance gate on Mark Shipped');
console.log('=========================================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('compliance_blocked')) { console.log('- Already patched.'); process.exit(0); }

// Find the start of /tracking POST route - inject compliance check right after auth + try open
const trackAnchor = "router.post('/orders/:id/tracking', async (req, res) => {";
if (!src.includes(trackAnchor)) {
  console.error('! Could not find /tracking POST anchor');
  process.exit(1);
}

// Inject compliance check before the existing INSERT INTO shipments
// Find the const pool inside this route and inject right after it
const idx = src.indexOf(trackAnchor);
const tryIdx = src.indexOf('try {', idx);
const poolIdx = src.indexOf('const pool', tryIdx);
const lineEnd = src.indexOf('\n', poolIdx);

const complianceCheck =
  '\n      // Phase A2: Compliance gate - block ship if certs required but not received\n' +
  '      const compR = await pool.request().input(\'oid\', sql.BigInt, req.params.id).query(\n' +
  '        "SELECT line_number, COALESCE(NULLIF(part_number,\'\'), nsn) AS pn, " +\n' +
  '        "(cert_8130_required & ~cert_8130_received) AS m8130, " +\n' +
  '        "(coc_required & ~coc_received) AS mcoc " +\n' +
  '        "FROM order_lines WHERE order_id=@oid AND ((cert_8130_required=1 AND cert_8130_received=0) OR (coc_required=1 AND coc_received=0))"\n' +
  '      );\n' +
  '      if (compR.recordset.length && req.body.compliance_override !== \'1\') {\n' +
  '        const blocking = compR.recordset.map(function(l){\n' +
  '          var miss = []; if (l.m8130) miss.push(\'8130-3\'); if (l.mcoc) miss.push(\'CoC\');\n' +
  '          return \'Line \' + l.line_number + \' (\' + l.pn + \') missing: \' + miss.join(\', \');\n' +
  '        }).join(\'; \');\n' +
  '        return res.redirect(\'/admin/orders/\' + req.params.id + \'?tab=shipping&error=\' + encodeURIComponent(\'Compliance blocked: \' + blocking + \'. Mark certs received first or use override.\'));\n' +
  '      }\n' +
  '      // (compliance_blocked check end)\n';

const insertHere = lineEnd + 1;
src = src.substring(0, insertHere) + complianceCheck + src.substring(insertHere);

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
