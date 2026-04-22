// routes/documents.js
import { Router } from 'express';
import { getPool, sql } from '../db/connect.js';
import { requireAdmin, requireCustomer } from '../middleware/auth.js';
import { logAudit, getIp } from '../middleware/audit.js';
import { BlobServiceClient } from '@azure/storage-blob';
import multer from 'multer';
import 'dotenv/config';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB max

async function uploadBlob(buffer, originalName, mimeType) {
  const ext = originalName.split('.').pop();
  const fileName = `docs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
    const fs = await import('fs');
    fs.mkdirSync('./tmp/docs', { recursive: true });
    fs.writeFileSync(`./tmp/${fileName}`, buffer);
    return { url: `http://localhost:${process.env.PORT || 3000}/tmp/${fileName}`, fileName, sizeKb: Math.round(buffer.length / 1024) };
  }

  const client = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
  const container = client.getContainerClient(process.env.AZURE_STORAGE_CONTAINER || 'jupiter-one-docs');
  await container.createIfNotExists({ access: 'blob' });
  const blob = container.getBlockBlobClient(fileName);
  await blob.uploadData(buffer, { blobHTTPHeaders: { blobContentType: mimeType } });
  return { url: blob.url, fileName, sizeKb: Math.round(buffer.length / 1024) };
}

// ── POST /api/documents/upload ────────────────────────────────
router.post('/upload', requireAdmin, upload.single('file'), async (req, res) => {
  const { entity_type, entity_id, doc_type, notes } = req.body;

  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  if (!entity_type || !entity_id) return res.status(400).json({ error: 'entity_type and entity_id required.' });

  try {
    const { url, sizeKb } = await uploadBlob(req.file.buffer, req.file.originalname, req.file.mimetype);

    const pool = await getPool();
    const result = await pool.request()
      .input('entityType',  sql.NVarChar(50),  entity_type)
      .input('entityId',    sql.BigInt,         parseInt(entity_id))
      .input('docType',     sql.NVarChar(50),   doc_type || 'Other')
      .input('fileName',    sql.NVarChar(255),  req.file.originalname)
      .input('fileUrl',     sql.NVarChar(500),  url)
      .input('sizeKb',      sql.Int,            sizeKb)
      .input('mimeType',    sql.NVarChar(100),  req.file.mimetype)
      .input('notes',       sql.NVarChar(500),  notes || null)
      .input('uploadedBy',  sql.BigInt,         req.adminId)
      .input('uploadType',  sql.NVarChar(10),   'admin')
      .query(`
        INSERT INTO documents (entity_type, entity_id, doc_type, file_name, file_url, file_size_kb, mime_type, notes, uploaded_by, uploaded_by_type)
        OUTPUT INSERTED.*
        VALUES (@entityType, @entityId, @docType, @fileName, @fileUrl, @sizeKb, @mimeType, @notes, @uploadedBy, @uploadType)
      `);

    await logAudit({
      userType: 'admin', userId: req.adminId,
      action: 'uploaded', entityType: entity_type, entityId: parseInt(entity_id),
      summary: `Document uploaded: ${req.file.originalname} (${doc_type})`,
      ipAddress: getIp(req),
    });

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed.' });
  }
});

// ── GET /api/documents/:entityType/:entityId ──────────────────
router.get('/:entityType/:entityId', requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('type', sql.NVarChar(50), req.params.entityType)
      .input('id',   sql.BigInt,       req.params.entityId)
      .query(`SELECT * FROM documents WHERE entity_type = @type AND entity_id = @id ORDER BY created_at DESC`);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load documents.' });
  }
});

// ── DELETE /api/documents/:id ─────────────────────────────────
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.BigInt, req.params.id)
      .query(`DELETE FROM documents OUTPUT DELETED.file_name WHERE id = @id`);
    if (!result.recordset.length) return res.status(404).json({ error: 'Document not found.' });
    await logAudit({ userType: 'admin', userId: req.adminId, action: 'deleted', entityType: 'document', entityId: req.params.id, summary: `Document deleted: ${result.recordset[0].file_name}`, ipAddress: getIp(req) });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete document.' });
  }
});

export default router;
