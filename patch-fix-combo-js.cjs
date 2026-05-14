// patch-fix-combo-js.cjs
// Fix the comma typo that breaks the combobox JS.

const fs = require('fs');
const { execSync } = require('child_process');

const f = 'admin/index.js';
const orig = fs.readFileSync(f, 'utf8');
let s = orig;

if (s.includes('COMBO_JS_FIX_V1')) {
  console.log('- already fixed');
  process.exit(0);
}

// The broken line: html += 'document.addEventListener("focus", function(e) {',
// Should end with semicolon, not comma.
const broken = "html += 'document.addEventListener(\"focus\", function(e) {',";
const fixed = "html += 'document.addEventListener(\"focus\", function(e) {';";

if (!s.includes(broken)) {
  console.error('! broken line not found (maybe already fixed?)');
  // Try with whitespace tolerance
  const idx = s.indexOf("document.addEventListener(\"focus\"");
  if (idx > 0) {
    // Find the end of that line
    const lineStart = s.lastIndexOf('\n', idx);
    const lineEnd = s.indexOf('\n', idx);
    console.error('Line as is: ' + s.substring(lineStart + 1, lineEnd));
  }
  process.exit(1);
}

s = s.replace(broken, function() { return fixed; });
s = '// COMBO_JS_FIX_V1\r\n' + s;

fs.writeFileSync(f + '.combofix.bak', orig);
fs.writeFileSync(f, s);

try {
  execSync('node -c "' + f + '"', { stdio: 'pipe' });
  console.log('+ Fixed comma typo on focus event listener line');
  console.log('+ Combobox JS should now run');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(f, orig);
  console.error('! syntax error - REVERTED');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
