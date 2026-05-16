// Fix the renderOSrcDropdown "No suppliers match" line that has bad escapes.
const fs = require('fs');
const { execSync } = require('child_process');

const f = 'admin/orderLinesBlock.js';
const orig = fs.readFileSync(f, 'utf8');
const lines = orig.split('\n');

let fixed = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Target: '  if (!matches.length) { dd.innerHTML = "<div style=\"padding:8px;color:#7a8a9a;font-size:.75rem;\">No suppliers match</div>"; ...
  if (line.indexOf('No suppliers match') >= 0) {
    console.log('Found bad line ' + (i+1) + ': ' + line.substring(0, 80) + '...');
    // Replace with single-quoted HTML attrs
    lines[i] = "    '  if (!matches.length) { dd.innerHTML = \"<div style=\\u0027padding:8px;color:#7a8a9a;font-size:.75rem;\\u0027>No suppliers match</div>\"; dd.style.display = \"block\"; return; }',";
    fixed++;
  }
  // Also fix the matches.map line (line 47) that has the same broken pattern
  if (line.indexOf("var name = (sup.company_name") >= 0 && line.indexOf("src-opt") >= 0) {
    console.log('Found map line ' + (i+1));
    lines[i] = "    '  var parts = matches.map(function(sup) { var name = (sup.company_name||\"\").replace(/</g,\"&lt;\").replace(/\\\"/g,\"&quot;\"); return \"<div class=\\u0027src-opt\\u0027 data-id=\\u0027\" + sup.id + \"\\u0027 data-name=\\u0027\" + name + \"\\u0027 style=\\u0027padding:5px 10px;cursor:pointer;font-size:.78rem;color:#eef1f5;border-bottom:1px solid #1e2d42;\\u0027>\" + name + \"</div>\"; });',";
    fixed++;
  }
}

if (!fixed) {
  console.error('! no lines fixed');
  process.exit(1);
}

const out = lines.join('\n');
fs.writeFileSync(f + '.dropfix.bak', orig);
fs.writeFileSync(f, out);

try {
  execSync('node -c "' + f + '"', { stdio: 'pipe' });
  console.log('+ Fixed ' + fixed + ' lines in renderOSrcDropdown');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(f, orig);
  console.error('! syntax - REVERTED');
  console.error(err.stderr.toString());
  process.exit(1);
}
