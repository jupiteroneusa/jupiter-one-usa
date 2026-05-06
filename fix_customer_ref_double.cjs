/**
 * fix_customer_ref_double.cjs
 * Jupiter One USA — Fix Script
 *
 * Fix: customer_ref selected twice in RFQ list query (line 296)
 *
 * Usage:
 *   move "%USERPROFILE%\Downloads\fix_customer_ref_double.cjs" fix_customer_ref_double.cjs && node fix_customer_ref_double.cjs
 *
 * Then:
 *   git add -A && git commit -m "Fix customer ref doubling in RFQ list query" && git push
 */

const fs = require('fs');
const path = require('path');

const ADMIN_FILE = path.join(__dirname, 'admin', 'index.js');
console.log('Reading:', ADMIN_FILE);

let src = fs.readFileSync(ADMIN_FILE, 'utf8');
const original = src;

const bad  = 'c.id AS customer_id, c.first_name+\' \'+c.last_name AS customer_name, c.company, c.email, h.customer_ref, h.customer_ref,';
const good = 'c.id AS customer_id, c.first_name+\' \'+c.last_name AS customer_name, c.company, c.email, h.customer_ref,';

if (src.includes(bad)) {
  src = src.replace(bad, good);
  fs.writeFileSync(ADMIN_FILE, src, 'utf8');
  console.log('✅ Fixed: duplicate h.customer_ref removed from RFQ list query.');
  console.log('\nNext step:');
  console.log('  git add -A && git commit -m "Fix customer ref doubling in RFQ list query" && git push');
} else {
  console.warn('⚠️  Pattern not found — may already be fixed or query changed.');
}
