// patch-step6e-supplier-list-ux-v2.cjs
// v2: regex-based to be robust to whitespace/line-ending variations.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/index.js';
const BACKUP = 'admin/index.js.step6e.bak';

console.log('Step 6e v2: Supplier list UX (clickable + sortable)');
console.log('===================================================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('data-supplier-row')) {
  console.log('- Already patched.');
  process.exit(0);
}

// ============================================================================
// PATCH 1: Find the supplier <tr> via regex (matches any whitespace/CRLF/LF)
// Pattern: `<tr>\s+<td style="font-weight:600;"><a href="/admin/suppliers/${s.id}"...
// ============================================================================
const rowRegex = /`<tr>\s+<td style="font-weight:600;"><a href="\/admin\/suppliers\/\$\{s\.id\}" style="color:#c8932a;">\$\{s\.name\}<\/a><\/td>/;

const newRowOpen = '`<tr data-supplier-row data-href="/admin/suppliers/${s.id}" style="cursor:pointer;">\n        <td style="font-weight:600;color:#c8932a;">${s.name}</td>';

if (!rowRegex.test(src)) {
  console.error('! Row pattern not found via regex. Dumping suppliers route excerpt:');
  const idx = src.indexOf("router.get('/suppliers',");
  if (idx > -1) console.error(src.substring(idx, idx + 1200));
  process.exit(1);
}
src = src.replace(rowRegex, newRowOpen);
console.log('+ Row template patched (now clickable)');

// ============================================================================
// PATCH 2: Sortable headers
// Header: <table><thead><tr><th>Company</th><th>Contact</th>...
// ============================================================================
const headerRegex = /<table><thead><tr><th>Company<\/th><th>Contact<\/th><th>Email<\/th><th>Phone<\/th><th>Country<\/th><th>Status<\/th><\/tr><\/thead>/;
const newHeader = '<table id="suppliersTable" class="sortable-table"><thead><tr><th data-sort="0" style="cursor:pointer;user-select:none;">Company &#9650;&#9660;</th><th data-sort="1" style="cursor:pointer;user-select:none;">Contact &#9650;&#9660;</th><th>Email</th><th>Phone</th><th data-sort="4" style="cursor:pointer;user-select:none;">Country &#9650;&#9660;</th><th data-sort="5" style="cursor:pointer;user-select:none;">Status &#9650;&#9660;</th></tr></thead>';

if (!headerRegex.test(src)) {
  console.error('! Header pattern not found');
  process.exit(1);
}
src = src.replace(headerRegex, newHeader);
console.log('+ Header replaced (sortable)');

// ============================================================================
// PATCH 3: Inject script before the closing </div>` of the suppliers route
// We anchor on the exact pattern: </tbody></table>\n        </div>`));
// followed by the catch block.
// ============================================================================
const closingRegex = /<\/tbody><\/table>\s+<\/div>`\)\);(\s+\}\s*catch)/;
const scriptPayload =
  '</tbody></table>\n        </div>\n        <script>\n' +
  '          (function(){\n' +
  '            document.querySelectorAll(\'tr[data-supplier-row]\').forEach(function(tr){\n' +
  '              tr.addEventListener(\'click\', function(e){\n' +
  '                if (e.target.tagName === \'A\' || e.target.closest(\'a\')) return;\n' +
  '                window.location = tr.getAttribute(\'data-href\');\n' +
  '              });\n' +
  '              tr.addEventListener(\'mouseenter\', function(){ tr.style.background=\'rgba(200,147,42,0.08)\'; });\n' +
  '              tr.addEventListener(\'mouseleave\', function(){ tr.style.background=\'\'; });\n' +
  '            });\n' +
  '            var t = document.getElementById(\'suppliersTable\');\n' +
  '            if (!t) return;\n' +
  '            var dirs = {};\n' +
  '            t.querySelectorAll(\'th[data-sort]\').forEach(function(h){\n' +
  '              h.addEventListener(\'click\', function(){\n' +
  '                var col = parseInt(h.getAttribute(\'data-sort\'));\n' +
  '                var dir = dirs[col] = (dirs[col] === \'asc\' ? \'desc\' : \'asc\');\n' +
  '                var tbody = t.querySelector(\'tbody\');\n' +
  '                var rows = Array.from(tbody.querySelectorAll(\'tr[data-supplier-row]\'));\n' +
  '                rows.sort(function(a,b){\n' +
  '                  var av = (a.children[col].textContent || \'\').trim().toLowerCase();\n' +
  '                  var bv = (b.children[col].textContent || \'\').trim().toLowerCase();\n' +
  '                  if (av < bv) return dir===\'asc\'?-1:1;\n' +
  '                  if (av > bv) return dir===\'asc\'?1:-1;\n' +
  '                  return 0;\n' +
  '                });\n' +
  '                rows.forEach(function(r){ tbody.appendChild(r); });\n' +
  '              });\n' +
  '            });\n' +
  '          })();\n' +
  '        </script>`));$1';

if (!closingRegex.test(src)) {
  console.error('! Closing pattern not found');
  process.exit(1);
}
src = src.replace(closingRegex, function(match, p1) { return scriptPayload.replace('$1', p1); });
console.log('+ Script injected');

// ============================================================================
fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);
console.log('+ Backup saved: ' + BACKUP);

try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ Syntax OK');
  console.log('SUCCESS - safe to push');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! Syntax error - REVERTED');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
