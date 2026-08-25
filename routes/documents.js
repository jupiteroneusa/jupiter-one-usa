// routes/documents.js
import { Router } from 'express';
import { getPool, sql } from '../db/connect.js';
import { requireAdmin, requireCustomer } from '../middleware/auth.js';
import { logAudit, getIp } from '../middleware/audit.js';
import { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob'; /* DOC_DOWNLOAD_ROUTE_v1 */
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
  await container.createIfNotExists(); /* BLOB_PRIVATE_v1: private container, no public access */
  const blob = container.getBlockBlobClient(fileName);
  await blob.uploadData(buffer, { blobHTTPHeaders: { blobContentType: mimeType } });
  return { url: blob.url, fileName, sizeKb: Math.round(buffer.length / 1024) };
}

// ── POST /api/documents/upload ────────────────────────────────
router.post('/upload', requireAdmin, upload.single('file'), async (req, res) => {
  // Accept both new names (related_to_*) and legacy names (entity_*) for back-compat
  const related_to_type = req.body.related_to_type || req.body.entity_type;
  const related_to_id   = req.body.related_to_id   || req.body.entity_id;
  const { doc_type, notes, is_customer_visible } = req.body;

  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  if (!related_to_type || !related_to_id) return res.status(400).json({ error: 'related_to_type and related_to_id required.' });

  try {
    const { url } = await uploadBlob(req.file.buffer, req.file.originalname, req.file.mimetype);
    const sizeBytes = req.file.buffer.length;

    const pool = await getPool();
    const result = await pool.request()
      .input('relType',  sql.NVarChar(50),  related_to_type)
      .input('relId',    sql.BigInt,         parseInt(related_to_id))
      .input('docType',  sql.NVarChar(50),   doc_type || 'Other')
      .input('fileName', sql.NVarChar(255),  req.file.originalname)
      .input('fileUrl',  sql.NVarChar(1000), url)
      .input('sizeB',    sql.BigInt,         sizeBytes)
      .input('mimeType', sql.NVarChar(100),  req.file.mimetype)
      .input('notes',    sql.NVarChar(500),  notes || null)
      .input('uploaded', sql.BigInt,         req.adminId)
      .input('custVis',  sql.Bit,            is_customer_visible === 'true' || is_customer_visible === true ? 1 : 0)
      .query(`
        INSERT INTO documents (related_to_type, related_to_id, doc_type, file_name, file_url, file_size_bytes, mime_type, notes, uploaded_by, is_customer_visible)
        OUTPUT INSERTED.*
        VALUES (@relType, @relId, @docType, @fileName, @fileUrl, @sizeB, @mimeType, @notes, @uploaded, @custVis)
      `);

    await logAudit({
      userType: 'admin', userId: req.adminId,
      action: 'uploaded', entityType: related_to_type, entityId: parseInt(related_to_id),
      summary: `Document uploaded: ${req.file.originalname} (${doc_type})`,
      ipAddress: getIp(req),
    });

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

// ── GET /api/documents/:entityType/:entityId ──────────────────

// DOC_DOWNLOAD_ROUTE_v1: secure short-lived download link (works for private or public containers)
router.get('/:id/download', requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    const r = await pool.request().input('id', sql.BigInt, parseInt(req.params.id))
      .query('SELECT file_url, file_name FROM documents WHERE id=@id');
    if (!r.recordset.length) return res.status(404).send('Document not found.');
    const doc = r.recordset[0];
    const fileUrl = doc.file_url;
    // Parse account + container + blob path from the stored URL
    // Expected: https://<account>.blob.core.windows.net/<container>/<blobPath>
    let m = /^https?:\/\/([^.]+)\.blob\.core\.windows\.net\/([^/]+)\/(.+)$/.exec(fileUrl || '');
    const conn = process.env.AZURE_STORAGE_CONNECTION_STRING || '';
    const keyMatch = /AccountKey=([^;]+)/.exec(conn);
    const nameMatch = /AccountName=([^;]+)/.exec(conn);
    if (m && keyMatch && nameMatch) {
      const accountName = nameMatch[1];
      const accountKey = keyMatch[1];
      const containerName = m[2];
      const blobName = decodeURIComponent(m[3]);
      const cred = new StorageSharedKeyCredential(accountName, accountKey);
      const expiresOn = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      const sas = generateBlobSASQueryParameters({
        containerName, blobName,
        permissions: BlobSASPermissions.parse('r'),
        startsOn: new Date(Date.now() - 60 * 1000),
        expiresOn,
        contentDisposition: 'attachment; filename="' + (doc.file_name || 'document').replace(/"/g, '') + '"'
      }, cred).toString();
      try { await logAudit({ userType: 'admin', userId: req.adminId, action: 'downloaded', entityType: 'document', entityId: parseInt(req.params.id), summary: 'Document downloaded: ' + (doc.file_name || ''), ipAddress: getIp(req) }); } catch(e) { console.error('audit doc download:', e.message); }
      return res.redirect(fileUrl + '?' + sas);
    }
    // Fallback: container is public or URL not parseable -> redirect to stored URL directly
    if (!fileUrl) return res.status(404).send('No file URL on record.');
    try { await logAudit({ userType: 'admin', userId: req.adminId, action: 'downloaded', entityType: 'document', entityId: parseInt(req.params.id), summary: 'Document downloaded (direct): ' + (doc.file_name || ''), ipAddress: getIp(req) }); } catch(e) { console.error('audit doc download:', e.message); }
    return res.redirect(fileUrl);
  } catch (err) {
    console.error('Document download error:', err);
    return res.status(500).send('Download failed: ' + err.message);
  }
});

router.get('/:entityType/:entityId', requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('type', sql.NVarChar(50), req.params.entityType)
      .input('id',   sql.BigInt,       req.params.entityId)
      .query(`SELECT * FROM documents WHERE related_to_type = @type AND related_to_id = @id ORDER BY uploaded_at DESC`);
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
