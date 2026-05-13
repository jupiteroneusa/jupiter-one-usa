// patch-fix-address.cjs
// Update the Tampa addresses to Palm Bay, FL in poPdfService.js
// Adds clear EDIT-ME markers so future address changes are trivial to find.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'services/poPdfService.js';
const BACKUP = TARGET + '.address.bak';

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('1101 Porter Ave')) {
  console.log('- already updated');
  process.exit(0);
}

// --- Header address (top-left of PDF) ---
const oldHeader1 = `doc.text('400 N Tampa St, Suite 1550', margin, y);
  y += 4;
  doc.text('Tampa, FL 33602', margin, y);`;

const newHeader1 = `// EDIT-ME: Company header address — appears top-left of every PO PDF
  doc.text('1101 Porter Ave NW', margin, y);
  y += 4;
  doc.text('Palm Bay, FL 32907', margin, y);`;

if (!src.includes(oldHeader1)) {
  console.error('! header address anchor not found');
  process.exit(1);
}
src = src.replace(oldHeader1, function(){ return newHeader1; });

// --- Ship-to address (right side of supplier/ship-to row) ---
const oldShipLines = `  const shipLines = [
    '400 N Tampa St, Suite 1550',
    'Tampa, FL 33602',
    'USA',
    'Attn: Receiving / Derek Torchia'
  ];`;

const newShipLines = `  // EDIT-ME: Ship-to address — where suppliers should ship parts
  const shipLines = [
    '1101 Porter Ave NW',
    'Palm Bay, FL 32907',
    'USA',
    'Attn: Receiving / Derek Torchia'
  ];`;

if (!src.includes(oldShipLines)) {
  console.error('! ship-to anchor not found');
  process.exit(1);
}
src = src.replace(oldShipLines, function(){ return newShipLines; });

fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);

try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ Header address: 1101 Porter Ave NW, Palm Bay, FL 32907');
  console.log('+ Ship-to address: 1101 Porter Ave NW, Palm Bay, FL 32907');
  console.log('+ EDIT-ME comments added for easy future updates');
  console.log('+ To edit: open services/poPdfService.js and search for "EDIT-ME"');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! syntax error — REVERTED');
  console.error(err.message);
  process.exit(1);
}
