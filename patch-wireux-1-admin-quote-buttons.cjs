// patch-wireux-1-admin-quote-buttons.cjs
// Patches admin/index.js quote detail page:
//   - Adds Reissue button (when Expired/Rejected)
//   - Adds Revise & Resend button (any status except Accepted)
//   - Shows rejection_reason in red banner if Rejected
//   - Shows "Expires in N days" countdown next to status

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/index.js';
const BACKUP = 'admin/index.js.wireux1.bak';

console.log('Wire UX 1: Admin quote detail buttons');
console.log('=====================================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('reissueQuoteDialog')) { console.log('- Already patched.'); process.exit(0); }

// PATCH 1: extend the SELECT to include the new fields
const oldSel = "SELECT q.id, q.quote_number, q.status, q.total_amount, q.valid_until, q.created_at,";
if (!src.includes(oldSel)) {
  console.error('! Could not find quote SELECT in admin');
  process.exit(1);
}
const newSel = "SELECT q.id, q.quote_number, q.status, q.total_amount, q.valid_until, q.created_at, q.rejected_at, q.rejection_reason, q.expired_at, q.parent_quote_id, q.reissued_count,";
src = src.replace(oldSel, function() { return newSel; });

// PATCH 2: Replace the existing action buttons + add status banners.
// Anchor on the existing "Resend / Requote" line. Replace the whole action div.
const oldActions =
  '<a href="/admin/rfqs/${q.rfq_header_id}/quote-review" class="btn btn-sm" style="background:#c8932a;color:#000;font-weight:600;">\u21BA Resend / Requote</a>\r\n          <a href="/admin/quotes" class="btn btn-outline btn-sm">\u2190 Back to Quotes</a>';
const newActions =
  '${q.status===\'Expired\' || q.status===\'Rejected\' ? `<button onclick="reissueQuoteDialog(${q.id})" class="btn btn-sm" style="background:#4caf50;color:#000;font-weight:600;">\u21BB Reissue Quote</button>` : \'\'}\r\n          ${q.status!==\'Accepted\' ? `<button onclick="reviseQuoteDialog(${q.id})" class="btn btn-sm" style="background:#c8932a;color:#000;font-weight:600;">\u270F Revise & Resend</button>` : \'\'}\r\n          <a href="/admin/quotes" class="btn btn-outline btn-sm">\u2190 Back to Quotes</a>';

if (!src.includes(oldActions)) {
  // Try LF
  const oldLF = oldActions.replace(/\r\n/g, '\n');
  const newLF = newActions.replace(/\r\n/g, '\n');
  if (src.includes(oldLF)) {
    src = src.replace(oldLF, function() { return newLF; });
    console.log('+ Action buttons replaced (LF)');
  } else {
    console.error('! Could not find action buttons region');
    process.exit(1);
  }
} else {
  src = src.replace(oldActions, function() { return newActions; });
  console.log('+ Action buttons replaced (CRLF)');
}

// PATCH 3: Add status banners + countdown right before the detail-grid
// Anchor: the status banner location is right before <div class="detail-grid"> in the quote detail
// Find the line: <div class="detail-item"><div class="detail-label">Status</div>
const oldStatusItem = '<div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">${statusBadge(q.status)}</div></div>';
const newStatusItem =
  '<div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">' +
  '${statusBadge(q.status)}' +
  '${(() => {' +
  '  if (q.status===\'Sent\' && q.valid_until) {' +
  '    const days = Math.ceil((new Date(q.valid_until)-new Date())/(86400000));' +
  '    if (days < 0) return \' <span style="color:#e05050;font-size:.7rem;margin-left:6px;">EXPIRED \'+Math.abs(days)+\'d AGO</span>\';' +
  '    if (days <= 3) return \' <span style="color:#e05050;font-size:.7rem;margin-left:6px;">Expires in \'+days+\'d</span>\';' +
  '    if (days <= 7) return \' <span style="color:#c8932a;font-size:.7rem;margin-left:6px;">Expires in \'+days+\'d</span>\';' +
  '    return \' <span style="color:#7a8a9a;font-size:.7rem;margin-left:6px;">Expires in \'+days+\'d</span>\';' +
  '  }' +
  '  if (q.reissued_count > 0) return \' <span style="color:#c8932a;font-size:.7rem;margin-left:6px;">Reissued \'+q.reissued_count+\'x</span>\';' +
  '  return \'\';' +
  '})()}' +
  '</div></div>' +
  '${q.status===\'Rejected\' && q.rejection_reason ? `<div class="alert alert-error" style="grid-column:1/-1;">\u26A0 Customer rejected on ${formatDate ? formatDate(q.rejected_at) : new Date(q.rejected_at).toLocaleDateString()}. Reason: ${q.rejection_reason}</div>` : (q.status===\'Rejected\' ? `<div class="alert alert-error" style="grid-column:1/-1;">\u26A0 Customer rejected on ${new Date(q.rejected_at).toLocaleDateString()}</div>` : \'\')}' +
  '${q.status===\'Expired\' ? `<div class="alert" style="grid-column:1/-1;background:rgba(122,138,154,0.1);border-color:#7a8a9a;color:#7a8a9a;">\u23F1 This quote expired on ${q.expired_at ? new Date(q.expired_at).toLocaleDateString() : new Date(q.valid_until).toLocaleDateString()}. Reissue or revise to send a new one.</div>` : \'\'}';

if (!src.includes(oldStatusItem)) {
  console.error('! Could not find Status detail item');
  process.exit(1);
}
src = src.replace(oldStatusItem, function() { return newStatusItem; });

// PATCH 4: Inject the dialog functions + handler scripts at end of admin/index.js
// Near the end of the file, before module.exports / closing
// Or insert into the page() helper... actually simpler: append to body of quote detail page.
// Since the page is rendered via template literal, we need to add the script block in the rendered HTML.
// Anchor on the end of the quote detail HTML: the closing of res.send(page(...))
const oldQuoteEnd = "res.send(page(`Quote ${q.quote_number}`,'quotes',html));";
const newQuoteEnd =
  "html += `\\n<script>\\n" +
  "function reissueQuoteDialog(id) {\\n" +
  "  const days = prompt('Reissue this quote: how many days valid from today?', '30');\\n" +
  "  if (!days) return;\\n" +
  "  const f = document.createElement('form'); f.method='POST'; f.action='/admin/quotes/'+id+'/reissue';\\n" +
  "  const i = document.createElement('input'); i.type='hidden'; i.name='valid_days'; i.value=days; f.appendChild(i);\\n" +
  "  document.body.appendChild(f); f.submit();\\n" +
  "}\\n" +
  "function reviseQuoteDialog(id) {\\n" +
  "  if (!confirm('This will mark the current quote as Superseded and open the requote builder for the original RFQ. Continue?')) return;\\n" +
  "  const f = document.createElement('form'); f.method='POST'; f.action='/admin/quotes/'+id+'/revise';\\n" +
  "  document.body.appendChild(f); f.submit();\\n" +
  "}\\n" +
  "</script>`;\n      " +
  "res.send(page(`Quote ${q.quote_number}`,'quotes',html));";

if (!src.includes(oldQuoteEnd)) {
  console.error('! Could not find quote res.send anchor');
  process.exit(1);
}
src = src.replace(oldQuoteEnd, function() { return newQuoteEnd; });

fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);

try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ Patched + syntax OK');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! Syntax error - reverted');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
