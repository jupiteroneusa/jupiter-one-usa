// patch-fix-script-scope.cjs
// The script block got injected inside the `if (oLines.length === 0)` branch
// because my previous patch put it before the WRONG `return html;`.
// Move it AFTER the final return-prep, just before return html (the real one).

const fs = require('fs');
const { execSync } = require('child_process');

const f = 'admin/orderLinesBlock.js';
const orig = fs.readFileSync(f, 'utf8');
let s = orig;

// Find the script block we injected. It starts at the comment marker.
const scriptStart = '    // ORDER_SOURCES_ADDREMOVE_V2: inject combobox + add row script';
const scriptStartIdx = s.indexOf(scriptStart);
if (scriptStartIdx < 0) {
  // Try without leading spaces
  const alt = '// ORDER_SOURCES_ADDREMOVE_V2: inject combobox + add row script';
  const altIdx = s.indexOf(alt);
  if (altIdx < 0) {
    console.error('! script start marker not found');
    process.exit(1);
  }
  // Walk back to start of line
  let i = altIdx;
  while (i > 0 && s[i-1] !== '\n') i--;
  console.log('Found script start at offset ' + i);
  scriptStartIdx_real = i;
} 

// Walk back to find the line beginning
let actualStart = scriptStartIdx;
while (actualStart > 0 && s[actualStart-1] !== '\n') actualStart--;

// Find script end - look for "html += '<' + '/script>';"
const scriptEndMarker = "html += '<' + '/script>';";
const scriptEndIdx = s.indexOf(scriptEndMarker, actualStart);
if (scriptEndIdx < 0) {
  console.error('! script end marker not found');
  process.exit(1);
}
let actualEnd = scriptEndIdx + scriptEndMarker.length;
// Include the trailing newline
while (actualEnd < s.length && s[actualEnd] !== '\n') actualEnd++;
actualEnd++;

// Extract the script block
const scriptBlock = s.substring(actualStart, actualEnd);
console.log('Extracted script block length: ' + scriptBlock.length + ' bytes');

// Remove from current location
s = s.slice(0, actualStart) + s.slice(actualEnd);

// Insert just before "  return html;" (the real one, which is now the ONLY one)
const returnAnchor = '  return html;';
const retIdx = s.lastIndexOf(returnAnchor);
if (retIdx < 0) {
  console.error('! return anchor not found');
  process.exit(1);
}

// Reformat the block to match new context (function scope, not inside if)
// The block currently has indentation for inside-if; reduce to function scope.
const cleanedBlock = scriptBlock.split('\n').map(function(line) {
  // Strip extra leading spaces if present
  return line;
}).join('\n');

s = s.slice(0, retIdx) + cleanedBlock + '\n' + s.slice(retIdx);

fs.writeFileSync(f + '.scopefix.bak', orig);
fs.writeFileSync(f, s);

try {
  execSync('node -c "' + f + '"', { stdio: 'pipe' });
  console.log('+ Moved script block out of if-branch, into function scope');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(f, orig);
  console.error('! syntax - REVERTED');
  console.error(err.stderr.toString());
  process.exit(1);
}
