// patch-po-fixups.cjs
// Fixes:
//   A) "Create Supplier POs" button: change form method POST->GET so it routes to review screen
//   B) Add editable basics to orderLinesBlock (uses correct anchor this time)

const fs = require('fs');
const { execSync } = require('child_process');

function compile(file) {
  try { execSync('node -c "' + file + '"', { stdio: 'pipe' }); return true; }
  catch (err) { return err.stderr ? err.stderr.toString() : err.message; }
}

// ============ A) Flip the form method ============
{
  const f = 'admin/orderRoutes.js';
  const orig = fs.readFileSync(f, 'utf8');
  let s = orig;

  if (s.includes('PO_BUTTON_GET_V1')) {
    console.log('- PO button already uses GET');
  } else {
    const oldForm = `'<form method="POST" action="/admin/orders/' + req.params.id + '/create-supplier-pos-from-order"`;
    const newForm = `'<form method="GET" action="/admin/orders/' + req.params.id + '/create-supplier-pos-from-order"`;
    if (s.includes(oldForm)) {
      s = s.replace(oldForm, newForm);
      // Also drop the confirm dialog since we're routing to review now
      const oldBtn = `onclick="return confirm(\\'Create draft Supplier POs grouped by supplier? You can review/edit each before sending.\\')"`;
      const newBtn = `title="Review and edit POs before commit"`;
      if (s.includes(oldBtn)) {
        s = s.replace(oldBtn, newBtn);
      }
      // Add marker
      const buttonIdx = s.indexOf('create-supplier-pos-from-order');
      if (buttonIdx > 0) {
        const lineStart = s.lastIndexOf('\n', buttonIdx);
        s = s.slice(0, lineStart) + '\n          // PO_BUTTON_GET_V1' + s.slice(lineStart);
      }
      fs.writeFileSync(f, s);
      const r = compile(f);
      if (r !== true) { fs.writeFileSync(f, orig); console.error('! orderRoutes syntax: ' + r); process.exit(1); }
      console.log('+ Create Supplier POs button now GETs to review screen');
    } else {
      console.log('- Create POs button form anchor not found (may already be fixed)');
    }
  }
}

// ============ B) Add editable basics to orderLinesBlock ============
{
  const f = 'admin/orderLinesBlock.js';
  if (!fs.existsSync(f)) {
    console.log('- orderLinesBlock not found, skipping');
  } else {
    const orig = fs.readFileSync(f, 'utf8');
    let s = orig;

    if (s.includes('EDIT_LINE_V2')) {
      console.log('- orderLinesBlock already has editable basics');
    } else {
      // Look for the actual structure - dump a sample to know what's there
      // Most likely the per-line edit form opens with <form method="POST" action="...lines/.../update">
      // Let's add the fields right after that form opens.
      const formAnchor = `/lines/' + l.id + '/update`;
      const idx = s.indexOf(formAnchor);
      if (idx < 0) {
        console.log('- form action anchor not found in orderLinesBlock — dumping first 40 lines for inspection');
        const lines = s.split('\n');
        for (let i = 0; i < Math.min(40, lines.length); i++) {
          console.log('  L' + (i+1) + ': ' + lines[i]);
        }
        process.exit(0);
      }
      // Find the next "html += '" after this anchor and inject our block
      const startAfterAnchor = idx + formAnchor.length;
      const nextHtml = s.indexOf("html += '", startAfterAnchor);
      if (nextHtml < 0) {
        console.log('- no next html += after form action; skipping');
        process.exit(0);
      }
      // We'll insert a fix-basics block right before that next html +=
      const indent = (function(){
        let n = nextHtml;
        while (n > 0 && s[n-1] !== '\n') n--;
        return s.substring(n, nextHtml);
      })();

      const inject =
        indent + "// EDIT_LINE_V2: editable basic fields (cascades to invoice_lines via /lines/:id/update)\n" +
        indent + "html += '<div style=\"display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0;padding:8px;background:#0a1628;border:1px dashed #c8932a;\"><div style=\"grid-column:1/-1;font-size:.7rem;letter-spacing:.1em;color:#c8932a;text-transform:uppercase;\">Fix Line Details (cascades to invoice if generated)</div>';\n" +
        indent + "html += '<div><div style=\"font-size:.65rem;color:#7a8a9a;margin-bottom:2px;\">NSN</div><input type=\"text\" name=\"nsn\" value=\"' + (l.nsn || '').toString().replace(/\"/g, '&quot;') + '\" style=\"width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;font-size:.78rem;\"/></div>';\n" +
        indent + "html += '<div><div style=\"font-size:.65rem;color:#7a8a9a;margin-bottom:2px;\">Part Number</div><input type=\"text\" name=\"part_number\" value=\"' + (l.part_number || '').toString().replace(/\"/g, '&quot;') + '\" style=\"width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;font-size:.78rem;\"/></div>';\n" +
        indent + "html += '<div style=\"grid-column:1/-1;\"><div style=\"font-size:.65rem;color:#7a8a9a;margin-bottom:2px;\">Item Name</div><input type=\"text\" name=\"item_name\" value=\"' + (l.item_name || '').toString().replace(/\"/g, '&quot;') + '\" style=\"width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;font-size:.78rem;\"/></div>';\n" +
        indent + "html += '<div><div style=\"font-size:.65rem;color:#7a8a9a;margin-bottom:2px;\">Quantity</div><input type=\"number\" min=\"1\" name=\"quantity_ordered\" value=\"' + (l.quantity_ordered || 1) + '\" style=\"width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;font-size:.78rem;\"/></div>';\n" +
        indent + "html += '<div><div style=\"font-size:.65rem;color:#7a8a9a;margin-bottom:2px;\">Unit Price ($)</div><input type=\"number\" step=\"0.01\" min=\"0\" name=\"unit_price\" value=\"' + parseFloat(l.unit_price || 0).toFixed(2) + '\" style=\"width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;font-size:.78rem;\"/></div>';\n" +
        indent + "html += '</div>';\n";

      s = s.slice(0, nextHtml) + inject + s.slice(nextHtml);
      s = '// EDIT_LINE_V2\n' + s;
      fs.writeFileSync(f, s);
      const r = compile(f);
      if (r !== true) { fs.writeFileSync(f, orig); console.error('! orderLinesBlock syntax: ' + r); process.exit(1); }
      console.log('+ orderLinesBlock: NSN/PN/item_name/qty/unit_price now editable per line');
    }
  }
}

console.log('SUCCESS');
