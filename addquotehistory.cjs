const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');
const lines = a.split('\n');

// 1. Add quotes history section before Status History on RFQ detail (line 892, 0-indexed 891)
const statusHistLine = lines.findIndex((l, i) => i >= 888 && i <= 898 && l.includes('<div class="card">') && lines[i+1] && lines[i+1].includes('Status History'));
console.log('Status history card at line:', statusHistLine + 1);

if (statusHistLine > -1) {
  const quoteHistSection = [
    `        <div class="card">`,
    `          <div class="card-header">Quote History</div>`,
    `          \${sentQuotesHtml}`,
    `        </div>`,
  ];
  lines.splice(statusHistLine, 0, ...quoteHistSection);
  console.log('Quote history section: ADDED');
}

fs.writeFileSync('admin/index.js', lines.join('\n'));

// 2. Now add the sentQuotesHtml query before the res.send on the RFQ detail page
let b = fs.readFileSync('admin/index.js', 'utf8');
const oldLogRows = `      const logRows = log.recordset.map`;
const newLogRows = `      // Load sent quotes for this RFQ
      const sentQuotes = await pool.request().input('rfqIdSQ', sql.BigInt, rfq.id)
        .query("SELECT id, quote_number, status, total_amount, valid_until, created_at FROM quotes WHERE rfq_id=@rfqIdSQ AND quote_number NOT LIKE '%-D' ORDER BY created_at DESC");
      const sentQuotesHtml = sentQuotes.recordset.length === 0
        ? '<div style="padding:16px;color:#7a8a9a;text-align:center;">No quotes sent yet</div>'
        : '<table><thead><tr><th>Quote #</th><th>Status</th><th>Total</th><th>Valid Until</th><th>Sent</th><th></th></tr></thead><tbody>' +
          sentQuotes.recordset.map(q => \`<tr>
            <td class="mono text-gold"><a href="/admin/quotes/\${q.id}" style="color:#c8932a;">\${q.quote_number}</a></td>
            <td>\${statusBadge(q.status)}</td>
            <td style="font-weight:600;">$\${parseFloat(q.total_amount||0).toFixed(2)}</td>
            <td style="color:#7a8a9a;font-size:.78rem;">\${q.valid_until?new Date(q.valid_until).toLocaleDateString():'—'}</td>
            <td style="color:#7a8a9a;font-size:.78rem;">\${new Date(q.created_at).toLocaleDateString()}</td>
            <td><a href="/admin/rfqs/\${rfq.id}/quote-review" class="btn btn-outline btn-sm" style="font-size:.7rem;">Requote</a></td>
          </tr>\`).join('') + '</tbody></table>';
      const logRows = sentQuotes.recordset.map`; // will be replaced below

if (b.includes(oldLogRows)) {
  b = b.replace(oldLogRows, newLogRows);
  // Fix the trailing .map that we left
  b = b.replace(
    `      const logRows = sentQuotes.recordset.map`,
    `      const logRows = log.recordset.map`
  );
  console.log('sentQuotesHtml query: ADDED');
}

// 3. Fix the existingQuote check - always insert new version (disable the UPDATE path)
const oldExist = `        .query("SELECT id, quote_number FROM quotes WHERE rfq_id=@rfqId2 AND status<>'Draft' AND quote_number NOT LIKE '%-D'");`;
const newExist = `        .query("SELECT id, quote_number FROM quotes WHERE rfq_id=@rfqId2 AND status<>'Draft' AND quote_number NOT LIKE '%-D' AND 1=0");`;
if (b.includes(oldExist)) { b = b.replace(oldExist, newExist); console.log('Always new version: FIXED'); }
else console.log('Existing check: NOT FOUND');

fs.writeFileSync('admin/index.js', b);
console.log('All done!');
