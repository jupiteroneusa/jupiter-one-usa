// routes/invoices.js
import { Router } from 'express';
import { getPool, sql } from '../db/connect.js';
import { requireCustomer, requireAdmin } from '../middleware/auth.js';
import { logAudit, getIp } from '../middleware/audit.js';
import { generateNumber } from '../db/numbering.js';
import { generateInvoicePdf } from '../services/pdfService.js';
import { sendInvoice } from '../services/mailer.js';

const router = Router();

router.post('/', requireAdmin, async (req, res) => {
  const { order_id, payment_term_id, due_days = 0, notes } = req.body;
  try {
    const pool = await getPool();
    const orderResult = await pool.request().input('id', sql.BigInt, order_id)
      .query(`SELECT o.*, c.first_name, c.last_name, c.email, c.company, c.phone FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = @id`);
    if (!orderResult.recordset.length) return res.status(404).json({ error: 'Order not found.' });
    const order = orderResult.recordset[0];

    const invoiceNumber = await generateNumber('INV');
    const issueDate = new Date();
    const dueDate = new Date(Date.now() + due_days * 24 * 60 * 60 * 1000);

    const invResult = await pool.request()
      .input('orderId',       sql.BigInt,       order_id)
      .input('customerId',    sql.BigInt,       order.customer_id)
      .input('invNumber',     sql.NVarChar(20), invoiceNumber)
      .input('termId',        sql.Int,          payment_term_id || null)
      .input('subtotal',      sql.Decimal(12,2),order.subtotal)
      .input('taxAmt',        sql.Decimal(12,2),order.tax_amount || 0)
      .input('shipAmt',       sql.Decimal(12,2),order.shipping_cost || 0)
      .input('total',         sql.Decimal(12,2),order.total_amount)
      .input('balance',       sql.Decimal(12,2),order.total_amount)
      .input('issueDate',     sql.Date,         issueDate)
      .input('dueDate',       sql.Date,         dueDate)
      .input('notes',         sql.NVarChar(sql.MAX), notes || null)
      .input('createdBy',     sql.BigInt,       req.adminId)
      .query(`INSERT INTO invoices (order_id, customer_id, invoice_number, payment_term_id, subtotal, tax_amount, shipping_amount, total_amount, balance_due, issue_date, due_date, notes, created_by) OUTPUT INSERTED.id VALUES (@orderId, @customerId, @invNumber, @termId, @subtotal, @taxAmt, @shipAmt, @total, @balance, @issueDate, @dueDate, @notes, @createdBy)`);

    const invoiceId = invResult.recordset[0].id;

    // Copy order lines to invoice lines
    const orderLines = await pool.request().input('id', sql.BigInt, order_id).query(`SELECT * FROM order_lines WHERE order_id = @id`);
    for (const l of orderLines.recordset) {
      await pool.request()
        .input('invId',   sql.BigInt,        invoiceId)
        .input('olId',    sql.BigInt,        l.id)
        .input('lineNum', sql.Int,           l.line_number)
        .input('desc',    sql.NVarChar(255), l.item_name || `${l.nsn || l.part_number}`)
        .input('nsn',     sql.NVarChar(20),  l.nsn)
        .input('pn',      sql.NVarChar(100), l.part_number)
        .input('cond',    sql.NVarChar(5),   l.condition_code)
        .input('qty',     sql.Int,           l.quantity_ordered)
        .input('price',   sql.Decimal(10,2), l.unit_price)
        .input('total',   sql.Decimal(12,2), l.line_total)
        .query(`INSERT INTO invoice_lines (invoice_id, order_line_id, line_number, description, nsn, part_number, condition_code, quantity, unit_price, line_total) VALUES (@invId, @olId, @lineNum, @desc, @nsn, @pn, @cond, @qty, @price, @total)`);
    }

    const invoice = { ...invResult.recordset[0], invoice_number: invoiceNumber, total_amount: order.total_amount, due_date: dueDate, notes };
    const customer = { first_name: order.first_name, last_name: order.last_name, email: order.email, company: order.company, phone: order.phone };

    const pdfUrl = await generateInvoicePdf({ invoice: { ...invoice, order_number: order.order_number }, lines: orderLines.recordset, customer });
    await pool.request().input('id', sql.BigInt, invoiceId).input('url', sql.NVarChar(500), pdfUrl).query(`UPDATE invoices SET pdf_url = @url WHERE id = @id`);

    sendInvoice({ customer, invoice: { ...invoice, invoice_number: invoiceNumber, due_date: dueDate, total_amount: order.total_amount }, pdfUrl }).catch(console.error);

    await logAudit({ userType: 'admin', userId: req.adminId, action: 'created', entityType: 'invoice', entityId: invoiceId, summary: `Invoice ${invoiceNumber} created`, ipAddress: getIp(req) });
    res.status(201).json({ id: invoiceId, invoice_number: invoiceNumber, pdf_url: pdfUrl });
  } catch (err) {
    console.error('Invoice error:', err);
    res.status(500).json({ error: 'Failed to create invoice.' });
  }
});

router.get('/', requireCustomer, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().input('cid', sql.BigInt, req.customerId)
      .query(`SELECT id, invoice_number, status, total_amount, balance_due, issue_date, due_date, pdf_url FROM invoices WHERE customer_id = @cid ORDER BY issue_date DESC`);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

router.post('/:id/payment', requireAdmin, async (req, res) => {
  const { amount, payment_method, reference_number, payment_date } = req.body;
  try {
    const pool = await getPool();
    const inv = await pool.request().input('id', sql.BigInt, req.params.id).query(`SELECT * FROM invoices WHERE id = @id`);
    if (!inv.recordset.length) return res.status(404).json({ error: 'Invoice not found.' });
    const invoice = inv.recordset[0];

    await pool.request()
      .input('invId', sql.BigInt, req.params.id).input('custId', sql.BigInt, invoice.customer_id)
      .input('amount', sql.Decimal(12,2), amount).input('method', sql.NVarChar(50), payment_method)
      .input('ref', sql.NVarChar(100), reference_number || null).input('date', sql.Date, payment_date)
      .input('by', sql.BigInt, req.adminId)
      .query(`INSERT INTO payments (invoice_id, customer_id, amount, payment_method, reference_number, payment_date, recorded_by) VALUES (@invId, @custId, @amount, @method, @ref, @date, @by)`);

    const newPaid = parseFloat(invoice.amount_paid || 0) + parseFloat(amount);
    const newBalance = parseFloat(invoice.total_amount) - newPaid;
    const newStatus = newBalance <= 0 ? 'Paid' : 'Partially Paid';

    await pool.request()
      .input('id', sql.BigInt, req.params.id).input('paid', sql.Decimal(12,2), newPaid)
      .input('balance', sql.Decimal(12,2), Math.max(0, newBalance)).input('status', sql.NVarChar(30), newStatus)
      .input('paidDate', sql.Date, newStatus === 'Paid' ? new Date() : null)
      .query(`UPDATE invoices SET amount_paid=@paid, balance_due=@balance, status=@status, paid_date=@paidDate, updated_at=GETDATE() WHERE id=@id`);

    await logAudit({ userType: 'admin', userId: req.adminId, action: 'payment_recorded', entityType: 'invoice', entityId: req.params.id, summary: `Payment of $${amount} recorded`, ipAddress: getIp(req) });
    res.json({ success: true, new_status: newStatus, balance_due: Math.max(0, newBalance) });
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

export default router;
