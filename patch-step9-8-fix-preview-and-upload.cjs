// patch-step9-8-fix-preview-and-upload.cjs
// Three fixes:
//   1. PDF preview "Failed to load" — set explicit Content-Length + use res.end()
//      with Buffer instead of res.send(). Some browsers reject the response stream
//      when Content-Length is missing on application/pdf.
//   2. Admin document upload — add /admin/api/documents/upload + /admin/api/documents/:id/delete
//      using the simple requireAuth (j1_admin_token cookie). Swap UI URLs to point there.
//   3. Better Send PO error visibility — log SendGrid response so we can see if delivery
//      was queued or rejected.

const fs = require('fs');
const { execSync } = require('child_process');

// ============================================================
// FIX 1: PDF preview returns proper Buffer with Content-Length
// ============================================================
const POROUTES = 'admin/supplierPoRoutes.js';
let poSrc = fs.readFileSync(POROUTES, 'utf8');
const poBackup = poSrc;

if (poSrc.includes('PDF_BUFFER_FIX_V1')) {
  console.log('- PDF buffer fix already applied');
} else {
  const oldPdfRes = `      const pdfBuffer = await generatePoPdf(req.params.id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="' + poNumber + '.pdf"');
      res.send(pdfBuffer);`;

  const newPdfRes = `      // PDF_BUFFER_FIX_V1: ensure we have a real Buffer with Content-Length set,
      // otherwise some browsers reject the stream and show "Failed to load PDF document"
      const pdfRaw = await generatePoPdf(req.params.id);
      const pdfBuffer = Buffer.isBuffer(pdfRaw) ? pdfRaw : Buffer.from(pdfRaw);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader('Content-Disposition', 'inline; filename="' + poNumber + '.pdf"');
      res.setHeader('Cache-Control', 'no-store');
      res.end(pdfBuffer);`;

  if (!poSrc.includes(oldPdfRes)) {
    console.error('! PDF response anchor not found');
    process.exit(1);
  }
  poSrc = poSrc.replace(oldPdfRes, function(){ return newPdfRes; });
  console.log('+ PDF preview: send as Buffer with Content-Length + Cache-Control');
}

// ============================================================
// FIX 3: Log SendGrid response for visibility
// ============================================================
if (poSrc.includes('SENDGRID_LOG_V1')) {
  console.log('- SendGrid logging already added');
} else {
  const oldSend = `      await transporter.sendMail({
        from: '"Derek Torchia - Jupiter One USA" <' + fromAddr + '>',`;
  const newSend = `      // SENDGRID_LOG_V1: capture response to log/verify delivery
      const sendResult = await transporter.sendMail({
        from: '"Derek Torchia - Jupiter One USA" <' + fromAddr + '>',`;
  if (poSrc.includes(oldSend)) {
    poSrc = poSrc.replace(oldSend, function(){ return newSend; });

    // And log the result after the send (before the DB update)
    const oldAfterSend = `      // Update PO: status=Sent, sent_at, email_to, issued_at if null
      await pool.request()`;
    const newAfterSend = `      console.log('[PO Send] SMTP response:', {
        messageId: sendResult && sendResult.messageId,
        accepted: sendResult && sendResult.accepted,
        rejected: sendResult && sendResult.rejected,
        response: sendResult && sendResult.response
      });

      // Update PO: status=Sent, sent_at, email_to, issued_at if null
      await pool.request()`;
    if (poSrc.includes(oldAfterSend)) {
      poSrc = poSrc.replace(oldAfterSend, function(){ return newAfterSend; });
      console.log('+ SendGrid response will be logged to Azure console');
    }
  }
}

// Write supplierPoRoutes
if (poSrc !== poBackup) {
  fs.writeFileSync(POROUTES + '.step9-8.bak', poBackup);
  fs.writeFileSync(POROUTES, poSrc);
  try { execSync('node -c "' + POROUTES + '"', { stdio: 'pipe' }); }
  catch (err) {
    fs.writeFileSync(POROUTES, poBackup);
    console.error('! supplierPoRoutes syntax error - REVERTED');
    console.error(err.message);
    process.exit(1);
  }
}

// ============================================================
// FIX 2: Admin upload routes — wraps existing documents logic with session auth
// Drop a new file admin/adminDocRoutes.js then mount it.
// ============================================================
const NEW_FILE = 'admin/adminDocRoutes.js';
if (fs.existsSync(NEW_FILE)) {
  console.log('- admin/adminDocRoutes.js already exists');
} else {
  const adminDocCode = `// admin/adminDocRoutes.js
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
        .query(\`
          INSERT INTO documents (related_to_type, related_to_id, doc_type, file_name, file_url, file_size_bytes, mime_type, notes, is_customer_visible)
          OUTPUT INSERTED.*
          VALUES (@relType, @relId, @docType, @fileName, @fileUrl, @sizeB, @mimeType, @notes, @custVis)
        \`);

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
`;

  fs.writeFileSync(NEW_FILE, adminDocCode);
  try { execSync('node -c "' + NEW_FILE + '"', { stdio: 'pipe' }); console.log('+ Created admin/adminDocRoutes.js'); }
  catch (err) { fs.unlinkSync(NEW_FILE); console.error('! syntax error in new file'); process.exit(1); }
}

// Mount the new routes in admin/index.js
const ADMIN = 'admin/index.js';
let aSrc = fs.readFileSync(ADMIN, 'utf8');
const aBackup = aSrc;

if (aSrc.includes('mountAdminDocRoutes')) {
  console.log('- admin/index.js already mounts adminDocRoutes');
} else {
  // Add import after existing imports (find a stable anchor — supplierPoRoutes import)
  const importAnchor = "import { mountSupplierPoRoutes } from './supplierPoRoutes.js';";
  if (!aSrc.includes(importAnchor)) {
    console.error('! supplierPoRoutes import anchor not found');
    process.exit(1);
  }
  aSrc = aSrc.replace(importAnchor,
    "import { mountSupplierPoRoutes } from './supplierPoRoutes.js';\nimport { mountAdminDocRoutes } from './adminDocRoutes.js';"
  );

  // Mount call: find mountSupplierPoRoutes invocation
  const mountAnchor = 'mountSupplierPoRoutes(router, requireAuth, page);';
  if (!aSrc.includes(mountAnchor)) {
    console.error('! mountSupplierPoRoutes call anchor not found');
    process.exit(1);
  }
  aSrc = aSrc.replace(mountAnchor,
    'mountSupplierPoRoutes(router, requireAuth, page);\nmountAdminDocRoutes(router, requireAuth);'
  );

  fs.writeFileSync(ADMIN + '.step9-8.bak', aBackup);
  fs.writeFileSync(ADMIN, aSrc);
  try { execSync('node -c "' + ADMIN + '"', { stdio: 'pipe' }); console.log('+ admin/index.js: mounted adminDocRoutes'); }
  catch (err) {
    fs.writeFileSync(ADMIN, aBackup);
    console.error('! admin/index.js syntax error - REVERTED');
    console.error(err.message);
    process.exit(1);
  }
}

// Swap upload URLs in both UI files
function swapUrls(file, label) {
  let s = fs.readFileSync(file, 'utf8');
  const before = s;
  // /api/documents/upload  -> /admin/api/documents/upload
  s = s.split('/api/documents/upload').join('/admin/api/documents/upload');
  // /api/documents/<id>  for DELETE  -> /admin/api/documents/<id>/delete   (and POST)
  // Pattern in source: 'fetch(\\'/api/documents/' + d.id + '\\',{method:\\'DELETE\\''
  s = s.split("'/api/documents/' + d.id + '\\',{method:\\'DELETE\\'")
       .join("'/admin/api/documents/' + d.id + '/delete\\',{method:\\'POST\\'");
  // Generic DELETE pattern just in case
  s = s.split('method:\\\'DELETE\\\'').join('method:\\\'POST\\\'');
  if (s === before) {
    console.log('- ' + label + ': no URL changes needed');
    return;
  }
  fs.writeFileSync(file + '.step9-8.bak', before);
  fs.writeFileSync(file, s);
  try {
    execSync('node -c "' + file + '"', { stdio: 'pipe' });
    console.log('+ ' + label + ': URLs swapped to /admin/api/documents/');
  } catch (err) {
    fs.writeFileSync(file, before);
    console.error('! ' + label + ' syntax error - REVERTED');
    console.error(err.message);
    process.exit(1);
  }
}

swapUrls('admin/supplierPoRoutes.js', 'supplier PO docs UI');
swapUrls('admin/supplierRoutes.js',   'supplier docs UI');

console.log('');
console.log('SUCCESS');
