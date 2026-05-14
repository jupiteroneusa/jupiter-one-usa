// LEAD_TIME_CHAIN_V1
// routes/quotes.js
import { Router } from 'express';
import { getPool, sql } from '../db/connect.js';
import { requireCustomer, requireAdmin } from '../middleware/auth.js';
import { logAudit, getIp } from '../middleware/audit.js';
import { generateNumber } from '../db/numbering.js';
import { generateQuotePdf } from '../services/pdfService.js';
import { sendQuoteToCustomer } from '../services/mailer.js';

const router = Router();

// ── POST /api/quotes — build a new quote from RFQ ────────────
router.post('/', requireAdmin, async (req, res) => {
  const { rfq_id, lines, valid_days = 30, payment_terms, delivery_terms, notes } = req.body;

  if (!rfq_id || !lines?.length)
    return res.status(400).json({ error: 'RFQ ID and quote lines are required.' });

  try {
    const pool = await getPool();

    // Get customer from RFQ
    const rfqResult = await pool.request()
      .input('rfqId', sql.BigInt, rfq_id)
      .query(`SELECT h.*, c.first_name, c.last_name, c.email, c.company FROM rfq_headers h JOIN customers c ON c.id = h.customer_id WHERE h.id = @rfqId`);

    if (!rfqResult.recordset.length) return res.status(404).json({ error: 'RFQ not found.' });
    const rfq = rfqResult.recordset[0];

    const quoteNumber = await generateNumber('QT');
    const validUntil = new Date(Date.now() + valid_days * 24 * 60 * 60 * 1000);

    // Calculate totals
    let subtotal = 0, totalCost = 0;
    const processedLines = lines.map((l, i) => {
      const unitPrice  = parseFloat(l.unit_price);
      const unitCost   = parseFloat(l.unit_cost || 0);
      const qty        = parseInt(l.quantity);
      const lineTotal  = unitPrice * qty;
      const lineCost   = unitCost * qty;
      const lineMargin = lineTotal - lineCost;
      // MARKUP_CLAMP_V1: clamp to decimal(5,2) range to avoid DB overflow
    const _rawMarkup = unitCost > 0 ? ((unitPrice - unitCost) / unitCost) * 100 : 0;
    const markupPct = Math.min(999.99, Math.max(-999.99, Number.isFinite(_rawMarkup) ? _rawMarkup : 0));
      const marginPct  = lineTotal > 0 ? (lineMargin / lineTotal) * 100 : 0;
      subtotal   += lineTotal;
      totalCost  += lineCost;
      return { ...l, line_number: i + 1, unit_price: unitPrice, unit_cost: unitCost, line_total: lineTotal, line_cost: lineCost, line_margin: lineMargin, markup_pct: markupPct, margin_pct: marginPct };
    });

    const totalMargin = subtotal - totalCost;

    // Get settings for default notes
    const settingsResult = await pool.request().query(`SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('quote_footer_text','company_name','company_address','company_phone','company_email')`);
    const settings = Object.fromEntries(settingsResult.recordset.map(s => [s.setting_key, s.setting_value]));

    // Insert quote header
    const quoteResult = await pool.request()
      .input('rfqId',         sql.BigInt,       rfq_id)
      .input('customerId',    sql.BigInt,       rfq.customer_id)
      .input('quoteNumber',   sql.NVarChar(20), quoteNumber)
      .input('subtotal',      sql.Decimal(12,2),subtotal)
      .input('totalAmount',   sql.Decimal(12,2),subtotal) // tax added later if needed
      .input('totalCost',     sql.Decimal(12,2),totalCost)
      .input('totalMargin',   sql.Decimal(12,2),totalMargin)
      .input('validUntil',    sql.Date,         validUntil)
      .input('paymentTerms',  sql.NVarChar(100),payment_terms || 'Credit Card, COD, or Wire Transfer')
      .input('deliveryTerms', sql.NVarChar(255),delivery_terms || null)
      .input('notes',         sql.NVarChar(sql.MAX), notes || settings.quote_footer_text)
      .input('createdBy',     sql.BigInt,       req.adminId)
      .query(`
        INSERT INTO quotes
          (rfq_id, customer_id, quote_number, subtotal, total_amount, total_cost, total_margin,
           valid_until, payment_terms, delivery_terms, notes, created_by)
        OUTPUT INSERTED.id, INSERTED.quote_number
        VALUES
          (@rfqId, @customerId, @quoteNumber, @subtotal, @totalAmount, @totalCost, @totalMargin,
           @validUntil, @paymentTerms, @deliveryTerms, @notes, @createdBy)
      `);

    const quote = quoteResult.recordset[0];

    // Insert lines
    for (const l of processedLines) {
      await pool.request()
        .input('quoteId',    sql.BigInt,        quote.id)
        .input('rfqLineId',  sql.BigInt,        l.rfq_line_id || null)
        .input('sqId',       sql.BigInt,        l.sourcing_quote_id || null)
        .input('lineNum',    sql.Int,           l.line_number)
        .input('nsn',        sql.NVarChar(20),  l.nsn || null)
        .input('partNum',    sql.NVarChar(100), l.part_number || null)
        .input('itemName',   sql.NVarChar(255), l.item_name || null)
        .input('condition',  sql.NVarChar(5),   l.condition_code || null)
        .input('qty',        sql.Int,           l.quantity)
        .input('ui',         sql.NVarChar(10),  l.unit_of_issue || null)
        .input('unitCost',   sql.Decimal(10,2), l.unit_cost)
        .input('markupPct',  sql.Decimal(5,2),  l.markup_pct)
        .input('unitPrice',  sql.Decimal(10,2), l.unit_price)
        .input('lineTotal',  sql.Decimal(12,2), l.line_total)
        .input('lineCost',   sql.Decimal(12,2), l.line_cost)
        .input('lineMargin', sql.Decimal(12,2), l.line_margin)
        .input('marginPct',  sql.Decimal(5,2),  l.margin_pct)
        .input('leadTime',   sql.Int,           l.lead_time_days || null)
        .input('notes',      sql.NVarChar(500), l.notes || null)
        .query(`
          INSERT INTO quote_lines
            (quote_id, rfq_line_id, sourcing_quote_id, line_number, nsn, part_number,
             item_name, condition_code, quantity, unit_of_issue, unit_cost, markup_pct,
             unit_price, line_total, line_cost, line_margin, margin_pct, lead_time_days, notes)
          VALUES
            (@quoteId, @rfqLineId, @sqId, @lineNum, @nsn, @partNum,
             @itemName, @condition, @qty, @ui, @unitCost, @markupPct,
             @unitPrice, @lineTotal, @lineCost, @lineMargin, @marginPct, @leadTime, @notes)
        `);
    }

    // Save initial revision snapshot
    await pool.request()
      .input('quoteId',  sql.BigInt, quote.id)
      .input('version',  sql.Int,    1)
      .input('snapshot', sql.NVarChar(sql.MAX), JSON.stringify({ lines: processedLines, subtotal, totalCost, totalMargin }))
      .input('by',       sql.BigInt, req.adminId)
      .query(`INSERT INTO quote_revisions (quote_id, version, snapshot, reason, revised_by) VALUES (@quoteId, @version, @snapshot, 'Initial quote', @by)`);

    await logAudit({
      userType: 'admin', userId: req.adminId,
      action: 'created', entityType: 'quote', entityId: quote.id,
      summary: `Quote ${quoteNumber} created for RFQ #${rfq_id} — $${subtotal.toFixed(2)}`,
      ipAddress: getIp(req),
    });

    res.status(201).json({ success: true, id: quote.id, quote_number: quoteNumber });

  } catch (err) {
    console.error('Quote create error:', err);
    res.status(500).json({ error: 'Failed to create quote.' });
  }
});

// ── POST /api/quotes/:id/send — generate PDF and email to customer
router.post('/:id/send', requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();

    const quoteResult = await pool.request()
      .input('id', sql.BigInt, req.params.id)
      .query(`
        SELECT q.*, c.first_name, c.last_name, c.email, c.company, c.phone
        FROM quotes q JOIN customers c ON c.id = q.customer_id
        WHERE q.id = @id
      `);

    if (!quoteResult.recordset.length) return res.status(404).json({ error: 'Quote not found.' });
    const quote = quoteResult.recordset[0];

    const linesResult = await pool.request()
      .input('quoteId', sql.BigInt, req.params.id)
      .query(`SELECT * FROM quote_lines WHERE quote_id = @quoteId ORDER BY line_number`);

    // Generate PDF
    const pdfUrl = await generateQuotePdf({ quote, lines: linesResult.recordset });

    // Update quote — mark as sent, save PDF URL
    await pool.request()
      .input('id',     sql.BigInt,       req.params.id)
      .input('pdfUrl', sql.NVarChar(500),pdfUrl)
      .query(`UPDATE quotes SET status = 'Sent', sent_at = GETDATE(), pdf_url = @pdfUrl, updated_at = GETDATE() WHERE id = @id`);

    // Update RFQ status
    await pool.request()
      .input('rfqId', sql.BigInt, quote.rfq_id)
      .query(`UPDATE rfq_headers SET status = 'Quoted', updated_at = GETDATE() WHERE id = @rfqId`);

    // Email customer
    const customer = { first_name: quote.first_name, last_name: quote.last_name, email: quote.email };
    await sendQuoteToCustomer({ customer, quote, lines: linesResult.recordset, pdfUrl });

    await logAudit({
      userType: 'admin', userId: req.adminId,
      action: 'sent', entityType: 'quote', entityId: req.params.id,
      summary: `Quote ${quote.quote_number} sent to ${quote.email}`,
      ipAddress: getIp(req),
    });

    res.json({ success: true, pdf_url: pdfUrl });
  } catch (err) {
    console.error('Quote send error:', err);
    res.status(500).json({ error: 'Failed to send quote.' });
  }
});

// ── POST /api/quotes/:id/accept — customer accepts quote ─────
router.post('/:id/accept', requireCustomer, async (req, res) => {
  try {
    const pool = await getPool();

    const result = await pool.request()
      .input('id',         sql.BigInt, req.params.id)
      .input('customerId', sql.BigInt, req.customerId)
      .query(`SELECT * FROM quotes WHERE id = @id AND customer_id = @customerId AND status = 'Sent'`);

    if (!result.recordset.length)
      return res.status(404).json({ error: 'Quote not found or no longer available.' });

    // Phase A1: Block accept if expired or already finalized
      const _qCheck = await pool.request().input('id', sql.BigInt, req.params.id)
        .query("SELECT valid_until, status FROM quotes WHERE id=@id");
      if (!_qCheck.recordset.length) return res.status(404).json({ error: 'Quote not found' });
      const _qq = _qCheck.recordset[0];
      if (_qq.status === 'Accepted') return res.status(400).json({ error: 'Quote has already been accepted' });
      if (_qq.status === 'Rejected') return res.status(400).json({ error: 'Quote has been rejected and cannot be accepted' });
      if (_qq.status === 'Expired') return res.status(410).json({ error: 'Quote has expired - please contact us for a new quote' });
      if (_qq.valid_until && new Date(_qq.valid_until) < new Date()) {
        await pool.request().input('id', sql.BigInt, req.params.id)
          .query("UPDATE quotes SET status='Expired', expired_at=GETDATE(), updated_at=GETDATE() WHERE id=@id");
        return res.status(410).json({ error: 'Quote has expired - please contact us for a new quote' });
      }
      await pool.request()
      .input('id', sql.BigInt, req.params.id)
      .query(`UPDATE quotes SET status = 'Accepted', accepted_at = GETDATE(), updated_at = GETDATE() WHERE id = @id`);

    // Auto-create order from accepted quote
    try {
      const q = result.recordset[0];
      const orderNumber = await generateNumber('ORD');
      const orderResult = await pool.request()
        .input('quoteId',      sql.BigInt,        req.params.id)
        .input('rfqId',        sql.BigInt,        q.rfq_id)
        .input('customerId',   sql.BigInt,        req.customerId)
        .input('orderNumber',  sql.NVarChar(20),  orderNumber)
        .input('subtotal',     sql.Decimal(12,2), q.subtotal || q.total_amount)
        .input('totalAmount',  sql.Decimal(12,2), q.total_amount)
        .input('paymentTerms', sql.NVarChar(100), q.payment_terms || 'Credit Card or Wire Transfer')
        .query(`INSERT INTO orders (quote_id,rfq_id,customer_id,order_number,subtotal,total_amount)
          OUTPUT INSERTED.id, INSERTED.order_number
          VALUES (@quoteId,@rfqId,@customerId,@orderNumber,@subtotal,@totalAmount)`);
      const order = orderResult.recordset[0];
      const qLines = await pool.request().input('qid', sql.BigInt, req.params.id)
        .query('SELECT * FROM quote_lines WHERE quote_id=@qid ORDER BY line_number');
      for (const l of qLines.recordset) {
        const olR = await pool.request()
          .input('orderId', sql.BigInt,        order.id)
          .input('qlId',    sql.BigInt,        l.id)
          .input('lineNum', sql.Int,           l.line_number)
          .input('nsn',     sql.NVarChar(20),  l.nsn || null)
          .input('pn',      sql.NVarChar(100), l.part_number || null)
          .input('name',    sql.NVarChar(255), l.item_name || null)
          .input('cond',    sql.NVarChar(5),   l.condition_code || null)
          .input('qty',     sql.Int,           l.quantity)
          .input('price',   sql.Decimal(10,2), l.unit_price)
          .input('total',   sql.Decimal(12,2), l.line_total)
          .query(`INSERT INTO order_lines (order_id,quote_line_id,line_number,nsn,part_number,item_name,condition_code,quantity_ordered,unit_price,line_total)
            OUTPUT INSERTED.id
            VALUES (@orderId,@qlId,@lineNum,@nsn,@pn,@name,@cond,@qty,@price,@total)`);
        // [Rewire 2] Copy quote_line_sources -> order_line_sources for this order line
        try {
          const newOrderLineId = olR && olR.recordset && olR.recordset[0] && olR.recordset[0].id;
          if (newOrderLineId && l.id) {
            const srcR = await pool.request().input('qli', sql.BigInt, l.id)
              .query('SELECT * FROM quote_line_sources WHERE quote_line_id=@qli ORDER BY sort_order');
            for (const _s of srcR.recordset) {
              await pool.request()
                .input('oli', sql.BigInt, newOrderLineId)
                .input('qlsi', sql.BigInt, _s.id)
                .input('sid', sql.BigInt, _s.supplier_id)
                .input('aq', sql.Int, _s.allocated_qty)
                .input('uc', sql.Decimal(10,2), _s.unit_cost)
                .input('ld', sql.Int, _s.supplier_lead_time_days)
                .input('ltt', sql.NVarChar(sql.MAX), _s.lead_time_text || null)
                .input('h81r', sql.Bit, _s.has_8130 ? 1 : 0)
                .input('hcocr', sql.Bit, _s.has_coc ? 1 : 0)
                .input('htracr', sql.Bit, _s.has_trace ? 1 : 0)
                .input('nt', sql.NVarChar(500), _s.notes)
                .input('so', sql.Int, _s.sort_order)
                .query('INSERT INTO order_line_sources (order_line_id, quote_line_source_id, supplier_id, allocated_qty, unit_cost, supplier_lead_time_days, lead_time_text, has_8130_required, has_coc_required, has_trace_required, notes, sort_order) VALUES (@oli, @qlsi, @sid, @aq, @uc, @ld, @ltt, @h81r, @hcocr, @htracr, @nt, @so)');
            }
          }
        } catch(srcErr) { console.error('Copy sources error:', srcErr.message); }
      }
      await pool.request().input('oid', sql.BigInt, order.id)
        .query(`INSERT INTO order_status_log (order_id,new_status,note) VALUES (@oid,'Confirmed','Auto-created from accepted quote')`);
      const custR = await pool.request().input('cid', sql.BigInt, req.customerId)
        .query('SELECT first_name, last_name, email FROM customers WHERE id=@cid');
      if (custR.recordset.length) {
        const { sendOrderConfirmation } = await import('../services/mailer.js');
        sendOrderConfirmation({ customer: custR.recordset[0], order: { ...order, total_amount: q.total_amount, payment_terms: q.payment_terms } }).catch(console.error);
      }
      console.log('Order auto-created:', orderNumber);
    } catch(orderErr) { console.error('Auto-order error:', orderErr.message); }

    await logAudit({
      userType: 'customer', userId: req.customerId,
      action: 'accepted', entityType: 'quote', entityId: req.params.id,
      summary: `Customer accepted quote ${result.recordset[0].quote_number}`,
      ipAddress: getIp(req),
    });

    res.json({ success: true, message: 'Quote accepted. We will confirm your order shortly.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to accept quote.' });
  }
});

// ── GET /api/quotes/:id — quote detail (customer or admin) ────
// POST /api/quotes/:id/reject - customer rejects a quote
router.post('/:id/reject', requireCustomer, async (req, res) => {
  const { reason } = req.body;
  try {
    const pool = await getPool();
    const qR = await pool.request().input('id', sql.BigInt, req.params.id).input('cid', sql.BigInt, req.customerId)
      .query('SELECT id, status FROM quotes WHERE id=@id AND customer_id=@cid');
    if (!qR.recordset.length) return res.status(404).json({ error: 'Quote not found' });
    const q = qR.recordset[0];
    if (q.status === 'Accepted') return res.status(400).json({ error: 'Quote already accepted' });
    if (q.status === 'Rejected') return res.status(400).json({ error: 'Quote already rejected' });
    await pool.request()
      .input('id', sql.BigInt, req.params.id)
      .input('reason', sql.NVarChar(1000), reason || null)
      .query("UPDATE quotes SET status='Rejected', rejected_at=GETDATE(), rejection_reason=@reason, updated_at=GETDATE() WHERE id=@id");
    try { await logAudit({ entity_type: 'quote', entity_id: req.params.id, action: 'rejected', performed_by: req.customerId, performed_by_type: 'customer', ip_address: getIp(req), notes: reason || null }); } catch(e) {}
    res.json({ ok: true });
  } catch(err) { console.error('Quote reject error:', err); res.status(500).json({ error: err.message }); }
});

router.get('/:id', requireCustomer, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id',         sql.BigInt, req.params.id)
      .input('customerId', sql.BigInt, req.customerId)
      .query(`SELECT q.*, r.rfq_number FROM quotes q JOIN rfq_headers r ON r.id = q.rfq_id WHERE q.id = @id AND q.customer_id = @customerId`);

    if (!result.recordset.length) return res.status(404).json({ error: 'Quote not found.' });

    const lines = await pool.request()
      .input('quoteId', sql.BigInt, req.params.id)
      .query(`SELECT * FROM quote_lines WHERE quote_id = @quoteId ORDER BY line_number`);

    res.json({ ...result.recordset[0], lines: lines.recordset });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load quote.' });
  }
});

// ── GET /api/quotes — customer's quote history ────────────────
router.get('/', requireCustomer, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('customerId', sql.BigInt, req.customerId)
      .query(`
        SELECT q.id, q.quote_number, q.status, q.total_amount, q.valid_until, q.sent_at, q.pdf_url, r.rfq_number
        FROM quotes q JOIN rfq_headers r ON r.id = q.rfq_id
        WHERE q.customer_id = @customerId
        ORDER BY q.created_at DESC
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load quotes.' });
  }
});

export default router;
