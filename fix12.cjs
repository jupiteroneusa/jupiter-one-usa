const fs = require('fs');

// Fix middleware/auth.js - add requireAdminCookie
let a = fs.readFileSync('middleware/auth.js', 'utf8');
a = a.replace(
  'function extractToken(req) {',
  `export async function requireAdminCookie(req, res, next) {
  try {
    const token = req.cookies?.j1_admin_token;
    if (!token) return res.status(401).json({ error: 'Admin login required.' });
    const jwt2 = await import('jsonwebtoken');
    const decoded = jwt2.default.verify(token, process.env.ADMIN_JWT_SECRET);
    if (decoded.type !== 'admin') return res.status(403).json({ error: 'Forbidden.' });
    req.adminEmail = decoded.email;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid admin token.' });
  }
}

function extractToken(req) {`
);
fs.writeFileSync('middleware/auth.js', a);
console.log('middleware done');

// Fix routes/rfq.js - use requireAdminCookie instead of requireAdmin
let r = fs.readFileSync('routes/rfq.js', 'utf8');
r = r.replace(
  "import { requireCustomer, requireAdmin } from '../middleware/auth.js';",
  "import { requireCustomer, requireAdmin, requireAdminCookie } from '../middleware/auth.js';"
);
r = r.replace("router.get('/admin/all', requireAdmin,", "router.get('/admin/all', requireAdminCookie,");
r = r.replace("router.patch('/admin/:id/status', requireAdmin,", "router.patch('/admin/:id/status', requireAdminCookie,");
fs.writeFileSync('routes/rfq.js', r);
console.log('rfq.js done');