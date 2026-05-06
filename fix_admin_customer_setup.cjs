/**
 * fix_admin_customer_setup.cjs
 * Jupiter One USA — Fix Script
 *
 * Fixes:
 *   1. Admin customer LIST — add "Never Logged In" badge + Send Setup button
 *   2. Admin customer DETAIL — add Send Password Reset button alongside existing Send Setup
 *
 * Usage:
 *   move "%USERPROFILE%\Downloads\fix_admin_customer_setup.cjs" fix_admin_customer_setup.cjs && node fix_admin_customer_setup.cjs
 *
 * Then:
 *   del fix_admin_customer_setup.cjs && git add -A && git commit -m "Admin: never logged in badge, send setup/reset buttons on customer pages" && git push
 */

const fs = require('fs');
const path = require('path');

const ADMIN_FILE = path.join(__dirname, 'admin', 'index.js');
console.log('='.repeat(60));
console.log('Reading:', ADMIN_FILE);

let src = fs.readFileSync(ADMIN_FILE, 'utf8');
const original = src;
let changeCount = 0;

// ─────────────────────────────────────────────────────────────
// FIX 1: Customer LIST — add last_login_at to query + badge + send setup button
// ─────────────────────────────────────────────────────────────
console.log('\n--- FIX 1: Customer list — never logged in badge + setup button ---');

// Step 1A: Add last_login_at to customer list query
const custListQuery = "SELECT c.id, c.first_name+' '+c.last_name AS name, c.company, c.email, c.phone,\n          c.status, c.created_at, COUNT(h.id) AS rfq_count";
const custListQueryFixed = "SELECT c.id, c.first_name+' '+c.last_name AS name, c.company, c.email, c.phone,\n          c.status, c.created_at, c.last_login_at, COUNT(h.id) AS rfq_count";

if (src.includes('last_login_at') && src.includes('rfq_count') && src.indexOf('last_login_at') < src.indexOf('rfq_count') + 500) {
  console.log('ℹ️  FIX 1A: last_login_at already in customer list query.');
} else if (src.includes(custListQuery)) {
  src = src.replace(custListQuery, custListQueryFixed);
  console.log('✅ FIX 1A: last_login_at added to customer list query.');
  changeCount++;
} else {
  console.warn('⚠️  FIX 1A: Could not find customer list query.');
}

// Step 1B: Update customer list row to show badge + button
// Current row ends with: <td>${statusBadge(c.status)}</td>  ...  <td>joined date</td>
// We add a new column for login status + action
const custListRow = "const rows = result.recordset.map(c => `<tr>\n        <td><a href=\"/admin/customers/${c.id}\" style=\"color:#c8932a;\">${c.name}</a></td>\n        <td style=\"color:#7a8a9a;\">${c.company||'—'}</td>\n        <td style=\"color:#7a8a9a;font-size:.8rem;\">${c.email}</td>\n        <td style=\"color:#7a8a9a;\">${c.phone||'—'}</td>\n        <td>${c.rfq_count}</td>\n        <td>${statusBadge(c.status)}</td>\n        <td style=\"color:#7a8a9a;font-size:.78rem;\">${new Date(c.created_at).toLocaleDateString()}</td>\n      </tr>`).join('')";

const custListRowFixed = "const rows = result.recordset.map(c => `<tr>\n        <td><a href=\"/admin/customers/${c.id}\" style=\"color:#c8932a;\">${c.name}</a></td>\n        <td style=\"color:#7a8a9a;\">${c.company||'—'}</td>\n        <td style=\"color:#7a8a9a;font-size:.8rem;\">${c.email}</td>\n        <td style=\"color:#7a8a9a;\">${c.phone||'—'}</td>\n        <td>${c.rfq_count}</td>\n        <td>${statusBadge(c.status)}</td>\n        <td style=\"color:#7a8a9a;font-size:.78rem;\">${new Date(c.created_at).toLocaleDateString()}</td>\n        <td>${c.last_login_at ? '<span style=\"color:#4caf50;font-size:.75rem;\">✔ Active</span>' : '<span style=\"background:#e05050;color:#fff;font-size:.65rem;padding:2px 7px;border-radius:3px;\">NO LOGIN</span>'}</td>\n        <td>${!c.last_login_at ? `<form method=\"POST\" action=\"/admin/customers/${c.id}/send-setup\" style=\"display:inline;\"><button type=\"submit\" class=\"btn btn-sm btn-outline\" style=\"border-color:#c8932a;color:#c8932a;font-size:.65rem;padding:3px 8px;\">✉ Send Setup</button></form>` : ''}</td>\n      </tr>`).join('')";

if (src.includes(custListRow)) {
  src = src.replace(custListRow, custListRowFixed);
  console.log('✅ FIX 1B: Never logged in badge + Send Setup button added to customer list rows.');
  changeCount++;
} else {
  console.warn('⚠️  FIX 1B: Could not find customer list row template.');
}

// Step 1C: Add new column headers to customer list table
const custListHeaders = "<table><thead><tr><th>Name</th><th>Company</th><th>Email</th><th>Phone</th><th>RFQs</th><th>Status</th><th>Joined</th></tr></thead>";
const custListHeadersFixed = "<table><thead><tr><th>Name</th><th>Company</th><th>Email</th><th>Phone</th><th>RFQs</th><th>Status</th><th>Joined</th><th>Login</th><th></th></tr></thead>";

if (src.includes(custListHeaders)) {
  src = src.replace(custListHeaders, custListHeadersFixed);
  console.log('✅ FIX 1C: Added Login and action column headers to customer list.');
  changeCount++;
} else {
  console.warn('⚠️  FIX 1C: Could not find customer list table headers.');
}

// ─────────────────────────────────────────────────────────────
// FIX 2: Customer DETAIL — add Send Password Reset button
// Already has Send Setup button — add Reset alongside it
// ─────────────────────────────────────────────────────────────
console.log('\n--- FIX 2: Customer detail — add Send Password Reset button ---');

// Add a POST route for sending password reset from admin
const setupRouteAnchor = "router.post('/customers/:id/send-setup'";

if (!src.includes(setupRouteAnchor)) {
  console.warn('⚠️  FIX 2: send-setup route not found — skipping reset route addition.');
} else if (src.includes("send-reset'") || src.includes('send-reset"')) {
  console.log('ℹ️  FIX 2: send-reset route already exists.');
} else {
  // Insert send-reset route after send-setup route
  // Find the end of send-setup route
  const setupRouteEnd = "res.redirect('/admin/customers/' + req.params.id + '?setup_sent=1');\n    } catch(err) {\n      console.error('Send setup email error:', err);\n      res.redirect('/admin/customers/' + req.params.id + '?error=' + encodeURIComponent(err.message));\n    }\n  });";

  const resetRoute = `res.redirect('/admin/customers/' + req.params.id + '?setup_sent=1');
    } catch(err) {
      console.error('Send setup email error:', err);
      res.redirect('/admin/customers/' + req.params.id + '?error=' + encodeURIComponent(err.message));
    }
  });

  // Send password reset email from admin
  router.post('/customers/:id/send-reset', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const cr = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT id, first_name, email FROM customers WHERE id=@id');
      if (!cr.recordset.length) return res.redirect('/admin/customers/' + req.params.id + '?error=Customer+not+found');
      const customer = cr.recordset[0];
      const crypto = await import('crypto');
      const resetToken = crypto.default.randomBytes(32).toString('hex');
      const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await pool.request()
        .input('customerId', sql.BigInt, customer.id)
        .input('token', sql.NVarChar, resetToken)
        .input('expiresAt', sql.DateTime, resetExpiry)
        .input('ip', sql.NVarChar(45), '0.0.0.0')
        .query('INSERT INTO password_resets (customer_id, reset_token, expires_at, ip_address) VALUES (@customerId, @token, @expiresAt, @ip)');
      const { sendPasswordReset } = await import('../services/mailer.js');
      await sendPasswordReset({ customer, token: resetToken });
      res.redirect('/admin/customers/' + req.params.id + '?reset_sent=1');
    } catch(err) {
      console.error('Send reset email error:', err);
      res.redirect('/admin/customers/' + req.params.id + '?error=' + encodeURIComponent(err.message));
    }
  });`;

  if (src.includes(setupRouteEnd)) {
    src = src.replace(setupRouteEnd, resetRoute);
    console.log('✅ FIX 2A: Send password reset route added.');
    changeCount++;
  } else {
    console.warn('⚠️  FIX 2A: Could not find end of setup route to insert reset route.');
  }
}

// Step 2B: Add reset_sent success message and reset button to customer detail page
const custDetailSuccessMsg = "const successMsg = req.query.setup_sent ? '<div class=\"alert alert-success\">Setup email sent.</div>' : req.query.error ? '<div class=\"alert alert-error\">'+req.query.error+'</div>' : '';";

if (src.includes(custDetailSuccessMsg)) {
  console.log('ℹ️  FIX 2B: Success messages already patched.');
} else {
  // Find existing success message handling in customer detail
  const custDetailGet = "router.get('/customers/:id', async (req, res) => {";
  const custDetailIdx = src.lastIndexOf(custDetailGet);
  if (custDetailIdx !== -1) {
    // Find the res.send in customer detail and look for setup_sent
    const setupSentCheck = "req.query.setup_sent";
    if (!src.includes(setupSentCheck)) {
      console.warn('⚠️  FIX 2B: setup_sent not in customer detail yet — may need manual check.');
    } else {
      console.log('ℹ️  FIX 2B: setup_sent already handled in customer detail.');
    }
  }
}

// Step 2C: Add reset button and reset_sent message to the HTML in customer detail
const setupBtnPattern = `<form method="POST" action="/admin/customers/\${cust.id}/send-setup" style="display:inline;" onsubmit="return confirm('Send account setup email to \${cust.email}?');">
            <button type="submit" class="btn btn-outline btn-sm" style="border-color:#4caf50;color:#4caf50;">✉ Send Setup Email</button>
          </form>`;

const setupAndResetBtns = `<form method="POST" action="/admin/customers/\${cust.id}/send-setup" style="display:inline;" onsubmit="return confirm('Send account setup email to \${cust.email}?');">
            <button type="submit" class="btn btn-outline btn-sm" style="border-color:#4caf50;color:#4caf50;">✉ Send Setup Email</button>
          </form>
          <form method="POST" action="/admin/customers/\${cust.id}/send-reset" style="display:inline;" onsubmit="return confirm('Send password reset email to \${cust.email}?');">
            <button type="submit" class="btn btn-outline btn-sm" style="border-color:#c8932a;color:#c8932a;">🔑 Send Password Reset</button>
          </form>`;

if (src.includes('send-reset') && src.includes('Send Password Reset')) {
  console.log('ℹ️  FIX 2C: Reset button already in customer detail HTML.');
} else if (src.includes(setupBtnPattern)) {
  src = src.replace(setupBtnPattern, setupAndResetBtns);
  console.log('✅ FIX 2C: Password Reset button added to customer detail page.');
  changeCount++;
} else {
  console.warn('⚠️  FIX 2C: Could not find setup button pattern in customer detail HTML.');
}

// Also update the success message block to handle reset_sent
const oldSuccessBlock = "req.query.setup_sent ? '<div class=\"alert alert-success\" style=\"margin-bottom:12px;\">Setup email sent.</div>' :";
const newSuccessBlock = "req.query.setup_sent ? '<div class=\"alert alert-success\" style=\"margin-bottom:12px;\">✔ Account setup email sent.</div>' : req.query.reset_sent ? '<div class=\"alert alert-success\" style=\"margin-bottom:12px;\">✔ Password reset email sent.</div>' :";

if (src.includes(oldSuccessBlock)) {
  src = src.replace(oldSuccessBlock, newSuccessBlock);
  console.log('✅ FIX 2D: reset_sent success message added.');
  changeCount++;
} else if (src.includes('reset_sent')) {
  console.log('ℹ️  FIX 2D: reset_sent already handled.');
} else {
  // Try finding the setup_sent success message a different way
  const altSetupSent = "'?setup_sent=1'";
  if (src.includes(altSetupSent)) {
    // Find the HTML success message display
    const htmlSetupCheck = src.indexOf("setup_sent");
    if (htmlSetupCheck !== -1) {
      console.log('ℹ️  FIX 2D: setup_sent found but pattern differs — check manually if reset_sent message shows.');
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(60));
if (src !== original) {
  fs.writeFileSync(ADMIN_FILE, src, 'utf8');
  console.log('✅ Done. ' + changeCount + ' fix(es) written to admin/index.js');
  console.log('\nNext step:');
  console.log('  del fix_admin_customer_setup.cjs && git add -A && git commit -m "Admin: never logged in badge, send setup/reset buttons on customer pages" && git push');
} else {
  console.log('ℹ️  No changes written — check warnings above.');
}
console.log('='.repeat(60));
