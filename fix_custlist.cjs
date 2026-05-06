const fs = require('fs');
let s = fs.readFileSync('admin/index.js', 'utf8');
const orig = s;

// Fix 1: Add last_login_at to query and GROUP BY
s = s.replace(
  'c.status, c.created_at, COUNT(h.id) AS rfq_count',
  'c.status, c.created_at, c.last_login_at, COUNT(h.id) AS rfq_count'
);
s = s.replace(
  'GROUP BY c.id,c.first_name,c.last_name,c.company,c.email,c.phone,c.status,c.created_at',
  'GROUP BY c.id,c.first_name,c.last_name,c.company,c.email,c.phone,c.status,c.created_at,c.last_login_at'
);
console.log(s.includes('c.last_login_at, COUNT') ? '✅ Fix 1: query updated' : '⚠️ Fix 1: query not found');

// Fix 2: Add badge and button columns to row
const oldRow = "        <td>${statusBadge(c.status)}</td>\r\n        <td style=\"color:#7a8a9a;font-size:.78rem;\">${new Date(c.created_at).toLocaleDateString()}</td>\r\n      </tr>`;";
const newRow = "        <td>${statusBadge(c.status)}</td>\r\n        <td style=\"color:#7a8a9a;font-size:.78rem;\">${new Date(c.created_at).toLocaleDateString()}</td>\r\n        <td>${c.last_login_at ? '<span style=\"color:#4caf50;font-size:.75rem;\">&#10004; Active</span>' : '<span style=\"background:#e05050;color:#fff;font-size:.65rem;padding:2px 7px;\">NO LOGIN</span>'}</td>\r\n        <td>${!c.last_login_at ? '<form method=\"POST\" action=\"/admin/customers/'+c.id+'/send-setup\" style=\"display:inline;\"><button type=\"submit\" class=\"btn btn-sm btn-outline\" style=\"border-color:#c8932a;color:#c8932a;font-size:.65rem;padding:3px 8px;\">Setup</button></form>' : ''}</td>\r\n      </tr>\`;"

if (s.includes(oldRow)) {
  s = s.replace(oldRow, newRow);
  console.log('✅ Fix 2: row updated with badge and button');
} else {
  // Try LF variant
  const oldRowLF = oldRow.replace(/\r\n/g, '\n');
  const newRowLF = newRow.replace(/\r\n/g, '\n');
  if (s.includes(oldRowLF)) {
    s = s.replace(oldRowLF, newRowLF);
    console.log('✅ Fix 2: row updated (LF variant)');
  } else {
    console.warn('⚠️ Fix 2: row not found — checking line 1658...');
    const lines = s.split('\n');
    console.log('Line 1657:', JSON.stringify(lines[1657]));
    console.log('Line 1658:', JSON.stringify(lines[1658]));
    console.log('Line 1659:', JSON.stringify(lines[1659]));
  }
}

// Fix 3: colspan 7 -> 9
s = s.replace("colspan=\"7\"", "colspan=\"9\"");
console.log(s.includes('colspan="9"') ? '✅ Fix 3: colspan updated' : '⚠️ Fix 3: colspan not found');

if (s !== orig) {
  fs.writeFileSync('admin/index.js', s, 'utf8');
  console.log('\n✅ Written. Now run:');
  console.log('  git add -A && git commit -m "Customer list: login status badge and send setup button" && git push');
} else {
  console.log('\n⚠️ No changes made.');
}
