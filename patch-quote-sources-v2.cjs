// patch-quote-sources-v2.cjs
// Same goal as v1, but uses line-by-line matching to dodge whitespace mismatches.

const fs = require('fs');
const { execSync } = require('child_process');

const f = 'admin/index.js';
const orig = fs.readFileSync(f, 'utf8');
let s = orig;

if (s.includes('QUOTE_SOURCES_SUBROW_V1')) {
  console.log('- already patched');
  process.exit(0);
}

const lines = s.split('\n');

// Find the GET /quotes/:id handler start
let handlerStart = -1;
for (let i = 0; i < lines.length; i++) {
  if (/router\.get\(['"]\/quotes\/:id['"]/.test(lines[i])) { handlerStart = i; break; }
}
if (handlerStart < 0) {
  console.error('! quote detail handler not found');
  process.exit(1);
}

// Find the lines query within that handler (within ~50 lines)
let linesQueryLineIdx = -1;
for (let i = handlerStart; i < Math.min(handlerStart + 80, lines.length); i++) {
  if (lines[i].includes("'SELECT * FROM quote_lines WHERE quote_id=@id ORDER BY line_number'")) {
    linesQueryLineIdx = i; break;
  }
}
if (linesQueryLineIdx < 0) {
  console.error('! quote_lines query line not found');
  console.error('Lines ' + (handlerStart+1) + ' to ' + (handlerStart+80) + ':');
  for (let i = handlerStart; i < Math.min(handlerStart + 80, lines.length); i++) {
    console.error('  L' + (i+1) + ': ' + lines[i].substring(0, 120));
  }
  process.exit(1);
}

// Find indent of that line
const indent = (lines[linesQueryLineIdx].match(/^(\s*)/) || ['',''])[1].replace(/^ +/, '      ');

// Insert source-loading code right after the lines query
const sourceLoad = [
  '',
  '      // QUOTE_SOURCES_SUBROW_V1: load sources for these quote lines (admin only display)',
  '      const _qSources = await pool.request().input(\'id2\', sql.BigInt, req.params.id).query(`',
  '        SELECT qls.quote_line_id, qls.supplier_id, qls.allocated_qty, qls.unit_cost,',
  '               qls.supplier_lead_time_days, qls.lead_time_text,',
  '               qls.has_8130, qls.has_coc, qls.has_trace,',
  '               s.company_name AS supplier_name',
  '        FROM quote_line_sources qls',
  '        INNER JOIN quote_lines ql ON ql.id = qls.quote_line_id',
  '        LEFT JOIN suppliers s ON s.id = qls.supplier_id',
  '        WHERE ql.quote_id = @id2',
  '        ORDER BY qls.quote_line_id, qls.sort_order',
  '      `);',
  '      const _sourcesByLine = {};',
  '      _qSources.recordset.forEach(function(src) {',
  '        if (!_sourcesByLine[src.quote_line_id]) _sourcesByLine[src.quote_line_id] = [];',
  '        _sourcesByLine[src.quote_line_id].push(src);',
  '      });'
].join('\n');

lines.splice(linesQueryLineIdx + 1, 0, sourceLoad);

// Now find the lineRows mapper
let lineRowsIdx = -1;
for (let i = linesQueryLineIdx + 1; i < lines.length; i++) {
  if (lines[i].includes('const lineRows = lines.recordset.map')) { lineRowsIdx = i; break; }
}
if (lineRowsIdx < 0) {
  console.error('! lineRows mapper not found');
  process.exit(1);
}

// Find the .join('') line that closes the mapper (within ~20 lines after)
let mapperCloseIdx = -1;
for (let i = lineRowsIdx; i < Math.min(lineRowsIdx + 25, lines.length); i++) {
  if (/\}\s*<\/tr>`\)\.join\(/.test(lines[i]) || lines[i].includes("</tr>`).join('')")) {
    mapperCloseIdx = i; break;
  }
}
if (mapperCloseIdx < 0) {
  console.error('! mapper close line not found near L' + (lineRowsIdx+1));
  console.error('Lines from mapper start:');
  for (let i = lineRowsIdx; i < Math.min(lineRowsIdx + 25, lines.length); i++) {
    console.error('  L' + (i+1) + ': ' + lines[i].substring(0, 150));
  }
  process.exit(1);
}

// Insert the renderer helper BEFORE the lineRows declaration
const helperBlock = [
  '      const _renderSourceSubRow = function(srcs) {',
  '        if (!srcs || !srcs.length) {',
  '          return \'<tr><td colspan="10" style="padding:6px 12px;background:rgba(200,147,42,0.04);font-size:.72rem;color:#7a8a9a;border-top:none;border-bottom:1px solid #1e2d42;font-style:italic;">No supplier sourcing on this line</td></tr>\';',
  '        }',
  '        let html = \'<tr><td colspan="10" style="padding:0;background:rgba(200,147,42,0.04);border-top:none;border-bottom:1px solid #1e2d42;">\';',
  '        html += \'<div style="padding:6px 14px;font-size:.65rem;letter-spacing:.12em;color:#c8932a;text-transform:uppercase;">Sourcing (Internal)</div>\';',
  '        html += \'<table style="width:100%;margin:0;"><thead><tr style="background:transparent;">\' +',
  '          \'<th style="font-size:.65rem;padding:4px 12px;color:#7a8a9a;text-align:left;">Supplier</th>\' +',
  '          \'<th style="font-size:.65rem;padding:4px 12px;color:#7a8a9a;text-align:left;">Qty</th>\' +',
  '          \'<th style="font-size:.65rem;padding:4px 12px;color:#7a8a9a;text-align:left;">Unit Cost</th>\' +',
  '          \'<th style="font-size:.65rem;padding:4px 12px;color:#7a8a9a;text-align:left;">Lead Time</th>\' +',
  '          \'<th style="font-size:.65rem;padding:4px 12px;color:#7a8a9a;text-align:left;">Certs</th>\' +',
  '          \'</tr></thead><tbody>\';',
  '        srcs.forEach(function(src) {',
  '          const leadText = src.lead_time_text || (src.supplier_lead_time_days ? src.supplier_lead_time_days + \' days\' : \'\\u2014\');',
  '          const certs = [];',
  '          if (src.has_8130) certs.push(\'<span style="display:inline-block;padding:2px 6px;background:rgba(76,175,80,0.15);color:#4caf50;border-radius:3px;font-size:.65rem;margin-right:3px;">8130</span>\');',
  '          if (src.has_coc) certs.push(\'<span style="display:inline-block;padding:2px 6px;background:rgba(76,175,80,0.15);color:#4caf50;border-radius:3px;font-size:.65rem;margin-right:3px;">CoC</span>\');',
  '          if (src.has_trace) certs.push(\'<span style="display:inline-block;padding:2px 6px;background:rgba(76,175,80,0.15);color:#4caf50;border-radius:3px;font-size:.65rem;">Trace</span>\');',
  '          html += \'<tr style="background:transparent;">\' +',
  '            \'<td style="padding:4px 12px;font-size:.78rem;color:#eef1f5;">\' + (src.supplier_name || \'\\u2014\') + \'</td>\' +',
  '            \'<td style="padding:4px 12px;font-size:.78rem;">\' + (src.allocated_qty || 0) + \'</td>\' +',
  '            \'<td style="padding:4px 12px;font-size:.78rem;color:#c8932a;font-weight:600;">$\' + parseFloat(src.unit_cost || 0).toFixed(2) + \'</td>\' +',
  '            \'<td style="padding:4px 12px;font-size:.78rem;color:#7a8a9a;">\' + leadText + \'</td>\' +',
  '            \'<td style="padding:4px 12px;font-size:.78rem;">\' + (certs.join(\'\') || \'<span style="color:#7a8a9a;">\\u2014</span>\') + \'</td>\' +',
  '            \'</tr>\';',
  '        });',
  '        html += \'</tbody></table></td></tr>\';',
  '        return html;',
  '      };'
].join('\n');

lines.splice(lineRowsIdx, 0, helperBlock);

// Now the mapper close line index has shifted by helperBlock line count (count newlines + 1)
const helperLines = helperBlock.split('\n').length;
mapperCloseIdx += helperLines;

// Append the source subrow injection to the mapper close line.
// The line currently ends like: </tr>`).join('');
// We need to change to: </tr>${_renderSourceSubRow(_sourcesByLine[l.id])}`).join('');
const before = lines[mapperCloseIdx];
const replaced = before.replace(
  "</tr>`).join('')",
  "</tr>${_renderSourceSubRow(_sourcesByLine[l.id])}`).join('')"
);
if (replaced === before) {
  console.error('! could not insert _renderSourceSubRow into mapper close line:');
  console.error('  ' + before);
  process.exit(1);
}
lines[mapperCloseIdx] = replaced;

// Add marker
lines.unshift('// QUOTE_SOURCES_SUBROW_V1');

const out = lines.join('\n');

fs.writeFileSync(f + '.qsrc.bak', orig);
fs.writeFileSync(f, out);

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
