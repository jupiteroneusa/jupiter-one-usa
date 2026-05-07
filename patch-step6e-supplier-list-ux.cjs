// patch-step6e-supplier-list-ux.cjs
// Make supplier list rows fully clickable, add sortable column headers.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/index.js';
const BACKUP = 'admin/index.js.step6e.bak';

console.log('Step 6e: Supplier list UX (clickable rows + sortable headers)');
console.log('=============================================================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('data-supplier-row')) {
  console.log('- Already patched.');
  process.exit(0);
}

// PATCH 1: Replace the row template - make whole <tr> clickable
const oldRow = "const rows = result.recordset.map(s => `<tr>\r\n        <td style=\"font-weight:600;\"><a href=\"/admin/suppliers/${s.id}\" style=\"color:#c8932a;\">${s.name}</a></td>\r\n        <td style=\"color:#7a8a9a;\">${s.contact_name||'\u2014'}</td>\r\n        <td style=\"color:#7a8a9a;font-size:.8rem;\">${s.email||'\u2014'}</td>\r\n        <td style=\"color:#7a8a9a;\">${s.phone||'\u2014'}</td>\r\n        <td style=\"color:#7a8a9a;\">${s.country||'\u2014'}</td>\r\n        <td>${statusBadge(s.status)}</td>\r\n      </tr>`).join('')";

const newRow = "const rows = result.recordset.map(s => `<tr data-supplier-row data-href=\"/admin/suppliers/${s.id}\" style=\"cursor:pointer;\">\r\n        <td style=\"font-weight:600;color:#c8932a;\">${s.name}</td>\r\n        <td style=\"color:#7a8a9a;\">${s.contact_name||'\u2014'}</td>\r\n        <td style=\"color:#7a8a9a;font-size:.8rem;\">${s.email||'\u2014'}</td>\r\n        <td style=\"color:#7a8a9a;\">${s.phone||'\u2014'}</td>\r\n        <td style=\"color:#7a8a9a;\">${s.country||'\u2014'}</td>\r\n        <td>${statusBadge(s.status)}</td>\r\n      </tr>`).join('')";

// Try with \r\n first
let row1Done = false;
if (src.includes(oldRow)) {
  src = src.replace(oldRow, function() { return newRow; });
  console.log('+ Replaced row template (CRLF)');
  row1Done = true;
} else {
  // Try with \n only as fallback
  const oldRowLF = oldRow.replace(/\r\n/g, '\n');
  const newRowLF = newRow.replace(/\r\n/g, '\n');
  if (src.includes(oldRowLF)) {
    src = src.replace(oldRowLF, function() { return newRowLF; });
    console.log('+ Replaced row template (LF)');
    row1Done = true;
  }
}

if (!row1Done) {
  console.error('! Could not find supplier row template to make clickable');
  console.error('  Looking for the <tr> with ${s.name} in suppliers route');
  process.exit(1);
}

// PATCH 2: Add sortable headers + JS click handler
const oldTHead = "<table><thead><tr><th>Company</th><th>Contact</th><th>Email</th><th>Phone</th><th>Country</th><th>Status</th></tr></thead>";
const newTHead = "<table id=\"suppliersTable\" class=\"sortable-table\"><thead><tr><th data-sort=\"company\" style=\"cursor:pointer;\">Company &uarr;&darr;</th><th data-sort=\"contact\" style=\"cursor:pointer;\">Contact &uarr;&darr;</th><th>Email</th><th>Phone</th><th data-sort=\"country\" style=\"cursor:pointer;\">Country &uarr;&darr;</th><th data-sort=\"status\" style=\"cursor:pointer;\">Status &uarr;&darr;</th></tr></thead>";

if (!src.includes(oldTHead)) {
  console.error('! Could not find supplier table header to make sortable');
  process.exit(1);
}
src = src.replace(oldTHead, function() { return newTHead; });
console.log('+ Replaced table header');

// PATCH 3: Add the JS for row clicks + sortable behavior at end of suppliers route response HTML
// Insert script tag right before the closing </div> of card
const oldClose = "</tbody></table>\r\n        </div>`));";
const newClose = "</tbody></table>\r\n        </div>\r\n        <script>\r\n          (function(){\r\n            // Row click navigation\r\n            document.querySelectorAll('tr[data-supplier-row]').forEach(function(tr){\r\n              tr.addEventListener('click', function(e){\r\n                if (e.target.tagName === 'A' || e.target.closest('a')) return;\r\n                window.location = tr.getAttribute('data-href');\r\n              });\r\n              tr.addEventListener('mouseenter', function(){ tr.style.background='rgba(200,147,42,0.08)'; });\r\n              tr.addEventListener('mouseleave', function(){ tr.style.background=''; });\r\n            });\r\n            // Header sorting\r\n            var table = document.getElementById('suppliersTable');\r\n            if (!table) return;\r\n            var headers = table.querySelectorAll('th[data-sort]');\r\n            var sortDir = {};\r\n            headers.forEach(function(h, idx){\r\n              h.addEventListener('click', function(){\r\n                var key = h.getAttribute('data-sort');\r\n                var dir = sortDir[key] = (sortDir[key] === 'asc' ? 'desc' : 'asc');\r\n                var tbody = table.querySelector('tbody');\r\n                var rows = Array.from(tbody.querySelectorAll('tr[data-supplier-row]'));\r\n                rows.sort(function(a,b){\r\n                  var av = (a.children[idx].textContent || '').trim().toLowerCase();\r\n                  var bv = (b.children[idx].textContent || '').trim().toLowerCase();\r\n                  if (av < bv) return dir==='asc'?-1:1;\r\n                  if (av > bv) return dir==='asc'?1:-1;\r\n                  return 0;\r\n                });\r\n                rows.forEach(function(r){ tbody.appendChild(r); });\r\n              });\r\n            });\r\n          })();\r\n        </script>`));";

if (src.includes(oldClose)) {
  src = src.replace(oldClose, function() { return newClose; });
  console.log('+ Added sort + click JS (CRLF)');
} else {
  const oldCloseLF = oldClose.replace(/\r\n/g, '\n');
  const newCloseLF = newClose.replace(/\r\n/g, '\n');
  if (src.includes(oldCloseLF)) {
    src = src.replace(oldCloseLF, function() { return newCloseLF; });
    console.log('+ Added sort + click JS (LF)');
  } else {
    console.error('! Could not find closing tags to inject script');
    process.exit(1);
  }
}

fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);
console.log('+ Backup saved: ' + BACKUP);

try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ Syntax OK');
  console.log('SUCCESS - safe to push');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! Syntax error - reverted');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
