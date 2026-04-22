// routes/settings.js
import { Router } from 'express';
import { getPool, sql } from '../db/connect.js';
import { requireAdmin } from '../middleware/auth.js';
import { logAudit, getIp } from '../middleware/audit.js';

const router = Router();

router.get('/', requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`SELECT setting_key, setting_value, description FROM system_settings ORDER BY setting_key`);
    // Return as object for easy frontend use
    const settings = Object.fromEntries(result.recordset.map(s => [s.setting_key, s.setting_value]));
    res.json(settings);
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

router.patch('/', requireAdmin, async (req, res) => {
  const updates = req.body; // { key: value, key: value }
  if (!updates || typeof updates !== 'object') return res.status(400).json({ error: 'Invalid payload.' });

  try {
    const pool = await getPool();
    for (const [key, value] of Object.entries(updates)) {
      await pool.request()
        .input('key',   sql.NVarChar(100), key)
        .input('value', sql.NVarChar(sql.MAX), String(value))
        .input('by',    sql.BigInt, req.adminId)
        .query(`UPDATE system_settings SET setting_value = @value, updated_by = @by, updated_at = GETDATE() WHERE setting_key = @key`);

      await logAudit({ userType: 'admin', userId: req.adminId, action: 'updated', entityType: 'system_settings', summary: `Setting updated: ${key}`, ipAddress: getIp(req) });
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

export default router;
