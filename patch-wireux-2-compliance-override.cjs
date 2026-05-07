// patch-wireux-2-compliance-override.cjs
// Adds compliance override admin button on order shipping tab.
// When the compliance gate blocks shipping, admin can click an override button
// (with required reason) to bypass for emergency cases.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'admin/orderShippingBlock.js';
const BACKUP = 'admin/orderShippingBlock.js.wireux2.bak';

console.log('Wire UX 2: Compliance override button');
console.log('=====================================');

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('compliance_override')) { console.log('- Already patched.'); process.exit(0); }

// Add a compliance check helper at top of renderShippingTab + warning banner if any line is missing certs
// Inject right after the function signature opens
const oldStart = "export function renderShippingTab(o, ships) {";
const newStart = "export function renderShippingTab(o, ships, missingCerts) {";

if (!src.includes(oldStart)) {
  console.error('! Could not find renderShippingTab signature');
  process.exit(1);
}
src = src.replace(oldStart, function() { return newStart; });

// Add a warning banner + override section right before the Add Shipment form
// Anchor on the existing comment "// Add shipment form (with new fields)"
const anchor = "// Add shipment form (with new fields)";
const banner =
  "// Compliance warning + override option (Wire UX 2)\n" +
  "  if (missingCerts && missingCerts.length) {\n" +
  "    let blockingHtml = '<div style=\"background:rgba(224,80,80,0.08);border:1px solid #e05050;border-left:4px solid #e05050;padding:14px 18px;margin-bottom:20px;\">';\n" +
  "    blockingHtml += '<div style=\"font-size:.7rem;letter-spacing:.15em;text-transform:uppercase;color:#e05050;margin-bottom:8px;font-weight:700;\">\\u26A0 COMPLIANCE BLOCK \\u2014 Cannot Ship</div>';\n" +
  "    blockingHtml += '<div style=\"font-size:.85rem;color:#eef1f5;margin-bottom:10px;\">The following lines have required certifications that have not been received yet:</div>';\n" +
  "    blockingHtml += '<ul style=\"margin:0 0 12px 18px;font-size:.82rem;color:#eef1f5;\">';\n" +
  "    missingCerts.forEach(function(m) {\n" +
  "      const miss = []; if (m.cert_8130_required && !m.cert_8130_received) miss.push('8130-3');\n" +
  "      if (m.coc_required && !m.coc_received) miss.push('CoC');\n" +
  "      blockingHtml += '<li>Line ' + m.line_number + ' (' + (m.part_number || m.nsn || '') + '): missing ' + miss.join(', ') + '</li>';\n" +
  "    });\n" +
  "    blockingHtml += '</ul>';\n" +
  "    blockingHtml += '<div style=\"font-size:.78rem;color:#7a8a9a;margin-bottom:10px;\">Resolve by marking certs received on the Lines tab, or use the override below for documented emergencies.</div>';\n" +
  "    blockingHtml += '<details style=\"margin-top:10px;\"><summary style=\"cursor:pointer;color:#e05050;font-size:.78rem;font-weight:600;\">\\u26A0 Compliance Override (Audited)</summary>';\n" +
  "    blockingHtml += '<form method=\"POST\" action=\"/admin/orders/' + o.id + '/tracking\" style=\"margin-top:12px;background:#0a1628;padding:14px;border:1px solid #1e2d42;\">';\n" +
  "    blockingHtml += '<input type=\"hidden\" name=\"compliance_override\" value=\"1\"/>';\n" +
  "    blockingHtml += '<input type=\"hidden\" name=\"carrier\" value=\"OVERRIDE\"/>';\n" +
  "    blockingHtml += '<div style=\"font-size:.7rem;color:#e05050;margin-bottom:6px;font-weight:600;\">Override Reason (required, audited)</div>';\n" +
  "    blockingHtml += '<textarea name=\"override_reason\" required minlength=\"15\" rows=\"3\" placeholder=\"Document the reason for overriding compliance gate (min 15 chars)...\" style=\"width:100%;background:#111e30;border:1px solid #e05050;color:#eef1f5;padding:8px 12px;font-size:.85rem;\"></textarea>';\n" +
  "    blockingHtml += '<div style=\"font-size:.7rem;color:#7a8a9a;margin:8px 0;\">Note: This override bypasses the compliance gate for THIS shipment only. The order line still has cert flags unchanged. The override action and reason are logged.</div>';\n" +
  "    blockingHtml += '<button type=\"submit\" onclick=\"return confirm(\\'Confirm: bypass compliance gate? This is logged.\\')\" class=\"btn btn-sm\" style=\"background:#e05050;color:#fff;font-weight:600;\">Override and Continue Shipping</button>';\n" +
  "    blockingHtml += '</form></details></div>';\n" +
  "    html += blockingHtml;\n" +
  "  }\n\n  ";

if (!src.includes(anchor)) {
  console.error('! Could not find Add shipment form anchor');
  process.exit(1);
}
src = src.replace(anchor, function() { return banner + anchor; });

fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);

try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ Patched + syntax OK');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! Syntax error - reverted');
  console.error(err.stderr ? err.stderr.toString() : err.message);
  process.exit(1);
}
