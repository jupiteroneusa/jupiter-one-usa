// patch-phaseB1-quote-reject.cjs
// Phase B1: Add /api/quotes/:id/reject route so customers can reject quotes.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'routes/quotes.js';
const BACKUP = 'routes/quotes.js.phaseB1.bak';

console.log('Phase B1: Customer reject quote route');
console.log('=====================================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes("router.post('/:id/reject'")) { console.log('- Already patched.'); process.exit(0); }

// Insert the reject route right BEFORE the existing GET '/:id' route (line ~265)
const anchor = "router.get('/:id', requireCustomer, async (req, res) => {";
if (!src.includes(anchor)) {
  console.error('! Could not find anchor');
  process.exit(1);
}

const newRoute =
  "// POST /api/quotes/:id/reject - customer rejects a quote\n" +
  "router.post('/:id/reject', requireCustomer, async (req, res) => {\n" +
  "  const { reason } = req.body;\n" +
  "  try {\n" +
  "    const pool = await getPool();\n" +
  "    const qR = await pool.request().input('id', sql.BigInt, req.params.id).input('cid', sql.BigInt, req.customerId)\n" +
  "      .query('SELECT id, status FROM quotes WHERE id=@id AND customer_id=@cid');\n" +
  "    if (!qR.recordset.length) return res.status(404).json({ error: 'Quote not found' });\n" +
  "    const q = qR.recordset[0];\n" +
  "    if (q.status === 'Accepted') return res.status(400).json({ error: 'Quote already accepted' });\n" +
  "    if (q.status === 'Rejected') return res.status(400).json({ error: 'Quote already rejected' });\n" +
  "    await pool.request()\n" +
  "      .input('id', sql.BigInt, req.params.id)\n" +
  "      .input('reason', sql.NVarChar(1000), reason || null)\n" +
  "      .query(\"UPDATE quotes SET status='Rejected', rejected_at=GETDATE(), rejection_reason=@reason, updated_at=GETDATE() WHERE id=@id\");\n" +
  "    try { await logAudit({ entity_type: 'quote', entity_id: req.params.id, action: 'rejected', performed_by: req.customerId, performed_by_type: 'customer', ip_address: getIp(req), notes: reason || null }); } catch(e) {}\n" +
  "    res.json({ ok: true });\n" +
  "  } catch(err) { console.error('Quote reject error:', err); res.status(500).json({ error: err.message }); }\n" +
  "});\n\n" +
  anchor;

src = src.replace(anchor, function() { return newRoute; });

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
