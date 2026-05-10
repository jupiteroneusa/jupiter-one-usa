// patch-rewire-6-rfq-detail-buttons.cjs
// Replaces the OLD inline quote form on RFQ detail page with clean buttons.
// Old: "Create & Send Quote" expandable form with inline cost/price inputs (no sourcing)
// New: Two buttons - "Sourcing" (record supplier responses) and "Build Quote" (new builder)

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/index.js';
const BACKUP = 'admin/index.js.rewire6.bak';

console.log('Rewire 6: Replace old RFQ detail inline form with clean buttons');
console.log('================================================================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

// Idempotency
if (src.includes('[Rewire 6]')) {
  console.log('- Already patched.');
  process.exit(0);
}

// =====================================================================
// Find the OLD form block. Anchor: the unique header line "Create & Send Quote"
// We need to find the WRAPPING <div class="card"> that opens just before it,
// and the matching </div> that closes the card.
//
// Looking at the recon, the structure is:
//   <div class="card">                            <-- start of block to remove
//     <div class="card-header">
//       Create & Send Quote
//       <button ... onclick="var f=...">+ New Quote</button>...
//     </div>
//     <div id="quote-form" style="display:none;padding:18px;">
//       <form method="POST" action="/admin/rfqs/${rfq.id}/quote-review">
//         ...
//       </form>
//     </div>
//   </div>                                        <-- end of block
//
// We'll anchor on the unique markers and slice it out.
// =====================================================================

const headerText = 'Create & Send Quote';
const headerIdx = src.indexOf(headerText);
if (headerIdx === -1) {
  console.error('! Cannot find "Create & Send Quote" header');
  process.exit(1);
}

// Walk backward from headerText to find the wrapping '<div class="card">'
const cardOpen = '<div class="card">';
let blockStart = src.lastIndexOf(cardOpen, headerIdx);
if (blockStart === -1) {
  console.error('! Cannot find opening <div class="card"> before header');
  process.exit(1);
}

// The block ends with the matching </div> for that opening card.
// Forward from blockStart, balance <div...> and </div>.
let depth = 0;
let i = blockStart;
let blockEnd = -1;

while (i < src.length) {
  // Find next <div... or </div>
  const openIdx = src.indexOf('<div', i);
  const closeIdx = src.indexOf('</div>', i);
  
  if (closeIdx === -1) break;
  
  if (openIdx !== -1 && openIdx < closeIdx) {
    depth++;
    i = openIdx + 4;
  } else {
    depth--;
    if (depth === 0) {
      blockEnd = closeIdx + '</div>'.length;
      break;
    }
    i = closeIdx + 6;
  }
}

if (blockEnd === -1) {
  console.error('! Cannot find matching </div> for the card');
  process.exit(1);
}

const blockLen = blockEnd - blockStart;
console.log('+ Found old form block: ' + blockLen + ' chars (lines approximately ' +
  (src.substring(0, blockStart).match(/\n/g) || []).length + '-' +
  (src.substring(0, blockEnd).match(/\n/g) || []).length + ')');

// =====================================================================
// Build the replacement - two clean buttons, no inline form
// =====================================================================
const replacement = '<div class="card"><!-- [Rewire 6] -->\n' +
'          <div class="card-header">Sourcing &amp; Quoting</div>\n' +
'          <div class="card-body" style="padding:18px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">\n' +
'            <a href="/admin/rfqs/${rfq.id}/sourcing" class="btn btn-outline" style="padding:10px 18px;">\\u{1F50D} Source Suppliers</a>\n' +
'            <a href="/admin/rfqs/${rfq.id}/quote-review" class="btn btn-gold" style="padding:10px 22px;">Build Quote &rarr;</a>\n' +
'            ${existingDraft ? `<a href="/admin/rfqs/${rfq.id}/quote-review-draft" class="btn btn-outline" style="border-color:#4caf50;color:#4caf50;padding:10px 18px;">Resume Draft</a>` : \'\'}\n' +
'            <div style="flex:1;min-width:200px;font-size:.75rem;color:#7a8a9a;text-align:right;">Record supplier responses on the Sourcing page first, then build the quote with internal cost/source data.</div>\n' +
'          </div>\n' +
'        </div>';

src = src.substring(0, blockStart) + replacement + src.substring(blockEnd);

// =====================================================================
// Write + verify
// =====================================================================
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

console.log('');
console.log('SUCCESS');
console.log('Now: git add -A && git commit -m "Rewire 6: ..." && git push');
