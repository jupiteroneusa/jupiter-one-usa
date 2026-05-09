// patch-rewire-FINAL.cjs
// Atomic fix: do everything patchers 1+1b were supposed to do.
// 1. Add import for quoteBuilder
// 2. Add mountQuoteBuilder() call
// 3. Remove 3 old handlers (GET/POST quote-review + POST quote)
// 4. Verify syntax, revert on any failure

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/index.js';
const BACKUP = 'admin/index.js.rewireFINAL.bak';

console.log('Rewire FINAL: complete the quote builder mount');
console.log('==============================================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

// Pre-flight: verify quoteBuilder exists
if (!fs.existsSync('admin/quoteBuilder.js')) {
  console.error('! admin/quoteBuilder.js missing - aborting');
  process.exit(1);
}

// Idempotency check
if (src.includes('mountQuoteBuilder')) {
  console.log('- Already patched (mountQuoteBuilder already present).');
  process.exit(0);
}

// =====================================================================
// STEP 1: Add import
// =====================================================================
const importAnchor = "import { mountSupplierPoRoutes } from './supplierPoRoutes.js';";
if (!src.includes(importAnchor)) {
  console.error('! Missing import anchor: ' + importAnchor);
  process.exit(1);
}
src = src.replace(importAnchor, function() {
  return importAnchor + "\nimport { mountQuoteBuilder } from './quoteBuilder.js';";
});
console.log('+ Import added');

// =====================================================================
// STEP 2: Add mount call
// =====================================================================
const mountAnchor = "mountSupplierPoRoutes(router, requireAuth, page);";
if (!src.includes(mountAnchor)) {
  console.error('! Missing mount anchor: ' + mountAnchor);
  process.exit(1);
}
src = src.replace(mountAnchor, function() {
  return mountAnchor + "\n  mountQuoteBuilder(router, requireAuth, page);";
});
console.log('+ Mount call added');

// =====================================================================
// STEP 3: Remove 3 old handlers using line-anchor approach
// 
// Strategy: instead of brace-counting (which got us into trouble), use the
// fact that each route handler in this file ENDS with the line "  });"
// at exactly indent level 2 (2 spaces).  We find the start signature and
// then scan forward for the next "\n  });\n" (or end of next handler 
// definition / function definition / file end).
// =====================================================================

const handlersToRemove = [
  "  router.get('/rfqs/:id/quote-review', async (req, res) => {",
  "  router.post('/rfqs/:id/quote-review', async (req, res) => {",
  "    router.post('/rfqs/:id/quote', async (req, res) => {",  // note: 4-space indent on this one per recon
];

function removeHandler(src, sig) {
  const startIdx = src.indexOf(sig);
  if (startIdx === -1) {
    return { src: src, removed: false, reason: 'signature not found' };
  }
  
  // Find handler end by brace counting with proper string/template handling
  const openBraceIdx = src.indexOf('{', startIdx + sig.length - 1);
  let depth = 1;
  let i = openBraceIdx + 1;
  let inString = null;
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;
  let templateDepthStack = [];

  while (i < src.length && depth > 0) {
    const ch = src[i];
    const next = src[i + 1] || '';

    if (escaped) { escaped = false; i++; continue; }

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      i++; continue;
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') { inBlockComment = false; i += 2; continue; }
      i++; continue;
    }

    if (inString) {
      if (ch === '\\') { escaped = true; i++; continue; }
      if (inString === '`' && ch === '$' && next === '{') {
        templateDepthStack.push(depth);
        depth++;
        i += 2;
        continue;
      }
      if (ch === inString) {
        inString = null;
      }
      i++;
      continue;
    } else {
      if (ch === '/' && next === '/') { inLineComment = true; i += 2; continue; }
      if (ch === '/' && next === '*') { inBlockComment = true; i += 2; continue; }
      if (ch === "'" || ch === '"' || ch === '`') {
        inString = ch;
        i++;
        continue;
      }
    }

    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (templateDepthStack.length > 0 && templateDepthStack[templateDepthStack.length - 1] === depth) {
        templateDepthStack.pop();
        inString = '`';
        i++;
        continue;
      }
      if (depth === 0) {
        // We just closed the arrow function body. Look for ");"
        let j = i + 1;
        while (j < src.length && /\s/.test(src[j])) j++;
        if (src[j] === ')') {
          j++;
          while (j < src.length && /\s/.test(src[j])) j++;
          if (src[j] === ';') {
            const endIdx = j + 1;
            const replacement = '/* MOVED to admin/quoteBuilder.js */';
            const newSrc = src.substring(0, startIdx) + replacement + src.substring(endIdx);
            return { src: newSrc, removed: true, len: endIdx - startIdx };
          }
        }
        return { src: src, removed: false, reason: 'closing }) not found' };
      }
    }
    i++;
  }
  return { src: src, removed: false, reason: 'walked off end (depth=' + depth + ')' };
}

for (const sig of handlersToRemove) {
  const result = removeHandler(src, sig);
  if (!result.removed) {
    console.error('! Failed to remove: ' + sig.trim());
    console.error('  Reason: ' + result.reason);
    process.exit(1);
  }
  src = result.src;
  console.log('+ Removed: ' + sig.trim().substring(0, 50) + '... (' + result.len + ' chars)');
}

// =====================================================================
// STEP 4: Write + verify syntax
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
  console.error('! admin/quoteBuilder.js syntax error - REVERTED admin/index.js');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}

console.log('');
console.log('SUCCESS - all 3 handlers removed, mount + import added.');
console.log('Now: git add -A && git commit -m "..." && git push');
