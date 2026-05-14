const fs = require('fs');
const s = fs.readFileSync('admin/index.js', 'utf8');
const needle = "      </tr>`).join('');";
let count = 0, idx = 0;
while ((idx = s.indexOf(needle, idx)) !== -1) {
  count++;
  // Find line number
  const before = s.substring(0, idx);
  const ln = before.split('\n').length;
  console.log('Match ' + count + ' at line ' + ln);
  idx += needle.length;
}
console.log('Total: ' + count);

// Also check the unit_cost line to find the quote mapper specifically
const unitCostLine = 'parseFloat(l.unit_cost||0).toFixed(2)';
let cnt2 = 0, idx2 = 0;
while ((idx2 = s.indexOf(unitCostLine, idx2)) !== -1) {
  cnt2++;
  const before = s.substring(0, idx2);
  console.log('unit_cost match ' + cnt2 + ' at line ' + before.split('\n').length);
  idx2 += unitCostLine.length;
}
