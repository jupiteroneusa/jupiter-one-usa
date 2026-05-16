// patch-podetails-v2.cjs
// Surgical fix: just MOVE 3 things in supplierPoRoutes.js.
// Identifies the broken structure: PO_DETAIL_EDIT_V1 router.post lives inside
// the helper function (between the helper's try block and its closing brace).
// We extract it by finding the marker line and walking until "});" appears at
// the correct indent.

const fs = require('fs');
const { execSync } = require('child_process');

const f = 'admin/supplierPoRoutes.js';
const orig = fs.readFileSync(f, 'utf8');

if (orig.includes('PODETAILS_SCOPE_FIX_V2')) {
  console.log('- already patched');
  process.exit(0);
}

const lines = orig.split(/\r?\n/);

// Find PO_DETAIL_EDIT_V1 marker
let blockStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].indexOf('PO_DETAIL_EDIT_V1') >= 0 && lines[i].indexOf('//') >= 0) {
    blockStart = i;
    break;
  }
}
if (blockStart < 0) {
  console.error('! PO_DETAIL_EDIT_V1 marker not found');
  process.exit(1);
}
console.log('Block starts at line ' + (blockStart+1));

// Find block end: the line "  });" (2-space indent, then });) AFTER blockStart.
// First find "router.post(" line
let routerPostLine = -1;
for (let i = blockStart; i < lines.length; i++) {
  if (lines[i].indexOf('router.post') >= 0) {
    routerPostLine = i;
    break;
  }
}
console.log('router.post at line ' + (routerPostLine+1));

// Walk forward; track depth in the handler body.
let depth = 0;
let inHandler = false;
let blockEnd = -1;
for (let i = routerPostLine; i < lines.length; i++) {
  const line = lines[i];
  for (let c = 0; c < line.length; c++) {
    const ch = line[c];
    if (ch === '(' || ch === '{') { depth++; inHandler = true; }
    else if (ch === ')' || ch === '}') {
      depth--;
      if (inHandler && depth === 0) {
        // Look for the ; that should follow at this column or the next
        // The pattern is "});" - we're at the ) so semicolon comes right after
        blockEnd = i;
        break;
      }
    }
  }
  if (blockEnd >= 0) break;
}

if (blockEnd < 0) {
  console.error('! could not find block end');
  process.exit(1);
}
console.log('Block ends at line ' + (blockEnd+1));

// Extract block (inclusive)
const blockLines = lines.slice(blockStart, blockEnd + 1);
console.log('Extracted ' + blockLines.length + ' lines');
console.log('First: ' + blockLines[0]);
console.log('Last:  ' + blockLines[blockLines.length-1]);

// Find the closing } of the setup function. Look for line "}" (no indent)
// that comes BEFORE "// Helper:" or "async function maybeMarkOrderReadyToShip"
let helperLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].indexOf('async function maybeMarkOrderReadyToShip') >= 0) {
    helperLine = i;
    break;
  }
}
if (helperLine < 0) {
  console.error('! helper function not found');
  process.exit(1);
}
console.log('Helper function at line ' + (helperLine+1));

// Walk backward from helper to find the closing }
let setupClose = -1;
for (let i = helperLine - 1; i >= 0; i--) {
  if (lines[i].trim() === '}') {
    setupClose = i;
    break;
  }
}
if (setupClose < 0) {
  console.error('! setup close brace not found');
  process.exit(1);
}
console.log('Setup function closes at line ' + (setupClose+1));

// Build new file:
// 1. lines[0..blockStart-1] (everything before the block)
// 2. lines[blockEnd+1..setupClose-1] (after block, up to but not including the })
// 3. The extracted block (with PODETAILS_SCOPE_FIX_V2 marker)
// 4. lines[setupClose..end] (the } and everything after)

const before = lines.slice(0, blockStart);
const middle = lines.slice(blockEnd + 1, setupClose);
const after = lines.slice(setupClose);

const newBlock = [
  '  // PODETAILS_SCOPE_FIX_V2: moved out of helper into setup scope',
  ...blockLines
];

const newLines = [...before, ...middle, ...newBlock, ...after];
const out = newLines.join('\r\n');

fs.writeFileSync(f + '.podv2.bak', orig);
fs.writeFileSync(f, out);

try {
  execSync('node -c "' + f + '"', { stdio: 'pipe' });
  console.log('+ PO_DETAIL_EDIT_V1 route moved into setup function scope');
  console.log('+ "router is not defined" should be fixed');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(f, orig);
  console.error('! syntax - REVERTED');
  console.error(err.stderr.toString().substring(0, 2000));
  process.exit(1);
}
