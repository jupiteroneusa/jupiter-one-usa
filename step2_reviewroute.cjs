const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');

// Find exact insert point - the line just before the quote POST route
const marker = "  router.post('/rfqs/:id/quote', async (req, res) => {";
const idx = a.indexOf(marker);
if (idx === -1) { console.log('Marker NOT FOUND'); process.exit(1); }
console.log('Marker found at:', idx);

// Build the route as a single string - no template literals, pure string concat
const nl = '\r\n'; // file uses CRLF

const route = 
"  router.post('/rfqs/:id/quote-review', async (req, res) => {" + nl +
"    if (!requireAuth(req, res)) return;" + nl +
"    try {" + nl +
"      const pool = await getPool();" + nl +
"      const h = await pool.request().input('id', sql.BigInt, req.params.id)" + nl +
"        .query('SELECT h.*, c.id AS customer_id, c.first_name+\\' \\'+c.last_name AS customer_name, c.company, c.email FROM rfq_headers h JOIN customers c ON c.id=h.customer_id WHERE h.id=@id');" + nl +
"      if (!h.recordset.length) return res.redirect('/admin/rfqs');" + nl +
"      const rfq = h.recordset[0];" + nl +
"      const dbLines = await pool.request().input('id2', sql.BigInt, req.params.id)" + nl +
"        .query('SELECT * FROM rfq_lines WHERE rfq_id=@id2 ORDER BY line_number');" + nl +
"      const pt = req.body.payment_terms || 'Credit Card or Wire Transfer';" + nl +
"      const vd = req.body.valid_days || 30;" + nl +
"      const nt = req.body.notes || '';" + nl +
"      const sub = Object.values(req.body.lines || {});" + nl +
"      let lineHtml = '';" + nl +
"      dbLines.recordset.forEach(function(l, i) {" + nl +
"        const s = sub[i] || {};" + nl +
"        const n = l.line_number - 1;" + nl +
"        const part = (s.fulfillment_part || l.nsn || l.part_number || '').toUpperCase();" + nl +
"        const desc = s.item_name || l.item_name || '';" + nl +
"        const qty = s.quantity || l.quantity || 1;" + nl +
"        const cost = s.unit_cost || '';" + nl +
"        const price = s.unit_price || '';" + nl +
"        const lead = s.lead_time_days || '';" + nl +
"        lineHtml += '<tr>';" + nl +
"        lineHtml += '<td style=\"color:#7a8a9a;\">' + l.line_number + '</td>';" + nl +
"        lineHtml += '<td><div style=\"font-size:.65rem;color:#7a8a9a;\">Req: ' + (l.nsn||l.part_number||'—') + '</div>';" + nl +
"        lineHtml += '<input type=\"text\" name=\"lines[' + n + '][fulfillment_part]\" value=\"' + part + '\" style=\"width:130px;font-family:monospace;color:#c8932a;text-transform:uppercase;\" oninput=\"this.value=this.value.toUpperCase()\"/>';" + nl +
"        lineHtml += '<input type=\"hidden\" name=\"lines[' + n + '][rfq_line_id]\" value=\"' + l.id + '\"/>';" + nl +
"        lineHtml += '<input type=\"hidden\" name=\"lines[' + n + '][original_nsn]\" value=\"' + (l.nsn||'') + '\"/>';" + nl +
"        lineHtml += '<input type=\"hidden\" name=\"lines[' + n + '][original_part]\" value=\"' + (l.part_number||'') + '\"/>';" + nl +
"        lineHtml += '<input type=\"hidden\" name=\"lines[' + n + '][condition_code]\" value=\"' + (l.condition_code||'NE') + '\"/></td>';" + nl +
"        lineHtml += '<td><input type=\"text\" name=\"lines[' + n + '][item_name]\" value=\"' + desc + '\" style=\"width:150px;\"/></td>';" + nl +
"        lineHtml += '<td><input type=\"number\" min=\"1\" name=\"lines[' + n + '][quantity]\" value=\"' + qty + '\" style=\"width:60px;\" required/></td>';" + nl +
"        lineHtml += '<td><input type=\"number\" step=\"0.01\" min=\"0\" name=\"lines[' + n + '][unit_cost]\" value=\"' + cost + '\" placeholder=\"0.00\" style=\"width:80px;\" required/></td>';" + nl +
"        lineHtml += '<td><input type=\"number\" step=\"0.01\" min=\"0\" name=\"lines[' + n + '][unit_price]\" value=\"' + price + '\" placeholder=\"0.00\" style=\"width:80px;\" required/></td>';" + nl +
"        lineHtml += '<td><input type=\"text\" name=\"lines[' + n + '][lead_time_days]\" value=\"' + lead + '\" placeholder=\"7-10 days\" style=\"width:100px;\"/></td>';" + nl +
"        lineHtml += '<td><button type=\"button\" onclick=\"removeQRow(' + l.line_number + ')\" class=\"btn btn-outline btn-sm\" style=\"color:#e05050;\">X</button></td>';" + nl +
"        lineHtml += '</tr>';" + nl +
"      });" + nl +
"      const nextLine = dbLines.recordset.length + 1;" + nl +
"      const addRowScript = 'let qc=' + nextLine + ';function addQRow(){const i=qc-1;const n=qc;qc++;const r=document.createElement(\\'tr\\');r.id=\\'qrow-\\'+n;r.innerHTML=\\'<td>\\'+n+\\'</td><td><input type=\\\\\\'text\\\\\\' name=\\\\\\'lines[\\'+i+\\'][fulfillment_part]\\\\\\'  style=\\\\\\'width:130px;font-family:monospace;color:#c8932a;text-transform:uppercase;\\\\\\' oninput=\\\\\\'this.value=this.value.toUpperCase()\\\\\\'/><input type=\\\\\\'hidden\\\\\\' name=\\\\\\'lines[\\'+i+\\'][rfq_line_id]\\\\\\' value=\\\\\\'\\\\\\'/><input type=\\\\\\'hidden\\\\\\' name=\\\\\\'lines[\\'+i+\\'][original_nsn]\\\\\\' value=\\\\\\'\\\\\\'/><input type=\\\\\\'hidden\\\\\\' name=\\\\\\'lines[\\'+i+\\'][original_part]\\\\\\' value=\\\\\\'\\\\\\'/><input type=\\\\\\'hidden\\\\\\' name=\\\\\\'lines[\\'+i+\\'][condition_code]\\\\\\' value=\\\\\\'NE\\\\\\'/></td><td><input type=\\\\\\'text\\\\\\' name=\\\\\\'lines[\\'+i+\\'][item_name]\\\\\\' style=\\\\\\'width:150px;\\\\\\'/></td><td><input type=\\\\\\'number\\\\\\' min=\\\\\\'1\\\\\\' name=\\\\\\'lines[\\'+i+\\'][quantity]\\\\\\' value=\\\\\\'1\\\\\\' style=\\\\\\'width:60px;\\\\\\' required/></td><td><input type=\\\\\\'number\\\\\\' step=\\\\\\'0.01\\\\\\' name=\\\\\\'lines[\\'+i+\\'][unit_cost]\\\\\\' placeholder=\\\\\\'0.00\\\\\\' style=\\\\\\'width:80px;\\\\\\' required/></td><td><input type=\\\\\\'number\\\\\\' step=\\\\\\'0.01\\\\\\' name=\\\\\\'lines[\\'+i+\\'][unit_price]\\\\\\' placeholder=\\\\\\'0.00\\\\\\' style=\\\\\\'width:80px;\\\\\\' required/></td><td><input type=\\\\\\'text\\\\\\' name=\\\\\\'lines[\\'+i+\\'][lead_time_days]\\\\\\' style=\\\\\\'width:100px;\\\\\\'/></td><td><button type=\\\\\\'button\\\\\\' onclick=\\\\\\'removeQRow(\\'+n+\\')\\\\\\'  class=\\\\\\'btn btn-outline btn-sm\\\\\\' style=\\\\\\'color:#e05050;\\\\\\'>X</button></td>\\';document.getElementById(\\'qlines-tbody\\').appendChild(r);}function removeQRow(n){const r=document.getElementById(\\'qrow-\\'+n);if(r&&document.getElementById(\\'qlines-tbody\\').children.length>1)r.remove();}';" + nl +
"      let html = SORT_SCRIPT;" + nl +
"      html += '<div style=\"display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;\">';" + nl +
"      html += '<div class=\"page-title\">Quote Review \u2014 ' + rfq.rfq_number + '</div>';" + nl +
"      html += '<a href=\"/admin/rfqs/' + rfq.id + '\" class=\"btn btn-outline btn-sm\">&larr; Back to RFQ</a></div>';" + nl +
"      html += '<div class=\"page-sub\">Review and edit before sending to customer</div>';" + nl +
"      html += '<div class=\"detail-grid\" style=\"margin-bottom:20px;\">';" + nl +
"      html += '<div class=\"detail-item\"><div class=\"detail-label\">Customer</div><div class=\"detail-value\"><a href=\"/admin/customers/' + rfq.customer_id + '\" style=\"color:#c8932a;\">' + rfq.customer_name + '</a></div></div>';" + nl +
"      html += '<div class=\"detail-item\"><div class=\"detail-label\">Company</div><div class=\"detail-value\">' + (rfq.company||'\u2014') + '</div></div>';" + nl +
"      html += '<div class=\"detail-item\"><div class=\"detail-label\">Email</div><div class=\"detail-value\"><a href=\"mailto:' + rfq.email + '\" style=\"color:#c8932a;\">' + rfq.email + '</a></div></div>';" + nl +
"      html += '<div class=\"detail-item\"><div class=\"detail-label\">RFQ #</div><div class=\"detail-value\">' + rfq.rfq_number + '</div></div></div>';" + nl +
"      html += '<form method=\"POST\" action=\"/admin/rfqs/' + rfq.id + '/quote\">';" + nl +
"      html += '<div class=\"card\" style=\"margin-bottom:20px;\"><div class=\"card-header\">Line Items <button type=\"button\" class=\"btn btn-outline btn-sm\" onclick=\"addQRow()\">+ Add Line</button></div>';" + nl +
"      html += '<div style=\"overflow-x:auto;\"><table style=\"width:100%;\"><thead><tr><th>#</th><th>NSN/Part</th><th>Description</th><th>Qty</th><th>Unit Cost($)</th><th>Unit Price($)</th><th>Lead Time</th><th></th></tr></thead>';" + nl +
"      html += '<tbody id=\"qlines-tbody\">' + lineHtml + '</tbody></table></div></div>';" + nl +
"      html += '<div class=\"card\" style=\"margin-bottom:20px;\"><div class=\"card-header\">Quote Details</div><div class=\"card-body\">';" + nl +
"      html += '<div style=\"display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;\">';" + nl +
"      html += '<div><div style=\"font-size:.7rem;color:#7a8a9a;margin-bottom:4px;\">Payment Terms</div><input type=\"text\" name=\"payment_terms\" value=\"' + pt + '\" style=\"width:100%;\"/></div>';" + nl +
"      html += '<div><div style=\"font-size:.7rem;color:#7a8a9a;margin-bottom:4px;\">Valid Days</div><input type=\"number\" name=\"valid_days\" value=\"' + vd + '\" style=\"width:100%;\"/></div></div>';" + nl +
"      html += '<div style=\"margin-bottom:12px;\"><div style=\"font-size:.7rem;color:#7a8a9a;margin-bottom:4px;\">Terms / Notes</div><textarea name=\"notes\" rows=\"3\" style=\"width:100%;\">' + nt + '</textarea></div>';" + nl +
"      html += '<div><div style=\"font-size:.7rem;color:#7a8a9a;margin-bottom:4px;\">Personal Message <span style=\"color:#555;\">(optional \u2014 shown at top of email)</span></div>';" + nl +
"      html += '<textarea name=\"personal_message\" rows=\"3\" style=\"width:100%;border-color:#c8932a;\" placeholder=\"Hi, great speaking with you...\"></textarea></div>';" + nl +
"      html += '</div></div>';" + nl +
"      html += '<div style=\"display:flex;gap:10px;\">';" + nl +
"      html += '<button type=\"submit\" class=\"btn btn-gold\" style=\"padding:12px 28px;\">Send Quote to Customer &rarr;</button>';" + nl +
"      html += '<a href=\"/admin/rfqs/' + rfq.id + '\" class=\"btn btn-outline\" style=\"padding:12px 20px;\">Cancel</a></div></form>';" + nl +
"      html += '<script>' + addRowScript + '</script>';" + nl +
"      res.send(page('Quote Review \u2014 ' + rfq.rfq_number, 'rfqs', html));" + nl +
"    } catch(err) {" + nl +
"      res.send(page('Quote Review', 'rfqs', '<div class=\"alert alert-error\">' + err.message + '</div>'));" + nl +
"    }" + nl +
"  });" + nl + nl;

a = a.slice(0, idx) + route + a.slice(idx);
fs.writeFileSync('admin/index.js', a);
console.log('Route added. Length now:', a.length);
console.log('Done.');
