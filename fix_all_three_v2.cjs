/**
 * fix_all_three_v2.cjs
 * Jupiter One USA — Admin Panel Fix Script (v2 — line-targeted)
 *
 * Fixes:
 *   1. Remove debug console.log lines 1307-1309
 *   2. Add "Close RFQ" quick button next to the status form (line ~900)
 *   3. Add version badge (v1, v2, DRAFT) next to quote number in history (line 825)
 *
 * Usage:
 *   move "%USERPROFILE%\Downloads\fix_all_three_v2.cjs" fix_all_three_v2.cjs && node fix_all_three_v2.cjs
 *
 * Then:
 *   git add -A && git commit -m "Remove debug logs, add Close RFQ button, show version badges in quote history" && git push
 */

const fs = require('fs');
const path = require('path');

const ADMIN_FILE = path.join(__dirname, 'admin', 'index.js');

console.log('='.repeat(60));
console.log('Jupiter One USA — Fix Script v2 (line-targeted)');
console.log('='.repeat(60));
console.log('Reading:', ADMIN_FILE);

let src = fs.readFileSync(ADMIN_FILE, 'utf8');
const original = src;
let changeCount = 0;

// ─────────────────────────────────────────────────────────────
// FIX 1: Remove debug console.log lines 1307-1309
// ─────────────────────────────────────────────────────────────
console.log('\n--- FIX 1: Remove DEBUG console.log lines ---');

const debug1 = "console.log('DEBUG body keys:', Object.keys(req.body));";
const debug2 = "console.log('DEBUG linesRaw:', JSON.stringify(linesRaw));";
const debug3 = "console.log('DEBUG linesArr length:', Object.values(linesRaw).length);";

let fix1ok = true;
for (const target of [debug1, debug2, debug3]) {
  if (src.includes(target)) {
    // Find the full line (from previous \n to next \n) and remove it
    const idx = src.indexOf(target);
    const lineStart = src.lastIndexOf('\n', idx - 1) + 1;
    let lineEnd = src.indexOf('\n', idx);
    if (lineEnd === -1) lineEnd = src.length;
    else lineEnd += 1;
    console.log('Removing:', JSON.stringify(src.slice(lineStart, lineEnd)));
    src = src.slice(0, lineStart) + src.slice(lineEnd);
  } else {
    console.warn('⚠️  Not found:', target);
    fix1ok = false;
  }
}

if (fix1ok) {
  console.log('✅ FIX 1: All 3 DEBUG log lines removed.');
  changeCount++;
} else {
  console.warn('⚠️  FIX 1: Some debug lines not found — check manually.');
}

// ─────────────────────────────────────────────────────────────
// FIX 2: Add Close RFQ quick-action button
// ─────────────────────────────────────────────────────────────
// The status form is at line ~900. It has a <select> with Closed already in it.
// We add a standalone "Close RFQ" button ABOVE the status form card as a
// quick one-click action — separate small form, only visible if not already Closed/Cancelled.
console.log('\n--- FIX 2: Add Close RFQ button ---');

// Anchor: the Update Status card header — unique enough
const statusCardAnchor = '<div class="card-header">Update Status</div>';

if (!src.includes(statusCardAnchor)) {
  console.warn('⚠️  FIX 2: Could not find "Update Status" card header — skipping.');
} else if (src.includes('Close RFQ</button>') || src.includes('Close RFQ<')) {
  console.log('ℹ️  FIX 2: Close RFQ button already exists — skipping.');
} else {
  // Insert a quick-close form just inside the card-body, after the status card header
  // We find the card-body opening div that follows the Update Status header
  const anchorIdx = src.indexOf(statusCardAnchor);
  const cardBodyIdx = src.indexOf('<div class="card-body">', anchorIdx);

  if (cardBodyIdx === -1) {
    console.warn('⚠️  FIX 2: Could not find card-body after Update Status — skipping.');
  } else {
    // Find end of that opening div tag
    const insertAfter = cardBodyIdx + '<div class="card-body">'.length;

    const closeBtn = `\r\n            <form method="POST" action="/admin/rfqs/\${rfq.id}/status" style="display:inline;margin-bottom:12px;" onsubmit="return confirm('Close this RFQ? It will be marked Closed.');">\r\n              <input type="hidden" name="status" value="Closed"/>\r\n              <input type="hidden" name="note" value="RFQ closed manually."/>\r\n              <button type="submit" class="btn btn-sm" style="background:#c0392b;color:#fff;border:none;margin-bottom:12px;">✕ Close RFQ</button>\r\n            </form>\r\n            <hr style="border-color:#2a3a4a;margin-bottom:12px;"/>`;

    src = src.slice(0, insertAfter) + closeBtn + src.slice(insertAfter);
    console.log('✅ FIX 2: Close RFQ button inserted inside Update Status card body.');
    changeCount++;
  }
}

// ─────────────────────────────────────────────────────────────
// FIX 3: Version badge in quote history (line 825)
// ─────────────────────────────────────────────────────────────
// Exact line from findstr output:
//   <td class="mono text-gold"><a href="/admin/quotes/${q.id}" style="color:#c8932a;">${q.quote_number}</a></td>
// We replace ${q.quote_number}</a> with the number + a version badge
console.log('\n--- FIX 3: Version badge in quote history ---');

// There are two occurrences of this pattern (line 825 and line 1635).
// We want BOTH — they're both quote history tables.
const quoteNumPattern = `\${q.quote_number}</a></td>`;
const versionBadge = `\${q.quote_number}</a> <span style="font-size:.68rem;background:#1e3a5f;color:#c8932a;border:1px solid #c8932a;padding:1px 7px;border-radius:10px;font-weight:700;margin-left:4px;vertical-align:middle;">\${(()=>{const m=(q.quote_number||'').match(/-v(\\d+)$/);return m?'v'+m[1]:(q.quote_number||'').endsWith('-D')?'DRAFT':''})()}</span></td>`;

if (!src.includes(quoteNumPattern)) {
  console.warn('⚠️  FIX 3: Could not find quote_number pattern — skipping.');
} else {
  // Replace all occurrences (both history tables)
  let count = 0;
  let searchFrom = 0;
  while (true) {
    const idx = src.indexOf(quoteNumPattern, searchFrom);
    if (idx === -1) break;
    src = src.slice(0, idx) + versionBadge + src.slice(idx + quoteNumPattern.length);
    searchFrom = idx + versionBadge.length;
    count++;
  }
  console.log(`✅ FIX 3: Version badge added in ${count} quote history table(s).`);
  changeCount++;
}

// ─────────────────────────────────────────────────────────────
// Write file
// ─────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(60));

if (src !== original) {
  fs.writeFileSync(ADMIN_FILE, src, 'utf8');
  console.log(`✅ Done. ${changeCount} fix group(s) written to admin/index.js`);
  console.log('\nNext step:');
  console.log('  git add -A && git commit -m "Remove debug logs, add Close RFQ button, show version badges in quote history" && git push');
} else {
  console.log('ℹ️  No changes written — check warnings above.');
}

console.log('='.repeat(60));
