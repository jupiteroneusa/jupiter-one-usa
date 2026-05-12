// patch-step9-1-fix-documents-route.cjs
// Fixes routes/documents.js — columns must match the documents table schema:
//   entity_type   → related_to_type
//   entity_id     → related_to_id
//   file_size_kb  → file_size_bytes  (Q11 shows file_size_bytes BIGINT)
//   uploaded_by_type → REMOVED (not in table)
// Also: keep size in bytes (not KB), match nvarchar lengths.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'routes/documents.js';
const BACKUP = TARGET + '.step9-1.bak';

if (!fs.existsSync(TARGET)) { console.error('! ' + TARGET + ' not found'); process.exit(1); }

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('related_to_type')) {
  console.log('- Already patched (found related_to_type).'); process.exit(0);
}

// ---- Replace POST /upload handler body (the INSERT + params) ----
const oldUpload = `router.post('/upload', requireAdmin, upload.single('file'), async (req, res) => {
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
      .query(\`
        INSERT INTO documents (entity_type, entity_id, doc_type, file_name, file_url, file_size_kb, mime_type, notes, uploaded_by, uploaded_by_type)
        OUTPUT INSERTED.*
        VALUES (@entityType, @entityId, @docType, @fileName, @fileUrl, @sizeKb, @mimeType, @notes, @uploadedBy, @uploadType)
      \`);

    await logAudit({
      userType: 'admin', userId: req.adminId,
      action: 'uploaded', entityType: entity_type, entityId: parseInt(entity_id),
      summary: \`Document uploaded: \${req.file.originalname} (\${doc_type})\`,
      ipAddress: getIp(req),
    });

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed.' });
  }
});`;

const newUpload = `router.post('/upload', requireAdmin, upload.single('file'), async (req, res) => {
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
      .query(\`
        INSERT INTO documents (related_to_type, related_to_id, doc_type, file_name, file_url, file_size_bytes, mime_type, notes, uploaded_by, is_customer_visible)
        OUTPUT INSERTED.*
        VALUES (@relType, @relId, @docType, @fileName, @fileUrl, @sizeB, @mimeType, @notes, @uploaded, @custVis)
      \`);

    await logAudit({
      userType: 'admin', userId: req.adminId,
      action: 'uploaded', entityType: related_to_type, entityId: parseInt(related_to_id),
      summary: \`Document uploaded: \${req.file.originalname} (\${doc_type})\`,
      ipAddress: getIp(req),
    });

    res.status(201).json(result.recordset[0]);
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});`;

if (!src.includes(oldUpload)) {
  console.error('! POST /upload anchor not found — file may have changed.');
  process.exit(1);
}
src = src.replace(oldUpload, function(){ return newUpload; });

// ---- Replace GET /:entityType/:entityId handler ----
const oldGet = `router.get('/:entityType/:entityId', requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('type', sql.NVarChar(50), req.params.entityType)
      .input('id',   sql.BigInt,       req.params.entityId)
      .query(\`SELECT * FROM documents WHERE entity_type = @type AND entity_id = @id ORDER BY created_at DESC\`);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load documents.' });
  }
});`;

const newGet = `router.get('/:entityType/:entityId', requireAdmin, async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('type', sql.NVarChar(50), req.params.entityType)
      .input('id',   sql.BigInt,       req.params.entityId)
      .query(\`SELECT * FROM documents WHERE related_to_type = @type AND related_to_id = @id ORDER BY uploaded_at DESC\`);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load documents.' });
  }
});`;

if (!src.includes(oldGet)) {
  console.error('! GET anchor not found.');
  process.exit(1);
}
src = src.replace(oldGet, function(){ return newGet; });

// ---- Write + verify ----
fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);

try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ documents route: column names → related_to_type / related_to_id');
  console.log('+ file_size_kb → file_size_bytes');
  console.log('+ uploaded_by_type removed (not in table)');
  console.log('+ is_customer_visible param wired');
  console.log('+ Back-compat: still accepts entity_type / entity_id from old callers');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! syntax error — REVERTED');
  console.error(err.message);
  process.exit(1);
}
