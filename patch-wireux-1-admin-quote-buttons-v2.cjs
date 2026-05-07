// patch-wireux-1-admin-quote-buttons-v2.cjs
// v2: Precise anchors based on actual file inspection.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/index.js';
const BACKUP = 'admin/index.js.wireux1v2.bak';

console.log('Wire UX 1 v2: Admin quote detail buttons');
console.log('=========================================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('reissueQuoteDialog')) { console.log('- Already patched.'); process.exit(0); }

// PATCH 1: Extend the SELECT to include rejected_at, rejection_reason, expired_at, parent_quote_id, reissued_count
const oldSel = "SELECT q.id, q.quote_number, q.status, q.total_amount, q.valid_until, q.created_at,";
const newSel = "SELECT q.id, q.quote_number, q.status, q.total_amount, q.valid_until, q.created_at, q.rejected_at, q.rejection_reason, q.expired_at, q.parent_quote_id, q.reissued_count,";
if (!src.includes(oldSel)) {
  console.error('! Could not find quote SELECT');
  process.exit(1);
}
src = src.replace(oldSel, function() { return newSel; });
console.log('+ SELECT extended with new columns');

// PATCH 2: Replace the action buttons line
// Original line: <a href="/admin/rfqs/${q.rfq_header_id}/quote-review" class="btn btn-sm" style="background:#c8932a;color:#000;font-weight:600;">↺ Resend / Requote</a>
// Note the special char ↺ - we'll use a regex that's tolerant
const oldButtonRegex = /<a href="\/admin\/rfqs\/\$\{q\.rfq_header_id\}\/quote-review" class="btn btn-sm" style="background:#c8932a;color:#000;font-weight:600;">[^<]*<\/a>/;
const newButtonHTML = '${q.status===\'Expired\' || q.status===\'Rejected\' ? `<button onclick="reissueQuoteDialog(${q.id})" class="btn btn-sm" style="background:#4caf50;color:#000;font-weight:600;">&#x21BB; Reissue Quote</button>` : \'\'}\n          ${q.status!==\'Accepted\' ? `<button onclick="reviseQuoteDialog(${q.id})" class="btn btn-sm" style="background:#c8932a;color:#000;font-weight:600;">&#x270F; Revise &amp; Resend</button>` : \'\'}';

if (!oldButtonRegex.test(src)) {
  console.error('! Could not find action button via regex');
  process.exit(1);
}
src = src.replace(oldButtonRegex, newButtonHTML);
console.log('+ Action buttons replaced');

// PATCH 3: Replace the Status detail-item with version that includes countdown + banners
const oldStatusItem = '<div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">${statusBadge(q.status)}</div></div>';
const newStatusItem =
  '<div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">' +
  '${statusBadge(q.status)}' +
  '${(() => {' +
  ' if (q.status===\'Sent\' && q.valid_until) {' +
  '  const days = Math.ceil((new Date(q.valid_until)-new Date())/86400000);' +
  '  if (days < 0) return \' <span style="color:#e05050;font-size:.7rem;margin-left:6px;">EXPIRED \'+Math.abs(days)+\'d AGO</span>\';' +
  '  if (days <= 3) return \' <span style="color:#e05050;font-size:.7rem;margin-left:6px;">Expires in \'+days+\'d</span>\';' +
  '  if (days <= 7) return \' <span style="color:#c8932a;font-size:.7rem;margin-left:6px;">Expires in \'+days+\'d</span>\';' +
  '  return \' <span style="color:#7a8a9a;font-size:.7rem;margin-left:6px;">\'+days+\'d left</span>\';' +
  ' }' +
  ' if (q.reissued_count > 0) return \' <span style="color:#c8932a;font-size:.7rem;margin-left:6px;">Reissued \'+q.reissued_count+\'x</span>\';' +
  ' return \'\';' +
  '})()}' +
  '</div></div>' +
  '${q.status===\'Rejected\' ? `<div class="alert alert-error" style="grid-column:1/-1;">&#9888; Customer rejected${q.rejected_at ? \' on \'+new Date(q.rejected_at).toLocaleDateString() : \'\'}${q.rejection_reason ? \'. Reason: \'+q.rejection_reason : \'\'}</div>` : \'\'}' +
  '${q.status===\'Expired\' ? `<div class="alert" style="grid-column:1/-1;background:rgba(122,138,154,0.1);border-color:#7a8a9a;color:#7a8a9a;">&#9201; This quote expired${q.expired_at ? \' on \'+new Date(q.expired_at).toLocaleDateString() : (q.valid_until ? \' on \'+new Date(q.valid_until).toLocaleDateString() : \'\')}. Use Reissue or Revise to send a new one.</div>` : \'\'}';

if (!src.includes(oldStatusItem)) {
  console.error('! Could not find Status detail item');
  process.exit(1);
}
src = src.replace(oldStatusItem, function() { return newStatusItem; });
console.log('+ Status item enhanced');

// PATCH 4: Inject the dialog functions <script> block before the closing of the template literal
// The closing pattern is: empty line + spaces + closing-backtick )) ;
// Our exact anchor from the file: `      `));` preceded by status history div close
const oldClose = '<tbody>${logRows||\'<tr><td colspan="3" style="color:#7a8a9a;text-align:center;padding:16px;">No history yet</td></tr>\'}</tbody></table>\r\n        </div>\r\n      `));';
const newClose = '<tbody>${logRows||\'<tr><td colspan="3" style="color:#7a8a9a;text-align:center;padding:16px;">No history yet</td></tr>\'}</tbody></table>\r\n        </div>\r\n        <script>\r\n          function reissueQuoteDialog(id) {\r\n            const days = prompt(\'Reissue this quote: how many days valid from today?\', \'30\');\r\n            if (!days) return;\r\n            const f = document.createElement(\'form\'); f.method=\'POST\'; f.action=\'/admin/quotes/\'+id+\'/reissue\';\r\n            const i = document.createElement(\'input\'); i.type=\'hidden\'; i.name=\'valid_days\'; i.value=days; f.appendChild(i);\r\n            document.body.appendChild(f); f.submit();\r\n          }\r\n          function reviseQuoteDialog(id) {\r\n            if (!confirm(\'This will mark the current quote as Superseded and open the requote builder for the original RFQ. Continue?\')) return;\r\n            const f = document.createElement(\'form\'); f.method=\'POST\'; f.action=\'/admin/quotes/\'+id+\'/revise\';\r\n            document.body.appendChild(f); f.submit();\r\n          }\r\n        </script>\r\n      `));';

let closeDone = false;
if (src.includes(oldClose)) {
  src = src.replace(oldClose, function() { return newClose; });
  closeDone = true;
  console.log('+ Dialog scripts injected (CRLF)');
} else {
  // Try LF
  const oldLF = oldClose.replace(/\r\n/g, '\n');
  const newLF = newClose.replace(/\r\n/g, '\n');
  if (src.includes(oldLF)) {
    src = src.replace(oldLF, function() { return newLF; });
    closeDone = true;
    console.log('+ Dialog scripts injected (LF)');
  }
}
if (!closeDone) {
  console.error('! Could not find quote template close anchor');
  process.exit(1);
}

fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);

try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ Patched + syntax OK');
  console.log('SUCCESS - safe to commit');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! Syntax error - REVERTED');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
