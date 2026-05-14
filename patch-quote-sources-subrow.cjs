// patch-quote-sources-subrow.cjs
// Add sources sub-row under each quote line in admin quote detail page.
// File: admin/index.js, GET /quotes/:id handler around L1676-1770.

const fs = require('fs');
const { execSync } = require('child_process');

const f = 'admin/index.js';
const orig = fs.readFileSync(f, 'utf8');
let s = orig;

if (s.includes('QUOTE_SOURCES_SUBROW_V1')) {
  console.log('- already patched');
  process.exit(0);
}

// 1) Load quote_line_sources after the lines query.
// Anchor: the existing rfqLog query right after the lines query.
const linesQueryAnchor = `const lines = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT * FROM quote_lines WHERE quote_id=@id ORDER BY line_number');`;

const linesWithSources = linesQueryAnchor + `
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
      });`;

if (!s.includes(linesQueryAnchor)) {
  console.error('! lines query anchor not found');
  process.exit(1);
}
s = s.replace(linesQueryAnchor, linesWithSources);

// 2) Modify lineRows mapper to ALSO emit a sub-row after each line row.
const oldMapper = `const lineRows = lines.recordset.map(l => \`<tr>
        <td style="color:#7a8a9a;">\${l.line_number}</td>
        <td class="mono" style="color:#c8932a;">\${l.nsn||l.part_number||'ΓÇö'}</td>
        <td>\${l.item_name||'ΓÇö'}</td>
        <td>\${l.quantity}</td>
        <td style="color:#7a8a9a;">\${l.condition_code||'ΓÇö'}</td>
        <td style="color:#7a8a9a;">\${parseFloat(l.unit_cost||0).toFixed(2)}</td>
        <td style="font-weight:600;">\${parseFloat(l.unit_price||0).toFixed(2)}</td>
        <td style="font-weight:600;">\${parseFloat(l.line_total||0).toFixed(2)}</td>
        <td style="color:#7a8a9a;">\${l.lead_time_text || (l.lead_time_days ? l.lead_time_days+' days' : 'ΓÇö')}</td>
        <td style="color:\${parseFloat(l.margin_pct||0)>=20?'#4caf50':'#e05050'};">\${parseFloat(l.margin_pct||0).toFixed(1)}%</td>
      </tr>\`).join('');`;

const newMapper = `const _renderSourceSubRow = function(srcs) {
        if (!srcs || !srcs.length) {
          return '<tr><td colspan="10" style="padding:6px 12px;background:rgba(200,147,42,0.04);font-size:.72rem;color:#7a8a9a;border-top:none;border-bottom:1px solid #1e2d42;font-style:italic;">No supplier sourcing on this line</td></tr>';
        }
        let html = '<tr><td colspan="10" style="padding:0;background:rgba(200,147,42,0.04);border-top:none;border-bottom:1px solid #1e2d42;">';
        html += '<div style="padding:6px 14px;font-size:.65rem;letter-spacing:.12em;color:#c8932a;text-transform:uppercase;">Sourcing (Internal)</div>';
        html += '<table style="width:100%;margin:0;"><thead><tr style="background:transparent;">' +
          '<th style="font-size:.65rem;padding:4px 12px;color:#7a8a9a;">Supplier</th>' +
          '<th style="font-size:.65rem;padding:4px 12px;color:#7a8a9a;">Qty</th>' +
          '<th style="font-size:.65rem;padding:4px 12px;color:#7a8a9a;">Unit Cost</th>' +
          '<th style="font-size:.65rem;padding:4px 12px;color:#7a8a9a;">Lead Time</th>' +
          '<th style="font-size:.65rem;padding:4px 12px;color:#7a8a9a;">Certs</th>' +
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
      };

      const lineRows = lines.recordset.map(l => \`<tr>
        <td style="color:#7a8a9a;">\${l.line_number}</td>
        <td class="mono" style="color:#c8932a;">\${l.nsn||l.part_number||'ΓÇö'}</td>
        <td>\${l.item_name||'ΓÇö'}</td>
        <td>\${l.quantity}</td>
        <td style="color:#7a8a9a;">\${l.condition_code||'ΓÇö'}</td>
        <td style="color:#7a8a9a;">\${parseFloat(l.unit_cost||0).toFixed(2)}</td>
        <td style="font-weight:600;">\${parseFloat(l.unit_price||0).toFixed(2)}</td>
        <td style="font-weight:600;">\${parseFloat(l.line_total||0).toFixed(2)}</td>
        <td style="color:#7a8a9a;">\${l.lead_time_text || (l.lead_time_days ? l.lead_time_days+' days' : 'ΓÇö')}</td>
        <td style="color:\${parseFloat(l.margin_pct||0)>=20?'#4caf50':'#e05050'};">\${parseFloat(l.margin_pct||0).toFixed(1)}%</td>
      </tr>\${_renderSourceSubRow(_sourcesByLine[l.id])}\`).join('');`;

if (!s.includes(oldMapper)) {
  console.error('! lineRows mapper anchor not found');
  // Dump 5 lines to help diagnose
  const idx = s.indexOf('const lineRows = lines.recordset.map');
  if (idx > 0) {
    console.error('  Found mapper start but exact anchor mismatch. Snippet around it:');
    console.error('  ' + s.substring(idx, idx + 200));
  }
  process.exit(1);
}
s = s.replace(oldMapper, newMapper);

// 3) Add marker so we don't re-patch
s = '// QUOTE_SOURCES_SUBROW_V1\n' + s;

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
