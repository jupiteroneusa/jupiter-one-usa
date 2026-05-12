// patch-step9-5-supplier-rowclick.cjs
// Adds the missing row-click handler to the /admin/suppliers list page.
// Rows have data-href set but no JS to navigate. This adds the same
// click+hover pattern used on the supplier-POs list.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/index.js';
const BACKUP = TARGET + '.step9-5.bak';

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('SUPPLIER_ROWCLICK_V1')) {
  console.log('- already patched.');
  process.exit(0);
}

// Anchor: the suppliers list closing </div> + page() wrapper + catch block.
// We inject a <script> after the table card closes, before the page() call ends.
const anchor = `        <div class="card">
          <table id="suppliersTable"><thead><tr><th data-sort="0" style="cursor:pointer;user-select:none;">Company &#x25B2;&#x25BC;</th><th data-sort="1" style="cursor:pointer;user-select:none;">Contact &#x25B2;&#x25BC;</th><th>Email</th><th>Phone</th><th data-sort="4" style="cursor:pointer;user-select:none;">Country &#x25B2;&#x25BC;</th><th data-sort="5" style="cursor:pointer;user-select:none;">Status &#x25B2;&#x25BC;</th></tr></thead>
          <tbody>\${rows}</tbody></table>
        </div>\`));`;

const replacement = `        <div class="card">
          <table id="suppliersTable"><thead><tr><th data-sort="0" style="cursor:pointer;user-select:none;">Company &#x25B2;&#x25BC;</th><th data-sort="1" style="cursor:pointer;user-select:none;">Contact &#x25B2;&#x25BC;</th><th>Email</th><th>Phone</th><th data-sort="4" style="cursor:pointer;user-select:none;">Country &#x25B2;&#x25BC;</th><th data-sort="5" style="cursor:pointer;user-select:none;">Status &#x25B2;&#x25BC;</th></tr></thead>
          <tbody>\${rows}</tbody></table>
        </div>
        <script>/* SUPPLIER_ROWCLICK_V1 */(function(){
          document.querySelectorAll("tr[data-supplier-row]").forEach(function(tr){
            tr.addEventListener("click", function(e){
              if (e.target.tagName === "A" || e.target.closest("a")) return;
              if (e.target.tagName === "BUTTON" || e.target.closest("button")) return;
              window.location = tr.getAttribute("data-href");
            });
            tr.addEventListener("mouseenter", function(){ tr.style.background="rgba(200,147,42,0.08)"; });
            tr.addEventListener("mouseleave", function(){ tr.style.background=""; });
          });
          var t = document.getElementById("suppliersTable"); if (!t) return;
          var dirs = {};
          t.querySelectorAll("th[data-sort]").forEach(function(h){
            h.addEventListener("click", function(){
              var col = parseInt(h.getAttribute("data-sort"));
              var dir = dirs[col] = (dirs[col] === "asc" ? "desc" : "asc");
              var tbody = t.querySelector("tbody");
              var rows = Array.from(tbody.querySelectorAll("tr[data-supplier-row]"));
              rows.sort(function(a,b){
                var av = (a.children[col].textContent || "").trim().toLowerCase();
                var bv = (b.children[col].textContent || "").trim().toLowerCase();
                if (av < bv) return dir==="asc"?-1:1;
                if (av > bv) return dir==="asc"?1:-1;
                return 0;
              });
              rows.forEach(function(r){ tbody.appendChild(r); });
            });
          });
        })();</script>\`));`;

if (!src.includes(anchor)) {
  console.error('! suppliers list anchor not found');
  process.exit(1);
}

src = src.replace(anchor, function(){ return replacement; });

fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);
try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ Suppliers list: rows now navigate on click');
  console.log('+ Suppliers list: rows highlight on hover');
  console.log('+ Suppliers list: column sorting wired up');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! syntax error - REVERTED');
  console.error(err.message);
  process.exit(1);
}
