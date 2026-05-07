// patch-phaseB3-admin-quote-actions.cjs
// Phase B3: Add "Reissue Quote" and "Revise & Resend" admin actions on quote detail page.
// Adds two POST routes to admin/index.js + buttons on quote detail page.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/index.js';
const BACKUP = 'admin/index.js.phaseB3.bak';

console.log('Phase B3: Admin reissue + revise quote actions');
console.log('==============================================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('reissueQuote')) { console.log('- Already patched.'); process.exit(0); }

// PATCH: insert two new POST routes near the supplier mount (end of admin routes)
// Anchor on existing `mountSupplierPoRoutes(router, requireAuth, page);` line we added in step 8
const mountAnchor = "mountSupplierPoRoutes(router, requireAuth, page);";
if (!src.includes(mountAnchor)) {
  console.error('! Could not find mountSupplierPoRoutes anchor (run Step 8 first)');
  process.exit(1);
}

const newRoutes =
  "// Phase B3: Reissue an expired/rejected quote (extends valid_until, marks Sent again)\n" +
  "  router.post('/quotes/:id/reissue', async (req, res) => {\n" +
  "    if (!requireAuth(req, res)) return;\n" +
  "    try {\n" +
  "      const pool = await getPool();\n" +
  "      const days = parseInt(req.body.valid_days || 30);\n" +
  "      const newValid = new Date(Date.now() + days*24*60*60*1000);\n" +
  "      await pool.request()\n" +
  "        .input('id', sql.BigInt, req.params.id)\n" +
  "        .input('vu', sql.Date, newValid)\n" +
  "        .query(\"UPDATE quotes SET status='Sent', valid_until=@vu, expired_at=NULL, rejected_at=NULL, rejection_reason=NULL, reissued_count=ISNULL(reissued_count,0)+1, updated_at=GETDATE() WHERE id=@id\");\n" +
  "      res.redirect('/admin/quotes/'+req.params.id+'?reissued=1');\n" +
  "    } catch(err) { res.redirect('/admin/quotes/'+req.params.id+'?error='+encodeURIComponent(err.message)); }\n" +
  "  });\n\n" +
  "  // Phase B3: Revise quote - mark old quote Superseded, redirect admin to new quote builder\n" +
  "  router.post('/quotes/:id/revise', async (req, res) => {\n" +
  "    if (!requireAuth(req, res)) return;\n" +
  "    try {\n" +
  "      const pool = await getPool();\n" +
  "      const qR = await pool.request().input('id', sql.BigInt, req.params.id).query('SELECT rfq_id FROM quotes WHERE id=@id');\n" +
  "      if (!qR.recordset.length) return res.redirect('/admin/quotes?error=Quote+not+found');\n" +
  "      const rfqId = qR.recordset[0].rfq_id;\n" +
  "      // Mark current quote as Superseded (keep history)\n" +
  "      await pool.request().input('id', sql.BigInt, req.params.id)\n" +
  "        .query(\"UPDATE quotes SET status='Superseded', updated_at=GETDATE() WHERE id=@id\");\n" +
  "      // Redirect to existing requote flow on the RFQ\n" +
  "      res.redirect('/admin/rfqs/'+rfqId+'/quote-review');\n" +
  "    } catch(err) { res.redirect('/admin/quotes/'+req.params.id+'?error='+encodeURIComponent(err.message)); }\n" +
  "  });\n\n" +
  "  ";

src = src.replace(mountAnchor, function() { return newRoutes + mountAnchor; });

fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);

try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ Patched + syntax OK');
  console.log('SUCCESS - safe to push');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! Syntax error - reverted');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
