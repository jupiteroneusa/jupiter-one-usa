// patch-rewire-1b-finish-handler-removal.cjs
// Patcher 1 succeeded on 2 of 3 handler removals but failed on:
//   router.post('/rfqs/:id/quote', async (req, res) => { ... });
//
// This finishes the job using a different scanning strategy.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/index.js';
const BACKUP = 'admin/index.js.rewire1b.bak';

console.log('Rewire 1b: Finish handler removal');
console.log('=================================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

// Check if the leftover route is actually still there
const sig = "router.post('/rfqs/:id/quote', async (req, res) => {";
if (!src.includes(sig)) {
  console.log('- Leftover route already gone. Nothing to do.');
  process.exit(0);
}

// Find it
const startIdx = src.indexOf(sig);

// We need to find the END. The old handler in admin/index.js (line 1430+) ends
// the same way as the others - typically: "    }\n  });" near column 2.
// Walk forward, brace-balanced, with proper string/template/regex handling.

const openBraceIdx = src.indexOf('{', startIdx + sig.length - 1);
let depth = 1;
let i = openBraceIdx + 1;
let inString = null;
let escaped = false;
let inLineComment = false;
let inBlockComment = false;
let templateBraceStack = [];  // track ${} inside templates

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
      templateBraceStack.push(depth);
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
    // If we just closed a ${} inside a template, restore template string mode
    if (templateBraceStack.length > 0 && templateBraceStack[templateBraceStack.length - 1] === depth) {
      templateBraceStack.pop();
      inString = '`';
    }
    if (depth === 0) {
      // We just closed the arrow function body. Look for ");"
      let j = i + 1;
      while (j < src.length && /\s/.test(src[j])) j++;
      if (src[j] === ')') {
        j++;
        while (j < src.length && /\s/.test(src[j])) j++;
        if (src[j] === ';') {
          // Found end of "});"
          const endIdx = j + 1;
          const handlerLen = endIdx - startIdx;
          console.log('+ Found handler end. Length: ' + handlerLen + ' chars');
          
          const replacement = "/* MOVED to admin/quoteBuilder.js: post('/rfqs/:id/quote' */";
          src = src.substring(0, startIdx) + replacement + src.substring(endIdx);
          
          fs.writeFileSync(BACKUP, original);
          fs.writeFileSync(TARGET, src);
          
          try {
            execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
            console.log('+ Patched + syntax OK');
            console.log('SUCCESS');
            process.exit(0);
          } catch (err) {
            fs.writeFileSync(TARGET, original);
            console.error('! Syntax error after removal - REVERTED');
            console.error(err.stderr ? err.stderr.toString() : err.message);
            process.exit(1);
          }
        }
      }
      console.error('! Found closing brace at depth 0 but no "});" follows');
      process.exit(1);
    }
  }
  i++;
}

console.error('! Walked end of file without finding handler close (depth=' + depth + ')');
process.exit(1);
