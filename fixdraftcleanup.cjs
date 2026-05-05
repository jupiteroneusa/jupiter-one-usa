const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');

// Wrap draft cleanup in try/catch so it doesn't fail the whole route
const old1 = `        // Delete draft if exists
        await pool.request().input('rfqIdDel', sql.BigInt, rfq.id)
          .query("DELETE FROM quote_lines WHERE quote_id IN (SELECT id FROM quotes WHERE rfq_id=@rfqIdDel AND quote_number LIKE '%-D')");
        await pool.request().input('rfqIdDel2', sql.BigInt, rfq.id)
          .query("DELETE FROM quotes WHERE rfq_id=@rfqIdDel2 AND quote_number LIKE '%-D'");`;
const new1 = `        // Delete draft if exists
        try {
          await pool.request().input('rfqIdDel', sql.BigInt, rfq.id)
            .query("DELETE FROM quote_lines WHERE quote_id IN (SELECT id FROM quotes WHERE rfq_id=@rfqIdDel AND quote_number LIKE '%-D')");
          await pool.request().input('rfqIdDel2', sql.BigInt, rfq.id)
            .query("DELETE FROM quotes WHERE rfq_id=@rfqIdDel2 AND quote_number LIKE '%-D'");
        } catch(e) { console.log('Draft cleanup skipped:', e.message); }`;

let count = 0;
while (a.includes(old1)) { a = a.replace(old1, new1); count++; }
console.log('Draft cleanup wrapped:', count, 'times');

const old2 = `        // Delete draft if exists
        await pool.request().input('rfqIdDel3', sql.BigInt, rfq.id)
          .query("DELETE FROM quote_lines WHERE quote_id IN (SELECT id FROM quotes WHERE rfq_id=@rfqIdDel3 AND quote_number LIKE '%-D')");
        await pool.request().input('rfqIdDel4', sql.BigInt, rfq.id)
          .query("DELETE FROM quotes WHERE rfq_id=@rfqIdDel4 AND quote_number LIKE '%-D'");`;
const new2 = `        // Delete draft if exists
        try {
          await pool.request().input('rfqIdDel3', sql.BigInt, rfq.id)
            .query("DELETE FROM quote_lines WHERE quote_id IN (SELECT id FROM quotes WHERE rfq_id=@rfqIdDel3 AND quote_number LIKE '%-D')");
          await pool.request().input('rfqIdDel4', sql.BigInt, rfq.id)
            .query("DELETE FROM quotes WHERE rfq_id=@rfqIdDel4 AND quote_number LIKE '%-D'");
        } catch(e) { console.log('Draft cleanup skipped:', e.message); }`;

let count2 = 0;
while (a.includes(old2)) { a = a.replace(old2, new2); count2++; }
console.log('Draft cleanup 2 wrapped:', count2, 'times');

fs.writeFileSync('admin/index.js', a);
console.log('Done.');
