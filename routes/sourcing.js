// routes/sourcing.js
import { Router } from 'express';
import { getPool, sql } from '../db/connect.js';
import { requireAdmin } from '../middleware/auth.js';
import { logAudit, getIp } from '../middleware/audit.js';

const router = Router();

// ── GET /api/sourcing/:rfqId — sourcing workspace for an RFQ ─
router.get('/:rfqId', requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();

    // Get all RFQ lines with their sourcing requests and quotes
    const result = await pool.request()
      .input('rfqId', sql.BigInt, req.params.rfqId)
      .query(`
        SELECT
          rl.id AS line_id,
          rl.line_number,
          rl.nsn,
          rl.part_number,
          rl.item_name,
          rl.condition_code,
          rl.quantity,
          rl.target_price,
          rl.needed_by,
          rl.status AS line_status,
          sr.id AS sourcing_id,
          sr.status AS sourcing_status,
          sr.due_date,
          (
            SELECT COUNT(*) FROM sourcing_quotes sq WHERE sq.sourcing_id = sr.id
          ) AS quote_count,
          (
            SELECT TOP 1 sq.unit_cost
            FROM sourcing_quotes sq
            WHERE sq.sourcing_id = sr.id AND sq.is_selected = 1
          ) AS selected_cost
        FROM rfq_lines rl
        LEFT JOIN sourcing_requests sr ON sr.rfq_line_id = rl.id
        WHERE rl.rfq_id = @rfqId
        ORDER BY rl.line_number
      `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load sourcing workspace.' });
  }
});

// ── POST /api/sourcing/request — create sourcing request for line
router.post('/request', requireAdmin, async (req, res) => {
  const { rfq_line_id, rfq_id, due_date, notes } = req.body;

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('rfqLineId', sql.BigInt,  rfq_line_id)
      .input('rfqId',     sql.BigInt,  rfq_id)
      .input('dueDate',   sql.Date,    due_date || null)
      .input('assignedTo',sql.BigInt,  req.adminId)
      .input('notes',     sql.NVarChar(sql.MAX), notes || null)
      .query(`
        INSERT INTO sourcing_requests (rfq_line_id, rfq_id, assigned_to, due_date, notes)
        OUTPUT INSERTED.id
        VALUES (@rfqLineId, @rfqId, @assignedTo, @dueDate, @notes)
      `);

    res.status(201).json({ id: result.recordset[0].id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create sourcing request.' });
  }
});

// ── GET /api/sourcing/quotes/:sourcingId — quotes for a sourcing request
router.get('/quotes/:sourcingId', requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.BigInt, req.params.sourcingId)
      .query(`
        SELECT sq.*, s.company_name AS supplier_name, s.is_preferred
        FROM sourcing_quotes sq
        JOIN suppliers s ON s.id = sq.supplier_id
        WHERE sq.sourcing_id = @id
        ORDER BY sq.unit_cost ASC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load supplier quotes.' });
  }
});

// ── POST /api/sourcing/quote — enter a supplier quote ────────
router.post('/quote', requireAdmin, async (req, res) => {
  const {
    sourcing_id, rfq_line_id, supplier_id,
    unit_cost, quantity_available, condition_code,
    lead_time_days, quote_expiry, source_platform,
    source_ref, has_coc, has_8130, has_trace, notes,
  } = req.body;

  if (!sourcing_id || !supplier_id || !unit_cost)
    return res.status(400).json({ error: 'Sourcing ID, supplier, and unit cost are required.' });

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('sourcingId',   sql.BigInt,       sourcing_id)
      .input('rfqLineId',    sql.BigInt,       rfq_line_id)
      .input('supplierId',   sql.BigInt,       supplier_id)
      .input('unitCost',     sql.Decimal(10,2),unit_cost)
      .input('qtyAvail',     sql.Int,          quantity_available || null)
      .input('condition',    sql.NVarChar(5),  condition_code || null)
      .input('leadTime',     sql.Int,          lead_time_days || null)
      .input('expiry',       sql.Date,         quote_expiry || null)
      .input('platform',     sql.NVarChar(50), source_platform || null)
      .input('sourceRef',    sql.NVarChar(100),source_ref || null)
      .input('hasCoc',       sql.Bit,          has_coc ? 1 : 0)
      .input('has8130',      sql.Bit,          has_8130 ? 1 : 0)
      .input('hasTrace',     sql.Bit,          has_trace ? 1 : 0)
      .input('notes',        sql.NVarChar(sql.MAX), notes || null)
      .input('enteredBy',    sql.BigInt,       req.adminId)
      .query(`
        INSERT INTO sourcing_quotes
          (sourcing_id, rfq_line_id, supplier_id, unit_cost, quantity_available,
           condition_code, lead_time_days, quote_expiry, source_platform, source_ref,
           has_coc, has_8130, has_trace, notes, entered_by)
        OUTPUT INSERTED.*
        VALUES
          (@sourcingId, @rfqLineId, @supplierId, @unitCost, @qtyAvail,
           @condition, @leadTime, @expiry, @platform, @sourceRef,
           @hasCoc, @has8130, @hasTrace, @notes, @enteredBy)
      `);

    // Log market price
    const lineResult = await pool.request()
      .input('id', sql.BigInt, rfq_line_id)
      .query(`SELECT nsn, part_number FROM rfq_lines WHERE id = @id`);

    if (lineResult.recordset.length) {
      const line = lineResult.recordset[0];
      pool.request()
        .input('nsn',      sql.NVarChar(20),  line.nsn)
        .input('pn',       sql.NVarChar(100), line.part_number)
        .input('platform', sql.NVarChar(50),  source_platform)
        .input('price',    sql.Decimal(10,2), unit_cost)
        .input('cond',     sql.NVarChar(5),   condition_code)
        .input('observedBy', sql.BigInt,      req.adminId)
        .query(`INSERT INTO market_price_log (nsn, part_number, source_platform, listed_price, condition_code, observed_by) VALUES (@nsn, @pn, @platform, @price, @cond, @observedBy)`)
        .catch(() => {});
    }

    await logAudit({
      userType: 'admin', userId: req.adminId,
      action: 'created', entityType: 'sourcing_quote',
      entityId: result.recordset[0].id,
      summary: `Supplier quote entered: $${unit_cost} from supplier #${supplier_id}`,
      ipAddress: getIp(req),
    });

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save supplier quote.' });
  }
});

// ── PATCH /api/sourcing/quote/:id/select — select winning quote
router.patch('/quote/:id/select', requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();

    // Get the quote to find its sourcing_id
    const q = await pool.request()
      .input('id', sql.BigInt, req.params.id)
      .query(`SELECT * FROM sourcing_quotes WHERE id = @id`);

    if (!q.recordset.length) return res.status(404).json({ error: 'Quote not found.' });

    const { sourcing_id } = q.recordset[0];

    // Deselect all others for this sourcing request
    await pool.request()
      .input('sourcingId', sql.BigInt, sourcing_id)
      .query(`UPDATE sourcing_quotes SET is_selected = 0 WHERE sourcing_id = @sourcingId`);

    // Select this one
    await pool.request()
      .input('id', sql.BigInt, req.params.id)
      .query(`UPDATE sourcing_quotes SET is_selected = 1, updated_at = GETDATE() WHERE id = @id`);

    // Update sourcing request status
    await pool.request()
      .input('id', sql.BigInt, sourcing_id)
      .query(`UPDATE sourcing_requests SET status = 'Sourced', updated_at = GETDATE() WHERE id = @id`);

    await logAudit({
      userType: 'admin', userId: req.adminId,
      action: 'selected', entityType: 'sourcing_quote', entityId: req.params.id,
      summary: `Supplier quote #${req.params.id} selected as winning quote`,
      ipAddress: getIp(req),
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to select quote.' });
  }
});

export default router;
