// patch-po-detail-calendar.cjs
// Adds an editable Expected Delivery + Shipping Terms section to the PO detail
// page Overview tab (admin/supplierPoRoutes.js) with a calendar input.
// Also adds shipping_terms to the supplier PO PDF + POST update route.

const fs = require('fs');
const { execSync } = require('child_process');

function compile(file) {
  try { execSync('node -c "' + file + '"', { stdio: 'pipe' }); return true; }
  catch (err) { return err.stderr ? err.stderr.toString() : err.message; }
}

const f = 'admin/supplierPoRoutes.js';
const orig = fs.readFileSync(f, 'utf8');
let s = orig;

if (s.includes('PO_DETAIL_EDIT_V1')) {
  console.log('- already patched');
  process.exit(0);
}

// 1) Replace the read-only Expected Delivery detail-item with an editable form
const oldDetail = `html += '<div class="detail-item"><div class="detail-label">Expected Delivery</div><div class="detail-value">' + shortDate(po.expected_delivery) + '</div></div>`;

const newDetail = `// PO_DETAIL_EDIT_V1: editable expected delivery + shipping terms
        const expDate = po.expected_delivery ? new Date(po.expected_delivery).toISOString().substring(0,10) : '';
        html += '<div class="detail-item" style="grid-column:1/-1;">';
        html += '<form method="POST" action="/admin/supplier-pos/' + po.id + '/po-details" style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;align-items:end;">';
        html += '<div><div class="detail-label">Expected Delivery</div><input type="date" name="expected_delivery" value="' + expDate + '" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:6px 10px;font-size:.85rem;"/></div>';
        html += '<div><div class="detail-label">Shipping Cost ($)</div><input type="number" step="0.01" min="0" name="shipping_cost" value="' + parseFloat(po.shipping_cost || 0).toFixed(2) + '" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:6px 10px;font-size:.85rem;"/></div>';
        html += '<div><div class="detail-label">Shipping Terms</div><input type="text" name="shipping_terms" placeholder="e.g. Pre-Pay and Add Ground" value="' + ((po.shipping_terms || '').toString().replace(/"/g, '&quot;')) + '" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:6px 10px;font-size:.85rem;"/></div>';
        html += '<button type="submit" class="btn btn-gold btn-sm">Save</button>';
        html += '</form></div>`;

if (!s.includes(oldDetail)) {
  console.error('! detail-item anchor not found in supplierPoRoutes.js');
  console.error('  Looking for: ' + oldDetail.substring(0, 100));
  process.exit(1);
}
s = s.replace(oldDetail, newDetail);

// 2) Add POST /supplier-pos/:id/po-details route — find a place to inject
// Look for the end of the file (last closing brace of mountSupplierPoRoutes)
const newRoute = `
  // PO_DETAIL_EDIT_V1: POST /supplier-pos/:id/po-details — update expected delivery + shipping
  router.post('/supplier-pos/:id/po-details', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const b = req.body;
      const shipCost = parseFloat(b.shipping_cost) || 0;
      // Recompute total if subtotal known
      const cur = await pool.request().input('id', sql.BigInt, req.params.id).query('SELECT subtotal FROM supplier_pos WHERE id=@id');
      const sub = parseFloat((cur.recordset[0] && cur.recordset[0].subtotal) || 0);
      const total = sub + shipCost;
      await pool.request()
        .input('id', sql.BigInt, req.params.id)
        .input('exp', sql.Date, b.expected_delivery || null)
        .input('ship', sql.Decimal(12,2), shipCost)
        .input('shipT', sql.NVarChar(255), b.shipping_terms || null)
        .input('tot', sql.Decimal(12,2), total)
        .query('UPDATE supplier_pos SET expected_delivery=@exp, shipping_cost=@ship, shipping_terms=@shipT, total=@tot, updated_at=GETDATE() WHERE id=@id');
      res.redirect('/admin/supplier-pos/' + req.params.id + '?saved=1');
    } catch(err) {
      console.error('PO details update error:', err);
      res.redirect('/admin/supplier-pos/' + req.params.id + '?error=' + encodeURIComponent(err.message));
    }
  });
`;

// Inject before the final closing brace of the exported function
const lastBrace = s.lastIndexOf('\n}');
if (lastBrace < 0) {
  console.error('! could not find function close in supplierPoRoutes.js');
  process.exit(1);
}
s = s.slice(0, lastBrace) + newRoute + s.slice(lastBrace);

fs.writeFileSync(f + '.calendar.bak', orig);
fs.writeFileSync(f, s);

const r = compile(f);
if (r !== true) {
  fs.writeFileSync(f, orig);
  console.error('! syntax error - REVERTED');
  console.error(r);
  process.exit(1);
}

console.log('+ PO detail Overview tab: editable expected delivery (calendar) + shipping cost + shipping terms');
console.log('+ POST /supplier-pos/:id/po-details route added');
console.log('SUCCESS');
