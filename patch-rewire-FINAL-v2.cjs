// patch-rewire-FINAL-v2.cjs
// Line-anchor approach for robust handler removal.
// 
// Each route handler in admin/index.js looks like:
//     router.METHOD('/path', async (req, res) => {
//       ...
//     });
//
// We find the start signature, then scan FORWARD line-by-line for the next
// "  });" at indent level <= 4 spaces (handler closes), OR for the start of
// the next "  router." at indent level <= 4 spaces (next handler).

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/index.js';
const BACKUP = 'admin/index.js.rewireFinalV2.bak';

console.log('Rewire FINAL v2: line-anchor handler removal');
console.log('============================================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (!fs.existsSync('admin/quoteBuilder.js')) {
  console.error('! admin/quoteBuilder.js missing');
  process.exit(1);
}

// =====================================================================
// Idempotency check
// =====================================================================
const importLine = "import { mountQuoteBuilder } from './quoteBuilder.js';";
const mountLine = "mountQuoteBuilder(router, requireAuth, page);";
const importDone = src.includes(importLine);
const mountDone = src.includes(mountLine);
const oldHandler1 = src.includes("router.get('/rfqs/:id/quote-review'");
const oldHandler2 = src.includes("router.post('/rfqs/:id/quote-review'");
const oldHandler3 = src.includes("router.post('/rfqs/:id/quote',");

console.log('Current state:');
console.log('  import added:    ' + importDone);
console.log('  mount added:     ' + mountDone);
console.log('  old handler 1:   ' + (oldHandler1 ? 'STILL PRESENT' : 'gone'));
console.log('  old handler 2:   ' + (oldHandler2 ? 'STILL PRESENT' : 'gone'));
console.log('  old handler 3:   ' + (oldHandler3 ? 'STILL PRESENT' : 'gone'));
console.log('');

// =====================================================================
// STEP 1: Add import if missing
// =====================================================================
if (!importDone) {
  const importAnchor = "import { mountSupplierPoRoutes } from './supplierPoRoutes.js';";
  if (!src.includes(importAnchor)) {
    console.error('! Cannot find import anchor');
    process.exit(1);
  }
  src = src.replace(importAnchor, function() { return importAnchor + "\n" + importLine; });
  console.log('+ Import added');
}

// =====================================================================
// STEP 2: Add mount if missing
// =====================================================================
if (!mountDone) {
  const mountAnchor = "mountSupplierPoRoutes(router, requireAuth, page);";
  if (!src.includes(mountAnchor)) {
    console.error('! Cannot find mount anchor');
    process.exit(1);
  }
  src = src.replace(mountAnchor, function() { return mountAnchor + "\n  " + mountLine; });
  console.log('+ Mount added');
}

// =====================================================================
// STEP 3: Remove handlers using line-anchor approach
// =====================================================================

// Each handler signature pattern. We use plain text indexOf which is robust
// to whatever indentation the file uses.
const handlers = [
  "router.get('/rfqs/:id/quote-review',",
  "router.post('/rfqs/:id/quote-review',",
  "router.post('/rfqs/:id/quote',",
];

function removeHandler(src, sigText) {
  const lines = src.split('\n');
  
  // Find the start line
  let startLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(sigText)) {
      startLine = i;
      break;
    }
  }
  if (startLine === -1) {
    return { src: src, removed: false, reason: 'not found' };
  }
  
  // Determine the indent of the start line. The closing line we're looking for 
  // will be at the SAME indent followed by "});"
  const startLineText = lines[startLine];
  const indentMatch = startLineText.match(/^(\s*)/);
  const startIndent = indentMatch ? indentMatch[1] : '';
  
  // Walk forward looking for either:
  //   1. A line that is exactly startIndent + "});" (the closing of THIS handler)
  //   2. A line that starts with a NEW route at the same indent (means we missed the close)
  
  const closingLine = startIndent + '});';
  let endLine = -1;
  
  for (let i = startLine + 1; i < lines.length; i++) {
    const ln = lines[i];
    
    // Check if this is the closing line
    if (ln === closingLine || ln.replace(/\s+$/, '') === closingLine) {
      endLine = i;
      break;
    }
    
    // If we hit another router definition at the same indent, we went too far
    // (means our handler had a different closing pattern)
    if (i > startLine + 5) {
      // Check for next handler signature at same indent
      const nextHandlerPattern = startIndent + 'router.';
      if (ln.startsWith(nextHandlerPattern)) {
        // Back off: closing must be the line BEFORE this
        endLine = i - 1;
        // Verify it's a closing
        let candidate = lines[endLine].replace(/\s+$/, '');
        if (candidate !== closingLine && !candidate.endsWith('});')) {
          return { src: src, removed: false, reason: 'next router found at line ' + (i+1) + ' but no clean close before it' };
        }
        break;
      }
    }
  }
  
  if (endLine === -1) {
    return { src: src, removed: false, reason: 'closing line not found' };
  }
  
  // Slice out lines [startLine .. endLine] inclusive, replace with comment marker
  const replacement = startIndent + '/* MOVED to admin/quoteBuilder.js: ' + sigText.substring(0, 40) + ' */';
  const newLines = lines.slice(0, startLine).concat([replacement]).concat(lines.slice(endLine + 1));
  return {
    src: newLines.join('\n'),
    removed: true,
    startLine: startLine + 1,
    endLine: endLine + 1,
    lineCount: endLine - startLine + 1,
  };
}

const handlersToProcess = [
  { sig: handlers[0], skipIfDone: !oldHandler1 },
  { sig: handlers[1], skipIfDone: !oldHandler2 },
  { sig: handlers[2], skipIfDone: !oldHandler3 },
];

for (const h of handlersToProcess) {
  if (h.skipIfDone) {
    console.log('- Skipping ' + h.sig + ' (already gone)');
    continue;
  }
  const result = removeHandler(src, h.sig);
  if (!result.removed) {
    console.error('! Failed to remove ' + h.sig);
    console.error('  Reason: ' + result.reason);
    process.exit(1);
  }
  src = result.src;
  console.log('+ Removed ' + h.sig + ' (lines ' + result.startLine + '-' + result.endLine + ', ' + result.lineCount + ' lines)');
}

// =====================================================================
// STEP 4: Verify syntax + write
// =====================================================================
fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);

try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ admin/index.js syntax OK');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! admin/index.js syntax error - REVERTED');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}

try {
  execSync('node -c "admin/quoteBuilder.js"', { stdio: 'pipe' });
  console.log('+ admin/quoteBuilder.js syntax OK');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! quoteBuilder.js syntax error - REVERTED admin/index.js');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}

console.log('');
console.log('SUCCESS');
console.log('Now: git add -A && git commit -m "Sourcing rewire complete" && git push');
