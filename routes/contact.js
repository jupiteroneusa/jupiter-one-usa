// routes/contact.js
import { Router } from 'express';
import { getPool, sql } from '../db/connect.js';
import { sendContactNotificationAdmin } from '../services/mailer.js';

const router = Router();

// ── POST /api/contact — submit contact form ───────────────────
router.post('/', async (req, res) => {
  const { name, email, phone, company, subject, message } = req.body;

  if (!name || !email || !message)
    return res.status(400).json({ error: 'Name, email and message are required.' });

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('name',    sql.NVarChar(100), name)
      .input('email',   sql.NVarChar(150), email)
      .input('phone',   sql.NVarChar(30),  phone || null)
      .input('company', sql.NVarChar(150), company || null)
      .input('subject', sql.NVarChar(255), subject || null)
      .input('message', sql.NVarChar(sql.MAX), message)
      .input('ip',      sql.NVarChar(45),  req.headers['x-forwarded-for'] || req.socket.remoteAddress)
      .query(`
        INSERT INTO contact_messages (name, email, phone, company, subject, message, ip_address)
        OUTPUT INSERTED.id, INSERTED.submitted_at
        VALUES (@name, @email, @phone, @company, @subject, @message, @ip)
      `);

    const record = result.recordset[0];

    // Email admin
    sendContactNotificationAdmin({ name, email, phone, company, subject, message }).catch(console.error);

    res.status(201).json({ success: true, id: record.id });
  } catch (err) {
    console.error('Contact form error:', err);
    res.status(500).json({ error: 'Failed to submit. Please try again.' });
  }
});

// ── GET /api/contact/admin/all — all messages ─────────────────
import { requireAdminCookie } from '../middleware/auth.js';

router.get('/admin/all', requireAdminCookie, async (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query;
  try {
    const pool = await getPool();
    const r = pool.request()
      .input('lim', sql.Int, parseInt(limit))
      .input('off', sql.Int, parseInt(offset));

    let where = '';
    if (status) { r.input('status', sql.NVarChar, status); where = 'WHERE status = @status'; }

    const result = await r.query(`
      SELECT id, name, email, phone, company, subject, message, status, submitted_at
      FROM contact_messages
      ${where}
      ORDER BY submitted_at DESC
      OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load messages.' });
  }
});

// ── PATCH /api/contact/admin/:id/status ──────────────────────
router.patch('/admin/:id/status', requireAdminCookie, async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Status required.' });
  try {
    const pool = await getPool();
    await pool.request()
      .input('id',     sql.BigInt,   req.params.id)
      .input('status', sql.NVarChar, status)
      .query(`UPDATE contact_messages SET status = @status WHERE id = @id`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Update failed.' });
  }
});

export default router;
