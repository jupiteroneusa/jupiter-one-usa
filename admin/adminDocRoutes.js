// admin/adminDocRoutes.js
// Document upload + delete using admin session auth (j1_admin_token cookie),
// avoids the JWT/admin_sessions middleware path used by /api/documents.
// Mounted by admin/index.js via mountAdminDocRoutes(router, requireAuth).

import multer from 'multer';
import { BlobServiceClient } from '@azure/storage-blob';
import { getPool, sql } from '../db/connect.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

async function uploadBlob(buffer, originalName, mimeType) {
  const ext = originalName.split('.').pop();
  const fileName = 'docs/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext;
  if (!process.env.AZURE_STORAGE_CONNECTION_STRING) {
    const fs = await import('fs');
    fs.mkdirSync('./tmp/docs', { recursive: true });
    fs.writeFileSync('./tmp/' + fileName, buffer);
    return { url: 'http://localhost:' + (process.env.PORT || 3000) + '/tmp/' + fileName };
  }
  const client = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
  const container = client.getContainerClient(process.env.AZURE_STORAGE_CONTAINER || 'jupiter-one-docs');
  await container.createIfNotExists({ access: 'blob' });
  const blob = container.getBlockBlobClient(fileName);
  await blob.uploadData(buffer, { blobHTTPHeaders: { blobContentType: mimeType } });
  return { url: blob.url };
}

export function mountAdminDocRoutes(router, requireAuth) {
  router.post('/api/documents/upload', upload.single('file'), async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const related_to_type = req.body.related_to_type;
      const related_to_id   = req.body.related_to_id;
      const { doc_type, notes, is_customer_visible } = req.body;

      if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
      if (!related_to_type || !related_to_id) return res.status(400).json({ error: 'related_to_type and related_to_id required.' });

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
        .input('custVis',  sql.Bit,            (is_customer_visible === 'true' || is_customer_visible === true) ? 1 : 0)
        .query(`
          INSERT INTO documents (related_to_type, related_to_id, doc_type, file_name, file_url, file_size_bytes, mime_type, notes, is_customer_visible, uploaded_at, created_at) /* DOC_UPLOAD_v1 */
          OUTPUT INSERTED.*
          VALUES (@relType, @relId, @docType, @fileName, @fileUrl, @sizeB, @mimeType, @notes, @custVis, GETDATE(), GETDATE())
        `);

      res.status(201).json(result.recordset[0]);
    } catch (err) {
      console.error('Admin doc upload error:', err);
      res.status(500).json({ error: 'Upload failed: ' + err.message });
    }
  });

  router.post('/api/documents/:id/delete', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      await pool.request().input('id', sql.BigInt, req.params.id)
        .query('DELETE FROM documents WHERE id=@id');
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
