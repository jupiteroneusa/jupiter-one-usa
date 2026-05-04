const fs = require('fs');

let a = fs.readFileSync('admin/index.js', 'utf8');

// Fix: use RFQ sequence number for quote instead of generating new one
const oldQuoteNum = `      const { generateNumber } = await import('../db/numbering.js');
      const quoteNumber = await generateNumber('QT');`;

const newQuoteNum = `      // Use same sequence number as RFQ for matching (RFQ-2026-00001 -> QT-2026-00001)
      const quoteNumber = rfq.rfq_number.replace(/^RFQ-/, 'QT-');`;

if (a.includes(oldQuoteNum)) {
  a = a.replace(oldQuoteNum, newQuoteNum);
  console.log('Quote numbering: FIXED');
} else {
  console.log('Quote numbering: NOT FOUND');
}

// Fix: make quote revisable - check if quote exists for this RFQ first, update instead of insert
const oldInsertQuote = `      const qr = await pool.request()
        .input('rfqId', sql.BigInt, rfq.id)
        .input('customerId', sql.BigInt, rfq.customer_id)
        .input('quoteNumber', sql.NVarChar(20), quoteNumber)
        .input('subtotal', sql.Decimal(12,2), subtotal)
        .input('totalAmount', sql.Decimal(12,2), subtotal)
        .input('totalCost', sql.Decimal(12,2), totalCost)
        .input('totalMargin', sql.Decimal(12,2), subtotal - totalCost)
        .input('validUntil', sql.Date, validUntil)
        .input('paymentTerms', sql.NVarChar(100), payment_terms || 'Credit Card or Wire Transfer')
        .input('notes', sql.NVarChar(sql.MAX), notes || null)
        .query(\`
          INSERT INTO quotes (rfq_id, customer_id, quote_number, subtotal, total_amount, total_cost, total_margin, valid_until, payment_terms, notes, status)
          OUTPUT INSERTED.id, INSERTED.quote_number
          VALUES (@rfqId, @customerId, @quoteNumber, @subtotal, @totalAmount, @totalCost, @totalMargin, @validUntil, @paymentTerms, @notes, 'Sent')
        \`);
      const quote = qr.recordset[0];`;

const newInsertQuote = `      // Check if quote already exists for this RFQ - if so, update it (revision)
      const existingQuote = await pool.request()
        .input('rfqId2', sql.BigInt, rfq.id)
        .query('SELECT id, quote_number FROM quotes WHERE rfq_id=@rfqId2');

      let quote;
      if (existingQuote.recordset.length) {
        // Update existing quote
        const qr = await pool.request()
          .input('rfqId', sql.BigInt, rfq.id)
          .input('subtotal', sql.Decimal(12,2), subtotal)
          .input('totalAmount', sql.Decimal(12,2), subtotal)
          .input('totalCost', sql.Decimal(12,2), totalCost)
          .input('totalMargin', sql.Decimal(12,2), subtotal - totalCost)
          .input('validUntil', sql.Date, validUntil)
          .input('paymentTerms', sql.NVarChar(100), payment_terms || 'Credit Card or Wire Transfer')
          .input('notes', sql.NVarChar(sql.MAX), notes || null)
          .query(\`
            UPDATE quotes SET
              subtotal=@subtotal, total_amount=@totalAmount, total_cost=@totalCost,
              total_margin=@totalMargin, valid_until=@validUntil, payment_terms=@paymentTerms,
              notes=@notes, status='Sent', updated_at=GETDATE()
            OUTPUT INSERTED.id, INSERTED.quote_number
            WHERE rfq_id=@rfqId
          \`);
        quote = qr.recordset[0];
        // Delete old lines and reinsert
        await pool.request().input('qid', sql.BigInt, quote.id)
          .query('DELETE FROM quote_lines WHERE quote_id=@qid');
        console.log('Quote revised:', quote.quote_number);
      } else {
        // Insert new quote
        const qr = await pool.request()
          .input('rfqId', sql.BigInt, rfq.id)
          .input('customerId', sql.BigInt, rfq.customer_id)
          .input('quoteNumber', sql.NVarChar(20), quoteNumber)
          .input('subtotal', sql.Decimal(12,2), subtotal)
          .input('totalAmount', sql.Decimal(12,2), subtotal)
          .input('totalCost', sql.Decimal(12,2), totalCost)
          .input('totalMargin', sql.Decimal(12,2), subtotal - totalCost)
          .input('validUntil', sql.Date, validUntil)
          .input('paymentTerms', sql.NVarChar(100), payment_terms || 'Credit Card or Wire Transfer')
          .input('notes', sql.NVarChar(sql.MAX), notes || null)
          .query(\`
            INSERT INTO quotes (rfq_id, customer_id, quote_number, subtotal, total_amount, total_cost, total_margin, valid_until, payment_terms, notes, status)
            OUTPUT INSERTED.id, INSERTED.quote_number
            VALUES (@rfqId, @customerId, @quoteNumber, @subtotal, @totalAmount, @totalCost, @totalMargin, @validUntil, @paymentTerms, @notes, 'Sent')
          \`);
        quote = qr.recordset[0];
      }`;

if (a.includes(oldInsertQuote)) {
  a = a.replace(oldInsertQuote, newInsertQuote);
  console.log('Quote revision logic: FIXED');
} else {
  console.log('Quote revision logic: NOT FOUND');
}

fs.writeFileSync('admin/index.js', a);
console.log('Done.');
