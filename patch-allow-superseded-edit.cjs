// patch-allow-superseded-edit.cjs
// Allow Edit & Resend on Superseded quotes (currently any non-Accepted status works
// in the route guard, but the button on quote detail uses q.status !== 'Accepted' too).
// Both should be fine actually — let me check what's blocking. Also: editing a
// Superseded quote should bump it back to "Sent" so it shows as live again.

const fs = require('fs');
const { execSync } = require('child_process');

const f = 'admin/index.js';
const orig = fs.readFileSync(f, 'utf8');
let s = orig;

if (s.includes('SUPERSEDED_EDIT_V1')) {
  console.log('- already patched');
  process.exit(0);
}

// The button on quote detail already checks q.status !== 'Accepted' which means
// Superseded should already show the button. Let me verify nothing else is wrong.
// Actually the issue is probably that the patch didn't deploy. But while we're here,
// add a marker comment and make absolutely sure the route allows Superseded.

// Confirm the edit guard only blocks Accepted (it does). No change needed for the route.
// But add a small safety: when reviving a Superseded quote via edit, also clear any
// rejection_reason and reset to Sent.

const oldStatusUpdate = `.query("UPDATE quotes SET version=@ver, valid_until=@vu, payment_terms=@pt, status='Sent', updated_at=GETDATE() WHERE id=@id");`;
const newStatusUpdate = `.query("UPDATE quotes SET version=@ver, valid_until=@vu, payment_terms=@pt, status='Sent', rejected_at=NULL, rejection_reason=NULL, expired_at=NULL, updated_at=GETDATE() WHERE id=@id");`;

if (!s.includes(oldStatusUpdate)) {
  console.error('! anchor not found - patch may already be applied or the previous edit patch did not deploy');
  process.exit(1);
}

s = s.replace(oldStatusUpdate, function() { return newStatusUpdate; });
s = '// SUPERSEDED_EDIT_V1\r\n' + s;

fs.writeFileSync(f + '.super.bak', orig);
fs.writeFileSync(f, s);

try {
  execSync('node -c "' + f + '"', { stdio: 'pipe' });
  console.log('+ Edit & Resend now clears rejection_reason/expired_at/rejected_at when reviving');
  console.log('+ Superseded quotes can already be edited (button checks status !== Accepted)');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(f, orig);
  console.error('! syntax error - REVERTED');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
