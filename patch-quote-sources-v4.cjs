// patch-quote-sources-v4.cjs
// Final attempt: use unit_cost line (unique in file) as anchor.
// Then operate on source text via two targeted string replacements.

const fs = require('fs');
const { execSync } = require('child_process');

const f = 'admin/index.js';
const orig = fs.readFileSync(f, 'utf8');
let s = orig;

if (s.includes('QUOTE_SOURCES_SUBROW_V1')) {
  console.log('- already patched');
  process.exit(0);
}

// =========================================================================
// Step 1: Inject source-load block right after the quote_lines SELECT query.
// The SELECT is uniquely identifiable.
// =========================================================================
const linesQueryStr = ".query('SELECT * FROM quote_lines WHERE quote_id=@id ORDER BY line_number');";

if ((s.match(new RegExp(linesQueryStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length !== 1) {
  console.error('! lines query is not unique. Aborting.');
  process.exit(1);
}

const sourceLoad = linesQueryStr + `
      // QUOTE_SOURCES_SUBROW_V1: load sources for these quote lines (admin only display)
      const _qSources = await pool.request().input('id2', sql.BigInt, req.params.id).query(\`
        SELECT qls.quote_line_id, qls.supplier_id, qls.allocated_qty, qls.unit_cost,
               qls.supplier_lead_time_days, qls.lead_time_text,
               qls.has_8130, qls.has_coc, qls.has_trace,
               s.company_name AS supplier_name
        FROM quote_line_sources qls
        INNER JOIN quote_lines ql ON ql.id = qls.quote_line_id
        LEFT JOIN suppliers s ON s.id = qls.supplier_id
        WHERE ql.quote_id = @id2
        ORDER BY qls.quote_line_id, qls.sort_order
      \`);
      const _sourcesByLine = {};
      _qSources.recordset.forEach(function(src) {
        if (!_sourcesByLine[src.quote_line_id]) _sourcesByLine[src.quote_line_id] = [];
        _sourcesByLine[src.quote_line_id].push(src);
      });
      const _renderSourceSubRow = function(srcs) {
        if (!srcs || !srcs.length) {
          return '<tr><td colspan="10" style="padding:6px 12px;background:rgba(200,147,42,0.04);font-size:.72rem;color:#7a8a9a;border-top:none;border-bottom:1px solid #1e2d42;font-style:italic;">No supplier sourcing on this line</td></tr>';
        }
        let html = '<tr><td colspan="10" style="padding:0;background:rgba(200,147,42,0.04);border-top:none;border-bottom:1px solid #1e2d42;">';
        html += '<div style="padding:6px 14px;font-size:.65rem;letter-spacing:.12em;color:#c8932a;text-transform:uppercase;">Sourcing (Internal)</div>';
        html += '<table style="width:100%;margin:0;"><thead><tr style="background:transparent;">' +
          '<th style="font-size:.65rem;padding:4px 12px;color:#7a8a9a;text-align:left;">Supplier</th>' +
          '<th style="font-size:.65rem;padding:4px 12px;color:#7a8a9a;text-align:left;">Qty</th>' +
          '<th style="font-size:.65rem;padding:4px 12px;color:#7a8a9a;text-align:left;">Unit Cost</th>' +
          '<th style="font-size:.65rem;padding:4px 12px;color:#7a8a9a;text-align:left;">Lead Time</th>' +
          '<th style="font-size:.65rem;padding:4px 12px;color:#7a8a9a;text-align:left;">Certs</th>' +
          '</tr></thead><tbody>';
        srcs.forEach(function(src) {
          const leadText = src.lead_time_text || (src.supplier_lead_time_days ? src.supplier_lead_time_days + ' days' : '\\u2014');
          const certs = [];
          if (src.has_8130) certs.push('<span style="display:inline-block;padding:2px 6px;background:rgba(76,175,80,0.15);color:#4caf50;border-radius:3px;font-size:.65rem;margin-right:3px;">8130</span>');
          if (src.has_coc) certs.push('<span style="display:inline-block;padding:2px 6px;background:rgba(76,175,80,0.15);color:#4caf50;border-radius:3px;font-size:.65rem;margin-right:3px;">CoC</span>');
          if (src.has_trace) certs.push('<span style="display:inline-block;padding:2px 6px;background:rgba(76,175,80,0.15);color:#4caf50;border-radius:3px;font-size:.65rem;">Trace</span>');
          html += '<tr style="background:transparent;">' +
            '<td style="padding:4px 12px;font-size:.78rem;color:#eef1f5;">' + (src.supplier_name || '\\u2014') + '</td>' +
            '<td style="padding:4px 12px;font-size:.78rem;">' + (src.allocated_qty || 0) + '</td>' +
            '<td style="padding:4px 12px;font-size:.78rem;color:#c8932a;font-weight:600;">$' + parseFloat(src.unit_cost || 0).toFixed(2) + '</td>' +
            '<td style="padding:4px 12px;font-size:.78rem;color:#7a8a9a;">' + leadText + '</td>' +
            '<td style="padding:4px 12px;font-size:.78rem;">' + (certs.join('') || '<span style="color:#7a8a9a;">\\u2014</span>') + '</td>' +
            '</tr>';
        });
        html += '</tbody></table></td></tr>';
        return html;
      };`;

s = s.replace(linesQueryStr, sourceLoad);

// =========================================================================
// Step 2: Modify the unique mapper close.
// The unit_cost line is at L1704 (unique). The mapper close `</tr>`).join('')`
// is the NEXT one after unit_cost line. Find via two-step indexOf.
// =========================================================================
const unitCostMarker = 'parseFloat(l.unit_cost||0).toFixed(2)';
const ucIdx = s.indexOf(unitCostMarker);
if (ucIdx < 0) {
  console.error('! unit_cost marker not found post-injection (this should not happen)');
  process.exit(1);
}

const closeNeedle = "</tr>`).join('');";
const closeIdx = s.indexOf(closeNeedle, ucIdx);
if (closeIdx < 0) {
  console.error('! mapper close not found after unit_cost marker');
  process.exit(1);
}

const closeReplacement = "</tr>${_renderSourceSubRow(_sourcesByLine[l.id])}`).join('');";
s = s.substring(0, closeIdx) + closeReplacement + s.substring(closeIdx + closeNeedle.length);

fs.writeFileSync(f + '.qsrc.bak', orig);
fs.writeFileSync(f, s);

try {
  execSync('node -c "' + f + '"', { stdio: 'pipe' });
  console.log('+ Admin quote detail: sources sub-row added under each line');
  console.log('+ Shows supplier / qty / unit cost / lead time / certs (8130, CoC, Trace)');
  console.log('+ Customer-facing quote view untouched');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(f, orig);
  console.error('! syntax error - REVERTED');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
