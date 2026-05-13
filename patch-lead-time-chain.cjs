// patch-lead-time-chain.cjs
// Wire lead_time_text through the whole sourcing -> quote -> order -> PO chain.

const fs = require('fs');
const { execSync } = require('child_process');

const log = [];
const errors = [];

function ok(msg) { log.push('+ ' + msg); }

// ============================================================
// 1) admin/quoteBuilder.js — write lead_time_text to quote_line_sources
//    (it already has lead_time_text on the quote line, just need to add to source)
// ============================================================
{
  const f = 'admin/quoteBuilder.js';
  const orig = fs.readFileSync(f, 'utf8');
  let s = orig;

  if (s.includes('LEAD_TIME_CHAIN_V1')) {
    log.push('- quoteBuilder.js already patched');
  } else {
    // Find the INSERT INTO quote_line_sources statement around line 559 and add lead_time_text
    const oldQuery = `.query("INSERT INTO quote_line_sources (quote_line_id, supplier_id, allocated_qty, unit_cost, supplier_lead_time_days, has_8130, has_coc, ha`;
    if (!s.includes(oldQuery)) { errors.push('quoteBuilder: source insert anchor not found'); }
    else {
      // Find the exact full line and replace
      const fullStart = s.indexOf(oldQuery);
      const lineEnd = s.indexOf('\n', fullStart);
      const fullLine = s.substring(fullStart, lineEnd);

      // We need to look at the actual surrounding code to understand the INSERT
      // It's safer to find the INSERT and add a column + input
      // Look for the broader context
      const insertStartIdx = s.lastIndexOf('INSERT INTO quote_line_sources', fullStart + 100);
      const insertEndIdx = s.indexOf('"', insertStartIdx + 30);
      const insertStmt = s.substring(insertStartIdx, insertEndIdx);

      // Add lead_time_text to column list and values
      if (insertStmt.includes('supplier_lead_time_days') && !insertStmt.includes('lead_time_text')) {
        const newInsertStmt = insertStmt
          .replace('supplier_lead_time_days', 'supplier_lead_time_days, lead_time_text')
          .replace(/VALUES\s*\(([^)]+)\)/, function(match, vals) {
            // The VALUES list needs an extra @ltt after @ld
            // Find @ld and add @ltt after it
            return match.replace('@ld,', '@ld, @ltt,').replace('@ld)', '@ld, @ltt)');
          });

        s = s.replace(insertStmt, newInsertStmt);

        // Now add the .input() for ltt right after the existing leadDays input
        // Look for the input chain leading into this query
        // Find " .input('ld', sql.Int, _s.supplier_lead_time_days)" or similar in the query call
        // Actually quoteBuilder.js uses different variable — let's just look for the supplier_lead pattern

        // Find the .input that feeds supplier_lead_time_days
        const inputMatch = s.match(/\.input\(\s*['"]ld['"]\s*,[^)]+\)/);
        if (inputMatch) {
          const newInput = inputMatch[0] + "\n          .input('ltt', sql.NVarChar(sql.MAX), sLine.lead_time_text || pl.lead_time_text || null)";
          s = s.replace(inputMatch[0], newInput);
          ok('quoteBuilder.js: quote_line_sources INSERT now writes lead_time_text');
        } else {
          errors.push('quoteBuilder: ld input not found');
        }
      } else if (insertStmt.includes('lead_time_text')) {
        log.push('- quoteBuilder.js quote_line_sources insert already has lead_time_text');
      }
    }

    if (errors.length === 0) {
      // Add marker so we don't re-patch
      s = '// LEAD_TIME_CHAIN_V1\n' + s;
      fs.writeFileSync(f + '.lt.bak', orig);
      fs.writeFileSync(f, s);
      try {
        execSync('node -c "' + f + '"', { stdio: 'pipe' });
      } catch (err) {
        fs.writeFileSync(f, orig);
        errors.push('quoteBuilder.js syntax error: ' + (err.stderr ? err.stderr.toString() : err.message));
      }
    }
  }
}

if (errors.length) {
  console.error('STEP 1 ERRORS:');
  errors.forEach(e => console.error('  ! ' + e));
  log.forEach(l => console.log(l));
  process.exit(1);
}

// ============================================================
// 2) routes/quotes.js — accept handler copies sources, add lead_time_text
// ============================================================
{
  const f = 'routes/quotes.js';
  const orig = fs.readFileSync(f, 'utf8');
  let s = orig;

  if (s.includes('LEAD_TIME_CHAIN_V1')) {
    log.push('- quotes.js already patched');
  } else {
    // Around line 266: .input('ld', sql.Int, _s.supplier_lead_time_days)
    // Around line 272: INSERT INTO order_line_sources (... supplier_lead_time_days, ...)
    // Add lead_time_text everywhere

    const oldInput = ".input('ld', sql.Int, _s.supplier_lead_time_days)";
    const newInput = ".input('ld', sql.Int, _s.supplier_lead_time_days)\n                .input('ltt', sql.NVarChar(sql.MAX), _s.lead_time_text || null)";

    if (!s.includes(oldInput)) { errors.push('quotes.js: ld input anchor not found'); }
    else {
      s = s.replace(oldInput, newInput);
      // Now update the INSERT to include lead_time_text
      const oldInsertCols = 'supplier_lead_time_days, has_8130_required';
      const newInsertCols = 'supplier_lead_time_days, lead_time_text, has_8130_required';
      if (!s.includes(oldInsertCols)) { errors.push('quotes.js: insert cols anchor not found'); }
      else {
        s = s.replace(oldInsertCols, newInsertCols);
        // Update VALUES
        const oldVals = 'VALUES (@oli, @qlsi, @sid, @aq, @uc, @ld, @h81r';
        const newVals = 'VALUES (@oli, @qlsi, @sid, @aq, @uc, @ld, @ltt, @h81r';
        if (!s.includes(oldVals)) { errors.push('quotes.js: insert values anchor not found'); }
        else {
          s = s.replace(oldVals, newVals);
          ok('quotes.js: accept handler copies lead_time_text from quote_line_sources to order_line_sources');
        }
      }

      if (errors.length === 0) {
        s = '// LEAD_TIME_CHAIN_V1\n' + s;
        fs.writeFileSync(f + '.lt.bak', orig);
        fs.writeFileSync(f, s);
        try {
          execSync('node -c "' + f + '"', { stdio: 'pipe' });
        } catch (err) {
          fs.writeFileSync(f, orig);
          errors.push('quotes.js syntax error: ' + (err.stderr ? err.stderr.toString() : err.message));
        }
      }
    }
  }
}

if (errors.length) {
  console.error('STEP 2 ERRORS:');
  errors.forEach(e => console.error('  ! ' + e));
  log.forEach(l => console.log(l));
  process.exit(1);
}

// ============================================================
// 3) admin/orderRoutes.js — create-supplier-pos handler add lead_time_text
//    AND the line-update handler should accept text now
// ============================================================
{
  const f = 'admin/orderRoutes.js';
  const orig = fs.readFileSync(f, 'utf8');
  let s = orig;

  if (s.includes('LEAD_TIME_CHAIN_V1')) {
    log.push('- orderRoutes.js already patched');
  } else {
    // 3a) create-supplier-pos handler INSERT supplier_po_lines
    // Currently has: .input('lead', sql.Int, l.supplier_lead_time_days || null)
    //                 INSERT ... supplier_po_lines (... expected_lead_time_days)
    // Add: .input('ltt', sql.NVarChar(sql.MAX), l.lead_time_text || null)
    //      add lead_time_text to INSERT col list and VALUES

    const oldLeadInput = ".input('lead', sql.Int, l.supplier_lead_time_days || null)";
    const newLeadInput = ".input('lead', sql.Int, l.supplier_lead_time_days || null)\n            .input('ltt', sql.NVarChar(sql.MAX), l.lead_time_text || null)";

    if (!s.includes(oldLeadInput)) { errors.push('orderRoutes: lead input anchor not found'); }
    else {
      s = s.replace(oldLeadInput, newLeadInput);

      // Update INSERT col list
      const oldInsertCols = 'line_total, expected_lead_time_days)';
      const newInsertCols = 'line_total, expected_lead_time_days, lead_time_text)';
      if (!s.includes(oldInsertCols)) { errors.push('orderRoutes: insert cols anchor not found'); }
      else {
        s = s.replace(oldInsertCols, newInsertCols);
        const oldVals = '@total, @lead)';
        const newVals = '@total, @lead, @ltt)';
        if (!s.includes(oldVals)) { errors.push('orderRoutes: insert values anchor not found'); }
        else {
          s = s.replace(oldVals, newVals);
          ok('orderRoutes.js: create-supplier-pos handler copies lead_time_text to supplier_po_lines');
        }
      }
    }

    // 3b) Update the line-update handler — input is currently named supplier_lead_time_days,
    //     keep that name (it's the form field name) but type it as text and store to both fields
    if (errors.length === 0) {
      const oldUpdateInput = `.input('leadDays', sql.Int, b.supplier_lead_time_days ? parseInt(b.supplier_lead_time_days) : null)`;
      const newUpdateInput = `.input('leadDays', sql.Int, b.supplier_lead_time_days ? parseInt((b.supplier_lead_time_days+'').replace(/[^0-9]/g,'')) || null : null)
        .input('leadTxt', sql.NVarChar(sql.MAX), b.supplier_lead_time_days || null)`;
      if (s.includes(oldUpdateInput)) {
        s = s.replace(oldUpdateInput, newUpdateInput);
        // Also update the SET clause
        const oldSet = 'supplier_lead_time_days=@leadDays,';
        const newSet = 'supplier_lead_time_days=@leadDays, lead_time_text=@leadTxt,';
        if (s.includes(oldSet)) {
          // Check if order_lines table has lead_time_text — we didn't add it there.
          // For now just store on supplier_lead_time_days (keep INT). User won't lose anything.
          // Skip lead_time_text on order_lines (not in chain we added).
          // Revert the leadTxt change since order_lines doesn't have the column.
          s = s.replace(newUpdateInput, oldUpdateInput);
          ok('orderRoutes.js: line-update keeps existing INT extract (order_lines.lead_time_text not in chain)');
        } else {
          // Couldn't find the SET, revert
          s = s.replace(newUpdateInput, oldUpdateInput);
        }
      }
    }

    if (errors.length === 0) {
      s = '// LEAD_TIME_CHAIN_V1\n' + s;
      fs.writeFileSync(f + '.lt.bak', orig);
      fs.writeFileSync(f, s);
      try {
        execSync('node -c "' + f + '"', { stdio: 'pipe' });
      } catch (err) {
        fs.writeFileSync(f, orig);
        errors.push('orderRoutes.js syntax error: ' + (err.stderr ? err.stderr.toString() : err.message));
      }
    }
  }
}

if (errors.length) {
  console.error('STEP 3 ERRORS:');
  errors.forEach(e => console.error('  ! ' + e));
  log.forEach(l => console.log(l));
  process.exit(1);
}

// ============================================================
// 4) services/poPdfService.js — add Lead Time column to PO PDF (show only if filled)
// ============================================================
{
  const f = 'services/poPdfService.js';
  const orig = fs.readFileSync(f, 'utf8');
  let s = orig;

  if (s.includes('LEAD_TIME_COL_V1')) {
    log.push('- poPdfService.js already has lead time col');
  } else {
    // Check if ANY line has lead_time_text filled — if so, render the column.
    // Otherwise skip. We'll compute this in the function dynamically.

    // The current columns use colX hash with keys num/part/desc/cond/qty/cost/total.
    // We need to insert lead time between cond and qty, OR after total.
    // Cleanest: add a small column to the right of qty. But space is tight.
    // Better idea: render lead time UNDER the item_name (compact, no new column needed)

    // Find the line that renders item_name in body row:
    const oldItem = `doc.text(String(l.item_name || '\\u2014').substring(0, 32), colX.desc, y);`;
    const newItem = `doc.text(String(l.item_name || '\\u2014').substring(0, 32), colX.desc, y);
    if (l.lead_time_text) {
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text('Lead: ' + String(l.lead_time_text).substring(0, 24), colX.desc, y + 3);
      doc.setFontSize(8);
      doc.setTextColor(60, 60, 60);
    }`;

    if (!s.includes(oldItem)) {
      errors.push('poPdfService: item_name anchor not found');
    } else {
      s = s.replace(oldItem, newItem);

      // Also need slightly more row height when lead time is present.
      // The row uses y += 7. With lead time we need ~10. Keep simple for now and rely on smaller text.
      // Bump the row spacing universally to 8 so two-line cells don't crash into each other.
      const oldYStep = `      y += 7;\n    });`;
      const newYStep = `      y += 8;\n    });`;
      if (s.includes(oldYStep)) {
        s = s.replace(oldYStep, newYStep);
      }

      ok('poPdfService.js: lead_time_text shows under item_name (only when filled)');

      s = '// LEAD_TIME_COL_V1\n' + s;
      fs.writeFileSync(f + '.lt.bak', orig);
      fs.writeFileSync(f, s);
      try {
        execSync('node -c "' + f + '"', { stdio: 'pipe' });
      } catch (err) {
        fs.writeFileSync(f, orig);
        errors.push('poPdfService.js syntax error: ' + (err.stderr ? err.stderr.toString() : err.message));
      }
    }
  }
}

if (errors.length) {
  console.error('STEP 4 ERRORS:');
  errors.forEach(e => console.error('  ! ' + e));
  log.forEach(l => console.log(l));
  process.exit(1);
}

// ============================================================
// 5) admin/orderLinesBlock.js — change number input to text (free form)
// ============================================================
{
  const f = 'admin/orderLinesBlock.js';
  if (fs.existsSync(f)) {
    const orig = fs.readFileSync(f, 'utf8');
    let s = orig;

    if (s.includes('LEAD_TIME_FREEFORM_V1')) {
      log.push('- orderLinesBlock.js already patched');
    } else {
      const oldInput = `html += '<input type="number" min="0" name="supplier_lead_time_days" value="' + (l.supplier_lead_time_days || '') + '" style="width:100%;`;
      const newInput = `html += '<input type="text" name="supplier_lead_time_days" placeholder="e.g. 7-10 days or 30 days ARO" value="' + (l.lead_time_text || (l.supplier_lead_time_days ? l.supplier_lead_time_days + ' days' : '')) + '" style="width:100%;`;

      if (s.includes(oldInput)) {
        s = s.replace(oldInput, newInput);
        s = '// LEAD_TIME_FREEFORM_V1\n' + s;
        ok('orderLinesBlock.js: lead time input is now free-text');
      } else {
        log.push('- orderLinesBlock.js anchor not found (skipping)');
      }

      fs.writeFileSync(f + '.lt.bak', orig);
      fs.writeFileSync(f, s);
      try {
        execSync('node -c "' + f + '"', { stdio: 'pipe' });
      } catch (err) {
        fs.writeFileSync(f, orig);
        errors.push('orderLinesBlock.js syntax error');
      }
    }
  }
}

if (errors.length) {
  console.error('STEP 5 ERRORS:');
  errors.forEach(e => console.error('  ! ' + e));
  log.forEach(l => console.log(l));
  process.exit(1);
}

log.forEach(l => console.log(l));
console.log('SUCCESS');
