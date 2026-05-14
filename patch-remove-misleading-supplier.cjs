// patch-remove-misleading-supplier.cjs
// Order line edit form: REMOVE the single Supplier dropdown / Supplier Cost / Supplier Lead trio.
// These misled the user because actual sourcing is multi-supplier per line, shown in the
// "INTERNAL SOURCES" sub-row right below.
// Keep: NSN, Part Number, Item Name, Quantity, Unit Price (typo fixes that cascade to invoice).
// Keep: Lot Number, Country of Origin, Received Date, Serial Numbers, Compliance checkboxes.

const fs = require('fs');
const { execSync } = require('child_process');

const f = 'admin/orderLinesBlock.js';
const orig = fs.readFileSync(f, 'utf8');
let s = orig;

if (s.includes('REMOVE_MISLEADING_SUPPLIER_V1')) {
  console.log('- already patched');
  process.exit(0);
}

// The block to remove is the 3-column grid starting at "<div style=\"display:grid;grid-template-columns:2fr 1fr 1fr"
// and the supplier dropdown lines, ending before "// Lot/serial/COO" comment.

// Find the start: opening grid div with 2fr 1fr 1fr
const startMarker = "html += '<div style=\"display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px;margin-bottom:10px;\">';";
// Find the end: the corresponding closing line + the comment that follows
const endMarker = "html += '</div>';\r\n\r\n      // Lot/serial/COO";

const sIdx = s.indexOf(startMarker);
if (sIdx < 0) {
  console.error('! start anchor not found - trying LF variant');
  const lfStart = startMarker;
  const lfIdx = s.indexOf(lfStart);
  if (lfIdx < 0) {
    console.error('! still not found. dumping for inspection.');
    process.exit(1);
  }
}

// Try CRLF version first, then LF
let foundStart = sIdx;
let foundEnd = -1;

// Try CRLF end
foundEnd = s.indexOf(endMarker, foundStart);
if (foundEnd < 0) {
  // Try LF
  const lfEndMarker = "html += '</div>';\n\n      // Lot/serial/COO";
  foundEnd = s.indexOf(lfEndMarker, foundStart);
  if (foundEnd < 0) {
    // Try just looking for "// Lot/serial/COO" right after closing div
    const lotCommentIdx = s.indexOf("// Lot/serial/COO", foundStart);
    if (lotCommentIdx < 0) {
      console.error('! could not find end marker (// Lot/serial/COO)');
      process.exit(1);
    }
    // Walk back to find the closing "html += '</div>';"
    const divClose = s.lastIndexOf("html += '</div>';", lotCommentIdx);
    if (divClose < 0) {
      console.error('! could not find div close before // Lot/serial/COO');
      process.exit(1);
    }
    // foundEnd should end at the line just before // Lot/serial/COO comment
    foundEnd = divClose + "html += '</div>';".length;
  } else {
    // LF variant matched - include length of LF endMarker but END at just the </div>';
    foundEnd = foundEnd + "html += '</div>';".length;
  }
} else {
  foundEnd = foundEnd + "html += '</div>';".length;
}

// Replace the block with a small explanation comment
const replacement = "// REMOVE_MISLEADING_SUPPLIER_V1: per-line single supplier field removed. Sources shown in INTERNAL SOURCES sub-row below.";

s = s.slice(0, foundStart) + replacement + s.slice(foundEnd);

fs.writeFileSync(f + '.rms.bak', orig);
fs.writeFileSync(f, s);

try {
  execSync('node -c "' + f + '"', { stdio: 'pipe' });
  console.log('+ Removed misleading per-line Supplier dropdown trio');
  console.log('+ INTERNAL SOURCES sub-row remains as the source of truth');
  console.log('+ Line basics (NSN/PN/item/qty/price) still editable');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(f, orig);
  console.error('! syntax error - REVERTED');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
