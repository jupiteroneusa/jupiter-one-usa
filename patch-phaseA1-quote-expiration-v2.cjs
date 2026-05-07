// patch-phaseA1-quote-expiration-v2.cjs
// v2: Anchor on the FULL pool.request().input().query() chain so we replace
// the whole expression as one unit. No more dangling .query.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'routes/quotes.js';
const BACKUP = 'routes/quotes.js.phaseA1v2.bak';

console.log('Phase A1 v2: Quote expiration enforcement');
console.log('=========================================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes("'Quote has expired'")) { console.log('- Already patched.'); process.exit(0); }

// Anchor on the FULL chain that does the Accept update.
// We need to find: await pool.request()...input chain...query("UPDATE quotes SET status='Accepted'...")
// And replace the whole thing with: expiration check + same accept update.

// Use regex to match the whole chain (multi-line). The chain ends with a ; after .query(...)
const acceptChainRegex = /await pool\.request\(\)[^;]*?\.query\(`UPDATE quotes SET status = 'Accepted'[^`]*`\);/s;

if (!acceptChainRegex.test(src)) {
  console.error('! Could not find accept chain via regex');
  // Show context
  const idx = src.indexOf("status = 'Accepted'");
  if (idx > -1) {
    console.error('  Context around accepted update:');
    console.error(src.substring(Math.max(0, idx - 200), Math.min(src.length, idx + 200)));
  }
  process.exit(1);
}

// Capture the original chain so we can keep it inside our new expression
const match = src.match(acceptChainRegex);
const originalChain = match[0];

const replacement =
  "// Phase A1: Block accept if expired or already finalized\n" +
  "      const _qCheck = await pool.request().input('id', sql.BigInt, req.params.id)\n" +
  "        .query(\"SELECT valid_until, status FROM quotes WHERE id=@id\");\n" +
  "      if (!_qCheck.recordset.length) return res.status(404).json({ error: 'Quote not found' });\n" +
  "      const _qq = _qCheck.recordset[0];\n" +
  "      if (_qq.status === 'Accepted') return res.status(400).json({ error: 'Quote has already been accepted' });\n" +
  "      if (_qq.status === 'Rejected') return res.status(400).json({ error: 'Quote has been rejected and cannot be accepted' });\n" +
  "      if (_qq.status === 'Expired') return res.status(410).json({ error: 'Quote has expired - please contact us for a new quote' });\n" +
  "      if (_qq.valid_until && new Date(_qq.valid_until) < new Date()) {\n" +
  "        await pool.request().input('id', sql.BigInt, req.params.id)\n" +
  "          .query(\"UPDATE quotes SET status='Expired', expired_at=GETDATE(), updated_at=GETDATE() WHERE id=@id\");\n" +
  "        return res.status(410).json({ error: 'Quote has expired - please contact us for a new quote' });\n" +
  "      }\n" +
  "      " + originalChain;

src = src.replace(acceptChainRegex, function() { return replacement; });

fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);

try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ Patched + syntax OK');
  console.log('SUCCESS - safe to push');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! Syntax error - reverted');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
