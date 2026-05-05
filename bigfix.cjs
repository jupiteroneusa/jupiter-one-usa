const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');
let m = fs.readFileSync('services/mailer.js', 'utf8');

// ============================================================
// 1. FIX EMAIL - Fix Quote Details column width wrapping
// ============================================================
m = m.replace(
  `<td style="padding:12px;border:1px solid #e8e8e8;vertical-align:top;width:48%;">`,
  `<td style="padding:12px;border:1px solid #e8e8e8;vertical-align:top;width:48%;min-width:200px;">`
);
// Fix the inner table in quote details to not wrap
m = m.replace(
  `<table style="width:100%;border-collapse:collapse;font-size:13px;">`,
  `<table style="width:100%;border-collapse:collapse;font-size:13px;white-space:nowrap;">`
);
// Fix two-col layout to stack on mobile
m = m.replace(
  `<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">`,
  `<table style="width:100%;border-collapse:collapse;margin-bottom:24px;table-layout:fixed;">`
);
console.log('Email fixes: APPLIED');

// ============================================================
// 2. QUOTE VERSIONING - change quoteNumber logic to use versions
// ============================================================
const oldQuoteNum = `      const quoteNumber = rfq.rfq_number.replace(/^RFQ-/, 'QT-');`;
const newQuoteNum = `      // Version-aware quote number: QT-2026-00001-v1, v2, v3...
      const baseQtNum = rfq.rfq_number.replace(/^RFQ-/, 'QT-');
      const existingVersions = await pool.request().input('rfqIdV', sql.BigInt, rfq.id)
        .query("SELECT quote_number FROM quotes WHERE rfq_id=@rfqIdV AND quote_number NOT LIKE '%-D' ORDER BY created_at ASC");
      const versionCount = existingVersions.recordset.length;
      const quoteNumber = versionCount === 0 ? baseQtNum + '-v1' : baseQtNum + '-v' + (versionCount + 1);`;
if (a.includes(oldQuoteNum)) { a = a.replace(oldQuoteNum, newQuoteNum); console.log('Versioning: ADDED'); }
else console.log('Versioning: NOT FOUND');

// ============================================================
// 3. FIX existingQuote check - don't UPDATE, always INSERT new version
// ============================================================
const oldExistingCheck = `      // Check if quote already exists for this RFQ - if so, update it (revision)
      const existingQuote = await pool.request()
        .input('rfqId2', sql.BigInt, rfq.id)
        .query("SELECT id, quote_number FROM quotes WHERE rfq_id=@rfqId2 AND status<>'Draft' AND quote_number NOT LIKE '%-D'");`;
const newExistingCheck = `      // Always create new version - no overwriting
      const existingQuote = await pool.request()
        .input('rfqId2', sql.BigInt, rfq.id)
        .query("SELECT id, quote_number FROM quotes WHERE rfq_id=@rfqId2 AND status<>'Draft' AND quote_number NOT LIKE '%-D' AND 1=0");`;
if (a.includes(oldExistingCheck)) { a = a.replace(oldExistingCheck, newExistingCheck); console.log('Always new version: APPLIED'); }
else console.log('Existing check: NOT FOUND');

// ============================================================
// 4. ADD RESEND BUTTON on quote detail page
// ============================================================
const oldBackToQuotes = `<a href="/admin/quotes" class="btn btn-outline btn-sm">← Back to Quotes</a>`;
const newBackToQuotes = `<div style="display:flex;gap:8px;">
          <a href="/admin/rfqs/\${q.rfq_header_id}/quote-review" class="btn btn-sm" style="background:#c8932a;color:#000;font-weight:600;">↺ Resend / Requote</a>
          <a href="/admin/quotes" class="btn btn-outline btn-sm">← Back to Quotes</a>
        </div>`;
if (a.includes(oldBackToQuotes)) { a = a.replace(oldBackToQuotes, newBackToQuotes); console.log('Resend button: ADDED'); }
else console.log('Resend button: NOT FOUND');

// ============================================================
// 5. CLICKABLE QUOTES on RFQ detail page
// ============================================================
// Find where quotes are shown on RFQ detail and make them clickable
const oldQuoteSection = `      const quoteExists = await pool.request().input('rfqId3', sql.BigInt, rfq.id)
        .query("SELECT id, quote_number, status, total_amount, created_at FROM quotes WHERE rfq_id=@rfqId3 AND quote_number NOT LIKE '%-D' ORDER BY created_at DESC");`;
if (a.includes(oldQuoteSection)) {
  console.log('Quote section: FOUND - quotes already linked');
} else console.log('Quote section: check manually');

// Find the quote rows rendering in RFQ detail and make quote_number a link
const oldQtRow = `<td class="mono text-gold">\${q2.quote_number}</td>`;
if (a.includes(oldQtRow)) {
  a = a.replace(oldQtRow, `<td class="mono text-gold"><a href="/admin/quotes/\${q2.id}" style="color:#c8932a;">\${q2.quote_number}</a></td>`);
  console.log('Clickable quote: ADDED');
} else console.log('Qt row: NOT FOUND');

fs.writeFileSync('admin/index.js', a);
fs.writeFileSync('services/mailer.js', m);
console.log('All done!');
