// routes/shipments.js
import { Router } from 'express';
import { getPool, sql } from '../db/connect.js';
import { requireCustomer, requireAdmin } from '../middleware/auth.js';
import { logAudit, getIp } from '../middleware/audit.js';
import { generateNumber } from '../db/numbering.js';
import { sendShipmentNotification } from '../services/mailer.js';

const router = Router();

router.post('/', requireAdmin, async (req, res) => {
  const { order_id, carrier, tracking_number, tracking_url, service_level, ship_date, estimated_delivery, shipping_cost, lines } = req.body;
  try {
    const pool = await getPool();
    const orderResult = await pool.request().input('id', sql.BigInt, order_id)
      .query(`SELECT o.*, c.first_name, c.last_name, c.email FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = @id`);
    if (!orderResult.recordset.length) return res.status(404).json({ error: 'Order not found.' });
    const order = orderResult.recordset[0];

    const shipNum = await generateNumber('SHP');
    const shipResult = await pool.request()
      .input('orderId',    sql.BigInt,       order_id)
      .input('shipNum',    sql.NVarChar(20), shipNum)
      .input('carrier',    sql.NVarChar(100),carrier || null)
      .input('tracking',   sql.NVarChar(100),tracking_number || null)
      .input('trackUrl',   sql.NVarChar(500),tracking_url || null)
      .input('service',    sql.NVarChar(100),service_level || null)
      .input('shipDate',   sql.Date,         ship_date || null)
      .input('estDel',     sql.Date,         estimated_delivery || null)
      .input('cost',       sql.Decimal(10,2),shipping_cost || null)
      .input('createdBy',  sql.BigInt,       req.adminId)
      .query(`INSERT INTO shipments (order_id, shipment_number, carrier, tracking_number, tracking_url, service_level, ship_date, estimated_delivery, shipping_cost, status, created_by) OUTPUT INSERTED.id VALUES (@orderId, @shipNum, @carrier, @tracking, @trackUrl, @service, @shipDate, @estDel, @cost, 'Shipped', @createdBy)`);

    const shipmentId = shipResult.recordset[0].id;

    // Link order lines to shipment
    if (lines?.length) {
      for (const l of lines) {
        await pool.request()
          .input('shipId',  sql.BigInt, shipmentId)
          .input('lineId',  sql.BigInt, l.order_line_id)
          .input('qty',     sql.Int,    l.quantity_shipped)
          .query(`INSERT INTO shipment_lines (shipment_id, order_line_id, quantity_shipped) VALUES (@shipId, @lineId, @qty)`);
        await pool.request()
          .input('id',  sql.BigInt, l.order_line_id)
          .input('qty', sql.Int,    l.quantity_shipped)
          .query(`UPDATE order_lines SET quantity_shipped = quantity_shipped + @qty, status = 'Shipped' WHERE id = @id`);
      }
    }

    // Update order status
    await pool.request().input('id', sql.BigInt, order_id).query(`UPDATE orders SET status = 'Shipped', updated_at = GETDATE() WHERE id = @id`);
    await pool.request().input('id', sql.BigInt, order_id).input('status', sql.NVarChar, 'Shipped').query(`INSERT INTO order_status_log (order_id, new_status, note) VALUES (@id, @status, 'Shipment created')`);

    const customer = { first_name: order.first_name, last_name: order.last_name, email: order.email };
    const shipment = { carrier, tracking_number, tracking_url, estimated_delivery };
    sendShipmentNotification({ customer, order, shipment }).catch(console.error);

    await logAudit({ userType: 'admin', userId: req.adminId, action: 'created', entityType: 'shipment', entityId: shipmentId, summary: `Shipment ${shipNum} created`, ipAddress: getIp(req) });
    res.status(201).json({ id: shipmentId, shipment_number: shipNum });
  } catch (err) {
    console.error('Shipment error:', err);
    res.status(500).json({ error: 'Failed to create shipment.' });
  }
});

router.get('/:id', requireCustomer, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().input('id', sql.BigInt, req.params.id).query(`SELECT s.*, o.customer_id FROM shipments s JOIN orders o ON o.id = s.order_id WHERE s.id = @id`);
    if (!result.recordset.length) return res.status(404).json({ error: 'Not found.' });
    if (result.recordset[0].customer_id !== req.customerId) return res.status(403).json({ error: 'Forbidden.' });
    const events = await pool.request().input('id', sql.BigInt, req.params.id).query(`SELECT * FROM shipment_events WHERE shipment_id = @id ORDER BY event_timestamp DESC`);
    res.json({ ...result.recordset[0], events: events.recordset });
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

export default router;
