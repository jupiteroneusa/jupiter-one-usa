// patch-quote-sources-v7.cjs
// Same content as v6 but WRITES THE FILE then immediately re-reads it
// and dumps the bytes around the injection point so we can see what's actually there.

const fs = require('fs');
const { execSync } = require('child_process');

const f = 'admin/index.js';
const orig = fs.readFileSync(f, 'utf8');
let s = orig;

if (s.includes('QUOTE_SOURCES_SUBROW_V1')) {
  console.log('- already patched');
  process.exit(0);
}

const linesQueryStr = ".query('SELECT * FROM quote_lines WHERE quote_id=@id ORDER BY line_number');";
const matches = (s.match(/\.query\('SELECT \* FROM quote_lines WHERE quote_id=@id ORDER BY line_number'\);/g) || []).length;
if (matches !== 1) {
  console.error('! lines query not unique. Count: ' + matches);
  process.exit(1);
}

const EOL = '\r\n'; // force CRLF since file is CRLF-dominant

const injectLines = [
  linesQueryStr,
  "      // QUOTE_SOURCES_SUBROW_V1",
  "      const _qSources = await pool.request().input('id2', sql.BigInt, req.params.id).query('SELECT qls.quote_line_id, qls.supplier_id, qls.allocated_qty, qls.unit_cost, qls.supplier_lead_time_days, qls.lead_time_text, qls.has_8130, qls.has_coc, qls.has_trace, s.company_name AS supplier_name FROM quote_line_sources qls INNER JOIN quote_lines ql ON ql.id = qls.quote_line_id LEFT JOIN suppliers s ON s.id = qls.supplier_id WHERE ql.quote_id = @id2 ORDER BY qls.quote_line_id, qls.sort_order');",
  "      const _sourcesByLine = {};",
  "      _qSources.recordset.forEach(function(src) { if (!_sourcesByLine[src.quote_line_id]) _sourcesByLine[src.quote_line_id] = []; _sourcesByLine[src.quote_line_id].push(src); });",
  "      const _renderSourceSubRow = function(srcs) {",
  "        if (!srcs || !srcs.length) { return '<tr><td colspan=\"10\" style=\"padding:6px 12px;background:rgba(200,147,42,0.04);font-size:.72rem;color:#7a8a9a;border-top:none;border-bottom:1px solid #1e2d42;font-style:italic;\">No supplier sourcing on this line</td></tr>'; }",
  "        var html = '';",
  "        html += '<tr><td colspan=\"10\" style=\"padding:0;background:rgba(200,147,42,0.04);border-top:none;border-bottom:1px solid #1e2d42;\">';",
  "        html += '<div style=\"padding:6px 14px;font-size:.65rem;letter-spacing:.12em;color:#c8932a;text-transform:uppercase;\">Sourcing (Internal)</div>';",
  "        html += '<table style=\"width:100%;margin:0;\"><thead><tr style=\"background:transparent;\">';",
  "        html += '<th style=\"font-size:.65rem;padding:4px 12px;color:#7a8a9a;text-align:left;\">Supplier</th>';",
  "        html += '<th style=\"font-size:.65rem;padding:4px 12px;color:#7a8a9a;text-align:left;\">Qty</th>';",
  "        html += '<th style=\"font-size:.65rem;padding:4px 12px;color:#7a8a9a;text-align:left;\">Unit Cost</th>';",
  "        html += '<th style=\"font-size:.65rem;padding:4px 12px;color:#7a8a9a;text-align:left;\">Lead Time</th>';",
  "        html += '<th style=\"font-size:.65rem;padding:4px 12px;color:#7a8a9a;text-align:left;\">Certs</th>';",
  "        html += '</tr></thead><tbody>';",
  "        srcs.forEach(function(src) {",
  "          var leadText = src.lead_time_text || (src.supplier_lead_time_days ? src.supplier_lead_time_days + ' days' : '\\u2014');",
  "          var certs = '';",
  "          if (src.has_8130) certs += '<span style=\"display:inline-block;padding:2px 6px;background:rgba(76,175,80,0.15);color:#4caf50;border-radius:3px;font-size:.65rem;margin-right:3px;\">8130</span>';",
  "          if (src.has_coc) certs += '<span style=\"display:inline-block;padding:2px 6px;background:rgba(76,175,80,0.15);color:#4caf50;border-radius:3px;font-size:.65rem;margin-right:3px;\">CoC</span>';",
  "          if (src.has_trace) certs += '<span style=\"display:inline-block;padding:2px 6px;background:rgba(76,175,80,0.15);color:#4caf50;border-radius:3px;font-size:.65rem;\">Trace</span>';",
  "          if (!certs) certs = '<span style=\"color:#7a8a9a;\">\\u2014</span>';",
  "          html += '<tr style=\"background:transparent;\">';",
  "          html += '<td style=\"padding:4px 12px;font-size:.78rem;color:#eef1f5;\">' + (src.supplier_name || '\\u2014') + '</td>';",
  "          html += '<td style=\"padding:4px 12px;font-size:.78rem;\">' + (src.allocated_qty || 0) + '</td>';",
  "          html += '<td style=\"padding:4px 12px;font-size:.78rem;color:#c8932a;font-weight:600;\">$' + parseFloat(src.unit_cost || 0).toFixed(2) + '</td>';",
  "          html += '<td style=\"padding:4px 12px;font-size:.78rem;color:#7a8a9a;\">' + leadText + '</td>';",
  "          html += '<td style=\"padding:4px 12px;font-size:.78rem;\">' + certs + '</td>';",
  "          html += '</tr>';",
  "        });",
  "        html += '</tbody></table></td></tr>';",
  "        return html;",
  "      };"
];

const inject = injectLines.join(EOL);
console.log('Inject byte length: ' + Buffer.byteLength(inject, 'utf8'));
console.log('First few chars of line 28 (the broken color line):');
console.log('  ' + JSON.stringify(injectLines[27]));

s = s.replace(linesQueryStr, inject);

const unitCostMarker = 'parseFloat(l.unit_cost||0).toFixed(2)';
const ucIdx = s.indexOf(unitCostMarker);
const closeNeedle = "</tr>`).join('');";
const closeIdx = s.indexOf(closeNeedle, ucIdx);
const closeReplacement = "</tr>${_renderSourceSubRow(_sourcesByLine[l.id])}`).join('');";
s = s.substring(0, closeIdx) + closeReplacement + s.substring(closeIdx + closeNeedle.length);

fs.writeFileSync(f + '.qsrc.bak', orig);
fs.writeFileSync(f, s);

// Now re-read and dump the region around the offending line
const written = fs.readFileSync(f, 'utf8');
const writtenLines = written.split(/\r?\n/);

// Find the color:#c8932a; font-weight:600 line
let foundLine = -1;
for (let i = 0; i < writtenLines.length; i++) {
  if (writtenLines[i].includes('color:#c8932a;font-weight:600;">$\'')) {
    foundLine = i;
    break;
  }
}
if (foundLine >= 0) {
  console.log('Found target line at L' + (foundLine+1) + ':');
  console.log('  raw: ' + JSON.stringify(writtenLines[foundLine]));
  console.log('  prev: ' + JSON.stringify(writtenLines[foundLine-1]));
  console.log('  next: ' + JSON.stringify(writtenLines[foundLine+1]));
}

try {
  execSync('node -c "' + f + '"', { stdio: 'pipe' });
  console.log('+ SUCCESS');
} catch (err) {
  console.error('! syntax error:');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  // DON'T revert yet — leave for inspection. Then revert.
  console.log('');
  console.log('Reverting file to original...');
  fs.writeFileSync(f, orig);
  console.log('Reverted.');
  process.exit(1);
}
