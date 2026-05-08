// patch-rewire-1-mount-quote-builder.cjs
// Wires in the new admin/quoteBuilder.js module.
// 
// What it does:
//   1. Adds: import { mountQuoteBuilder } from './quoteBuilder.js';
//   2. Adds: mountQuoteBuilder(router, requireAuth, page);  next to other mounts
//   3. Removes the 3 OLD inline handlers:
//      - GET  /rfqs/:id/quote-review
//      - POST /rfqs/:id/quote-review
//      - POST /rfqs/:id/quote
//
// The new module replaces all 3 routes. Old handlers must be removed to avoid
// route collision.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/index.js';
const BACKUP = 'admin/index.js.rewire1.bak';

console.log('Rewire 1: Mount quoteBuilder + remove old handlers');
console.log('==================================================');

if (!fs.existsSync('admin/quoteBuilder.js')) {
  console.error('! Missing admin/quoteBuilder.js (move it to admin/ first)');
  process.exit(1);
}

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('mountQuoteBuilder')) {
  console.log('- Already patched.');
  process.exit(0);
}

// ============================================================================
// PATCH A: Add import statement
// ============================================================================
const importAnchor = "import { mountSupplierPoRoutes } from './supplierPoRoutes.js';";
if (!src.includes(importAnchor)) {
  console.error('! Could not find mountSupplierPoRoutes import anchor');
  process.exit(1);
}
src = src.replace(importAnchor, function() {
  return importAnchor + "\nimport { mountQuoteBuilder } from './quoteBuilder.js';";
});
console.log('+ Import added');

// ============================================================================
// PATCH B: Add mount call
// ============================================================================
const mountAnchor = "mountSupplierPoRoutes(router, requireAuth, page);";
if (!src.includes(mountAnchor)) {
  console.error('! Could not find mountSupplierPoRoutes mount anchor');
  process.exit(1);
}
src = src.replace(mountAnchor, function() {
  return mountAnchor + "\n  mountQuoteBuilder(router, requireAuth, page);";
});
console.log('+ Mount call added');

// ============================================================================
// PATCH C: Remove the OLD inline handlers
// We do this by finding each handler's start and end, and slicing them out.
// Strategy: find "router.get('/rfqs/:id/quote-review'" and slice from there
// until the matching closing "});" at the right depth.
// 
// Simpler alternative: just comment them out with a clear marker.
// We'll use the "comment out" approach for safety.
// ============================================================================

// Find each handler's start position
const handlerSignatures = [
  "router.get('/rfqs/:id/quote-review', async (req, res) => {",
  "router.post('/rfqs/:id/quote-review', async (req, res) => {",
  "router.post('/rfqs/:id/quote', async (req, res) => {",
];

// We need to find the END of each handler. Each handler ends with "});" at the
// outermost level matching its "router.METHOD(..., async (req, res) => {".
// The pattern that reliably ends each handler is:
//   "      res.send(page(...));\n    } catch(err) {\n      res.send(page(...));\n    }\n  });"
// or similar. Looking at the file, each handler ends with:
//   "  });" at column 2 (2 spaces indent)
//
// Approach: find handler start, then scan forward for the next line that is
// exactly "  });" (closing of the route function) - that's the end.

function findHandlerEnd(src, startIdx) {
  // The handler we're slicing is wrapped: "  router.METHOD('/path', async (req, res) => {\n  ...\n  });"
  // So we need the closing "  });" at indent level 2.
  // We track brace depth to find the closing "});" of the (req, res) => { ... } arrow function.
  // Skip the opening "{" of the arrow function (already passed it from the signature).
  let depth = 1;  // we start AFTER the "=> {" opening brace
  let i = startIdx;
  let inString = null;  // track ' " ` strings
  let inTemplate = 0;   // depth of ${ } inside templates
  let inLineComment = false;
  let inBlockComment = false;
  let prev = '';

  while (i < src.length) {
    const ch = src[i];
    const next = src[i+1] || '';

    // Comment handling
    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      i++; prev = ch; continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') { inBlockComment = false; i += 2; prev = '/'; continue; }
      i++; prev = ch; continue;
    }
    if (!inString && ch === '/' && next === '/') { inLineComment = true; i += 2; continue; }
    if (!inString && ch === '/' && next === '*') { inBlockComment = true; i += 2; continue; }

    // String handling
    if (inString) {
      if (ch === '\\') { i += 2; prev = ''; continue; }
      if (ch === inString) {
        if (inString === '`' && inTemplate > 0) {
          // shouldn't happen - template close handled below
        }
        inString = null;
      }
      // Template literal ${ }
      if (inString === '`' && ch === '$' && next === '{') {
        inTemplate++;
        i += 2;
        prev = '{';
        depth++;  // counts as a brace open
        continue;
      }
      i++; prev = ch; continue;
    } else {
      if (ch === "'" || ch === '"' || ch === '`') {
        inString = ch;
        i++; prev = ch; continue;
      }
    }

    if (ch === '{') { depth++; }
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        // We just closed the arrow function body. Now we need ");"
        // skip whitespace
        let j = i + 1;
        while (j < src.length && /\s/.test(src[j])) j++;
        if (src[j] === ')') {
          j++;
          while (j < src.length && /\s/.test(src[j])) j++;
          if (src[j] === ';') return j + 1;  // end of "});"
        }
        return i + 1; // fallback
      }
    }
    i++; prev = ch;
  }
  return -1;
}

// Slice out each handler (replace with a comment marker)
let totalRemoved = 0;
for (const sig of handlerSignatures) {
  const startIdx = src.indexOf(sig);
  if (startIdx === -1) {
    console.error('! Could not find handler: ' + sig);
    console.error('  File may already be partially patched. Aborting to avoid corruption.');
    process.exit(1);
  }
  // Find the opening brace of the arrow function body
  const openBraceIdx = src.indexOf('{', startIdx + sig.length - 1);
  // findHandlerEnd looks for closing "});" starting after openBrace
  const endIdx = findHandlerEnd(src, openBraceIdx + 1);
  if (endIdx === -1) {
    console.error('! Could not find end of handler: ' + sig);
    process.exit(1);
  }

  const handlerLen = endIdx - startIdx;
  const replacement = '/* MOVED to admin/quoteBuilder.js: ' + sig.split(',')[0].replace("router.", "") + ' */';
  src = src.substring(0, startIdx) + replacement + src.substring(endIdx);
  totalRemoved++;
  console.log('+ Removed: ' + sig.split(',')[0].replace("router.", "") + ' (' + handlerLen + ' chars)');
}

console.log('+ Removed ' + totalRemoved + ' old handlers');

// ============================================================================
// Write + verify
// ============================================================================
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
  console.error('! admin/quoteBuilder.js syntax error - REVERTED admin/index.js');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}

console.log('');
console.log('SUCCESS - safe to commit and push.');
console.log('');
console.log('After deploy + Ctrl+F5:');
console.log('  - Open any RFQ -> click Requote/New Quote');
console.log('  - You should see new quote builder with supplier dropdowns + cost inputs per line');
console.log('  - Each line has a "+ Split: Add Another Supplier" button');
console.log('  - Live margin calculation per line as you type');
console.log('  - Validation: SUM(supplier qtys) must equal line qty before submit');
