// patch-rewire-2-quote-accept-handoff.cjs
// Updates routes/quotes.js accept handler so when customer accepts a quote,
// the quote_line_sources rows get copied to order_line_sources rows.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'routes/quotes.js';
const BACKUP = 'routes/quotes.js.rewire2.bak';

console.log('Rewire 2: Quote accept -> order_line_sources handoff');
console.log('====================================================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('order_line_sources')) {
  console.log('- Already patched.');
  process.exit(0);
}

// Anchor: the existing INSERT INTO order_lines query (we'll inject sources copy AFTER each line insert)
const anchor = "INSERT INTO order_lines (order_id,quote_line_id,line_number,nsn,part_number,item_name,condition_code,quantity_ordered,unit_price,line_total)";
if (!src.includes(anchor)) {
  console.error('! Could not find INSERT INTO order_lines anchor');
  process.exit(1);
}

// We need to capture the inserted order_line.id, then copy quote_line_sources to order_line_sources
// Current code: .query(`INSERT INTO order_lines ... VALUES (...)`)
// New code: add OUTPUT INSERTED.id, then loop sources to copy

// Find the full statement we need to replace
const oldStatement = ".query(`INSERT INTO order_lines (order_id,quote_line_id,line_number,nsn,part_number,item_name,condition_code,quantity_ordered,unit_price,line_total)\n            VALUES (@orderId,@qlId,@lineNum,@nsn,@pn,@name,@cond,@qty,@price,@total)`);";

let foundOldStmt = src.includes(oldStatement);
let oldStmtVariant = oldStatement;

if (!foundOldStmt) {
  // Try with \r\n
  const variantCRLF = oldStatement.replace(/\n/g, '\r\n');
  if (src.includes(variantCRLF)) {
    foundOldStmt = true;
    oldStmtVariant = variantCRLF;
  }
}

if (!foundOldStmt) {
  console.error('! Could not find exact INSERT INTO order_lines query - file may have changed');
  process.exit(1);
}

// New statement: capture id, then copy sources
const newStatement = 
".query(`INSERT INTO order_lines (order_id,quote_line_id,line_number,nsn,part_number,item_name,condition_code,quantity_ordered,unit_price,line_total)\n" +
"            OUTPUT INSERTED.id\n" +
"            VALUES (@orderId,@qlId,@lineNum,@nsn,@pn,@name,@cond,@qty,@price,@total)`);\n" +
"        // [Rewire 2] Copy quote_line_sources -> order_line_sources for this order line\n" +
"        try {\n" +
"          const newOrderLineId = olR && olR.recordset && olR.recordset[0] && olR.recordset[0].id;\n" +
"          if (newOrderLineId && l.id) {\n" +
"            const srcR = await pool.request().input('qli', sql.BigInt, l.id)\n" +
"              .query('SELECT * FROM quote_line_sources WHERE quote_line_id=@qli ORDER BY sort_order');\n" +
"            for (const _s of srcR.recordset) {\n" +
"              await pool.request()\n" +
"                .input('oli', sql.BigInt, newOrderLineId)\n" +
"                .input('qlsi', sql.BigInt, _s.id)\n" +
"                .input('sid', sql.BigInt, _s.supplier_id)\n" +
"                .input('aq', sql.Int, _s.allocated_qty)\n" +
"                .input('uc', sql.Decimal(10,2), _s.unit_cost)\n" +
"                .input('ld', sql.Int, _s.supplier_lead_time_days)\n" +
"                .input('h81r', sql.Bit, _s.has_8130 ? 1 : 0)\n" +
"                .input('hcocr', sql.Bit, _s.has_coc ? 1 : 0)\n" +
"                .input('htracr', sql.Bit, _s.has_trace ? 1 : 0)\n" +
"                .input('nt', sql.NVarChar(500), _s.notes)\n" +
"                .input('so', sql.Int, _s.sort_order)\n" +
"                .query('INSERT INTO order_line_sources (order_line_id, quote_line_source_id, supplier_id, allocated_qty, unit_cost, supplier_lead_time_days, has_8130_required, has_coc_required, has_trace_required, notes, sort_order) VALUES (@oli, @qlsi, @sid, @aq, @uc, @ld, @h81r, @hcocr, @htracr, @nt, @so)');\n" +
"            }\n" +
"          }\n" +
"        } catch(srcErr) { console.error('Copy sources error:', srcErr.message); }";

// We also need to capture the result of the INSERT into a variable.
// Find the line "await pool.request()" that precedes our anchor and rewrite
// to "const olR = await pool.request()".
// Looking at the existing code, the line is:
//        await pool.request()
//          .input('orderId', sql.BigInt,        order.id)
//   ...
//          .query(`INSERT INTO order_lines ...`);
//
// We need to change "await pool.request()" to "const olR = await pool.request()"
// for THIS specific call (the one inside the for loop over qLines).

// The for loop contains one specific await pool.request() chain ending in our anchor.
// Find the START of that chain by walking backward from our anchor to find "await pool.request()"
const stmtIdx = src.indexOf(oldStmtVariant);
if (stmtIdx === -1) { console.error('! Could not locate statement'); process.exit(1); }

// Walk back to find "await pool.request()"
const awaitChainStart = src.lastIndexOf('await pool.request()', stmtIdx);
if (awaitChainStart === -1) {
  console.error('! Could not find await pool.request() preceding anchor');
  process.exit(1);
}

// Construct the fully replaced section: from awaitChainStart through end of oldStmtVariant
const oldFullSection = src.substring(awaitChainStart, stmtIdx + oldStmtVariant.length);
const newFullSection = oldFullSection
  .replace('await pool.request()', 'const olR = await pool.request()')
  .replace(oldStmtVariant, newStatement);

src = src.substring(0, awaitChainStart) + newFullSection + src.substring(stmtIdx + oldStmtVariant.length);

console.log('+ Quote accept handler rewired with sources copy');

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
