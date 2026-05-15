// patch-sources-update-handler.cjs
// Add the missing POST /orders/:id/lines/:lineId/sources-update handler.
// Saves per-source edits (qty, cost, lead, certs) AND recomputes the order_line
// unit_cost as weighted average from the updated sources.

const fs = require('fs');
const { execSync } = require('child_process');

const f = 'admin/orderRoutes.js';
const orig = fs.readFileSync(f, 'utf8');
let s = orig;

if (s.includes('SOURCES_UPDATE_HANDLER_V1')) {
  console.log('- already patched');
  process.exit(0);
}

// Find a stable insertion point - just before "router.post('/orders/:id/overview-update'"
const anchor = "router.post('/orders/:id/overview-update'";
const aIdx = s.indexOf(anchor);
if (aIdx < 0) {
  console.error('! anchor not found');
  process.exit(1);
}

const handler = [
  "  // SOURCES_UPDATE_HANDLER_V1: save per-source edits + recompute line cost",
  "  router.post('/orders/:id/lines/:lineId/sources-update', async (req, res) => {",
  "    if (!requireAuth(req, res)) return;",
  "    try {",
  "      const pool = await getPool();",
  "      const b = req.body;",
  "      const orderId = parseInt(req.params.id);",
  "      const lineId = parseInt(req.params.lineId);",
  "      const count = parseInt(b.src_count) || 0;",
  "      if (count === 0) return res.redirect('/admin/orders/' + orderId + '?tab=lines&error=No+sources');",
  "",
  "      let totalQty = 0, totalCost = 0;",
  "      for (let i = 0; i < count; i++) {",
  "        const id = parseInt(b['src_' + i + '_id']);",
  "        const qty = parseInt(b['src_' + i + '_qty']) || 0;",
  "        const cost = parseFloat(b['src_' + i + '_cost']) || 0;",
  "        const lead = b['src_' + i + '_lead'] || null;",
  "        const h8 = b['src_' + i + '_8130'] === 'on' || b['src_' + i + '_8130'] === '1' ? 1 : 0;",
  "        const hc = b['src_' + i + '_coc'] === 'on' || b['src_' + i + '_coc'] === '1' ? 1 : 0;",
  "        const ht = b['src_' + i + '_trace'] === 'on' || b['src_' + i + '_trace'] === '1' ? 1 : 0;",
  "        totalQty += qty;",
  "        totalCost += qty * cost;",
  "",
  "        await pool.request()",
  "          .input('id', sql.BigInt, id)",
  "          .input('qty', sql.Int, qty)",
  "          .input('cost', sql.Decimal(10,2), cost)",
  "          .input('lc', sql.Decimal(12,2), qty * cost)",
  "          .input('lead', sql.NVarChar(sql.MAX), lead)",
  "          .input('h8', sql.Bit, h8)",
  "          .input('hc', sql.Bit, hc)",
  "          .input('ht', sql.Bit, ht)",
  "          .query('UPDATE order_line_sources SET allocated_qty=@qty, unit_cost=@cost, line_cost=@lc, lead_time_text=@lead, has_8130=@h8, has_coc=@hc, has_trace=@ht, updated_at=GETDATE() WHERE id=@id');",
  "      }",
  "",
  "      // Recompute line unit_cost as weighted average (cascades to PO PDF + analytics)",
  "      const newLineUnitCost = totalQty > 0 ? totalCost / totalQty : 0;",
  "      await pool.request()",
  "        .input('id', sql.BigInt, lineId)",
  "        .input('uc', sql.Decimal(10,2), newLineUnitCost)",
  "        .query('UPDATE order_lines SET supplier_cost=@uc WHERE id=@id');",
  "",
  "      res.redirect('/admin/orders/' + orderId + '?tab=lines&saved=Sources+updated');",
  "    } catch (err) {",
  "      console.error('Sources update error:', err);",
  "      res.redirect('/admin/orders/' + req.params.id + '?tab=lines&error=' + encodeURIComponent(err.message));",
  "    }",
  "  });",
  "",
  ""
].join('\r\n');

s = s.slice(0, aIdx) + handler + '  ' + s.slice(aIdx);

fs.writeFileSync(f + '.srcupd.bak', orig);
fs.writeFileSync(f, s);

try {
  execSync('node -c "' + f + '"', { stdio: 'pipe' });
  console.log('+ POST /orders/:id/lines/:lineId/sources-update handler added');
  console.log('+ Saves qty/cost/lead/certs per source');
  console.log('+ Recomputes order line cost as weighted average');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(f, orig);
  console.error('! syntax error - REVERTED');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
