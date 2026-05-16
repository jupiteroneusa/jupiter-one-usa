// patch-podetails-v3.cjs
// 1. Revert v2's move (restore from .podv2.bak)
// 2. Find the SPECIFIC bad route at line ~802: "// PO_DETAIL_EDIT_V1: POST /supplier-pos/:id/po-details"
// 3. Extract that handler completely
// 4. Move it inside the setup function (right before its closing brace)

const fs = require('fs');
const { execSync } = require('child_process');

const f = 'admin/supplierPoRoutes.js';

// STEP 1: Revert v2 if backup exists
if (fs.existsSync(f + '.podv2.bak')) {
  console.log('Reverting v2 from .podv2.bak');
  const v2orig = fs.readFileSync(f + '.podv2.bak', 'utf8');
  fs.writeFileSync(f, v2orig);
  fs.unlinkSync(f + '.podv2.bak');
}

const orig = fs.readFileSync(f, 'utf8');
const lines = orig.split(/\r?\n/);

// STEP 2: Find the SPECIFIC broken route. Anchor: comment line containing "POST /supplier-pos/:id/po-details"
let blockStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].indexOf('// PO_DETAIL_EDIT_V1: POST /supplier-pos/:id/po-details') >= 0) {
    blockStart = i;
    break;
  }
}
if (blockStart < 0) {
  console.error('! exact marker not found');
  process.exit(1);
}
console.log('Broken route comment at line ' + (blockStart+1));

// Find router.post line right after
let postLine = -1;
for (let i = blockStart; i < Math.min(blockStart + 5, lines.length); i++) {
  if (lines[i].indexOf("router.post('/supplier-pos/:id/po-details'") >= 0) {
    postLine = i;
    break;
  }
}
if (postLine < 0) {
  console.error('! router.post line not found near marker');
  process.exit(1);
}
console.log('router.post at line ' + (postLine+1));

// Walk forward counting parens/braces to find end of handler.
// Handler ends when the outer ( from router.post(...) closes.
let parens = 0;
let blockEnd = -1;
let entered = false;
for (let i = postLine; i < lines.length; i++) {
  const line = lines[i];
  for (let c = 0; c < line.length; c++) {
    const ch = line[c];
    // skip strings (cheap heuristic: skip until matching quote)
    if (ch === '"' || ch === "'") {
      const q = ch; c++;
      while (c < line.length && line[c] !== q) {
        if (line[c] === '\\') c++; // skip escaped
        c++;
      }
      continue;
    }
    if (ch === '(') { parens++; entered = true; }
    else if (ch === ')') { 
      parens--; 
      if (entered && parens === 0) { blockEnd = i; break; }
    }
  }
  if (blockEnd >= 0) break;
}

if (blockEnd < 0) {
  console.error('! could not find handler end');
  process.exit(1);
}
console.log('Handler ends at line ' + (blockEnd+1) + ': ' + lines[blockEnd]);

// Extract block (include comment line above and everything up through });)
const blockLines = lines.slice(blockStart, blockEnd + 1);
console.log('Block: ' + blockLines.length + ' lines');
console.log('First: ' + blockLines[0]);
console.log('Last:  ' + blockLines[blockLines.length-1]);

// STEP 3: Find the setup function closing brace.
// Easier: find line containing "async function maybeMarkOrderReadyToShip"
// then walk back to the previous standalone "}".
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
console.log('Setup closes at line ' + (setupClose+1));

// Make sure setup close is BEFORE block start (otherwise we'd be moving wrong direction)
if (setupClose > blockStart) {
  console.error('! WARNING: setup brace appears AFTER block; structure must be different');
  // Try to insert AT setupClose (which is below blockStart) - that's also wrong.
  // The actual situation: blockStart is INSIDE the helper, setupClose is BEFORE helper.
  // We want to MOVE block to JUST BEFORE setupClose.
  // setupClose < blockStart means block needs to move UP. That's correct.
}

// STEP 4: Rebuild file: remove block from old position, insert it before setup close
// CAUTION: removing block then inserting elsewhere needs index awareness.
// Strategy: build new array

const before = lines.slice(0, setupClose);           // 0 .. setupClose-1
const insertHere = setupClose;                        // position to insert at
const middle = lines.slice(setupClose, blockStart);   // setupClose .. blockStart-1
const after = lines.slice(blockEnd + 1);              // blockEnd+1 .. end

// New file order:
// before + [marker + block] + middle + after
const newBlock = [
  '  // PODETAILS_SCOPE_FIX_V3: moved out of maybeMarkOrderReadyToShip helper into setup scope',
  ...blockLines
];

const newLines = [...before, ...newBlock, ...middle, ...after];
const out = newLines.join('\r\n');

fs.writeFileSync(f + '.podv3.bak', orig);
fs.writeFileSync(f, out);

try {
  execSync('node -c "' + f + '"', { stdio: 'pipe' });
  console.log('+ Moved broken router.post out of helper into setup scope');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(f, orig);
  console.error('! syntax - REVERTED to pre-v3');
  console.error(err.stderr.toString().substring(0, 2000));
  process.exit(1);
}
