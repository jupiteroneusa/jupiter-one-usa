// find-lead-time.cjs
// Locates every place lead time is read or written in the codebase

const fs = require('fs');
const path = require('path');

const targets = [
  'supplier_lead_time_days',
  'expected_lead_time_days',
  'lead_time_days',
  'lead_time_text',
  'leadTimeDays',
  'lead_time'
];

function walk(dir, found) {
  try {
    const items = fs.readdirSync(dir);
    for (const it of items) {
      if (it === 'node_modules' || it === '.git' || it.startsWith('.') || it.includes('.bak')) continue;
      const full = path.join(dir, it);
      let stat;
      try { stat = fs.statSync(full); } catch { continue; }
      if (stat.isDirectory()) walk(full, found);
      else if (/\.(js|cjs|mjs)$/.test(it)) {
        const src = fs.readFileSync(full, 'utf8');
        const lines = src.split('\n');
        lines.forEach(function(line, idx) {
          for (const t of targets) {
            if (line.includes(t)) {
              found.push({ file: full, line: idx + 1, snippet: line.trim().substring(0, 140), term: t });
              break;
            }
          }
        });
      }
    }
  } catch (err) { /* skip */ }
}

const found = [];
walk('.', found);

// Group by file
const byFile = {};
found.forEach(function(f) {
  if (!byFile[f.file]) byFile[f.file] = [];
  byFile[f.file].push(f);
});

console.log('========== Lead-time references ==========\n');
const files = Object.keys(byFile).sort();
files.forEach(function(f) {
  // Skip patch files and backup-ish
  if (f.includes('patch-') || f.includes('.bak') || f.includes('check-')) return;
  console.log('### ' + f);
  byFile[f].forEach(function(item) {
    console.log('  L' + item.line + ' [' + item.term + ']: ' + item.snippet);
  });
  console.log('');
});

// Also flag patcher refs separately
const patcherRefs = files.filter(function(f) { return f.includes('patch-') || f.includes('check-'); });
if (patcherRefs.length) {
  console.log('\n(Skipped ' + patcherRefs.length + ' patcher/check scripts)');
}
