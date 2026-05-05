const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');

// 1. In draft save route - store lead_time_text alongside lead_time_days
// Find the INSERT into quote_lines in the draft route (both update and create sections)
const oldInsert = `INSERT INTO quote_lines (quote_id,rfq_line_id,line_number,nsn,part_number,item_name,condition_code,quantity,unit_cost,unit_price,line_total,line_cost,line_margin,markup_pct,margin_pct,lead_time_days) VALUES (@quoteId,@rfqLineId,@lineNum,@nsn,@partNum,@itemName,@condition,@qty,@unitCost,@unitPrice,@lineTotal,@lineCost,@lineMargin,@markupPct,@marginPct,@leadTime)`;
const newInsert = `INSERT INTO quote_lines (quote_id,rfq_line_id,line_number,nsn,part_number,item_name,condition_code,quantity,unit_cost,unit_price,line_total,line_cost,line_margin,markup_pct,margin_pct,lead_time_days,lead_time_text) VALUES (@quoteId,@rfqLineId,@lineNum,@nsn,@partNum,@itemName,@condition,@qty,@unitCost,@unitPrice,@lineTotal,@lineCost,@lineMargin,@markupPct,@marginPct,@leadTime,@leadTimeText)`;

let count = 0;
while (a.includes(oldInsert)) {
  // Find the .input for leadTime and add leadTimeText input before the query
  const insertIdx = a.indexOf(oldInsert);
  const leadTimeInputIdx = a.lastIndexOf('.input(\'leadTime\'', insertIdx);
  const leadTimeLineEnd = a.indexOf('\n', leadTimeInputIdx);
  const leadTimeLine = a.slice(leadTimeInputIdx, leadTimeLineEnd);
  
  // Add leadTimeText input after leadTime input
  const newLeadTimeLine = leadTimeLine + '\n            .input(\'leadTimeText\', sql.NVarChar(100), (l.lead_time_days||l.lead_time_text||\'\')+\'\' || null)';
  a = a.slice(0, leadTimeInputIdx) + newLeadTimeLine + a.slice(leadTimeLineEnd);
  a = a.replace(oldInsert, newInsert);
  count++;
}
console.log('Draft INSERT fixed:', count, 'occurrences');

// 2. In resume route - show lead_time_text instead of lead_time_days
const oldLeadVal = `value="'+(l.lead_time_days||'')+'"`;
const newLeadVal = `value="'+(l.lead_time_text||l.lead_time_days||'')+'"`;
let c2 = 0;
while (a.includes(oldLeadVal)) { a = a.replace(oldLeadVal, newLeadVal); c2++; }
console.log('Lead time display fixed:', c2, 'occurrences');

// 3. Also fix the main quote POST route INSERT to store lead_time_text
const mainOldInsert = `INSERT INTO quote_lines\n              (quote_id, rfq_line_id, line_number, nsn, part_number, item_name, condition_code, quantity, unit_cost, unit_price, line_total, line_cost, line_margin, markup_pct, margin_pct, lead_time_days)`;
const mainNewInsert = `INSERT INTO quote_lines\n              (quote_id, rfq_line_id, line_number, nsn, part_number, item_name, condition_code, quantity, unit_cost, unit_price, line_total, line_cost, line_margin, markup_pct, margin_pct, lead_time_days, lead_time_text)`;
if (a.includes(mainOldInsert)) {
  a = a.replace(mainOldInsert, mainNewInsert);
  // Fix VALUES too
  a = a.replace(
    '@quoteId, @rfqLineId, @lineNum, @nsn, @partNum, @itemName, @condition, @qty, @unitCost, @unitPrice, @lineTotal, @lineCost, @lineMargin, @markupPct, @marginPct, @leadTime)',
    '@quoteId, @rfqLineId, @lineNum, @nsn, @partNum, @itemName, @condition, @qty, @unitCost, @unitPrice, @lineTotal, @lineCost, @lineMargin, @markupPct, @marginPct, @leadTime, @leadTimeText)'
  );
  console.log('Main quote INSERT: FIXED');
}

fs.writeFileSync('admin/index.js', a);
console.log('Done.');
