// admin/index.js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export async function buildAdminRouter() {
  const router = Router();

  // Admin login page
  router.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html>
<head><title>Jupiter One USA — Admin</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#0a1628; color:#eef1f5; font-family:sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; }
.card { background:#111e30; border:1px solid #1e2d42; border-top:3px solid #c8932a; padding:40px; width:100%; max-width:400px; }
h1 { font-size:1.4rem; margin-bottom:6px; color:#c8932a; }
p { font-size:.85rem; color:#7a8a9a; margin-bottom:24px; }
input { width:100%; background:#0a1628; border:1px solid #1e2d42; color:#eef1f5; padding:10px 14px; margin-bottom:14px; font-size:.9rem; outline:none; }
input:focus { border-color:#c8932a; }
button { width:100%; background:#c8932a; color:#0a1628; border:none; padding:12px; font-weight:700; font-size:.95rem; cursor:pointer; }
button:hover { background:#b8831a; }
.error { color:#e05050; font-size:.85rem; margin-bottom:14px; }
</style>
</head>
<body>
<div class="card">
  <h1>Jupiter One USA</h1>
  <p>Admin Panel — Restricted Access</p>
  <div class="error" id="err"></div>
  <form method="POST" action="/admin/login">
    <input type="email" name="email" placeholder="Admin Email" required/>
    <input type="password" name="password" placeholder="Password" required/>
    <button type="submit">Login →</button>
  </form>
</div>
</body>
</html>`);
  });

  // Admin login POST
  router.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      const token = jwt.sign({ email, type: 'admin' }, process.env.ADMIN_JWT_SECRET, { expiresIn: '12h' });
      res.cookie('j1_admin_token', token, { httpOnly: true, maxAge: 12 * 60 * 60 * 1000 });
      res.redirect('/admin/dashboard');
    } else {
      res.redirect('/admin?error=1');
    }
  });

  // Admin dashboard
  router.get('/dashboard', (req, res) => {
    const token = req.cookies?.j1_admin_token;
    if (!token) return res.redirect('/admin');
    try {
      jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    } catch { return res.redirect('/admin'); }

    res.send(`<!DOCTYPE html>
<html>
<head><title>Admin Dashboard — Jupiter One USA</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#0a1628; color:#eef1f5; font-family:sans-serif; }
.topbar { background:#111e30; border-bottom:1px solid #1e2d42; padding:14px 24px; display:flex; justify-content:space-between; align-items:center; }
.topbar h1 { color:#c8932a; font-size:1.1rem; }
.topbar a { color:#7a8a9a; font-size:.85rem; text-decoration:none; }
.topbar a:hover { color:#c8932a; }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:16px; padding:32px 24px; }
.card { background:#111e30; border:1px solid #1e2d42; border-top:3px solid #c8932a; padding:24px; text-decoration:none; color:inherit; display:block; transition:border-color .2s; }
.card:hover { border-color:#c8932a; background:#1a2535; }
.card h2 { font-size:1rem; color:#c8932a; margin-bottom:6px; }
.card p { font-size:.82rem; color:#7a8a9a; }
</style>
</head>
<body>
<div class="topbar">
  <h1>⚡ Jupiter One USA — Admin</h1>
  <a href="/admin/logout">Logout</a>
</div>
<div class="grid">
  <a href="/admin/rfqs" class="card"><h2>📋 RFQs</h2><p>View and manage customer RFQs</p></a>
  <a href="/admin/customers" class="card"><h2>👥 Customers</h2><p>View registered customers</p></a>
  <a href="/admin/quotes" class="card"><h2>💰 Quotes</h2><p>Manage quotes</p></a>
  <a href="/admin/orders" class="card"><h2>📦 Orders</h2><p>Track orders</p></a>
  <a href="/admin/suppliers" class="card"><h2>🏭 Suppliers</h2><p>Manage suppliers</p></a>
  <a href="/admin/invoices" class="card"><h2>🧾 Invoices</h2><p>View invoices</p></a>
</div>
</body>
</html>`);
  });

  router.get('/logout', (req, res) => {
    res.clearCookie('j1_admin_token');
    res.redirect('/admin');
  });

  return { admin: { options: { rootPath: '/admin' } }, adminRouter: router };
}