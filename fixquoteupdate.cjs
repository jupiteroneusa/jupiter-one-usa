const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');
const lines = a.split('\n');

// Fix line 1236 (0-indexed 1235) - add status filter to UPDATE WHERE clause
if (lines[1235].includes("WHERE rfq_id=@rfqId") && !lines[1235].includes("status")) {
  lines[1235] = "            WHERE rfq_id=@rfqId AND status<>'Draft' AND quote_number NOT LIKE '%-D'";
  console.log('UPDATE WHERE: FIXED');
} else console.log('UPDATE WHERE: not found or already fixed:', JSON.stringify(lines[1235]));

// Also delete draft after sending - add after line 1242 (console.log)
const consoleLogLine = lines.findIndex((l, i) => i >= 1238 && i <= 1248 && l.includes("console.log('Quote revised:'"));
if (consoleLogLine > -1) {
  lines.splice(consoleLogLine + 1, 0, 
    "        // Delete draft if exists",
    "        await pool.request().input('rfqIdDel', sql.BigInt, rfq.id)",
    "          .query(\"DELETE FROM quote_lines WHERE quote_id IN (SELECT id FROM quotes WHERE rfq_id=@rfqIdDel AND quote_number LIKE '%-D')\");",
    "        await pool.request().input('rfqIdDel2', sql.BigInt, rfq.id)",
    "          .query(\"DELETE FROM quotes WHERE rfq_id=@rfqIdDel2 AND quote_number LIKE '%-D'\");"
  );
  console.log('Draft cleanup after revise: ADDED');
}

// Also add draft cleanup in the INSERT path (else branch) - after quote = qr.recordset[0]
const insertQuoteLine = lines.findIndex((l, i) => i >= 1255 && i <= 1275 && l.includes('quote = qr.recordset[0]'));
if (insertQuoteLine > -1) {
  lines.splice(insertQuoteLine + 1, 0,
    "        // Delete draft if exists",
    "        await pool.request().input('rfqIdDel3', sql.BigInt, rfq.id)",
    "          .query(\"DELETE FROM quote_lines WHERE quote_id IN (SELECT id FROM quotes WHERE rfq_id=@rfqIdDel3 AND quote_number LIKE '%-D')\");",
    "        await pool.request().input('rfqIdDel4', sql.BigInt, rfq.id)",
    "          .query(\"DELETE FROM quotes WHERE rfq_id=@rfqIdDel4 AND quote_number LIKE '%-D'\");"
  );
  console.log('Draft cleanup after insert: ADDED');
}

fs.writeFileSync('admin/index.js', lines.join('\n'));
console.log('Done.');
