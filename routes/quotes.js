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
      const markupPct  = unitCost > 0 ? ((unitPrice - unitCost) / unitCost) * 100 : 0;
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
        .query(`INSERT INTO orders (quote_id,rfq_id,customer_id,order_number,subtotal,total_amount,payment_terms,status,confirmed_at)
          OUTPUT INSERTED.id, INSERTED.order_number
          VALUES (@quoteId,@rfqId,@customerId,@orderNumber,@subtotal,@totalAmount,@paymentTerms,'Confirmed',GETDATE())`);
      const order = orderResult.recordset[0];
      const qLines = await pool.request().input('qid', sql.BigInt, req.params.id)
        .query('SELECT * FROM quote_lines WHERE quote_id=@qid ORDER BY line_number');
      for (const l of qLines.recordset) {
        await pool.request()
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
            VALUES (@orderId,@qlId,@lineNum,@nsn,@pn,@name,@cond,@qty,@price,@total)`);
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
