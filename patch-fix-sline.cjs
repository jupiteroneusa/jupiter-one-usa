// patch-fix-sline.cjs
// Fixes the nested .input() bug from the earlier lead-time patch.
// Use loop variable `s` (not sLine) and properly separate the .input chains.

const fs = require('fs');
const { execSync } = require('child_process');

const f = 'admin/quoteBuilder.js';
const orig = fs.readFileSync(f, 'utf8');
let s = orig;

if (s.includes('SLINE_FIX_V1')) {
  console.log('- already fixed');
  process.exit(0);
}

const oldBroken = `.input('ld', sql.Int, s.lead_days ? parseInt(s.lead_days)
          .input('ltt', sql.NVarChar(sql.MAX), sLine.lead_time_text || pl.lead_time_text || null) : null)`;

const newFixed = `.input('ld', sql.Int, s.lead_days ? parseInt((s.lead_days+'').replace(/[^0-9]/g,'')) || null : null)
        .input('ltt', sql.NVarChar(sql.MAX), s.lead_time_text || s.lead_days || pl.lead_time_text || null)`;

if (!s.includes(oldBroken)) {
  console.error('! could not find broken anchor — file may already be different');
  console.error('  Looking for: ' + oldBroken.substring(0, 80));
  process.exit(1);
}

s = s.replace(oldBroken, newFixed);
// Add marker so we don't re-patch
s = '// SLINE_FIX_V1\n' + s;

fs.writeFileSync(f + '.sline.bak', orig);
fs.writeFileSync(f, s);

try {
  execSync('node -c "' + f + '"', { stdio: 'pipe' });
  console.log('+ Fixed nested .input() malformation');
  console.log('+ Use `s.lead_time_text` (loop var) instead of out-of-scope `sLine`');
  console.log('+ Falls back to s.lead_days text if no separate lead_time_text');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(f, orig);
  console.error('! syntax error - REVERTED');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
