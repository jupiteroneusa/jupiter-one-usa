// patch-step6b-supplier-list-fix.cjs
// Fix: supplier list query in admin/index.js still uses 'name' instead of 'company_name'.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/index.js';
const BACKUP = 'admin/index.js.step6b.bak';

console.log('Step 6b: Fix supplier list query');
console.log('================================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

// Try multiple variants of the broken query
const variants = [
  // Variant 1: with whitespace
  { old: "SELECT id, name, contact_name, email, phone, country, status, created_at FROM suppliers ORDER BY name ASC",
    new: "SELECT id, company_name AS name, contact_name, email, phone, country, status, created_at FROM suppliers ORDER BY company_name ASC" },
  // Variant 2: simpler
  { old: "SELECT id, name, contact_name, email, phone, country, status FROM suppliers ORDER BY name",
    new: "SELECT id, company_name AS name, contact_name, email, phone, country, status FROM suppliers ORDER BY company_name" },
  // Variant 3: even simpler SELECT * style
  { old: "FROM suppliers ORDER BY name ASC",
    new: "FROM suppliers ORDER BY company_name ASC" },
  // Variant 4: just the SELECT name
  { old: "SELECT id, name,",
    new: "SELECT id, company_name AS name," },
];

let patched = false;
for (const v of variants) {
  if (src.includes(v.new)) { console.log('- Already patched (matched: ' + v.new.substring(0, 40) + '...)'); patched = true; break; }
  if (src.includes(v.old)) {
    src = src.replace(v.old, function() { return v.new; });
    console.log('+ Patched variant: ' + v.old.substring(0, 50) + '...');
    patched = true;
    break;
  }
}

if (!patched) {
  console.error('! Could not find supplier list query to fix.');
  console.error('  Looking at the actual query in admin/index.js to debug:');
  // Print the suppliers route section so we can see what's there
  const idx = src.indexOf("router.get('/suppliers',");
  if (idx > -1) {
    console.error('  Found /suppliers route at char ' + idx);
    console.error('  Excerpt:');
    console.error(src.substring(idx, idx + 800));
  }
  process.exit(1);
}

fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);
console.log('+ Backup saved: ' + BACKUP);

try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ Syntax check PASSED');
  console.log('SUCCESS - safe to push');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! Syntax error - reverted');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
