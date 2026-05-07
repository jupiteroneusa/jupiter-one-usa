// patch-step6e-supplier-list-ux-v4.cjs
// v4: regex with \r? to handle CRLF/LF agnostic matching.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/index.js';
const BACKUP = 'admin/index.js.step6e.bak';

console.log('Step 6e v4: Supplier list UX');
console.log('============================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('data-supplier-row')) { console.log('- Already patched.'); process.exit(0); }

// PATCH 1: row template - regex tolerates CRLF/LF and any whitespace
const rowRegex = /`<tr>\r?\n\s+<td style="font-weight:600;">\$\{s\.name\}<\/td>/;
const newRow1 = '`<tr data-supplier-row data-href="/admin/suppliers/${s.id}" style="cursor:pointer;">\n        <td style="font-weight:600;color:#c8932a;">${s.name}</td>';

if (!rowRegex.test(src)) {
  console.error('! Row regex did NOT match. Showing what we found around the area:');
  const idx = src.indexOf('${s.name}');
  console.error('  Context (60 chars before/after first ${s.name}):');
  console.error(JSON.stringify(src.substring(idx - 60, idx + 60)));
  process.exit(1);
}
src = src.replace(rowRegex, newRow1);
console.log('+ Row template patched');

// PATCH 2: header
const oldHead = '<table><thead><tr><th>Company</th><th>Contact</th><th>Email</th><th>Phone</th><th>Country</th><th>Status</th></tr></thead>';
const newHead = '<table id="suppliersTable"><thead><tr><th data-sort="0" style="cursor:pointer;user-select:none;">Company &#x25B2;&#x25BC;</th><th data-sort="1" style="cursor:pointer;user-select:none;">Contact &#x25B2;&#x25BC;</th><th>Email</th><th>Phone</th><th data-sort="4" style="cursor:pointer;user-select:none;">Country &#x25B2;&#x25BC;</th><th data-sort="5" style="cursor:pointer;user-select:none;">Status &#x25B2;&#x25BC;</th></tr></thead>';

if (!src.includes(oldHead)) {
  console.error('! Header anchor not found');
  process.exit(1);
}
src = src.replace(oldHead, function() { return newHead; });
console.log('+ Header patched');

// PATCH 3: closing tag - regex with CRLF/LF tolerance
const closeRegex = /<\/tbody><\/table>\r?\n\s+<\/div>`\)\);/;
const closeReplacement = '</tbody></table>\n        </div>\n        <script>\n          (function(){\n            document.querySelectorAll(\'tr[data-supplier-row]\').forEach(function(tr){\n              tr.addEventListener(\'click\', function(e){\n                if (e.target.tagName === \'A\' || e.target.closest(\'a\')) return;\n                window.location = tr.getAttribute(\'data-href\');\n              });\n              tr.addEventListener(\'mouseenter\', function(){ tr.style.background=\'rgba(200,147,42,0.08)\'; });\n              tr.addEventListener(\'mouseleave\', function(){ tr.style.background=\'\'; });\n            });\n            var t = document.getElementById(\'suppliersTable\');\n            if (!t) return;\n            var dirs = {};\n            t.querySelectorAll(\'th[data-sort]\').forEach(function(h){\n              h.addEventListener(\'click\', function(){\n                var col = parseInt(h.getAttribute(\'data-sort\'));\n                var dir = dirs[col] = (dirs[col] === \'asc\' ? \'desc\' : \'asc\');\n                var tbody = t.querySelector(\'tbody\');\n                var rows = Array.from(tbody.querySelectorAll(\'tr[data-supplier-row]\'));\n                rows.sort(function(a,b){\n                  var av = (a.children[col].textContent || \'\').trim().toLowerCase();\n                  var bv = (b.children[col].textContent || \'\').trim().toLowerCase();\n                  if (av < bv) return dir===\'asc\'?-1:1;\n                  if (av > bv) return dir===\'asc\'?1:-1;\n                  return 0;\n                });\n                rows.forEach(function(r){ tbody.appendChild(r); });\n              });\n            });\n          })();\n        </script>`));';

if (!closeRegex.test(src)) {
  console.error('! Close regex did not match');
  process.exit(1);
}
src = src.replace(closeRegex, closeReplacement);
console.log('+ Script injected');

fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);

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
