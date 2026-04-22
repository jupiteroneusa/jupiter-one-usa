// routes/customers.js
import { Router } from 'express';
import { getPool, sql } from '../db/connect.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAdmin, async (req, res) => {
  const { limit = 50, offset = 0, q } = req.query;
  try {
    const pool = await getPool();
    const r = pool.request().input('lim', sql.Int, parseInt(limit)).input('off', sql.Int, parseInt(offset));
    let where = '';
    if (q) { r.input('q', sql.NVarChar, `%${q}%`); where = `WHERE first_name LIKE @q OR last_name LIKE @q OR email LIKE @q OR company LIKE @q`; }
    const result = await r.query(`SELECT id, first_name, last_name, company, email, phone, status, tier_id, created_at, last_login_at FROM customers ${where} ORDER BY created_at DESC OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY`);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    const c = await pool.request().input('id', sql.BigInt, req.params.id).query(`SELECT id, first_name, last_name, company, job_title, email, phone, tier_id, status, email_verified, billing_address1, billing_city, billing_state, billing_zip, billing_country, notes, created_at, last_login_at FROM customers WHERE id = @id`);
    if (!c.recordset.length) return res.status(404).json({ error: 'Not found.' });
    const rfqs = await pool.request().input('id', sql.BigInt, req.params.id).query(`SELECT id, rfq_number, status, submitted_at FROM rfq_headers WHERE customer_id = @id ORDER BY submitted_at DESC`);
    const orders = await pool.request().input('id', sql.BigInt, req.params.id).query(`SELECT id, order_number, status, total_amount, confirmed_at FROM orders WHERE customer_id = @id ORDER BY confirmed_at DESC`);
    res.json({ ...c.recordset[0], rfqs: rfqs.recordset, orders: orders.recordset });
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

export default router;
