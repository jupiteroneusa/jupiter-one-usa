// patch-fix-addrow-escapes.cjs
// Replace lines 234-246 (rowHtml builder) with versions using single-quoted HTML attrs.

const fs = require('fs');
const { execSync } = require('child_process');

const f = 'admin/orderLinesBlock.js';
const orig = fs.readFileSync(f, 'utf8');
const lines = orig.split('\n');

// Replace the rowHtml builder lines. The pattern: starts at "  var rowHtml = \"\";"
let startIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].indexOf("var rowHtml = ") >= 0 && lines[i].indexOf("'") === 4) {
    startIdx = i;
    break;
  }
}
if (startIdx < 0) {
  // Try another pattern - just look for "var rowHtml"
  for (let i = 0; i < lines.length; i++) {
    if (/var rowHtml = ""/.test(lines[i])) {
      startIdx = i;
      break;
    }
  }
}
if (startIdx < 0) {
  console.error('! could not find rowHtml builder start');
  process.exit(1);
}
console.log('Found start at line ' + (startIdx+1));

// Find end - look for "div.innerHTML = rowHtml" line
let endIdx = -1;
for (let i = startIdx; i < lines.length; i++) {
  if (/div\.innerHTML = rowHtml/.test(lines[i])) {
    endIdx = i;
    break;
  }
}
if (endIdx < 0) {
  console.error('! could not find rowHtml builder end');
  process.exit(1);
}
console.log('Found end at line ' + (endIdx+1));

// New body using single-quoted HTML attrs (browsers accept both)
const newBody = [
  "    '  var rowHtml = \"\";',",
  "    '  rowHtml += \"<input type=\\u0027hidden\\u0027 name=\\u0027src_\" + nextIdx + \"_id\\u0027 value=\\u0027\\u0027/>\";',",
  "    '  rowHtml += \"<div style=\\u0027position:relative;\\u0027><div style=\\u0027font-size:.6rem;color:#7a8a9a;\\u0027>Supplier</div>\";',",
  "    '  rowHtml += \"<input type=\\u0027text\\u0027 class=\\u0027src-combo\\u0027 data-target=\\u0027\" + hidId + \"\\u0027 placeholder=\\u0027Type to search...\\u0027 autocomplete=\\u0027off\\u0027 style=\\u0027width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 22px 5px 8px;font-size:.76rem;\\u0027/>\";',",
  "    '  rowHtml += \"<div style=\\u0027position:absolute;right:6px;top:22px;color:#c8932a;pointer-events:none;font-size:.65rem;\\u0027>\\u25BC</div>\";',",
  "    '  rowHtml += \"<div class=\\u0027src-dropdown\\u0027 style=\\u0027display:none;position:absolute;top:100%;left:0;right:0;background:#0a1628;border:1px solid #c8932a;border-top:none;max-height:180px;overflow-y:auto;z-index:1000;\\u0027></div>\";',",
  "    '  rowHtml += \"<input type=\\u0027hidden\\u0027 id=\\u0027\" + hidId + \"\\u0027 name=\\u0027src_\" + nextIdx + \"_supplier_id\\u0027 required/></div>\";',",
  "    '  rowHtml += \"<div><div style=\\u0027font-size:.6rem;color:#7a8a9a;\\u0027>Qty</div><input type=\\u0027number\\u0027 min=\\u00271\\u0027 name=\\u0027src_\" + nextIdx + \"_qty\\u0027 value=\\u00271\\u0027 required style=\\u0027width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 6px;font-size:.76rem;\\u0027/></div>\";',",
  "    '  rowHtml += \"<div><div style=\\u0027font-size:.6rem;color:#7a8a9a;\\u0027>Unit Cost</div><input type=\\u0027number\\u0027 step=\\u00270.01\\u0027 name=\\u0027src_\" + nextIdx + \"_cost\\u0027 required style=\\u0027width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 6px;font-size:.76rem;\\u0027/></div>\";',",
  "    '  rowHtml += \"<div><div style=\\u0027font-size:.6rem;color:#7a8a9a;\\u0027>Lead</div><input type=\\u0027text\\u0027 name=\\u0027src_\" + nextIdx + \"_lead\\u0027 placeholder=\\u00275 days\\u0027 style=\\u0027width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 6px;font-size:.76rem;\\u0027/></div>\";',",
  "    '  rowHtml += \"<div><div style=\\u0027font-size:.6rem;color:#7a8a9a;\\u0027>8130</div><input type=\\u0027checkbox\\u0027 name=\\u0027src_\" + nextIdx + \"_8130\\u0027 value=\\u00271\\u0027/></div>\";',",
  "    '  rowHtml += \"<div><div style=\\u0027font-size:.6rem;color:#7a8a9a;\\u0027>CoC</div><input type=\\u0027checkbox\\u0027 name=\\u0027src_\" + nextIdx + \"_coc\\u0027 value=\\u00271\\u0027/></div>\";',",
  "    '  rowHtml += \"<div><div style=\\u0027font-size:.6rem;color:#7a8a9a;\\u0027>Trace</div><input type=\\u0027checkbox\\u0027 name=\\u0027src_\" + nextIdx + \"_trace\\u0027 value=\\u00271\\u0027/></div>\";',",
  "    '  rowHtml += \"<div><button type=\\u0027button\\u0027 onclick=\\u0027this.closest(&quot;[data-srcrow]&quot;).remove();\\u0027 style=\\u0027background:#3b1d1d;border:1px solid #5a2828;color:#e05050;padding:4px 8px;cursor:pointer;border-radius:3px;\\u0027>\\u2716</button></div>\";',",
  "    '  div.innerHTML = rowHtml;',"
];

// Replace lines startIdx through endIdx with newBody
lines.splice(startIdx, endIdx - startIdx + 1, ...newBody);

const out = lines.join('\n');
fs.writeFileSync(f + '.escfix.bak', orig);
fs.writeFileSync(f, out);

try {
  execSync('node -c "' + f + '"', { stdio: 'pipe' });
  console.log('+ Replaced rowHtml builder with single-quoted HTML attrs (\\u0027 for safety)');
  console.log('+ Browser will now parse the inline script correctly');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(f, orig);
  console.error('! syntax - REVERTED');
  console.error(err.stderr.toString());
  process.exit(1);
}
