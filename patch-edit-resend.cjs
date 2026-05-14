// patch-edit-resend.cjs
// Edit & Resend redesign for quotes.
// 1. Replace "Revise & Resend" + "Reissue" buttons with single "Edit & Resend"
// 2. New GET /admin/quotes/:id/edit — full builder pre-filled with current data
// 3. New POST /admin/quotes/:id/edit-save — snapshot old version, update current, email customer
// 4. Show version history block on quote detail
// 5. Clean up duplicate revise/reissue routes (just remove second pair)

const fs = require('fs');
const { execSync } = require('child_process');

const errors = [];
const log = [];
const ok = m => log.push('+ ' + m);

function compile(file) {
  try { execSync('node -c "' + file + '"', { stdio: 'pipe' }); return true; }
  catch (err) { return err.stderr ? err.stderr.toString() : err.message; }
}

const f = 'admin/index.js';
const orig = fs.readFileSync(f, 'utf8');
let s = orig;

if (s.includes('EDIT_RESEND_V1')) {
  console.log('- already patched');
  process.exit(0);
}

// =========================================================================
// PIECE 1: Remove duplicate revise/reissue route block (L2149-2174 second copy).
// Match the comment block + both routes; we'll keep the FIRST copies at L2118-2143.
// =========================================================================
{
  // Find the second occurrence of "// Phase B3: Reissue an expired/rejected quote"
  const phrase = '// Phase B3: Reissue an expired/rejected quote (extends valid_until, marks Sent again)';
  const first = s.indexOf(phrase);
  const second = s.indexOf(phrase, first + 1);
  if (second > 0) {
    // Find end of second block — closing }); of the second /revise handler
    // Walk forward from the second occurrence; find the second occurrence of
    // ".query(\"UPDATE quotes SET status='Superseded'..." then walk to end of handler.
    const supersededIdx = s.indexOf("UPDATE quotes SET status='Superseded'", second);
    if (supersededIdx > 0) {
      // Find the end of the function. Look for "});" after the next 200 chars.
      let depth = 0, started = false, eIdx = -1;
      for (let i = second; i < s.length; i++) {
        const c = s[i];
        if (c === '{') { depth++; started = true; }
        else if (c === '}') { depth--; if (started && depth === 0) {
          // consume "});" + trailing newline
          while (i < s.length && s[i] !== '\n') i++;
          eIdx = i + 1; break;
        }}
      }
      if (eIdx > 0) {
        s = s.slice(0, second) + s.slice(eIdx);
        ok('Removed duplicate revise/reissue routes');
      }
    }
  }
}

// =========================================================================
// PIECE 2: Replace the two button divs in quote detail page with one Edit & Resend
// Anchor: the line containing "Reissue Quote" button definition.
// =========================================================================
{
  const reissueLine = "${q.status==='Expired' || q.status==='Rejected' ? `<button onclick=\"reissueQuoteDialog(${q.id})\" class=\"btn btn-sm\" style=\"background:#4caf50;color:#000;font-weight:600;\">&#x21BB; Reissue Quote</button>` : ''}";
  const reviseLine = "${q.status!=='Accepted' ? `<button onclick=\"reviseQuoteDialog(${q.id})\" class=\"btn btn-sm\" style=\"background:#c8932a;color:#000;font-weight:600;\">&#x270F; Revise &amp; Resend</button>` : ''}";

  if (s.indexOf(reissueLine) > -1 && s.indexOf(reviseLine) > -1) {
    const newButton = "${q.status!=='Accepted' ? `<a href=\"/admin/quotes/${q.id}/edit\" class=\"btn btn-sm\" style=\"background:#c8932a;color:#000;font-weight:600;text-decoration:none;\">&#x270F; Edit &amp; Resend</a>` : ''}";
    // Remove the reissue line entirely
    s = s.split(reissueLine).join('');
    // Replace the revise line with our new button
    s = s.split(reviseLine).join(newButton);
    ok('Replaced Reissue + Revise buttons with single Edit & Resend');
  } else {
    errors.push('Could not find button anchors');
  }
}

// =========================================================================
// PIECE 3: Remove the old JS dialog functions (reissueQuoteDialog, reviseQuoteDialog)
// since they're no longer referenced.
// =========================================================================
{
  // Find function reissueQuoteDialog and walk to end of reviseQuoteDialog
  const startMarker = 'function reissueQuoteDialog(id) {';
  const endMarker = 'document.body.appendChild(f); f.submit();\r\n          }';
  const sIdx = s.indexOf(startMarker);
  if (sIdx > 0) {
    // Find the SECOND occurrence of endMarker after sIdx — that's the close of reviseQuoteDialog
    const e1 = s.indexOf(endMarker, sIdx);
    if (e1 > 0) {
      const e2 = s.indexOf(endMarker, e1 + endMarker.length);
      if (e2 > 0) {
        s = s.slice(0, sIdx) + s.slice(e2 + endMarker.length);
        ok('Removed unused reissueQuoteDialog/reviseQuoteDialog JS functions');
      } else {
        // Try LF-only ending
        const endMarkerLf = 'document.body.appendChild(f); f.submit();\n          }';
        const e1lf = s.indexOf(endMarkerLf, sIdx);
        if (e1lf > 0) {
          const e2lf = s.indexOf(endMarkerLf, e1lf + endMarkerLf.length);
          if (e2lf > 0) {
            s = s.slice(0, sIdx) + s.slice(e2lf + endMarkerLf.length);
            ok('Removed unused JS dialog functions (LF variant)');
          }
        }
      }
    }
  }
}

// =========================================================================
// PIECE 4: Add Version History block after RFQ Status History.
// Anchor: <div class="card-header">RFQ Status History</div>
// =========================================================================
{
  // We'll inject a version-history-aware section BEFORE the RFQ Status History card.
  // Need to load versions data first. Find where logRows is set; add versionRows there.
  const logRowsAnchor = "const logRows = rfqLog.recordset.map(l => `<tr>";
  if (s.includes(logRowsAnchor)) {
    const loadVersions = "// EDIT_RESEND_V1 load versions\r\n      const versionsR = await pool.request().input('idv', sql.BigInt, req.params.id).query('SELECT id, version, revised_at, revised_by, revision_note, email_sent, subtotal, total FROM quote_versions WHERE quote_id=@idv ORDER BY version DESC');\r\n      const versionRows = versionsR.recordset.map(function(v) { return '<tr><td style=\"color:#c8932a;font-weight:600;\">v' + v.version + '</td><td>' + new Date(v.revised_at).toLocaleString() + '</td><td>' + (v.revised_by || 'admin') + '</td><td style=\"font-weight:600;\">$' + parseFloat(v.total || 0).toLocaleString('en-US', {minimumFractionDigits: 2}) + '</td><td style=\"color:#7a8a9a;\">' + (v.revision_note || '\\u2014') + '</td><td>' + (v.email_sent ? '<span style=\"color:#4caf50;\">Sent</span>' : '<span style=\"color:#7a8a9a;\">No</span>') + '</td></tr>'; }).join('');\r\n      ";
    s = s.replace(logRowsAnchor, function() { return loadVersions + logRowsAnchor; });
    ok('Added version-load query');
  }

  // Inject the version history card before the RFQ Status History card
  const rfqHistAnchor = '<div class="card-header">RFQ Status History</div>';
  if (s.includes(rfqHistAnchor)) {
    const newBlock = "<div class=\"card\"><div class=\"card-header\">Revision History (Current: v${q.version || 1})</div><table><thead><tr><th>Version</th><th>Date</th><th>By</th><th>Total</th><th>Note</th><th>Emailed</th></tr></thead><tbody>${versionRows || '<tr><td colspan=\"6\" style=\"color:#7a8a9a;text-align:center;padding:16px;\">Original version only \\u2014 no revisions yet</td></tr>'}</tbody></table></div>\r\n        <div class=\"card\">\r\n          " + rfqHistAnchor;
    s = s.split(rfqHistAnchor).join(newBlock);
    // The above puts an extra <div class="card"> ... but our injection already opens its own card.
    // Issue: the original line was already wrapped in <div class="card">. Let's fix that by making the
    // injection NOT include another <div class="card"> open after our block.
    // Simpler: revert and use a different anchor that captures the open <div class="card"> too.
    s = s.split("<div class=\"card\"><div class=\"card-header\">Revision History (Current: v${q.version || 1})</div><table><thead><tr><th>Version</th><th>Date</th><th>By</th><th>Total</th><th>Note</th><th>Emailed</th></tr></thead><tbody>${versionRows || '<tr><td colspan=\"6\" style=\"color:#7a8a9a;text-align:center;padding:16px;\">Original version only \u2014 no revisions yet</td></tr>'}</tbody></table></div>\r\n        <div class=\"card\">\r\n          " + rfqHistAnchor)
        .join("<div class=\"card\"><div class=\"card-header\">Revision History (Current: v${q.version || 1})</div><table><thead><tr><th>Version</th><th>Date</th><th>By</th><th>Total</th><th>Note</th><th>Emailed</th></tr></thead><tbody>${versionRows || '<tr><td colspan=\"6\" style=\"color:#7a8a9a;text-align:center;padding:16px;\">Original version only \\u2014 no revisions yet</td></tr>'}</tbody></table></div>\r\n        " + rfqHistAnchor);
    ok('Injected Revision History card before RFQ Status History');
  }
}

// =========================================================================
// PIECE 5: Add new GET /quotes/:id/edit + POST /quotes/:id/edit-save handlers.
// These get inserted right after the existing /quotes/:id GET handler closes.
// Insertion point: just before the duplicate-cleaned "// Phase B3: Reissue" line.
// =========================================================================
{
  const insertAnchor = '// Phase B3: Reissue an expired/rejected quote';
  const insertIdx = s.indexOf(insertAnchor);
  if (insertIdx < 0) {
    errors.push('Could not find insertion point for new edit routes');
  } else {
    // Move back to just before this comment (start of its line)
    let lineStart = insertIdx;
    while (lineStart > 0 && s[lineStart - 1] !== '\n') lineStart--;

    const newHandlers = [
      "  // EDIT_RESEND_V1 ============================================================",
      "  // GET /admin/quotes/:id/edit  — show pre-filled edit form for an existing quote",
      "  router.get('/quotes/:id/edit', async (req, res) => {",
      "    if (!requireAuth(req, res)) return;",
      "    try {",
      "      const pool = await getPool();",
      "      const qr = await pool.request().input('id', sql.BigInt, req.params.id).query('SELECT q.*, c.first_name+\\' \\'+c.last_name AS customer_name, c.email, c.company FROM quotes q JOIN customers c ON c.id=q.customer_id WHERE q.id=@id');",
      "      if (!qr.recordset.length) return res.send(page('Edit Quote', 'quotes', '<div class=\"alert alert-error\">Quote not found.</div>'));",
      "      const q = qr.recordset[0];",
      "      if (q.status === 'Accepted') {",
      "        return res.send(page('Edit Quote', 'quotes', '<div class=\"alert alert-error\">Cannot edit an accepted quote. To fix typos on accepted quotes, use the order page Lines tab.</div><div style=\"margin-top:12px;\"><a href=\"/admin/quotes/' + q.id + '\" class=\"btn btn-outline\">&larr; Back to Quote</a></div>'));",
      "      }",
      "      const linesR = await pool.request().input('qid', sql.BigInt, req.params.id).query('SELECT * FROM quote_lines WHERE quote_id=@qid ORDER BY line_number');",
      "      const srcsR = await pool.request().input('qid2', sql.BigInt, req.params.id).query('SELECT qls.*, s.company_name AS supplier_name FROM quote_line_sources qls LEFT JOIN suppliers s ON s.id=qls.supplier_id INNER JOIN quote_lines ql ON ql.id=qls.quote_line_id WHERE ql.quote_id=@qid2 ORDER BY qls.quote_line_id, qls.sort_order');",
      "      const srcsByLine = {};",
      "      srcsR.recordset.forEach(function(src) { if (!srcsByLine[src.quote_line_id]) srcsByLine[src.quote_line_id] = []; srcsByLine[src.quote_line_id].push(src); });",
      "      var html = '';",
      "      html += '<div class=\"page-title\">Edit Quote ' + q.quote_number + ' &mdash; v' + (q.version || 1) + ' \\u2192 v' + ((q.version || 1) + 1) + '</div>';",
      "      html += '<div class=\"page-sub\">Editing creates a new version. Customer will receive an email with the revised PDF.</div>';",
      "      html += '<form method=\"POST\" action=\"/admin/quotes/' + q.id + '/edit-save\">';",
      "      html += '<div class=\"card\"><div class=\"card-body\">';",
      "      html += '<div class=\"detail-grid\">';",
      "      html += '<div><div class=\"detail-label\">Valid Until</div><input type=\"date\" name=\"valid_until\" value=\"' + (q.valid_until ? new Date(q.valid_until).toISOString().substring(0,10) : '') + '\" style=\"width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:8px 12px;\"/></div>';",
      "      html += '<div><div class=\"detail-label\">Payment Terms</div><input type=\"text\" name=\"payment_terms\" value=\"' + (q.payment_terms || '').replace(/\"/g, '&quot;') + '\" style=\"width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:8px 12px;\"/></div>';",
      "      html += '</div>';",
      "      html += '</div></div>';",
      "      html += '<div class=\"card\" style=\"margin-top:14px;\"><div class=\"card-header\">Line Items</div><div class=\"card-body\">';",
      "      linesR.recordset.forEach(function(l, idx) {",
      "        html += '<div style=\"margin-bottom:14px;padding:12px;background:#0a1628;border:1px solid #1e2d42;border-radius:4px;\">';",
      "        html += '<input type=\"hidden\" name=\"lines[' + idx + '][id]\" value=\"' + l.id + '\"/>';",
      "        html += '<div style=\"display:grid;grid-template-columns:repeat(4,1fr);gap:8px;\">';",
      "        html += '<div><div class=\"detail-label\">NSN</div><input type=\"text\" name=\"lines[' + idx + '][nsn]\" value=\"' + ((l.nsn || '').toString().replace(/\"/g, '&quot;')) + '\" style=\"width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;\"/></div>';",
      "        html += '<div><div class=\"detail-label\">Part Number</div><input type=\"text\" name=\"lines[' + idx + '][part_number]\" value=\"' + ((l.part_number || '').toString().replace(/\"/g, '&quot;')) + '\" style=\"width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;\"/></div>';",
      "        html += '<div style=\"grid-column:span 2;\"><div class=\"detail-label\">Item Name</div><input type=\"text\" name=\"lines[' + idx + '][item_name]\" value=\"' + ((l.item_name || '').toString().replace(/\"/g, '&quot;')) + '\" style=\"width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;\"/></div>';",
      "        html += '<div><div class=\"detail-label\">Condition</div><input type=\"text\" name=\"lines[' + idx + '][condition_code]\" value=\"' + (l.condition_code || '') + '\" style=\"width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;\"/></div>';",
      "        html += '<div><div class=\"detail-label\">Qty</div><input type=\"number\" min=\"1\" name=\"lines[' + idx + '][quantity]\" value=\"' + (l.quantity || 1) + '\" style=\"width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;\"/></div>';",
      "        html += '<div><div class=\"detail-label\">Unit Cost</div><input type=\"number\" step=\"0.01\" name=\"lines[' + idx + '][unit_cost]\" value=\"' + parseFloat(l.unit_cost || 0).toFixed(2) + '\" style=\"width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;\"/></div>';",
      "        html += '<div><div class=\"detail-label\">Unit Price</div><input type=\"number\" step=\"0.01\" name=\"lines[' + idx + '][unit_price]\" value=\"' + parseFloat(l.unit_price || 0).toFixed(2) + '\" style=\"width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;\"/></div>';",
      "        html += '<div><div class=\"detail-label\">Lead Time</div><input type=\"text\" name=\"lines[' + idx + '][lead_time_text]\" value=\"' + ((l.lead_time_text || '').toString().replace(/\"/g, '&quot;')) + '\" placeholder=\"e.g. 7-10 days\" style=\"width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;\"/></div>';",
      "        html += '</div>';",
      "        var srcs = srcsByLine[l.id] || [];",
      "        if (srcs.length) {",
      "          html += '<div style=\"margin-top:10px;padding-top:8px;border-top:1px dashed #1e2d42;\"><div style=\"font-size:.65rem;color:#c8932a;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px;\">Sources (read-only here \\u2014 use New RFQ to re-source)</div>';",
      "          srcs.forEach(function(src) {",
      "            html += '<div style=\"font-size:.78rem;color:#7a8a9a;\">' + (src.supplier_name || '?') + ' &mdash; qty ' + src.allocated_qty + ' @ $' + parseFloat(src.unit_cost || 0).toFixed(2) + ' &mdash; ' + (src.lead_time_text || src.supplier_lead_time_days + ' days') + '</div>';",
      "          });",
      "          html += '</div>';",
      "        }",
      "        html += '</div>';",
      "      });",
      "      html += '</div></div>';",
      "      html += '<div class=\"card\" style=\"margin-top:14px;\"><div class=\"card-body\">';",
      "      html += '<div class=\"detail-label\">Revision Note (visible to admin only, optional)</div>';",
      "      html += '<input type=\"text\" name=\"revision_note\" placeholder=\"e.g. Updated price per Mike at Acme\" style=\"width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:8px 12px;margin-bottom:10px;\"/>';",
      "      html += '<label style=\"display:flex;align-items:center;gap:8px;cursor:pointer;\"><input type=\"checkbox\" name=\"email_customer\" value=\"1\" checked/> Email customer the revised quote PDF</label>';",
      "      html += '</div></div>';",
      "      html += '<div style=\"display:flex;gap:8px;justify-content:flex-end;margin-top:14px;\">';",
      "      html += '<a href=\"/admin/quotes/' + q.id + '\" class=\"btn btn-outline\">Cancel</a>';",
      "      html += '<button type=\"submit\" class=\"btn btn-gold\">Save & Resend</button>';",
      "      html += '</div></form>';",
      "      res.send(page('Edit Quote', 'quotes', html));",
      "    } catch (err) { console.error('Quote edit form error:', err); res.send(page('Edit Quote', 'quotes', '<div class=\"alert alert-error\">' + err.message + '</div>')); }",
      "  });",
      "",
      "  // POST /admin/quotes/:id/edit-save — snapshot old version, update current, optionally email",
      "  router.post('/quotes/:id/edit-save', async (req, res) => {",
      "    if (!requireAuth(req, res)) return;",
      "    try {",
      "      const pool = await getPool();",
      "      const b = req.body;",
      "      const qid = parseInt(req.params.id);",
      "      const qCur = await pool.request().input('id', sql.BigInt, qid).query('SELECT q.*, c.email, c.first_name+\\' \\'+c.last_name AS customer_name FROM quotes q JOIN customers c ON c.id=q.customer_id WHERE q.id=@id');",
      "      if (!qCur.recordset.length) return res.redirect('/admin/quotes/' + qid + '?error=Quote+not+found');",
      "      const q = qCur.recordset[0];",
      "      if (q.status === 'Accepted') return res.redirect('/admin/quotes/' + qid + '?error=Cannot+edit+accepted+quote');",
      "",
      "      // Snapshot current state before changes",
      "      const linesBefore = await pool.request().input('qid', sql.BigInt, qid).query('SELECT * FROM quote_lines WHERE quote_id=@qid ORDER BY line_number');",
      "      const srcsBefore = await pool.request().input('qid', sql.BigInt, qid).query('SELECT qls.* FROM quote_line_sources qls INNER JOIN quote_lines ql ON ql.id=qls.quote_line_id WHERE ql.quote_id=@qid');",
      "      const snapshot = JSON.stringify({ quote: q, lines: linesBefore.recordset, sources: srcsBefore.recordset });",
      "",
      "      const curVer = q.version || 1;",
      "      await pool.request()",
      "        .input('qid', sql.BigInt, qid)",
      "        .input('ver', sql.Int, curVer)",
      "        .input('snap', sql.NVarChar(sql.MAX), snapshot)",
      "        .input('sub', sql.Decimal(12,2), q.subtotal || 0)",
      "        .input('tot', sql.Decimal(12,2), q.total_amount || 0)",
      "        .input('vu', sql.Date, q.valid_until)",
      "        .input('by', sql.NVarChar(255), 'admin')",
      "        .input('note', sql.NVarChar(sql.MAX), b.revision_note || null)",
      "        .input('sent', sql.Bit, q.status === 'Sent' ? 1 : 0)",
      "        .query('INSERT INTO quote_versions (quote_id, version, snapshot_json, subtotal, total, valid_until, revised_by, revision_note, email_sent) VALUES (@qid, @ver, @snap, @sub, @tot, @vu, @by, @note, @sent)');",
      "",
      "      // Apply edits to quote header",
      "      const newVer = curVer + 1;",
      "      await pool.request()",
      "        .input('id', sql.BigInt, qid)",
      "        .input('ver', sql.Int, newVer)",
      "        .input('vu', sql.Date, b.valid_until || q.valid_until)",
      "        .input('pt', sql.NVarChar(100), b.payment_terms || q.payment_terms)",
      "        .query(\"UPDATE quotes SET version=@ver, valid_until=@vu, payment_terms=@pt, status='Sent', updated_at=GETDATE() WHERE id=@id\");",
      "",
      "      // Apply line edits + recompute totals",
      "      let newSubtotal = 0, newTotalCost = 0, newTotalMargin = 0;",
      "      const editLines = b.lines || [];",
      "      for (const ln of editLines) {",
      "        const lid = parseInt(ln.id);",
      "        const qty = parseInt(ln.quantity) || 0;",
      "        const uc = parseFloat(ln.unit_cost) || 0;",
      "        const up = parseFloat(ln.unit_price) || 0;",
      "        const lineTotal = qty * up;",
      "        const lineCost = qty * uc;",
      "        const lineMargin = lineTotal - lineCost;",
      "        const marginPct = up > 0 ? Math.min(999.99, Math.max(-999.99, (lineMargin / lineTotal) * 100)) : 0;",
      "        const markupPct = uc > 0 ? Math.min(999.99, Math.max(-999.99, ((up - uc) / uc) * 100)) : 0;",
      "        newSubtotal += lineTotal;",
      "        newTotalCost += lineCost;",
      "        newTotalMargin += lineMargin;",
      "        await pool.request()",
      "          .input('id', sql.BigInt, lid)",
      "          .input('nsn', sql.NVarChar(20), ln.nsn || null)",
      "          .input('pn', sql.NVarChar(100), ln.part_number || null)",
      "          .input('iname', sql.NVarChar(255), ln.item_name || null)",
      "          .input('cond', sql.NVarChar(5), ln.condition_code || null)",
      "          .input('qty', sql.Int, qty)",
      "          .input('uc', sql.Decimal(10,2), uc)",
      "          .input('up', sql.Decimal(10,2), up)",
      "          .input('lt', sql.Decimal(12,2), lineTotal)",
      "          .input('lc', sql.Decimal(12,2), lineCost)",
      "          .input('lm', sql.Decimal(12,2), lineMargin)",
      "          .input('mpct', sql.Decimal(5,2), marginPct)",
      "          .input('mkp', sql.Decimal(5,2), markupPct)",
      "          .input('ltt', sql.NVarChar(100), ln.lead_time_text || null)",
      "          .query('UPDATE quote_lines SET nsn=@nsn, part_number=@pn, item_name=@iname, condition_code=@cond, quantity=@qty, unit_cost=@uc, unit_price=@up, line_total=@lt, line_cost=@lc, line_margin=@lm, margin_pct=@mpct, markup_pct=@mkp, lead_time_text=@ltt WHERE id=@id');",
      "      }",
      "      await pool.request()",
      "        .input('id', sql.BigInt, qid)",
      "        .input('sub', sql.Decimal(12,2), newSubtotal)",
      "        .input('tot', sql.Decimal(12,2), newSubtotal)",
      "        .input('tc', sql.Decimal(12,2), newTotalCost)",
      "        .input('tm', sql.Decimal(12,2), newTotalMargin)",
      "        .query('UPDATE quotes SET subtotal=@sub, total_amount=@tot, total_cost=@tc, total_margin=@tm WHERE id=@id');",
      "",
      "      // Send email if requested",
      "      if (b.email_customer === '1') {",
      "        try {",
      "          const nodemailerMod = await import('nodemailer');",
      "          const nodemailer = nodemailerMod.default;",
      "          if (process.env.SMTP_HOST) {",
      "            const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: parseInt(process.env.SMTP_PORT || '587'), auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });",
      "            const body = '<p>Hello ' + q.customer_name + ',</p><p>Your quote ' + q.quote_number + ' has been revised (version ' + newVer + '). Please review and let us know if you have any questions.</p><p>View: <a href=\"https://jupiteroneusa.com/quote/' + q.accept_token + '\">https://jupiteroneusa.com/quote/' + q.accept_token + '</a></p><p>Thank you,<br/>Jupiter One USA</p>';",
      "            await transport.sendMail({ from: process.env.ADMIN_EMAIL || 'DTorchia@jupiteroneusa.com', to: q.email, subject: 'Revised Quote ' + q.quote_number + ' (v' + newVer + ')', html: body });",
      "          }",
      "        } catch (mailErr) { console.error('Quote revise email error:', mailErr.message); }",
      "      }",
      "      res.redirect('/admin/quotes/' + qid + '?saved=1&new_version=' + newVer);",
      "    } catch (err) { console.error('Quote edit-save error:', err); res.redirect('/admin/quotes/' + req.params.id + '?error=' + encodeURIComponent(err.message)); }",
      "  });",
      "",
      ""
    ].join('\r\n');

    s = s.slice(0, lineStart) + newHandlers + s.slice(lineStart);
    ok('Added GET /quotes/:id/edit and POST /quotes/:id/edit-save handlers');
  }
}

// Marker
s = '// EDIT_RESEND_V1\r\n' + s;

fs.writeFileSync(f + '.eredit.bak', orig);
fs.writeFileSync(f, s);

const r = compile(f);
if (r !== true) {
  fs.writeFileSync(f, orig);
  errors.push('Syntax error after patch: ' + r);
}

log.forEach(l => console.log(l));
if (errors.length) {
  console.error('\nERRORS:');
  errors.forEach(e => console.error('  ! ' + e));
  process.exit(1);
}
console.log('SUCCESS');
