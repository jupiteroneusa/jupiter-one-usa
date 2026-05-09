// patch-rewire-FINAL-v3.cjs
// The 3rd handler at line 1430 starts at 4-space indent but closes at 2-space
// indent. Previous patchers required matching indent. This one accepts the 
// "  });" closer regardless of opener indent.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/index.js';
const BACKUP = 'admin/index.js.rewireFinalV3.bak';

console.log('Rewire FINAL v3: flexible-indent close matching');
console.log('===============================================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (!fs.existsSync('admin/quoteBuilder.js')) {
  console.error('! admin/quoteBuilder.js missing'); process.exit(1);
}

// State check
const importLine = "import { mountQuoteBuilder } from './quoteBuilder.js';";
const mountLine = "mountQuoteBuilder(router, requireAuth, page);";
const importDone = src.includes(importLine);
const mountDone = src.includes(mountLine);

console.log('import: ' + (importDone ? 'present' : 'MISSING'));
console.log('mount:  ' + (mountDone ? 'present' : 'MISSING'));

// Add import if missing
if (!importDone) {
  const importAnchor = "import { mountSupplierPoRoutes } from './supplierPoRoutes.js';";
  if (!src.includes(importAnchor)) { console.error('! import anchor missing'); process.exit(1); }
  src = src.replace(importAnchor, function(){ return importAnchor + "\n" + importLine; });
  console.log('+ Import added');
}

// Add mount if missing
if (!mountDone) {
  const mountAnchor = "mountSupplierPoRoutes(router, requireAuth, page);";
  if (!src.includes(mountAnchor)) { console.error('! mount anchor missing'); process.exit(1); }
  src = src.replace(mountAnchor, function(){ return mountAnchor + "\n  " + mountLine; });
  console.log('+ Mount added');
}

// Removal: find the next router.METHOD (any of them) at 2-space-or-less indent
// to mark where THIS handler ends, then back up to find the closing }); right
// before that next handler.

function removeHandler(src, sigText) {
  const lines = src.split('\n');
  
  // Find start
  let startLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(sigText)) {
      startLine = i;
      break;
    }
  }
  if (startLine === -1) return { removed: false, reason: 'not found' };
  
  // Walk forward for end of handler. The handler ends at the LAST });
  // line before the next "router." line OR before "// comment" then "router."
  // OR before end of file.
  
  let endLine = -1;
  
  // Find next ROUTER signature line (any router.METHOD) starting at indent <= 4
  let nextRouterLine = -1;
  for (let i = startLine + 1; i < lines.length; i++) {
    const ln = lines[i];
    const trimmed = ln.trimStart();
    if (trimmed.startsWith('router.') && trimmed.match(/^router\.(get|post|put|patch|delete)\s*\(/)) {
      // Make sure indent is <= 4 (top-level route definition)
      const indent = ln.length - trimmed.length;
      if (indent <= 4) {
        nextRouterLine = i;
        break;
      }
    }
  }
  
  // Backtrack from nextRouterLine (or end of file) to find the LAST "});" 
  // line at indent <= 4 (the closing of our handler)
  const searchEnd = nextRouterLine !== -1 ? nextRouterLine : lines.length;
  
  for (let i = searchEnd - 1; i > startLine; i--) {
    const ln = lines[i];
    const trimmed = ln.trim();
    if (trimmed === '});' || trimmed === '})') {
      const indent = ln.length - ln.trimStart().length;
      if (indent <= 4) {
        endLine = i;
        break;
      }
    }
  }
  
  if (endLine === -1) {
    return { removed: false, reason: 'no closing }); found before line ' + (searchEnd + 1) };
  }
  
  // Determine the indent of the start line for the comment marker
  const startIndentMatch = lines[startLine].match(/^(\s*)/);
  const startIndent = startIndentMatch ? startIndentMatch[1] : '';
  
  const replacement = startIndent + '/* MOVED to admin/quoteBuilder.js: ' + sigText.substring(0, 40) + ' */';
  const newLines = lines.slice(0, startLine).concat([replacement]).concat(lines.slice(endLine + 1));
  
  return {
    removed: true,
    src: newLines.join('\n'),
    startLine: startLine + 1,
    endLine: endLine + 1,
    lineCount: endLine - startLine + 1,
  };
}

const handlers = [
  "router.get('/rfqs/:id/quote-review',",
  "router.post('/rfqs/:id/quote-review',",
  "router.post('/rfqs/:id/quote',",
];

for (const sig of handlers) {
  if (!src.includes(sig)) {
    console.log('- Already removed: ' + sig);
    continue;
  }
  const r = removeHandler(src, sig);
  if (!r.removed) {
    console.error('! Failed to remove ' + sig);
    console.error('  Reason: ' + r.reason);
    process.exit(1);
  }
  src = r.src;
  console.log('+ Removed ' + sig + ' (lines ' + r.startLine + '-' + r.endLine + ', ' + r.lineCount + ' lines)');
}

// Write + verify
fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);

try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ admin/index.js syntax OK');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! syntax error - REVERTED');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}

try {
  execSync('node -c "admin/quoteBuilder.js"', { stdio: 'pipe' });
  console.log('+ admin/quoteBuilder.js syntax OK');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! quoteBuilder.js syntax error - REVERTED');
  process.exit(1);
}

console.log('');
console.log('SUCCESS');
