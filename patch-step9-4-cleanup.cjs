// patch-step9-4-cleanup.cjs
// Two small UI cleanups on the supplier detail page:
//   1. Documents tab: replace "Upload UI coming" placeholder with the real upload form
//      (same pattern as the supplier_po Documents tab)
//   2. POs tab: add a "Sent" column showing sent_at date

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/supplierRoutes.js';
const BACKUP = TARGET + '.step9-4.bak';

if (!fs.existsSync(TARGET)) { console.error('! ' + TARGET + ' missing'); process.exit(1); }

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('STEP9_4_SUPPLIER_DOCS')) {
  console.log('- supplierRoutes already patched');
  process.exit(0);
}

// ============================================================
// PART 1: Replace documents placeholder with real upload form
// ============================================================
const oldDocsTab = `      if (activeTab === 'documents') {
        if (docs.recordset.length === 0) {
          html += '<div style="text-align:center;color:#7a8a9a;padding:24px;">No documents uploaded yet.</div>';
          html += '<div style="text-align:center;color:#7a8a9a;font-size:.78rem;">Upload UI coming in Step 9. For now, attach via your blob storage.</div>';
        } else {
          html += '<table><thead><tr><th>Type</th><th>File</th><th>Uploaded</th><th>Notes</th></tr></thead><tbody>';
          docs.recordset.forEach(function(d) {
            html += '<tr>';
            html += '<td>' + statusBadge(d.doc_type) + '</td>';
            html += '<td><a href="' + d.file_url + '" target="_blank" style="color:#c8932a;">' + d.file_name + '</a></td>';
            html += '<td style="color:#7a8a9a;font-size:.78rem;">' + shortDateTime(d.uploaded_at) + '</td>';
            html += '<td style="color:#7a8a9a;">' + (d.notes || '&mdash;') + '</td>';
            html += '</tr>';
          });
          html += '</tbody></table>';
        }
      }`;

const newDocsTab = `      if (activeTab === 'documents') {
        // STEP9_4_SUPPLIER_DOCS upload form
        html += '<div style="background:rgba(200,147,42,0.06);border:1px solid rgba(200,147,42,0.3);padding:16px;border-radius:6px;margin-bottom:20px;">';
        html += '<div style="font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;color:#c8932a;margin-bottom:12px;">&#128206; Upload Document</div>';
        html += '<form id="docUploadForm" enctype="multipart/form-data" style="display:grid;grid-template-columns:1fr 1fr 2fr auto;gap:10px;align-items:flex-end;">';
        html += '<input type="hidden" name="related_to_type" value="supplier"/>';
        html += '<input type="hidden" name="related_to_id" value="' + s.id + '"/>';
        html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:4px;">Document Type</div>';
        html += '<select name="doc_type" required style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:8px 10px;">' +
          '<option value="">-- Select --</option>' +
          '<option value="W9">W-9</option>' +
          '<option value="NDA">NDA</option>' +
          '<option value="Agreement">Supplier Agreement</option>' +
          '<option value="Certification">Certification</option>' +
          '<option value="Insurance">Certificate of Insurance</option>' +
          '<option value="QualityCert">Quality Cert (ISO/AS9100)</option>' +
          '<option value="Capability">Capability Statement</option>' +
          '<option value="PriceList">Price List / Catalog</option>' +
          '<option value="Other">Other</option>' +
          '</select></div>';
        html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:4px;">File (max 25MB)</div>';
        html += '<input type="file" name="file" required style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:6px 8px;font-size:.82rem;"/></div>';
        html += '<div><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:4px;">Notes (optional)</div>';
        html += '<input type="text" name="notes" placeholder="Expiry date, version, etc..." style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:8px 10px;"/></div>';
        html += '<button type="button" onclick="uploadSupDoc()" class="btn btn-gold">Upload</button>';
        html += '</form>';
        html += '<div id="uploadStatus" style="margin-top:10px;font-size:.85rem;"></div>';
        html += '</div>';

        html += '<script>function uploadSupDoc(){var f=document.getElementById("docUploadForm");var fd=new FormData(f);var st=document.getElementById("uploadStatus");st.innerHTML="<span style=\\"color:#c8932a;\\">Uploading...</span>";fetch("/api/documents/upload",{method:"POST",body:fd,credentials:"same-origin"}).then(function(r){return r.json().then(function(j){return{ok:r.ok,j:j};});}).then(function(res){if(res.ok){st.innerHTML="<span style=\\"color:#4caf50;\\">&#10004; Uploaded. Reloading...</span>";setTimeout(function(){location.reload();},800);}else{st.innerHTML="<span style=\\"color:#e05050;\\">Error: "+(res.j.error||"Upload failed")+"</span>";}}).catch(function(err){st.innerHTML="<span style=\\"color:#e05050;\\">Network error: "+err.message+"</span>";});}</script>';

        if (docs.recordset.length === 0) {
          html += '<div style="text-align:center;color:#7a8a9a;padding:24px;">No documents uploaded yet.</div>';
        } else {
          html += '<table><thead><tr><th>Type</th><th>File</th><th>Uploaded</th><th>Notes</th><th></th></tr></thead><tbody>';
          docs.recordset.forEach(function(d) {
            html += '<tr>';
            html += '<td>' + statusBadge(d.doc_type) + '</td>';
            html += '<td><a href="' + d.file_url + '" target="_blank" style="color:#c8932a;">&#128206; ' + d.file_name + '</a></td>';
            html += '<td style="color:#7a8a9a;font-size:.78rem;">' + shortDateTime(d.uploaded_at) + '</td>';
            html += '<td style="color:#7a8a9a;font-size:.82rem;">' + (d.notes || '&mdash;') + '</td>';
            html += '<td><button onclick="if(confirm(\\'Delete this document?\\')){fetch(\\'/api/documents/' + d.id + '\\',{method:\\'DELETE\\',credentials:\\'same-origin\\'}).then(function(){location.reload();});}" class="btn btn-outline btn-sm" style="font-size:.7rem;padding:4px 8px;color:#e05050;border-color:#e05050;">Delete</button></td>';
            html += '</tr>';
          });
          html += '</tbody></table>';
        }
      }`;

if (!src.includes(oldDocsTab)) {
  console.error('! documents tab anchor not found');
  process.exit(1);
}
src = src.replace(oldDocsTab, function(){ return newDocsTab; });

// ============================================================
// PART 2: Add "Sent" column to POs query + table
// ============================================================
const oldPoQuery = `      const pos = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT id, po_number, status, total, issued_at, expected_delivery, received_at FROM supplier_pos WHERE supplier_id=@id ORDER BY created_at DESC');`;

const newPoQuery = `      const pos = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT id, po_number, status, total, issued_at, sent_at, expected_delivery, received_at FROM supplier_pos WHERE supplier_id=@id ORDER BY created_at DESC');`;

if (!src.includes(oldPoQuery)) {
  console.error('! pos query anchor not found');
  process.exit(1);
}
src = src.replace(oldPoQuery, function(){ return newPoQuery; });

// PO table — add Sent column header + cell
const oldPoTable = `          html += '<table><thead><tr><th>PO #</th><th>Status</th><th>Total</th><th>Issued</th><th>Expected</th><th>Received</th></tr></thead><tbody>';
          pos.recordset.forEach(function(p) {
            html += '<tr>';
            html += '<td class="mono"><a href="/admin/supplier-pos/' + p.id + '" style="color:#c8932a;">' + p.po_number + '</a></td>';
            html += '<td>' + statusBadge(p.status) + '</td>';
            html += '<td style="font-weight:600;">' + currency(p.total) + '</td>';
            html += '<td style="color:#7a8a9a;font-size:.78rem;">' + shortDate(p.issued_at) + '</td>';
            html += '<td style="color:#7a8a9a;font-size:.78rem;">' + shortDate(p.expected_delivery) + '</td>';
            html += '<td style="color:#7a8a9a;font-size:.78rem;">' + shortDate(p.received_at) + '</td>';
            html += '</tr>';
          });
          html += '</tbody></table>';`;

const newPoTable = `          html += '<table><thead><tr><th>PO #</th><th>Status</th><th>Total</th><th>Issued</th><th>Sent</th><th>Expected</th><th>Received</th></tr></thead><tbody>';
          pos.recordset.forEach(function(p) {
            html += '<tr>';
            html += '<td class="mono"><a href="/admin/supplier-pos/' + p.id + '" style="color:#c8932a;">' + p.po_number + '</a></td>';
            html += '<td>' + statusBadge(p.status) + '</td>';
            html += '<td style="font-weight:600;">' + currency(p.total) + '</td>';
            html += '<td style="color:#7a8a9a;font-size:.78rem;">' + shortDate(p.issued_at) + '</td>';
            html += '<td style="color:' + (p.sent_at ? '#4caf50' : '#7a8a9a') + ';font-size:.78rem;">' + (p.sent_at ? shortDate(p.sent_at) : '&mdash;') + '</td>';
            html += '<td style="color:#7a8a9a;font-size:.78rem;">' + shortDate(p.expected_delivery) + '</td>';
            html += '<td style="color:#7a8a9a;font-size:.78rem;">' + shortDate(p.received_at) + '</td>';
            html += '</tr>';
          });
          html += '</tbody></table>';`;

if (!src.includes(oldPoTable)) {
  console.error('! pos table anchor not found');
  process.exit(1);
}
src = src.replace(oldPoTable, function(){ return newPoTable; });

// Write + verify
fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);
try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ Documents tab: real upload form (W9, NDA, Cert, Insurance, etc.)');
  console.log('+ Documents tab: delete buttons on each row');
  console.log('+ POs tab: added Sent column (green when sent, dash when not)');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! syntax error - REVERTED');
  console.error(err.message);
  process.exit(1);
}
