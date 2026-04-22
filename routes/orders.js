// routes/orders.js
import { Router } from 'express';
import { getPool, sql } from '../db/connect.js';
import { requireCustomer, requireAdmin } from '../middleware/auth.js';
import { logAudit, getIp } from '../middleware/audit.js';
import { generateNumber } from '../db/numbering.js';
import { sendOrderConfirmation } from '../services/mailer.js';

const router = Router();

// ── POST /api/orders — create order from accepted quote ───────
router.post('/', requireAdmin, async (req, res) => {
  const { quote_id, customer_po, ship_to, notes } = req.body;

  try {
    const pool = await getPool();

    const quoteResult = await pool.request()
      .input('id', sql.BigInt, quote_id)
      .query(`SELECT q.*, c.first_name, c.last_name, c.email FROM quotes q JOIN customers c ON c.id = q.customer_id WHERE q.id = @id AND q.status = 'Accepted'`);

    if (!quoteResult.recordset.length) return res.status(404).json({ error: 'Accepted quote not found.' });
    const quote = quoteResult.recordset[0];

    const orderNumber = await generateNumber('ORD');

    const orderResult = await pool.request()
      .input('quoteId',      sql.BigInt,       quote_id)
      .input('rfqId',        sql.BigInt,       quote.rfq_id)
      .input('customerId',   sql.BigInt,       quote.customer_id)
      .input('orderNumber',  sql.NVarChar(20), orderNumber)
      .input('customerPo',   sql.NVarChar(100),customer_po || null)
      .input('subtotal',     sql.Decimal(12,2),quote.subtotal)
      .input('taxAmount',    sql.Decimal(12,2),quote.tax_amount || 0)
      .input('totalAmount',  sql.Decimal(12,2),quote.total_amount)
      .input('paymentTerms', sql.NVarChar(100),quote.payment_terms)
      .input('addr1',        sql.NVarChar(150),ship_to?.address1 || null)
      .input('city',         sql.NVarChar(100),ship_to?.city || null)
      .input('state',        sql.NVarChar(50), ship_to?.state || null)
      .input('zip',          sql.NVarChar(20), ship_to?.zip || null)
      .input('country',      sql.NVarChar(50), ship_to?.country || 'USA')
      .input('notes',        sql.NVarChar(sql.MAX), notes || null)
      .input('createdBy',    sql.BigInt, req.adminId)
      .query(`
        INSERT INTO orders
          (quote_id, rfq_id, customer_id, order_number, customer_po, subtotal, tax_amount, total_amount,
           payment_terms, ship_to_address1, ship_to_city, ship_to_state, ship_to_zip, ship_to_country, notes, created_by)
        OUTPUT INSERTED.id, INSERTED.order_number
        VALUES
          (@quoteId, @rfqId, @customerId, @orderNumber, @customerPo, @subtotal, @taxAmount, @totalAmount,
           @paymentTerms, @addr1, @city, @state, @zip, @country, @notes, @createdBy)
      `);

    const order = orderResult.recordset[0];

    // Copy quote lines to order lines
    const quoteLines = await pool.request()
      .input('quoteId', sql.BigInt, quote_id)
      .query(`SELECT * FROM quote_lines WHERE quote_id = @quoteId`);

    for (const l of quoteLines.recordset) {
      await pool.request()
        .input('orderId',   sql.BigInt,       order.id)
        .input('qlId',      sql.BigInt,       l.id)
        .input('lineNum',   sql.Int,          l.line_number)
        .input('nsn',       sql.NVarChar(20), l.nsn)
        .input('pn',        sql.NVarChar(100),l.part_number)
        .input('name',      sql.NVarChar(255),l.item_name)
        .input('cond',      sql.NVarChar(5),  l.condition_code)
        .input('qty',       sql.Int,          l.quantity)
        .input('price',     sql.Decimal(10,2),l.unit_price)
        .input('total',     sql.Decimal(12,2),l.line_total)
        .query(`
          INSERT INTO order_lines (order_id, quote_line_id, line_number, nsn, part_number, item_name, condition_code, quantity_ordered, unit_price, line_total)
          VALUES (@orderId, @qlId, @lineNum, @nsn, @pn, @name, @cond, @qty, @price, @total)
        `);
    }

    // Log status
    await pool.request()
      .input('orderId', sql.BigInt, order.id)
      .input('status',  sql.NVarChar, 'Confirmed')
      .query(`INSERT INTO order_status_log (order_id, new_status, note) VALUES (@orderId, @status, 'Order created from accepted quote')`);

    // Update quote status
    await pool.request()
      .input('id', sql.BigInt, quote_id)
      .query(`UPDATE quotes SET status = 'Accepted' WHERE id = @id`);

    const customer = { first_name: quote.first_name, last_name: quote.last_name, email: quote.email };
    sendOrderConfirmation({ customer, order: { ...order, total_amount: quote.total_amount, payment_terms: quote.payment_terms } }).catch(console.error);

    await logAudit({ userType: 'admin', userId: req.adminId, action: 'created', entityType: 'order', entityId: order.id, summary: `Order ${orderNumber} created`, ipAddress: getIp(req) });

    res.status(201).json({ success: true, id: order.id, order_number: orderNumber });
  } catch (err) {
    console.error('Order create error:', err);
    res.status(500).json({ error: 'Failed to create order.' });
  }
});

// ── GET /api/orders — customer order history ─────────────────
router.get('/', requireCustomer, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('customerId', sql.BigInt, req.customerId)
      .query(`SELECT id, order_number, status, total_amount, confirmed_at, customer_po FROM orders WHERE customer_id = @customerId ORDER BY confirmed_at DESC`);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: 'Failed to load orders.' }); }
});

// ── GET /api/orders/:id ───────────────────────────────────────
router.get('/:id', requireCustomer, async (req, res) => {
  try {
    const pool = await getPool();
    const order = await pool.request()
      .input('id', sql.BigInt, req.params.id)
      .input('cid', sql.BigInt, req.customerId)
      .query(`SELECT * FROM orders WHERE id = @id AND customer_id = @cid`);
    if (!order.recordset.length) return res.status(404).json({ error: 'Order not found.' });

    const lines = await pool.request().input('id', sql.BigInt, req.params.id).query(`SELECT * FROM order_lines WHERE order_id = @id ORDER BY line_number`);
    const shipments = await pool.request().input('id', sql.BigInt, req.params.id).query(`SELECT id, shipment_number, carrier, tracking_number, status, ship_date, estimated_delivery, actual_delivery FROM shipments WHERE order_id = @id`);
    const invoices = await pool.request().input('id', sql.BigInt, req.params.id).query(`SELECT id, invoice_number, status, total_amount, due_date, pdf_url FROM invoices WHERE order_id = @id`);

    res.json({ ...order.recordset[0], lines: lines.recordset, shipments: shipments.recordset, invoices: invoices.recordset });
  } catch (err) { res.status(500).json({ error: 'Failed to load order.' }); }
});

// Admin: GET all orders
router.get('/admin/all', requireAdmin, async (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query;
  try {
    const pool = await getPool();
    const r = pool.request().input('lim', sql.Int, parseInt(limit)).input('off', sql.Int, parseInt(offset));
    let where = '';
    if (status) { r.input('status', sql.NVarChar, status); where = 'WHERE o.status = @status'; }
    const result = await r.query(`
      SELECT o.id, o.order_number, o.status, o.total_amount, o.confirmed_at, o.customer_po,
             c.first_name + ' ' + c.last_name AS customer_name, c.company, c.email
      FROM orders o JOIN customers c ON c.id = o.customer_id
      ${where}
      ORDER BY o.confirmed_at DESC
      OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY
    `);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

export default router;
