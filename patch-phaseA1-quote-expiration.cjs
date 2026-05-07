// patch-phaseA1-quote-expiration.cjs
// Phase A1: Reject expired quotes on accept attempt.
// Patches routes/quotes.js to check valid_until before accepting.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'routes/quotes.js';
const BACKUP = 'routes/quotes.js.phaseA1.bak';

console.log('Phase A1: Quote expiration enforcement');
console.log('======================================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes("'Quote has expired'")) { console.log('- Already patched.'); process.exit(0); }

// Find the accept route's existing UPDATE statement and inject expiration check before it
const oldAccept = ".query(`UPDATE quotes SET status = 'Accepted', accepted_at = GETDATE(), updated_at = GETDATE() WHERE id = @id`);";

if (!src.includes(oldAccept)) {
  console.error('! Could not find accept query');
  process.exit(1);
}

// We need to insert a check BEFORE this query. Find the function body and inject early.
// The accept handler starts with: router.post('/:id/accept', requireCustomer, async (req, res) => {
// We'll find the line right after the function opens and inject the expiration check.

const acceptHandlerStart = "router.post('/:id/accept', requireCustomer, async (req, res) => {";
if (!src.includes(acceptHandlerStart)) {
  console.error('! Could not find accept handler');
  process.exit(1);
}

// Find the first try { inside the accept handler
const acceptIdx = src.indexOf(acceptHandlerStart);
const tryAfterAccept = src.indexOf('try {', acceptIdx);
const poolLine = src.indexOf('const pool', tryAfterAccept);
const insertPoint = src.indexOf('\n', poolLine) + 1;

const expirationCheck =
  "      // Phase A1: Check expiration before accepting\n" +
  "      const checkR = await pool.request().input('id', sql.BigInt, req.params.id)\n" +
  "        .query(\"SELECT valid_until, status FROM quotes WHERE id=@id AND customer_id=@cid\");\n" +
  "      // (cid is a placeholder - we'll use customer_id from token via req.customerId)\n";

// Actually simpler approach: insert just BEFORE the UPDATE
const newAccept =
  "// Phase A1: Block accept if expired or already finalized\n" +
  "      const qCheck = await pool.request().input('id', sql.BigInt, req.params.id)\n" +
  "        .query(\"SELECT valid_until, status FROM quotes WHERE id=@id\");\n" +
  "      if (!qCheck.recordset.length) return res.status(404).json({ error: 'Quote not found' });\n" +
  "      const qq = qCheck.recordset[0];\n" +
  "      if (qq.status === 'Accepted') return res.status(400).json({ error: 'Quote has already been accepted' });\n" +
  "      if (qq.status === 'Rejected') return res.status(400).json({ error: 'Quote has been rejected and cannot be accepted' });\n" +
  "      if (qq.status === 'Expired') return res.status(410).json({ error: 'Quote has expired - please contact us for a new quote' });\n" +
  "      if (qq.valid_until && new Date(qq.valid_until) < new Date()) {\n" +
  "        // Auto-mark as Expired\n" +
  "        await pool.request().input('id', sql.BigInt, req.params.id)\n" +
  "          .query(\"UPDATE quotes SET status='Expired', expired_at=GETDATE(), updated_at=GETDATE() WHERE id=@id\");\n" +
  "        return res.status(410).json({ error: 'Quote has expired - please contact us for a new quote' });\n" +
  "      }\n      " + oldAccept;

src = src.replace(oldAccept, function() { return newAccept; });

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
