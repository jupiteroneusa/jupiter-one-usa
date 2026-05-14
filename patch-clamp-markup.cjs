// patch-clamp-markup.cjs
// Fix: decimal(5,2) max is 999.99. When unit_cost is tiny and unit_price big,
// markup% can be 5000+ and overflow. Clamp at the call sites that don't already.

const fs = require('fs');
const { execSync } = require('child_process');

function compile(file) {
  try { execSync('node -c "' + file + '"', { stdio: 'pipe' }); return true; }
  catch (err) { return err.stderr ? err.stderr.toString() : err.message; }
}

function clampHelper(v) {
  // Clamp to decimal(5,2) range
  return 'Math.min(999.99, Math.max(-999.99, ' + v + '))';
}

let touched = 0;

// ============ admin/quoteBuilder.js line 468 ============
{
  const f = 'admin/quoteBuilder.js';
  const orig = fs.readFileSync(f, 'utf8');
  let s = orig;
  if (s.includes('MARKUP_CLAMP_V1')) {
    console.log('- quoteBuilder.js already clamped');
  } else {
    const oldExpr = `const markupPct = avgUnitCost > 0 ? ((unitPrice - avgUnitCost) / avgUnitCost * 100) : 0;`;
    const newExpr = `// MARKUP_CLAMP_V1: clamp to decimal(5,2) range to avoid DB overflow
        const _rawMarkup = avgUnitCost > 0 ? ((unitPrice - avgUnitCost) / avgUnitCost * 100) : 0;
        const markupPct = Math.min(999.99, Math.max(-999.99, Number.isFinite(_rawMarkup) ? _rawMarkup : 0));`;

    if (!s.includes(oldExpr)) {
      console.error('! quoteBuilder.js markup anchor not found');
      process.exit(1);
    }
    s = s.replace(oldExpr, newExpr);
    fs.writeFileSync(f + '.mclamp.bak', orig);
    fs.writeFileSync(f, s);
    const r = compile(f);
    if (r !== true) { fs.writeFileSync(f, orig); console.error('! syntax: ' + r); process.exit(1); }
    console.log('+ quoteBuilder.js clamped to [-999.99, 999.99]');
    touched++;
  }
}

// ============ routes/quotes.js line 43 ============
{
  const f = 'routes/quotes.js';
  const orig = fs.readFileSync(f, 'utf8');
  let s = orig;
  if (s.includes('MARKUP_CLAMP_V1')) {
    console.log('- quotes.js already clamped');
  } else {
    const oldExpr = `const markupPct  = unitCost > 0 ? ((unitPrice - unitCost) / unitCost) * 100 : 0;`;
    const newExpr = `// MARKUP_CLAMP_V1: clamp to decimal(5,2) range to avoid DB overflow
    const _rawMarkup = unitCost > 0 ? ((unitPrice - unitCost) / unitCost) * 100 : 0;
    const markupPct = Math.min(999.99, Math.max(-999.99, Number.isFinite(_rawMarkup) ? _rawMarkup : 0));`;

    if (!s.includes(oldExpr)) {
      console.log('- quotes.js anchor not found (skipping)');
    } else {
      s = s.replace(oldExpr, newExpr);
      fs.writeFileSync(f + '.mclamp.bak', orig);
      fs.writeFileSync(f, s);
      const r = compile(f);
      if (r !== true) { fs.writeFileSync(f, orig); console.error('! syntax: ' + r); process.exit(1); }
      console.log('+ quotes.js clamped to [-999.99, 999.99]');
      touched++;
    }
  }
}

if (touched === 0) console.log('Nothing changed.');
console.log('SUCCESS');
