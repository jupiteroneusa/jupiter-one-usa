// patch-proforma-fix1.cjs
// Fixes:
//  1) proformaPdfService SQL — bill-to fields live on `orders`, not `customers`
//  2) send-proforma handler — don't overwrite order total/shipping on every resend

const fs = require('fs');
const { execSync } = require('child_process');

// ============ 1) Fix proformaPdfService query ============
const svc = 'services/proformaPdfService.js';
let s = fs.readFileSync(svc, 'utf8');

const oldQuery = `    SELECT pf.*, o.order_number, o.quote_id,
           c.first_name, c.last_name, c.email, c.phone, c.company,
           c.ship_to_address1 AS bill_address1, c.ship_to_city AS bill_city,
           c.ship_to_state AS bill_state, c.ship_to_zip AS bill_zip,
           c.ship_to_country AS bill_country,
           q.quote_number`;

const newQuery = `    SELECT pf.*, o.order_number, o.quote_id,
           c.first_name, c.last_name, c.email, c.phone, c.company,
           o.ship_to_address1 AS bill_address1, o.ship_to_city AS bill_city,
           o.ship_to_state AS bill_state, o.ship_to_zip AS bill_zip,
           o.ship_to_country AS bill_country,
           q.quote_number`;

if (!s.includes(oldQuery)) {
  console.error('! proforma query anchor not found');
  process.exit(1);
}
s = s.replace(oldQuery, newQuery);
fs.writeFileSync(svc, s);
console.log('+ proformaPdfService SQL: bill-to from orders not customers');

// ============ 2) Stop overwriting order total on proforma resend ============
const rt = 'admin/orderRoutes.js';
let r = fs.readFileSync(rt, 'utf8');

const oldUpdate = `      // Also save shipping cost back to order
      await pool.request()
        .input('id', sql.BigInt, orderId)
        .input('sc', sql.Decimal(12,2), shippingCost)
        .input('tot', sql.Decimal(12,2), total)
        .query('UPDATE orders SET shipping_cost=@sc, total_amount=@tot, updated_at=GETDATE() WHERE id=@id');`;

const newUpdate = `      // Save shipping cost back to order ONLY if not already set or invoice not generated.
      // Avoids clobbering paid/invoiced totals on a proforma resend.
      const existingInv = await pool.request().input('idC', sql.BigInt, orderId)
        .query('SELECT COUNT(*) AS cnt FROM invoices WHERE order_id=@idC');
      if (!existingInv.recordset[0].cnt) {
        await pool.request()
          .input('id', sql.BigInt, orderId)
          .input('sc', sql.Decimal(12,2), shippingCost)
          .input('tot', sql.Decimal(12,2), total)
          .query('UPDATE orders SET shipping_cost=@sc, total_amount=@tot, updated_at=GETDATE() WHERE id=@id');
      }`;

if (!r.includes(oldUpdate)) {
  console.error('! order update anchor not found');
  process.exit(1);
}
r = r.replace(oldUpdate, newUpdate);
fs.writeFileSync(rt, r);

try {
  execSync('node -c "' + rt + '"', { stdio: 'pipe' });
  console.log('+ send-proforma: skip order total update if invoice exists');
  console.log('SUCCESS');
} catch (err) {
  console.error('! syntax error');
  console.error(err.message);
  process.exit(1);
}
