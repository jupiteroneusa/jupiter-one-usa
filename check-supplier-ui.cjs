// check-supplier-ui.cjs
const fs = require('fs');
const f = 'admin/supplierRoutes.js';
if (!fs.existsSync(f)) { console.log('not found'); process.exit(1); }
const src = fs.readFileSync(f, 'utf8');
// Just dump the GET /:id and POST /update routes
const lines = src.split('\n');
let inDetail = false, inUpdate = false;
let depth = 0;
for (let i = 0; i < lines.length; i++) {
  const ln = lines[i];
  if (ln.includes("router.get('/suppliers/:id'")) { inDetail = true; depth = 0; console.log('=== GET /suppliers/:id starting at line ' + (i+1) + ' ==='); }
  if (ln.includes("router.post('/suppliers/:id/update'")) { inUpdate = true; depth = 0; console.log('=== POST /suppliers/:id/update starting at line ' + (i+1) + ' ==='); }
  if (inDetail || inUpdate) {
    console.log((i+1) + ': ' + ln);
    for (const c of ln) {
      if (c === '{') depth++;
      if (c === '}') depth--;
    }
    if (depth === 0 && ln.includes('});')) {
      if (inDetail) { inDetail = false; console.log('=== END GET ==='); }
      if (inUpdate) { inUpdate = false; console.log('=== END UPDATE ==='); }
    }
  }
}
