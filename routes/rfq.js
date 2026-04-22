// routes/rfq.js
import { Router } from 'express';
import { getPool, sql } from '../db/connect.js';
import { requireCustomer, requireAdmin } from '../middleware/auth.js';
import { logAudit, getIp } from '../middleware/audit.js';
import { generateNumber } from '../db/numbering.js';
import { sendRfqReceivedCustomer, sendRfqNotificationAdmin } from '../services/mailer.js';

const router = Router();

// ── POST /api/rfq — submit new RFQ ───────────────────────────
router.post('/', requireCustomer, async (req, res) => {
  const { lines, priority = 'Standard', notes } = req.body;

  if (!lines?.length)
    return res.status(400).json({ error: 'At least one part is required.' });

  for (const l of lines) {
    if (!l.nsn && !l.part_number)
      return res.status(400).json({ error: 'Each line needs an NSN or part number.' });
    if (!l.quantity || l.quantity < 1)
      return res.status(400).json({ error: 'Each line needs a valid quantity.' });
  }

  try {
    const pool = await getPool();
    const rfqNumber = await generateNumber('RFQ');

    // Insert header
    const headerResult = await pool.request()
      .input('customerId', sql.BigInt,      req.customerId)
      .input('rfqNumber',  sql.NVarChar(20), rfqNumber)
      .input('priority',   sql.NVarChar(20), priority)
      .input('notes',      sql.NVarChar(sql.MAX), notes || null)
      .input('ip',         sql.NVarChar(45), getIp(req))
      .query(`
        INSERT INTO rfq_headers (customer_id, rfq_number, priority, notes, ip_address)
        OUTPUT INSERTED.id, INSERTED.rfq_number, INSERTED.submitted_at
        VALUES (@customerId, @rfqNumber, @priority, @notes, @ip)
      `);

    const rfq = headerResult.recordset[0];

    // Insert lines
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      await pool.request()
        .input('rfqId',      sql.BigInt,       rfq.id)
        .input('lineNum',    sql.Int,           i + 1)
        .input('nsn',        sql.NVarChar(20),  l.nsn || null)
        .input('partNum',    sql.NVarChar(100), l.part_number || null)
        .input('itemName',   sql.NVarChar(255), l.item_name || null)
        .input('condition',  sql.NVarChar(5),   l.condition_code || null)
        .input('qty',        sql.Int,           l.quantity)
        .input('ui',         sql.NVarChar(10),  l.unit_of_issue || null)
        .input('target',     sql.Decimal(10,2), l.target_price || null)
        .input('neededBy',   sql.Date,          l.needed_by || null)
        .input('notes',      sql.NVarChar(500), l.notes || null)
        .query(`
          INSERT INTO rfq_lines
            (rfq_id, line_number, nsn, part_number, item_name, condition_code, quantity, unit_of_issue, target_price, needed_by, notes)
          VALUES
            (@rfqId, @lineNum, @nsn, @partNum, @itemName, @condition, @qty, @ui, @target, @neededBy, @notes)
        `);
    }

    // Log initial status
    await pool.request()
      .input('rfqId', sql.BigInt, rfq.id)
      .input('status', sql.NVarChar, 'Submitted')
      .query(`INSERT INTO rfq_status_log (rfq_id, new_status, note) VALUES (@rfqId, @status, 'RFQ submitted by customer')`);

    await logAudit({
      userType: 'customer', userId: req.customerId,
      action: 'created', entityType: 'rfq', entityId: rfq.id,
      summary: `RFQ ${rfqNumber} submitted with ${lines.length} lines`,
      ipAddress: getIp(req),
    });

    // Get customer details for emails
    const custResult = await pool.request()
      .input('id', sql.BigInt, req.customerId)
      .query(`SELECT * FROM customers WHERE id = @id`);
    const customer = custResult.recordset[0];

    sendRfqReceivedCustomer({ customer, rfq: { ...rfq, line_count: lines.length, priority } }).catch(console.error);
    sendRfqNotificationAdmin({ rfq: { ...rfq, line_count: lines.length, priority }, customer, lines }).catch(console.error);

    res.status(201).json({ success: true, rfq_number: rfqNumber, id: rfq.id, message: "RFQ submitted. We'll respond within 24 hours." });

  } catch (err) {
    console.error('RFQ submit error:', err);
    res.status(500).json({ error: 'Submission failed. Please try again.' });
  }
});

// ── GET /api/rfq — customer's own RFQs ───────────────────────
router.get('/', requireCustomer, async (req, res) => {
  const { limit = 20, offset = 0 } = req.query;
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('customerId', sql.BigInt, req.customerId)
      .input('lim', sql.Int, parseInt(limit))
      .input('off', sql.Int, parseInt(offset))
      .query(`
        SELECT
          h.id, h.rfq_number, h.status, h.priority, h.submitted_at,
          COUNT(l.id) AS line_count
        FROM rfq_headers h
        LEFT JOIN rfq_lines l ON l.rfq_id = h.id
        WHERE h.customer_id = @customerId
        GROUP BY h.id, h.rfq_number, h.status, h.priority, h.submitted_at
        ORDER BY h.submitted_at DESC
        OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load RFQs.' });
  }
});

// ── GET /api/rfq/:id — RFQ detail ────────────────────────────
router.get('/:id', requireCustomer, async (req, res) => {
  try {
    const pool = await getPool();
    const header = await pool.request()
      .input('id',         sql.BigInt, req.params.id)
      .input('customerId', sql.BigInt, req.customerId)
      .query(`SELECT * FROM rfq_headers WHERE id = @id AND customer_id = @customerId`);

    if (!header.recordset.length) return res.status(404).json({ error: 'RFQ not found.' });

    const lines = await pool.request()
      .input('rfqId', sql.BigInt, req.params.id)
      .query(`SELECT * FROM rfq_lines WHERE rfq_id = @rfqId ORDER BY line_number`);

    const statusLog = await pool.request()
      .input('rfqId', sql.BigInt, req.params.id)
      .query(`SELECT new_status, note, created_at FROM rfq_status_log WHERE rfq_id = @rfqId ORDER BY created_at ASC`);

    res.json({ ...header.recordset[0], lines: lines.recordset, status_log: statusLog.recordset });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load RFQ.' });
  }
});

// ── Admin: GET /api/rfq/admin/all — all RFQs ─────────────────
router.get('/admin/all', requireAdmin, async (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query;
  try {
    const pool = await getPool();
    const req2 = pool.request()
      .input('lim', sql.Int, parseInt(limit))
      .input('off', sql.Int, parseInt(offset));

    let where = '';
    if (status) { req2.input('status', sql.NVarChar, status); where = 'WHERE h.status = @status'; }

    const result = await req2.query(`
      SELECT
        h.id, h.rfq_number, h.status, h.priority, h.submitted_at, h.assigned_to,
        c.first_name + ' ' + c.last_name AS customer_name,
        c.company, c.email,
        COUNT(l.id) AS line_count
      FROM rfq_headers h
      JOIN customers c ON c.id = h.customer_id
      LEFT JOIN rfq_lines l ON l.rfq_id = h.id
      ${where}
      GROUP BY h.id, h.rfq_number, h.status, h.priority, h.submitted_at, h.assigned_to,
               c.first_name, c.last_name, c.company, c.email
      ORDER BY h.submitted_at DESC
      OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load RFQs.' });
  }
});

// ── Admin: PATCH /api/rfq/admin/:id/status ───────────────────
router.patch('/admin/:id/status', requireAdmin, async (req, res) => {
  const { status, note } = req.body;
  if (!status) return res.status(400).json({ error: 'Status required.' });

  try {
    const pool = await getPool();

    const current = await pool.request()
      .input('id', sql.BigInt, req.params.id)
      .query(`SELECT status FROM rfq_headers WHERE id = @id`);

    if (!current.recordset.length) return res.status(404).json({ error: 'RFQ not found.' });

    const oldStatus = current.recordset[0].status;

    await pool.request()
      .input('id',     sql.BigInt,    req.params.id)
      .input('status', sql.NVarChar,  status)
      .query(`UPDATE rfq_headers SET status = @status, updated_at = GETDATE() WHERE id = @id`);

    await pool.request()
      .input('rfqId',     sql.BigInt,   req.params.id)
      .input('oldStatus', sql.NVarChar, oldStatus)
      .input('newStatus', sql.NVarChar, status)
      .input('changedBy', sql.BigInt,   req.adminId)
      .input('note',      sql.NVarChar(500), note || null)
      .input('ip',        sql.NVarChar(45),  getIp(req))
      .query(`
        INSERT INTO rfq_status_log (rfq_id, old_status, new_status, changed_by, note, ip_address)
        VALUES (@rfqId, @oldStatus, @newStatus, @changedBy, @note, @ip)
      `);

    await logAudit({
      userType: 'admin', userId: req.adminId,
      action: 'status_changed', entityType: 'rfq', entityId: req.params.id,
      oldValue: oldStatus, newValue: status,
      summary: `RFQ status changed from ${oldStatus} to ${status}`,
      ipAddress: getIp(req),
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Status update failed.' });
  }
});

export default router;
