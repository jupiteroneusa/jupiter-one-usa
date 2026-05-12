// check-admin-session.cjs
const fs = require('fs');

console.log('========== admin/index.js login route ==========\n');
const src = fs.readFileSync('admin/index.js', 'utf8');
const lines = src.split('\n');
let depth = 0, started = false, start = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("router.post('/login'")) { start = i; break; }
}
if (start >= 0) {
  for (let i = start; i < Math.min(lines.length, start + 80); i++) {
    console.log((i+1) + ': ' + lines[i]);
    for (const c of lines[i]) {
      if (c === '{') { depth++; started = true; }
      if (c === '}') depth--;
    }
    if (started && depth === 0 && lines[i].includes('});')) break;
  }
}

console.log('\n========== admin/index.js requireAuth helper ==========\n');
const reqIdx = src.indexOf('function requireAuth') >= 0
  ? src.indexOf('function requireAuth')
  : src.indexOf('requireAuth =') >= 0
  ? src.indexOf('requireAuth =')
  : src.indexOf('const requireAuth');
if (reqIdx >= 0) {
  console.log(src.slice(reqIdx, reqIdx + 1500));
}

console.log('\n========== middleware/auth.js extractToken ==========\n');
if (fs.existsSync('middleware/auth.js')) {
  const m = fs.readFileSync('middleware/auth.js', 'utf8');
  const ex = m.indexOf('extractToken');
  if (ex >= 0) console.log(m.slice(ex, ex + 800));
}
