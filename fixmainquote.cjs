const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');
const lines = a.split('\n');

// Line 1280 (0-indexed 1279) - add leadTimeText input
// Line 1283 (0-indexed 1282) - fix INSERT columns
// Line after 1283 - fix VALUES

const leadTimeLine = lines.findIndex((l, i) => i >= 1275 && i <= 1285 && l.includes('.input(\'leadTime\'') && !l.includes('leadTimeText'));
console.log('leadTime line:', leadTimeLine + 1, lines[leadTimeLine]);

if (leadTimeLine > -1) {
  lines.splice(leadTimeLine + 1, 0, "          .input('leadTimeText', sql.NVarChar(100), (l.lead_time_days||l.lead_time_text||'').toString() || null)");
  console.log('leadTimeText input: ADDED');
}

// Fix the INSERT columns line
const insertLine = lines.findIndex((l, i) => i >= 1278 && i <= 1290 && l.includes('quote_id, rfq_line_id') && l.includes('lead_time_days)'));
if (insertLine > -1) {
  lines[insertLine] = lines[insertLine].replace('lead_time_days)', 'lead_time_days, lead_time_text)');
  console.log('INSERT columns: FIXED');
}

// Fix VALUES line
const valuesLine = lines.findIndex((l, i) => i >= insertLine && i <= insertLine + 5 && l.includes('@leadTime)'));
if (valuesLine > -1) {
  lines[valuesLine] = lines[valuesLine].replace('@leadTime)', '@leadTime, @leadTimeText)');
  console.log('VALUES: FIXED');
}

// Also fix line 1483 - display lead_time_text in quote detail
const displayLine = lines.findIndex((l, i) => i >= 1478 && i <= 1490 && l.includes("l.lead_time_days ? l.lead_time_days+' days'"));
if (displayLine > -1) {
  lines[displayLine] = lines[displayLine].replace(
    "l.lead_time_days ? l.lead_time_days+' days' : '\u2014'",
    "l.lead_time_text || (l.lead_time_days ? l.lead_time_days+' days' : '\u2014')"
  );
  console.log('Display: FIXED');
}

fs.writeFileSync('admin/index.js', lines.join('\n'));
console.log('Done.');
