// check-upload-wiring.cjs
const fs = require('fs');

console.log('========== where is /api/documents mounted? ==========\n');
// Look in app.js, server.js, index.js (root)
['app.js', 'server.js', 'index.js', 'main.js'].forEach(f => {
  if (!fs.existsSync(f)) return;
  console.log('\n--- ' + f + ' (lines mentioning documents) ---');
  const src = fs.readFileSync(f, 'utf8');
  src.split('\n').forEach((ln, i) => {
    if (/document/i.test(ln) || /\/api/i.test(ln)) {
      console.log((i+1) + ': ' + ln);
    }
  });
});

console.log('\n========== requireAdmin middleware ==========\n');
if (fs.existsSync('middleware/auth.js')) {
  const src = fs.readFileSync('middleware/auth.js', 'utf8');
  // Find requireAdmin function
  const idx = src.indexOf('requireAdmin');
  if (idx >= 0) {
    console.log(src.slice(idx, idx + 800));
  }
}

console.log('\n========== check if /api/documents/upload returns anything ==========');
console.log('Try in browser DevTools console (F12 → Console) while on the PO docs tab:');
console.log("  fetch('/api/documents/upload', {method:'POST', credentials:'same-origin'}).then(r => r.text()).then(console.log)");
console.log('That should return an error message saying what auth is needed.');
