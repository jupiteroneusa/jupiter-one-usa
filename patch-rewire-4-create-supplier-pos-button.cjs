// patch-rewire-4-create-supplier-pos-button.cjs
// Adds "Create Supplier POs" one-click button on order detail page.
// Groups order_line_sources by supplier_id, creates one Draft PO per supplier
// with the right line allocations.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/orderRoutes.js';
const BACKUP = 'admin/orderRoutes.js.rewire4.bak';

console.log('Rewire 4: One-click Create Supplier POs button');
console.log('==============================================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('create-supplier-pos-from-order')) {
  console.log('- Already patched.');
  process.exit(0);
}

// Find the end of the mountOrderRoutes function so we can inject the new POST route inside
// Pattern: function mountOrderRoutes(router, requireAuth, page) { ... }
const fnAnchor = "export function mountOrderRoutes(router, requireAuth, page) {";
if (!src.includes(fnAnchor)) {
  console.error('! Could not find mountOrderRoutes signature');
  process.exit(1);
}

// We'll inject the new route at the END of the function body.
// Find the LAST "});" inside the function (closing of last route handler).
// Walk the function brace-balanced.
const fnStart = src.indexOf(fnAnchor);
const fnBraceStart = src.indexOf('{', fnStart + fnAnchor.length - 1);

let depth = 1;
let i = fnBraceStart + 1;
let inString = null;
let lastCloseRouteIdx = -1;

while (i < src.length && depth > 0) {
  const ch = src[i];
  const next = src[i+1] || '';
  
  if (inString) {
    if (ch === '\\') { i += 2; continue; }
    if (ch === inString) inString = null;
    i++; continue;
  }
  if (ch === "'" || ch === '"' || ch === '`') { inString = ch; i++; continue; }
  if (ch === '{') depth++;
  else if (ch === '}') { 
    depth--;
    if (depth === 0) break;
  }
  i++;
}

if (depth !== 0) {
  console.error('! Could not find end of mountOrderRoutes function');
  process.exit(1);
}

// i is the position of the closing } of the function
// Insert our new route just before it
const newRoute = `
  // [Rewire 4] POST /orders/:id/create-supplier-pos-from-order
  // Groups order_line_sources by supplier_id, creates one Draft PO per supplier.
  router.post('/orders/:id/create-supplier-pos-from-order', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      
      // Load order info
      const oR = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT * FROM orders WHERE id=@id');
      if (!oR.recordset.length) return res.redirect('/admin/orders/' + req.params.id + '?error=Order+not+found');
      const order = oR.recordset[0];
      
      // Load all order_line_sources for this order's lines
      const sourcesR = await pool.request().input('oid', sql.BigInt, req.params.id).query(\`
        SELECT ols.*, ol.line_number AS oline_num, ol.nsn, ol.part_number, ol.item_name, ol.condition_code,
               s.company_name AS supplier_name
        FROM order_line_sources ols
        INNER JOIN order_lines ol ON ol.id = ols.order_line_id
        INNER JOIN suppliers s ON s.id = ols.supplier_id
        WHERE ol.order_id = @oid
          AND ols.supplier_po_line_id IS NULL
        ORDER BY ols.supplier_id, ol.line_number, ols.sort_order
      \`);
      
      if (!sourcesR.recordset.length) {
        return res.redirect('/admin/orders/' + req.params.id + '?error=No+pending+sources+to+PO+(maybe+all+already+PO%27d)');
      }
      
      // Group by supplier_id
      const bySupplier = {};
      sourcesR.recordset.forEach(function(s) {
        if (!bySupplier[s.supplier_id]) bySupplier[s.supplier_id] = [];
        bySupplier[s.supplier_id].push(s);
      });
      
      const supplierIds = Object.keys(bySupplier);
      const created = [];
      
      // Need numbering helper
      const numberingMod = await import('../db/numbering.js');
      const generateNumber = numberingMod.generateNumber;
      
      // Create one PO per supplier
      for (const sid of supplierIds) {
        const lines = bySupplier[sid];
        const supplierName = lines[0].supplier_name;
        
        let subtotal = 0;
        lines.forEach(function(l) { subtotal += parseFloat(l.unit_cost || 0) * (l.allocated_qty || 0); });
        
        const poNumber = await generateNumber('PO');
        const phR = await pool.request()
          .input('oid', sql.BigInt, req.params.id)
          .input('sid', sql.BigInt, sid)
          .input('pn', sql.NVarChar(30), poNumber)
          .input('sub', sql.Decimal(12,2), subtotal)
          .input('tot', sql.Decimal(12,2), subtotal)
          .input('notes', sql.NVarChar(sql.MAX), 'Auto-generated from order ' + order.order_number)
          .query("INSERT INTO supplier_pos (order_id, supplier_id, po_number, status, subtotal, shipping_cost, total, notes) OUTPUT INSERTED.id VALUES (@oid, @sid, @pn, 'Draft', @sub, 0, @tot, @notes)");
        const poId = phR.recordset[0].id;
        
        let lineNum = 1;
        for (const l of lines) {
          const lineTotal = parseFloat(l.unit_cost || 0) * (l.allocated_qty || 0);
          const polR = await pool.request()
            .input('poid', sql.BigInt, poId)
            .input('olid', sql.BigInt, l.order_line_id)
            .input('ln', sql.Int, lineNum++)
            .input('nsn', sql.NVarChar(20), l.nsn)
            .input('pn2', sql.NVarChar(100), l.part_number)
            .input('item', sql.NVarChar(255), l.item_name)
            .input('cond', sql.NVarChar(5), l.condition_code)
            .input('qty', sql.Int, l.allocated_qty)
            .input('cost', sql.Decimal(10,2), l.unit_cost)
            .input('total', sql.Decimal(12,2), lineTotal)
            .input('lead', sql.Int, l.supplier_lead_time_days || null)
            .query('INSERT INTO supplier_po_lines (supplier_po_id, order_line_id, line_number, nsn, part_number, item_name, condition_code, quantity, unit_cost, line_total, expected_lead_time_days) OUTPUT INSERTED.id VALUES (@poid, @olid, @ln, @nsn, @pn2, @item, @cond, @qty, @cost, @total, @lead)');
          
          // Link the order_line_source to the new supplier_po_line
          await pool.request()
            .input('olsId', sql.BigInt, l.id)
            .input('polId', sql.BigInt, polR.recordset[0].id)
            .query('UPDATE order_line_sources SET supplier_po_line_id=@polId, updated_at=GETDATE() WHERE id=@olsId');
        }
        
        created.push({ id: poId, number: poNumber, supplier: supplierName, line_count: lines.length });
      }
      
      const summary = created.map(function(c) { return c.number + ' (' + c.supplier + ', ' + c.line_count + ' lines)'; }).join(', ');
      res.redirect('/admin/orders/' + req.params.id + '?saved=1&pos_created=' + encodeURIComponent(summary));
    } catch(err) {
      console.error('Create supplier POs error:', err);
      res.redirect('/admin/orders/' + req.params.id + '?error=' + encodeURIComponent(err.message));
    }
  });

`;

src = src.substring(0, i) + newRoute + src.substring(i);
console.log('+ POST route added');

// ===========================================================================
// Now also add the BUTTON on the order detail page
// We need to find the order detail GET handler and add a button somewhere prominent.
// Most likely place: top of Lines tab or a dedicated "Actions" section.
//
// Strategy: find the current "Lines tab" rendering in orderRoutes.js where it
// calls renderLinesTab(). Add a button right above the lines table.
// ===========================================================================

const linesAnchor = "html += renderLinesTab(o, oLines, suppliers";
if (src.includes(linesAnchor)) {
  // Inject button just before the renderLinesTab call
  const buttonHtml = 
"// [Rewire 4] One-click Create Supplier POs button\n" +
"        const _pendingSourcesR = await pool.request().input('idCSP', sql.BigInt, req.params.id).query(\"SELECT COUNT(*) AS pending FROM order_line_sources ols INNER JOIN order_lines ol ON ol.id = ols.order_line_id WHERE ol.order_id=@idCSP AND ols.supplier_po_line_id IS NULL\");\n" +
"        const _pending = _pendingSourcesR.recordset[0].pending;\n" +
"        if (_pending > 0) {\n" +
"          html += '<div style=\"background:rgba(200,147,42,0.1);border:1px solid #c8932a;padding:14px 18px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;\">';\n" +
"          html += '<div><div style=\"font-size:.72rem;letter-spacing:.12em;text-transform:uppercase;color:#c8932a;font-weight:700;margin-bottom:4px;\">\\u26A1 Ready for Supplier POs</div>';\n" +
"          html += '<div style=\"color:#cfd5dc;font-size:.85rem;\">' + _pending + ' supplier source(s) on this order have no PO yet. One click creates Draft POs (one per supplier).</div></div>';\n" +
"          html += '<form method=\"POST\" action=\"/admin/orders/' + req.params.id + '/create-supplier-pos-from-order\" style=\"margin:0;\">';\n" +
"          html += '<button type=\"submit\" class=\"btn btn-gold\" onclick=\"return confirm(\\'Create draft Supplier POs grouped by supplier? You can review/edit each before sending.\\')\">+ Create Supplier POs (' + _pending + ')</button>';\n" +
"          html += '</form></div>';\n" +
"        }\n" +
"        ";
  
  src = src.replace(linesAnchor, buttonHtml + linesAnchor);
  console.log('+ Button added on Lines tab');
} else {
  console.log('  (Lines tab anchor not found - POST route added but button must be added manually)');
}

fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);

try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ Patched + syntax OK');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! Syntax error - reverted');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
