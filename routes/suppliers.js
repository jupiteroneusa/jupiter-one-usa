// routes/suppliers.js
import { Router } from 'express';
import { getPool, sql } from '../db/connect.js';
import { requireAdmin } from '../middleware/auth.js';
import { logAudit, getIp } from '../middleware/audit.js';

const router = Router();

router.get('/', requireAdmin, async (req, res) => {
  const { status, preferred, limit = 50, offset = 0 } = req.query;
  try {
    const pool = await getPool();
    const r = pool.request().input('lim', sql.Int, parseInt(limit)).input('off', sql.Int, parseInt(offset));
    const conditions = [];
    if (status) { r.input('status', sql.NVarChar, status); conditions.push('status = @status'); }
    if (preferred === 'true') conditions.push('is_preferred = 1');
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const result = await r.query(`SELECT * FROM suppliers ${where} ORDER BY is_preferred DESC, company_name OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY`);
    res.json(result.recordset);
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    const s = await pool.request().input('id', sql.BigInt, req.params.id).query(`SELECT * FROM suppliers WHERE id = @id`);
    if (!s.recordset.length) return res.status(404).json({ error: 'Supplier not found.' });
    const contacts = await pool.request().input('id', sql.BigInt, req.params.id).query(`SELECT * FROM supplier_contacts WHERE supplier_id = @id ORDER BY is_primary DESC`);
    const certs = await pool.request().input('id', sql.BigInt, req.params.id).query(`SELECT * FROM supplier_certifications WHERE supplier_id = @id ORDER BY expiry_date ASC`);
    const perf = await pool.request().input('id', sql.BigInt, req.params.id).query(`SELECT * FROM supplier_performance WHERE supplier_id = @id ORDER BY created_at DESC`);
    res.json({ ...s.recordset[0], contacts: contacts.recordset, certifications: certs.recordset, performance: perf.recordset });
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

router.post('/', requireAdmin, async (req, res) => {
  const { company_name, cage_code, website, address1, city, state, zip, country, is_preferred, notes } = req.body;
  if (!company_name) return res.status(400).json({ error: 'Company name required.' });
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('name',        sql.NVarChar(150), company_name)
      .input('cage',        sql.NVarChar(10),  cage_code || null)
      .input('website',     sql.NVarChar(255), website || null)
      .input('addr1',       sql.NVarChar(150), address1 || null)
      .input('city',        sql.NVarChar(100), city || null)
      .input('state',       sql.NVarChar(50),  state || null)
      .input('zip',         sql.NVarChar(20),  zip || null)
      .input('country',     sql.NVarChar(50),  country || 'USA')
      .input('preferred',   sql.Bit,           is_preferred ? 1 : 0)
      .input('notes',       sql.NVarChar(sql.MAX), notes || null)
      .query(`INSERT INTO suppliers (company_name, cage_code, website, address1, city, state, zip, country, is_preferred, notes) OUTPUT INSERTED.id VALUES (@name, @cage, @website, @addr1, @city, @state, @zip, @country, @preferred, @notes)`);
    await logAudit({ userType: 'admin', userId: req.adminId, action: 'created', entityType: 'supplier', entityId: result.recordset[0].id, summary: `Supplier created: ${company_name}`, ipAddress: getIp(req) });
    res.status(201).json({ id: result.recordset[0].id });
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

router.patch('/:id', requireAdmin, async (req, res) => {
  const { company_name, cage_code, website, status, is_preferred, notes } = req.body;
  try {
    const pool = await getPool();
    await pool.request()
      .input('id',        sql.BigInt,       req.params.id)
      .input('name',      sql.NVarChar(150),company_name || null)
      .input('cage',      sql.NVarChar(10), cage_code || null)
      .input('website',   sql.NVarChar(255),website || null)
      .input('status',    sql.NVarChar(20), status || null)
      .input('preferred', sql.Bit,          is_preferred ? 1 : 0)
      .input('notes',     sql.NVarChar(sql.MAX), notes || null)
      .query(`UPDATE suppliers SET company_name=COALESCE(@name,company_name), cage_code=COALESCE(@cage,cage_code), website=COALESCE(@website,website), status=COALESCE(@status,status), is_preferred=@preferred, notes=COALESCE(@notes,notes), updated_at=GETDATE() WHERE id=@id`);
    await logAudit({ userType: 'admin', userId: req.adminId, action: 'updated', entityType: 'supplier', entityId: req.params.id, ipAddress: getIp(req) });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed.' }); }
});

export default router;
