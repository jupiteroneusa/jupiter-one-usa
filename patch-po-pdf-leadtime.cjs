// patch-po-pdf-leadtime.cjs
// Add lead time display under item name in PO PDF.
// Previous patch missed the anchor due to escape mismatch.

const fs = require('fs');
const { execSync } = require('child_process');

const f = 'services/poPdfService.js';
const orig = fs.readFileSync(f, 'utf8');
let s = orig;

if (s.includes('LEAD_TIME_COL_V1')) {
  console.log('- already has lead time display');
  process.exit(0);
}

// Find the item_name render line by content match (more flexible than exact string)
const lines = s.split('\n');
let targetIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('item_name') && lines[i].includes('colX.desc') && lines[i].includes('doc.text')) {
    targetIdx = i;
    break;
  }
}

if (targetIdx < 0) {
  console.error('! could not find item_name doc.text line. Lines containing item_name:');
  lines.forEach((line, i) => {
    if (line.includes('item_name')) console.log('  L' + (i+1) + ': ' + line.trim().substring(0, 120));
  });
  process.exit(1);
}

console.log('Found anchor at line ' + (targetIdx + 1) + ':');
console.log('  ' + lines[targetIdx].trim());

// Insert lead time rendering AFTER the item_name line
const indent = lines[targetIdx].match(/^(\s*)/)[1];
const newLines = [
  indent + 'if (l.lead_time_text) {',
  indent + '  doc.setFontSize(7);',
  indent + '  doc.setTextColor(120, 120, 120);',
  indent + "  doc.text('Lead: ' + String(l.lead_time_text).substring(0, 30), colX.desc, y + 3);",
  indent + '  doc.setFontSize(8);',
  indent + '  doc.setTextColor(60, 60, 60);',
  indent + '}'
];

lines.splice(targetIdx + 1, 0, ...newLines);

// Also bump the row stride from 7 to 8 so lead text doesn't crash into next row
const updated = lines.join('\n');
let final = updated;

// Find the row increment "y += 7;" near "lines.forEach" body
// Be careful - there may be multiple "y += 7" usages. Find the one inside the forEach callback.
const forEachIdx = final.indexOf('lines.forEach(');
if (forEachIdx >= 0) {
  // Look for first "y += 7;" after forEach
  const yPlusIdx = final.indexOf('y += 7;', forEachIdx);
  if (yPlusIdx >= 0 && yPlusIdx < forEachIdx + 2000) {
    final = final.substring(0, yPlusIdx) + 'y += 8;' + final.substring(yPlusIdx + 'y += 7;'.length);
    console.log('Bumped row stride 7 -> 8');
  }
}

final = '// LEAD_TIME_COL_V1\n' + final;

fs.writeFileSync(f + '.ltpdf.bak', orig);
fs.writeFileSync(f, final);

try {
  execSync('node -c "' + f + '"', { stdio: 'pipe' });
  console.log('+ Lead time will render under item name on PO PDF (only when filled)');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(f, orig);
  console.error('! syntax error - REVERTED');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
