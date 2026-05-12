// patch-step9-5b-supplier-rowclick.cjs
// Replaces patch-step9-5 which silently failed.
// Uses a simpler anchor without template literal characters.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/index.js';
const BACKUP = TARGET + '.step9-5b.bak';

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('SUPPLIER_ROWCLICK_V1')) {
  console.log('- already patched.');
  process.exit(0);
}

// Find the suppliers list closing — anchor on something unique and short.
// Looking for: `        </div>` directly followed by the page() close pattern
// of the /suppliers route. The text right before is `<tbody>${rows}</tbody></table>`
// — we anchor on `id="suppliersTable"` going DOWN to find the close.

const idx = src.indexOf('id="suppliersTable"');
if (idx < 0) {
  console.error('! could not find id="suppliersTable" anchor');
  process.exit(1);
}

// From that point, find the next occurrence of `</table>` then the `</div>` after it,
// then the `\`));` that ends the page() call. We insert our script between </table>'s
// closing </div> and the `\`));`.

const tableClose = src.indexOf('</table>', idx);
if (tableClose < 0) { console.error('! </table> not found after suppliersTable'); process.exit(1); }

const divClose = src.indexOf('</div>', tableClose);
if (divClose < 0) { console.error('! </div> after </table> not found'); process.exit(1); }
const afterDivClose = divClose + '</div>'.length;

// Verify what comes after the </div> looks like the route close
const tail = src.slice(afterDivClose, afterDivClose + 20);
if (!tail.includes('`))')) {
  console.error('! unexpected content after </div>: "' + tail + '"');
  process.exit(1);
}

const scriptToInject = `
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
        })();</script>`;

src = src.slice(0, afterDivClose) + scriptToInject + src.slice(afterDivClose);

fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);

try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! syntax error — REVERTED');
  console.error(err.message);
  process.exit(1);
}

// Re-verify the marker is now present
const verifySrc = fs.readFileSync(TARGET, 'utf8');
if (!verifySrc.includes('SUPPLIER_ROWCLICK_V1')) {
  fs.writeFileSync(TARGET, original);
  console.error('! marker not present after write — REVERTED');
  process.exit(1);
}

console.log('+ Inserted row-click script after suppliers table');
console.log('+ Marker SUPPLIER_ROWCLICK_V1 verified in file');
console.log('SUCCESS');
