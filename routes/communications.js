// routes/communications.js
import { Router } from 'express';
import { getPool, sql } from '../db/connect.js';
import { requireAdminCookie } from '../middleware/auth.js';

const router = Router();

// ── GET /api/communications — unified inbox ───────────────────
router.get('/', requireAdminCookie, async (req, res) => {
  const { type, status, limit = 50, offset = 0 } = req.query;
  try {
    const pool = await getPool();

    // Contact messages
    let contacts = [];
    if (!type || type === 'contact') {
      const r = await pool.request()
        .input('lim', sql.Int, parseInt(limit))
        .input('off', sql.Int, parseInt(offset))
        .query(`
          SELECT
            id, 'contact' AS type, name, email, company, subject AS title,
            message AS preview, status, submitted_at AS created_at, NULL AS line_count
          FROM contact_messages
          ORDER BY submitted_at DESC
          OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY
        `);
      contacts = r.recordset;
    }

    // RFQ submissions
    let rfqs = [];
    if (!type || type === 'rfq') {
      const r = await pool.request()
        .input('lim', sql.Int, parseInt(limit))
        .input('off', sql.Int, parseInt(offset))
        .query(`
          SELECT
            h.id, 'rfq' AS type,
            c.first_name + ' ' + c.last_name AS name,
            c.email, c.company,
            h.rfq_number AS title,
            h.notes AS preview,
            h.status, h.submitted_at AS created_at,
            COUNT(l.id) AS line_count
          FROM rfq_headers h
          JOIN customers c ON c.id = h.customer_id
          LEFT JOIN rfq_lines l ON l.rfq_id = h.id
          GROUP BY h.id, h.rfq_number, h.notes, h.status, h.submitted_at,
                   c.first_name, c.last_name, c.email, c.company
          ORDER BY h.submitted_at DESC
          OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY
        `);
      rfqs = r.recordset;
    }

    // Merge and sort by created_at
    const all = [...contacts, ...rfqs].sort((a, b) =>
      new Date(b.created_at) - new Date(a.created_at)
    );

    // Group by type
    const grouped = {
      all,
      contact: all.filter(m => m.type === 'contact'),
      rfq: all.filter(m => m.type === 'rfq'),
      counts: {
        total: all.length,
        contact: all.filter(m => m.type === 'contact').length,
        rfq: all.filter(m => m.type === 'rfq').length,
        new: all.filter(m => m.status === 'New' || m.status === 'Submitted').length,
      }
    };

    res.json(grouped);
  } catch (err) {
    console.error('Communications inbox error:', err);
    res.status(500).json({ error: 'Failed to load inbox.' });
  }
});

// ── PATCH /api/communications/contact/:id/status ─────────────
router.patch('/contact/:id/status', requireAdminCookie, async (req, res) => {
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
