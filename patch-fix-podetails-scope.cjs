// Move PO_DETAIL_EDIT_V1 block out of the maybeMarkOrderReadyToShip helper,
// back into the setup function where `router` is defined.

const fs = require('fs');
const { execSync } = require('child_process');

const f = 'admin/supplierPoRoutes.js';
const orig = fs.readFileSync(f, 'utf8');
let s = orig;

if (s.includes('PODETAILS_SCOPE_FIX_V1')) {
  console.log('- already patched');
  process.exit(0);
}

// 1. Find the block "// PO_DETAIL_EDIT_V1: POST /supplier-pos/:id/po-details" up to its closing });
const blockStart = s.indexOf("// PO_DETAIL_EDIT_V1: POST /supplier-pos/:id/po-details");
if (blockStart < 0) {
  console.error('! PO_DETAIL_EDIT_V1 marker not found');
  process.exit(1);
}

// Walk back to start of line
let bs = blockStart;
while (bs > 0 && s[bs-1] !== '\n') bs--;

// Find the matching `});` that closes router.post(...)
// Walk forward, counting parens/braces inside the router.post call.
// Easier: look for the next `\n  });\n` after blockStart that closes a router.post handler.
let depth = 0;
let inHandler = false;
let blockEnd = -1;
let i = bs;
while (i < s.length) {
  if (!inHandler && s.substring(i, i+12) === "router.post(") { inHandler = true; depth = 0; i += 12; continue; }
  if (inHandler) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') { 
      depth--; 
      if (depth === 0) {
        // Now expect ; then newline
        let j = i+1;
        while (j < s.length && (s[j] === ' ' || s[j] === ';')) j++;
        // Include trailing newline
        if (s[j] === '\n') j++;
        blockEnd = j;
        break;
      }
    }
  }
  i++;
}

if (blockEnd < 0) {
  console.error('! could not find block end');
  process.exit(1);
}

const block = s.substring(bs, blockEnd);
console.log('Extracted block: ' + block.length + ' chars');
console.log('First line: ' + block.split('\n')[0]);
console.log('Last 60 chars: ' + block.substring(block.length-60));

// Remove from current location
s = s.substring(0, bs) + s.substring(blockEnd);

// 2. Insert BEFORE the line "}" that closes the setup function.
// That's the "^}$" at line ~776 in original (now shifted). Find it as the }
// that comes right before "// =====" and "// Helper:" or similar.
// Anchor: find the literal "\n}\n\n// ==========================================================================\n// Helper:"
const anchor = "\n}\n\n// ==========================================================================\n// Helper: when all order_lines";
const aIdx = s.indexOf(anchor);
if (aIdx < 0) {
  // Try without exact whitespace
  const altIdx = s.indexOf("// Helper: when all order_lines");
  if (altIdx < 0) {
    console.error('! Helper marker not found');
    process.exit(1);
  }
  // Walk back to find the closing } of setup
  let p = altIdx;
  while (p > 0 && s[p] !== '}') p--;
  // Insert block JUST BEFORE that }
  console.log('Inserting block before closing brace at offset ' + p);
  // Prepend marker
  const marker = "  // PODETAILS_SCOPE_FIX_V1: moved out of maybeMarkOrderReadyToShip\r\n";
  s = s.substring(0, p) + marker + block + s.substring(p);
} else {
  // Position right before the closing }
  const closeBrace = aIdx + 1; // \n at aIdx, then } at aIdx+1
  console.log('Inserting block before closing brace at offset ' + closeBrace);
  const marker = "  // PODETAILS_SCOPE_FIX_V1: moved out of maybeMarkOrderReadyToShip\r\n";
  s = s.substring(0, closeBrace) + marker + block + s.substring(closeBrace);
}

fs.writeFileSync(f + '.scope.bak', orig);
fs.writeFileSync(f, s);

try {
  execSync('node -c "' + f + '"', { stdio: 'pipe' });
  console.log('+ Moved PO_DETAIL_EDIT_V1 back into setup function scope');
  console.log('+ "router is not defined" should be fixed');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(f, orig);
  console.error('! syntax - REVERTED');
  console.error(err.stderr.toString());
  process.exit(1);
}
