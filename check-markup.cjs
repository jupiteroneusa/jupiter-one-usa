// check-markup.cjs
const fs = require('fs');
const path = require('path');

function walk(dir, found) {
  try {
    const items = fs.readdirSync(dir);
    for (const it of items) {
      if (it === 'node_modules' || it === '.git' || it.startsWith('.') || it.includes('.bak')) continue;
      const full = path.join(dir, it);
      let stat;
      try { stat = fs.statSync(full); } catch { continue; }
      if (stat.isDirectory()) walk(full, found);
      else if (/\.js$/.test(it)) {
        const src = fs.readFileSync(full, 'utf8');
        const lines = src.split('\n');
        lines.forEach(function(line, i) {
          if (/['"]mkp['"]/.test(line) || /markup/i.test(line)) {
            found.push({ file: full, line: i + 1, snippet: line.trim().substring(0, 160) });
          }
        });
      }
    }
  } catch {}
}

const found = [];
walk('.', found);

const byFile = {};
found.forEach(function(f) {
  if (f.file.includes('patch-') || f.file.includes('.bak') || f.file.includes('check-') || f.file.includes('fix') || f.file.includes('add') || f.file.includes('step')) return;
  if (!byFile[f.file]) byFile[f.file] = [];
  byFile[f.file].push(f);
});

console.log('========== markup / mkp references ==========\n');
Object.keys(byFile).sort().forEach(function(f) {
  console.log('### ' + f);
  byFile[f].forEach(function(item) {
    console.log('  L' + item.line + ': ' + item.snippet);
  });
  console.log('');
});

console.log('\n========== SQL: quote_lines + quotes table column types for markup/margin ==========');
console.log(`
-- Run in SSMS to see the column definitions:
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, NUMERIC_PRECISION, NUMERIC_SCALE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE COLUMN_NAME LIKE '%markup%'
   OR COLUMN_NAME LIKE '%margin%'
   OR COLUMN_NAME LIKE '%mkp%';
`);
