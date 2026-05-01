// admin/index.js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getPool, sql } from '../db/connect.js';

const CSS = `
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#0a1628; color:#eef1f5; font-family:'Segoe UI',sans-serif; font-size:.9rem; }
a { color:inherit; text-decoration:none; }
.topbar { background:#060e1a; border-bottom:1px solid #1e2d42; padding:0 24px; height:52px; display:flex; align-items:center; justify-content:space-between; position:sticky; top:0; z-index:100; }
.topbar-brand { color:#c8932a; font-weight:700; font-size:1rem; letter-spacing:.06em; }
.topbar-right { display:flex; align-items:center; gap:16px; }
.topbar-right a { color:#7a8a9a; font-size:.82rem; }
.topbar-right a:hover { color:#c8932a; }
.sidebar { position:fixed; top:52px; left:0; bottom:0; width:200px; background:#0f1e35; border-right:1px solid #1e2d42; padding:16px 0; overflow-y:auto; }
.sidebar a { display:block; padding:10px 20px; color:#7a8a9a; font-size:.85rem; transition:all .2s; border-left:3px solid transparent; }
.sidebar a:hover, .sidebar a.active { color:#c8932a; border-left-color:#c8932a; background:rgba(200,147,42,0.08); }
.main { margin-left:200px; padding:28px 32px; min-height:calc(100vh - 52px); }
.page-title { font-size:1.4rem; font-weight:700; letter-spacing:.04em; margin-bottom:6px; }
.page-sub { color:#7a8a9a; font-size:.82rem; margin-bottom:24px; }
.card { background:#111e30; border:1px solid #1e2d42; margin-bottom:20px; }
.card-header { padding:12px 18px; border-bottom:1px solid #1e2d42; font-weight:600; font-size:.85rem; color:#c8932a; letter-spacing:.06em; display:flex; justify-content:space-between; align-items:center; }
.card-body { padding:18px; }
table { width:100%; border-collapse:collapse; font-size:.85rem; }
th { background:#060e1a; padding:9px 12px; text-align:left; font-size:.68rem; letter-spacing:.15em; text-transform:uppercase; color:#7a8a9a; border-bottom:1px solid #1e2d42; white-space:nowrap; }
td { padding:11px 12px; border-bottom:1px solid #1e2d42; vertical-align:middle; }
tr:last-child td { border-bottom:none; }
tr:hover td { background:rgba(200,147,42,0.04); }
.badge { display:inline-block; font-size:.65rem; letter-spacing:.08em; text-transform:uppercase; padding:3px 8px; border:1px solid; white-space:nowrap; }
.badge-blue { color:#5ab4e8; border-color:#5ab4e8; background:rgba(90,180,232,0.1); }
.badge-gold { color:#c8932a; border-color:#c8932a; background:rgba(200,147,42,0.1); }
.badge-green { color:#4caf50; border-color:#4caf50; background:rgba(76,175,80,0.1); }
.badge-red { color:#e05050; border-color:#e05050; background:rgba(224,80,80,0.1); }
.badge-gray { color:#7a8a9a; border-color:#1e2d42; }
.btn { display:inline-block; font-size:.78rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase; padding:7px 16px; border:none; cursor:pointer; transition:all .2s; white-space:nowrap; }
.btn-gold { background:#c8932a; color:#0a1628; }
.btn-gold:hover { background:#b8831a; }
.btn-outline { background:transparent; color:#7a8a9a; border:1px solid #1e2d42; }
.btn-outline:hover { border-color:#c8932a; color:#c8932a; }
.btn-sm { font-size:.7rem; padding:5px 12px; }
.btn-red { background:#8a2a2a; color:#eef1f5; }
.btn-red:hover { background:#a03030; }
select, input[type=text], input[type=email], textarea { background:#0a1628; border:1px solid #1e2d42; color:#eef1f5; padding:8px 12px; font-size:.85rem; outline:none; font-family:inherit; }
select:focus, input:focus, textarea:focus { border-color:#c8932a; }
.stat-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:12px; margin-bottom:24px; }
.stat { background:#111e30; border:1px solid #1e2d42; border-top:3px solid #c8932a; padding:18px 20px; }
.stat-num { font-size:1.8rem; font-weight:700; color:#c8932a; line-height:1; margin-bottom:4px; }
.stat-label { font-size:.72rem; color:#7a8a9a; letter-spacing:.1em; text-transform:uppercase; }
.filter-bar { display:flex; gap:10px; align-items:center; margin-bottom:16px; flex-wrap:wrap; }
.mono { font-family:monospace; }
.text-gold { color:#c8932a; }
.text-muted { color:#7a8a9a; }
.alert { padding:12px 16px; border-left:3px solid; margin-bottom:16px; font-size:.85rem; }
.alert-success { background:rgba(76,175,80,0.1); border-color:#4caf50; color:#4caf50; }
.alert-error { background:rgba(224,80,80,0.1); border-color:#e05050; color:#e05050; }
.detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px; }
.detail-item { background:#0a1628; padding:12px 16px; }
.detail-label { font-size:.65rem; letter-spacing:.15em; text-transform:uppercase; color:#7a8a9a; margin-bottom:4px; }
.detail-value { font-size:.9rem; color:#eef1f5; }
@media(max-width:700px){ .sidebar{display:none;} .main{margin-left:0;} .detail-grid{grid-template-columns:1fr;} }
`;

function adminNav(active) {
  return `
  <div class="topbar">
    <span class="topbar-brand">⚡ Jupiter One USA — Admin</span>
    <div class="topbar-right">
      <a href="/admin/dashboard">Dashboard</a>
      <a href="/admin/logout">Logout</a>
    </div>
  </div>
  <div class="sidebar">
    <a href="/admin/dashboard" class="${active==='dashboard'?'active':''}">📊 Dashboard</a>
    <a href="/admin/rfqs" class="${active==='rfqs'?'active':''}">📋 RFQs</a>
    <a href="/admin/customers" class="${active==='customers'?'active':''}">👥 Customers</a>
    <a href="/admin/quotes" class="${active==='quotes'?'active':''}">💰 Quotes</a>
    <a href="/admin/orders" class="${active==='orders'?'active':''}">📦 Orders</a>
    <a href="/admin/suppliers" class="${active==='suppliers'?'active':''}">🏭 Suppliers</a>
    <a href="/admin/invoices" class="${active==='invoices'?'active':''}">🧾 Invoices</a>
  </div>`;
}

function page(title, active, body) {
  return `<!DOCTYPE html><html><head><title>${title} — Jupiter One Admin</title>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <style>${CSS}</style></head><body>
  ${adminNav(active)}
  <div class="main">${body}</div>
  </body></html>`;
}

function statusBadge(s) {
  const map = { 'Submitted':'blue','Under Review':'blue','Sourcing':'gold','Quoted':'gold','Closed':'green','Cancelled':'red','Active':'green','New':'blue','Sent':'blue','Accepted':'green','Rejected':'red','Expired':'gray','Confirmed':'green','Processing':'blue','Shipped':'gold','Delivered':'green','Paid':'green','Unpaid':'red','Overdue':'red','Draft':'gray','Standard':'gray','Urgent':'gold','AOG':'red' };
  const c = map[s] || 'gray';
  return `<span class="badge badge-${c}">${s||'—'}</span>`;
}

function requireAuth(req, res) {
  const token = req.cookies?.j1_admin_token;
  if (!token) { res.redirect('/admin'); return false; }
  try { jwt.verify(token, process.env.ADMIN_JWT_SECRET); return true; }
  catch { res.redirect('/admin'); return false; }
}

export async function buildAdminRouter() {
  const router = Router();

  // ── Login ────────────────────────────────────────────────
  router.get('/', (req, res) => {
    const err = req.query.error ? '<div class="alert alert-error">Invalid credentials.</div>' : '';
    res.send(`<!DOCTYPE html><html><head><title>Admin Login — Jupiter One USA</title>
    <style>${CSS}
    body{display:flex;align-items:center;justify-content:center;min-height:100vh;}
    .login-card{background:#111e30;border:1px solid #1e2d42;border-top:3px solid #c8932a;padding:40px;width:100%;max-width:400px;}
    h1{font-size:1.3rem;color:#c8932a;margin-bottom:4px;}
    p{font-size:.82rem;color:#7a8a9a;margin-bottom:24px;}
    input{width:100%;margin-bottom:12px;display:block;}
    </style></head><body>
    <div class="login-card">
      <h1>⚡ Jupiter One USA</h1>
      <p>Admin Panel — Restricted Access</p>
      ${err}
      <form method="POST" action="/admin/login">
        <input type="email" name="email" placeholder="Admin Email" required/>
        <input type="password" name="password" placeholder="Password" required/>
        <button type="submit" class="btn btn-gold" style="width:100%;padding:11px;">Login →</button>
      </form>
    </div></body></html>`);
  });

  router.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase() && password === process.env.ADMIN_PASSWORD) {
      const token = jwt.sign({ email, type: 'admin' }, process.env.ADMIN_JWT_SECRET, { expiresIn: '12h' });
      res.cookie('j1_admin_token', token, { httpOnly: true, maxAge: 12 * 60 * 60 * 1000 });
      res.redirect('/admin/dashboard');
    } else {
      res.redirect('/admin?error=1');
    }
  });

  router.get('/logout', (req, res) => {
    res.clearCookie('j1_admin_token');
    res.redirect('/admin');
  });

  // ── Dashboard ────────────────────────────────────────────
  router.get('/dashboard', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const stats = await pool.request().query(`
        SELECT
          (SELECT COUNT(*) FROM rfq_headers) AS total_rfqs,
          (SELECT COUNT(*) FROM rfq_headers WHERE status='Submitted') AS new_rfqs,
          (SELECT COUNT(*) FROM customers) AS total_customers,
          (SELECT COUNT(*) FROM rfq_headers WHERE status='Sourcing') AS active_sourcing
      `);
      const s = stats.recordset[0];
      const recent = await pool.request().query(`
        SELECT TOP 10 h.rfq_number, h.status, h.priority, h.submitted_at,
          c.first_name+' '+c.last_name AS customer_name, c.company,
          COUNT(l.id) AS line_count
        FROM rfq_headers h
        JOIN customers c ON c.id=h.customer_id
        LEFT JOIN rfq_lines l ON l.rfq_id=h.id
        GROUP BY h.rfq_number,h.status,h.priority,h.submitted_at,c.first_name,c.last_name,c.company
        ORDER BY h.submitted_at DESC
      `);
      let rows = recent.recordset.map(r => `<tr>
        <td class="mono text-gold">${r.rfq_number}</td>
        <td>${r.customer_name}<br><span class="text-muted" style="font-size:.75rem;">${r.company||''}</span></td>
        <td>${r.line_count}</td>
        <td>${statusBadge(r.priority)}</td>
        <td>${statusBadge(r.status)}</td>
        <td>${new Date(r.submitted_at).toLocaleDateString()}</td>
        <td><a href="/admin/rfqs/'+r.id+'" class="btn btn-outline btn-sm">View</a></td>
      </tr>`).join('');
      res.send(page('Dashboard', 'dashboard', `
        <div class="page-title">Dashboard</div>
        <div class="page-sub">Jupiter One USA — Admin Overview</div>
        <div class="stat-grid">
          <div class="stat"><div class="stat-num">${s.new_rfqs}</div><div class="stat-label">New RFQs</div></div>
          <div class="stat"><div class="stat-num">${s.total_rfqs}</div><div class="stat-label">Total RFQs</div></div>
          <div class="stat"><div class="stat-num">${s.active_sourcing}</div><div class="stat-label">Sourcing</div></div>
          <div class="stat"><div class="stat-num">${s.total_customers}</div><div class="stat-label">Customers</div></div>
        </div>
        <div class="card">
          <div class="card-header">Recent RFQs</div>
          <table><thead><tr><th>RFQ #</th><th>Customer</th><th>Lines</th><th>Priority</th><th>Status</th><th>Date</th><th></th></tr></thead>
          <tbody>${rows}</tbody></table>
        </div>`));
    } catch(err) {
      res.send(page('Dashboard','dashboard',`<div class="alert alert-error">${err.message}</div>`));
    }
  });

  // ── RFQs List ────────────────────────────────────────────
  router.get('/rfqs', async (req, res) => {
    if (!requireAuth(req, res)) return;
    const status = req.query.status || '';
    try {
      const pool = await getPool();
      const r = pool.request().input('lim', sql.Int, 100).input('off', sql.Int, 0);
      let where = '';
      if (status) { r.input('status', sql.NVarChar, status); where = 'WHERE h.status=@status'; }
      const result = await r.query(`
        SELECT h.id, h.rfq_number, h.status, h.priority, h.submitted_at,
          c.first_name+' '+c.last_name AS customer_name, c.company, c.email,
          COUNT(l.id) AS line_count
        FROM rfq_headers h
        JOIN customers c ON c.id=h.customer_id
        LEFT JOIN rfq_lines l ON l.rfq_id=h.id
        ${where}
        GROUP BY h.id,h.rfq_number,h.status,h.priority,h.submitted_at,c.first_name,c.last_name,c.company,c.email
        ORDER BY h.submitted_at DESC
        OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY
      `);
      const statuses = ['','Submitted','Under Review','Sourcing','Quoted','Closed','Cancelled'];
      const filters = statuses.map(s => `<a href="/admin/rfqs${s?'?status='+s:''}" class="btn btn-sm ${status===s?'btn-gold':'btn-outline'}">${s||'All'}</a>`).join('');
      const rows = result.recordset.map(r => `<tr>
        <td class="mono text-gold"><a href="/admin/rfqs/${r.id}" style="color:#c8932a;">${r.rfq_number}</a></td>
        <td>${r.customer_name}<br><span class="text-muted" style="font-size:.75rem;">${r.company||''}</span></td>
        <td style="color:#7a8a9a;font-size:.75rem;">${r.email}</td>
        <td>${r.line_count}</td>
        <td>${statusBadge(r.priority)}</td>
        <td>${statusBadge(r.status)}</td>
        <td>${new Date(r.submitted_at).toLocaleDateString()}</td>
        <td><a href="/admin/rfqs/${r.id}" class="btn btn-outline btn-sm">View</a></td>
      </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;color:#7a8a9a;padding:24px;">No RFQs found</td></tr>';
      res.send(page('RFQs','rfqs',`
        <div class="page-title">RFQs</div>
        <div class="page-sub">All customer requests for quotation</div>
        <div class="filter-bar">${filters}</div>
        <div class="card">
          <table><thead><tr><th>RFQ #</th><th>Customer</th><th>Email</th><th>Lines</th><th>Priority</th><th>Status</th><th>Date</th><th></th></tr></thead>
          <tbody>${rows}</tbody></table>
        </div>`));
    } catch(err) {
      res.send(page('RFQs','rfqs',`<div class="alert alert-error">${err.message}</div>`));
    }
  });

  // ── RFQ Detail ───────────────────────────────────────────
  router.get('/rfqs/:id', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const h = await pool.request().input('id', sql.BigInt, req.params.id).query(`
        SELECT h.*, c.first_name+' '+c.last_name AS customer_name, c.company, c.email, c.phone
        FROM rfq_headers h JOIN customers c ON c.id=h.customer_id WHERE h.id=@id`);
      if (!h.recordset.length) return res.send(page('RFQ','rfqs','<div class="alert alert-error">RFQ not found.</div>'));
      const rfq = h.recordset[0];
      const lines = await pool.request().input('id', sql.BigInt, req.params.id)
        .query(`SELECT * FROM rfq_lines WHERE rfq_id=@id ORDER BY line_number`);
      const log = await pool.request().input('id', sql.BigInt, req.params.id)
        .query(`SELECT * FROM rfq_status_log WHERE rfq_id=@id ORDER BY created_at ASC`);

      const lineRows = lines.recordset.map(l => `<tr>
        <td style="color:#7a8a9a;">${l.line_number}</td>
        <td class="mono text-gold">${l.nsn||l.part_number||'—'}</td>
        <td>${l.item_name||'—'}</td>
        <td>${l.quantity}</td>
        <td>${statusBadge(l.condition_code||'—')}</td>
        <td>${l.target_price ? '$'+parseFloat(l.target_price).toFixed(2) : '—'}</td>
        <td style="color:#7a8a9a;font-size:.8rem;">${l.notes||'—'}</td>
      </tr>`).join('');

      const logRows = log.recordset.map(l => `<tr>
        <td style="color:#7a8a9a;font-size:.78rem;">${new Date(l.created_at).toLocaleString()}</td>
        <td>${statusBadge(l.new_status)}</td>
        <td style="color:#7a8a9a;">${l.note||'—'}</td>
      </tr>`).join('');

      const statuses = ['Submitted','Under Review','Sourcing','Quoted','Closed','Cancelled'];
      const statusOptions = statuses.map(s => `<option value="${s}"${rfq.status===s?' selected':''}>${s}</option>`).join('');

      res.send(page(`RFQ ${rfq.rfq_number}`,'rfqs',`
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div class="page-title">RFQ ${rfq.rfq_number}</div>
          <a href="/admin/rfqs" class="btn btn-outline btn-sm">← Back to RFQs</a>
        </div>
        <div class="page-sub">Submitted ${new Date(rfq.submitted_at).toLocaleString()}</div>

        <div class="detail-grid">
          <div class="detail-item"><div class="detail-label">Customer</div><div class="detail-value">${rfq.customer_name}</div></div>
          <div class="detail-item"><div class="detail-label">Company</div><div class="detail-value">${rfq.company||'—'}</div></div>
          <div class="detail-item"><div class="detail-label">Email</div><div class="detail-value">${rfq.email}</div></div>
          <div class="detail-item"><div class="detail-label">Phone</div><div class="detail-value">${rfq.phone||'—'}</div></div>
          <div class="detail-item"><div class="detail-label">Priority</div><div class="detail-value">${statusBadge(rfq.priority)}</div></div>
          <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">${statusBadge(rfq.status)}</div></div>
        </div>

        ${rfq.notes ? `<div class="card" style="margin-bottom:20px;"><div class="card-header">Notes from Customer</div><div class="card-body" style="color:#7a8a9a;">${rfq.notes}</div></div>` : ''}

        <div class="card">
          <div class="card-header">Line Items (${lines.recordset.length})</div>
          <table><thead><tr><th>#</th><th>NSN / Part</th><th>Description</th><th>Qty</th><th>Condition</th><th>Target Price</th><th>Notes</th></tr></thead>
          <tbody>${lineRows}</tbody></table>
        </div>

        <div class="card">
          <div class="card-header">Update Status</div>
          <div class="card-body">
            <form method="POST" action="/admin/rfqs/${rfq.id}/status" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
              <div>
                <div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">New Status</div>
                <select name="status">${statusOptions}</select>
              </div>
              <div style="flex:1;min-width:200px;">
                <div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Note (optional)</div>
                <input type="text" name="note" placeholder="Add a note..." style="width:100%;"/>
              </div>
              <button type="submit" class="btn btn-gold">Update Status</button>
            </form>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Status History</div>
          <table><thead><tr><th>Date</th><th>Status</th><th>Note</th></tr></thead>
          <tbody>${logRows||'<tr><td colspan="3" style="color:#7a8a9a;text-align:center;padding:16px;">No history yet</td></tr>'}</tbody></table>
        </div>`));
    } catch(err) {
      res.send(page('RFQ','rfqs',`<div class="alert alert-error">${err.message}</div>`));
    }
  });

  // ── RFQ Status Update POST ───────────────────────────────
  router.post('/rfqs/:id/status', async (req, res) => {
    if (!requireAuth(req, res)) return;
    const { status, note } = req.body;
    try {
      const pool = await getPool();
      const current = await pool.request().input('id', sql.BigInt, req.params.id)
        .query(`SELECT status FROM rfq_headers WHERE id=@id`);
      const oldStatus = current.recordset[0]?.status;
      await pool.request().input('id', sql.BigInt, req.params.id).input('status', sql.NVarChar, status)
        .query(`UPDATE rfq_headers SET status=@status, updated_at=GETDATE() WHERE id=@id`);
      await pool.request()
        .input('rfqId', sql.BigInt, req.params.id)
        .input('oldStatus', sql.NVarChar, oldStatus)
        .input('newStatus', sql.NVarChar, status)
        .input('note', sql.NVarChar(500), note||null)
        .query(`INSERT INTO rfq_status_log (rfq_id, old_status, new_status, note) VALUES (@rfqId, @oldStatus, @newStatus, @note)`);
      res.redirect(`/admin/rfqs/${req.params.id}?updated=1`);
    } catch(err) {
      res.redirect(`/admin/rfqs/${req.params.id}?error=1`);
    }
  });

  // ── Customers ────────────────────────────────────────────
  router.get('/customers', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const result = await pool.request().query(`
        SELECT c.id, c.first_name+' '+c.last_name AS name, c.company, c.email, c.phone,
          c.status, c.created_at, COUNT(h.id) AS rfq_count
        FROM customers c
        LEFT JOIN rfq_headers h ON h.customer_id=c.id
        GROUP BY c.id,c.first_name,c.last_name,c.company,c.email,c.phone,c.status,c.created_at
        ORDER BY c.created_at DESC
      `);
      const rows = result.recordset.map(c => `<tr>
        <td>${c.name}</td>
        <td style="color:#7a8a9a;">${c.company||'—'}</td>
        <td style="color:#7a8a9a;font-size:.8rem;">${c.email}</td>
        <td style="color:#7a8a9a;">${c.phone||'—'}</td>
        <td>${c.rfq_count}</td>
        <td>${statusBadge(c.status)}</td>
        <td style="color:#7a8a9a;font-size:.78rem;">${new Date(c.created_at).toLocaleDateString()}</td>
      </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:#7a8a9a;padding:24px;">No customers yet</td></tr>';
      res.send(page('Customers','customers',`
        <div class="page-title">Customers</div>
        <div class="page-sub">All registered customers</div>
        <div class="card">
          <table><thead><tr><th>Name</th><th>Company</th><th>Email</th><th>Phone</th><th>RFQs</th><th>Status</th><th>Joined</th></tr></thead>
          <tbody>${rows}</tbody></table>
        </div>`));
    } catch(err) {
      res.send(page('Customers','customers',`<div class="alert alert-error">${err.message}</div>`));
    }
  });

  // ── Quotes ───────────────────────────────────────────────
  router.get('/quotes', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const result = await pool.request().query(`
        SELECT q.id, q.quote_number, q.status, q.total_amount, q.valid_until, q.created_at,
          c.first_name+' '+c.last_name AS customer_name, c.company,
          h.rfq_number
        FROM quotes q
        JOIN customers c ON c.id=q.customer_id
        JOIN rfq_headers h ON h.id=q.rfq_id
        ORDER BY q.created_at DESC
      `);
      const rows = result.recordset.map(q => `<tr>
        <td class="mono text-gold">${q.quote_number}</td>
        <td class="mono" style="color:#7a8a9a;">${q.rfq_number}</td>
        <td>${q.customer_name}<br><span class="text-muted" style="font-size:.75rem;">${q.company||''}</span></td>
        <td style="font-weight:600;">$${parseFloat(q.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
        <td>${statusBadge(q.status)}</td>
        <td style="color:#7a8a9a;font-size:.78rem;">${q.valid_until?new Date(q.valid_until).toLocaleDateString():'—'}</td>
        <td style="color:#7a8a9a;font-size:.78rem;">${new Date(q.created_at).toLocaleDateString()}</td>
      </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:#7a8a9a;padding:24px;">No quotes yet</td></tr>';
      res.send(page('Quotes','quotes',`
        <div class="page-title">Quotes</div>
        <div class="page-sub">All customer quotes</div>
        <div class="card">
          <table><thead><tr><th>Quote #</th><th>RFQ #</th><th>Customer</th><th>Amount</th><th>Status</th><th>Valid Until</th><th>Created</th></tr></thead>
          <tbody>${rows}</tbody></table>
        </div>`));
    } catch(err) {
      res.send(page('Quotes','quotes',`<div class="alert alert-error">${err.message}</div>`));
    }
  });

  // ── Orders ───────────────────────────────────────────────
  router.get('/orders', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const result = await pool.request().query(`
        SELECT o.id, o.order_number, o.status, o.total_amount, o.confirmed_at,
          c.first_name+' '+c.last_name AS customer_name, c.company
        FROM orders o
        JOIN customers c ON c.id=o.customer_id
        ORDER BY o.confirmed_at DESC
      `);
      const rows = result.recordset.map(o => `<tr>
        <td class="mono text-gold">${o.order_number}</td>
        <td>${o.customer_name}<br><span class="text-muted" style="font-size:.75rem;">${o.company||''}</span></td>
        <td style="font-weight:600;">$${parseFloat(o.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
        <td>${statusBadge(o.status)}</td>
        <td style="color:#7a8a9a;font-size:.78rem;">${o.confirmed_at?new Date(o.confirmed_at).toLocaleDateString():'—'}</td>
      </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#7a8a9a;padding:24px;">No orders yet</td></tr>';
      res.send(page('Orders','orders',`
        <div class="page-title">Orders</div>
        <div class="page-sub">All customer orders</div>
        <div class="card">
          <table><thead><tr><th>Order #</th><th>Customer</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>${rows}</tbody></table>
        </div>`));
    } catch(err) {
      res.send(page('Orders','orders',`<div class="alert alert-error">${err.message}</div>`));
    }
  });

  // ── Invoices ─────────────────────────────────────────────
  router.get('/invoices', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const result = await pool.request().query(`
        SELECT i.id, i.invoice_number, i.status, i.total_amount, i.balance_due, i.due_date, i.created_at,
          c.first_name+' '+c.last_name AS customer_name, c.company
        FROM invoices i
        JOIN customers c ON c.id=i.customer_id
        ORDER BY i.created_at DESC
      `);
      const rows = result.recordset.map(i => `<tr>
        <td class="mono text-gold">${i.invoice_number}</td>
        <td>${i.customer_name}<br><span class="text-muted" style="font-size:.75rem;">${i.company||''}</span></td>
        <td>$${parseFloat(i.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
        <td style="font-weight:600;${parseFloat(i.balance_due)>0?'color:#e05050;':'color:#4caf50;'}">$${parseFloat(i.balance_due||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
        <td>${statusBadge(i.status)}</td>
        <td style="color:#7a8a9a;font-size:.78rem;">${i.due_date?new Date(i.due_date).toLocaleDateString():'—'}</td>
      </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#7a8a9a;padding:24px;">No invoices yet</td></tr>';
      res.send(page('Invoices','invoices',`
        <div class="page-title">Invoices</div>
        <div class="page-sub">All customer invoices</div>
        <div class="card">
          <table><thead><tr><th>Invoice #</th><th>Customer</th><th>Total</th><th>Balance Due</th><th>Status</th><th>Due Date</th></tr></thead>
          <tbody>${rows}</tbody></table>
        </div>`));
    } catch(err) {
      res.send(page('Invoices','invoices',`<div class="alert alert-error">${err.message}</div>`));
    }
  });

  // ── Suppliers ────────────────────────────────────────────
  router.get('/suppliers', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const result = await pool.request().query(`
        SELECT id, name, contact_name, email, phone, country, status, created_at
        FROM suppliers ORDER BY name ASC
      `);
      const rows = result.recordset.map(s => `<tr>
        <td style="font-weight:600;">${s.name}</td>
        <td style="color:#7a8a9a;">${s.contact_name||'—'}</td>
        <td style="color:#7a8a9a;font-size:.8rem;">${s.email||'—'}</td>
        <td style="color:#7a8a9a;">${s.phone||'—'}</td>
        <td style="color:#7a8a9a;">${s.country||'—'}</td>
        <td>${statusBadge(s.status)}</td>
      </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#7a8a9a;padding:24px;">No suppliers yet</td></tr>';
      res.send(page('Suppliers','suppliers',`
        <div class="page-title">Suppliers</div>
        <div class="page-sub">Verified supplier network</div>
        <div class="card">
          <table><thead><tr><th>Company</th><th>Contact</th><th>Email</th><th>Phone</th><th>Country</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody></table>
        </div>`));
    } catch(err) {
      res.send(page('Suppliers','suppliers',`<div class="alert alert-error">${err.message}</div>`));
    }
  });

  return { admin: { options: { rootPath: '/admin' } }, adminRouter: router };
}