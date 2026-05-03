// admin/index.js
import { Router } from 'express';
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
select, input[type=text], input[type=email], input[type=number], textarea { background:#0a1628; border:1px solid #1e2d42; color:#eef1f5; padding:8px 12px; font-size:.85rem; outline:none; font-family:inherit; }
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
    <a href="/admin/messages" class="${active==='messages'?'active':''}">✉️ Messages</a>
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

  // Login
  router.get('/', (req, res) => {
    const err = req.query.error ? '<div class="alert alert-error">Invalid credentials.</div>' : '';
    res.send(`<!DOCTYPE html><html><head><title>Admin Login</title>
    <style>${CSS} body{display:flex;align-items:center;justify-content:center;min-height:100vh;}
    .login-card{background:#111e30;border:1px solid #1e2d42;border-top:3px solid #c8932a;padding:40px;width:100%;max-width:400px;}
    h1{font-size:1.3rem;color:#c8932a;margin-bottom:4px;} p{font-size:.82rem;color:#7a8a9a;margin-bottom:24px;}
    input{width:100%;margin-bottom:12px;display:block;}</style></head><body>
    <div class="login-card">
      <h1>⚡ Jupiter One USA</h1><p>Admin Panel — Restricted Access</p>${err}
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

  // Dashboard
  router.get('/dashboard', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const stats = await pool.request().query(`
        SELECT
          (SELECT COUNT(*) FROM rfq_headers) AS total_rfqs,
          (SELECT COUNT(*) FROM rfq_headers WHERE status='Submitted') AS new_rfqs,
          (SELECT COUNT(*) FROM customers) AS total_customers,
          (SELECT COUNT(*) FROM rfq_headers WHERE status='Sourcing') AS active_sourcing,
          (SELECT COUNT(*) FROM contact_messages WHERE status='New') AS new_messages
      `);
      const s = stats.recordset[0];
      const recent = await pool.request().query(`
        SELECT TOP 10 h.id, h.rfq_number, h.status, h.priority, h.submitted_at,
          c.id AS customer_id, c.first_name+' '+c.last_name AS customer_name, c.company,
          COUNT(l.id) AS line_count
        FROM rfq_headers h
        JOIN customers c ON c.id=h.customer_id
        LEFT JOIN rfq_lines l ON l.rfq_id=h.id
        GROUP BY h.id,h.rfq_number,h.status,h.priority,h.submitted_at,c.id,c.first_name,c.last_name,c.company
        ORDER BY h.submitted_at DESC
      `);
      const rows = recent.recordset.map(r => `<tr>
        <td class="mono text-gold"><a href="/admin/rfqs/${r.id}" style="color:#c8932a;">${r.rfq_number}</a></td>
        <td><a href="/admin/customers/${r.customer_id}" style="color:#c8932a;">${r.customer_name}</a><br><span style="font-size:.75rem;color:#7a8a9a;">${r.company||''}</span></td>
        <td>${r.line_count}</td>
        <td>${statusBadge(r.priority)}</td>
        <td>${statusBadge(r.status)}</td>
        <td>${new Date(r.submitted_at).toLocaleDateString()}</td>
        <td><a href="/admin/rfqs/${r.id}" class="btn btn-outline btn-sm">View</a></td>
      </tr>`).join('');
      res.send(page('Dashboard', 'dashboard', `
        <div class="page-title">Dashboard</div>
        <div class="page-sub">Jupiter One USA — Admin Overview</div>
        <div class="stat-grid">
          <div class="stat"><div class="stat-num">${s.new_rfqs}</div><div class="stat-label">New RFQs</div></div>
          <div class="stat"><div class="stat-num">${s.total_rfqs}</div><div class="stat-label">Total RFQs</div></div>
          <div class="stat"><div class="stat-num">${s.active_sourcing}</div><div class="stat-label">Active</div></div>
          <div class="stat"><div class="stat-num">${s.total_customers}</div><div class="stat-label">Customers</div></div>
          <div class="stat"><div class="stat-num">${s.new_messages}</div><div class="stat-label">New Messages</div></div>
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

  // RFQs List
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
          c.id AS customer_id, c.first_name+' '+c.last_name AS customer_name, c.company, c.email,
          COUNT(l.id) AS line_count
        FROM rfq_headers h
        JOIN customers c ON c.id=h.customer_id
        LEFT JOIN rfq_lines l ON l.rfq_id=h.id
        ${where}
        GROUP BY h.id,h.rfq_number,h.status,h.priority,h.submitted_at,c.id,c.first_name,c.last_name,c.company,c.email
        ORDER BY h.submitted_at DESC
        OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY
      `);
      const statuses = ['','Submitted','Under Review','Sourcing','Quoted','Closed','Cancelled'];
      const filters = statuses.map(s => `<a href="/admin/rfqs${s?'?status='+s:''}" class="btn btn-sm ${status===s?'btn-gold':'btn-outline'}">${s||'All'}</a>`).join('');
      const rows = result.recordset.map(r => `<tr>
        <td class="mono text-gold"><a href="/admin/rfqs/${r.id}" style="color:#c8932a;">${r.rfq_number}</a></td>
        <td><a href="/admin/customers/${r.customer_id}" style="color:#c8932a;">${r.customer_name}</a><br><span style="font-size:.75rem;color:#7a8a9a;">${r.company||''}</span></td>
        <td style="color:#7a8a9a;font-size:.8rem;">${r.email}</td>
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

  // RFQ Detail
  router.get('/rfqs/:id', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const h = await pool.request().input('id', sql.BigInt, req.params.id).query(`
        SELECT h.*, c.id AS customer_id, c.first_name+' '+c.last_name AS customer_name, c.company, c.email, c.phone
        FROM rfq_headers h JOIN customers c ON c.id=h.customer_id WHERE h.id=@id`);
      if (!h.recordset.length) return res.send(page('RFQ','rfqs','<div class="alert alert-error">RFQ not found.</div>'));
      const rfq = h.recordset[0];
      const lines = await pool.request().input('id', sql.BigInt, req.params.id)
        .query(`SELECT * FROM rfq_lines WHERE rfq_id=@id ORDER BY line_number`);
      const log = await pool.request().input('id', sql.BigInt, req.params.id)
        .query(`SELECT * FROM rfq_status_log WHERE rfq_id=@id ORDER BY created_at ASC`);

      const successMsg = req.query.quoted ? '<div class="alert alert-success">Quote created and sent to customer!</div>' : req.query.updated ? '<div class="alert alert-success">Status updated.</div>' : req.query.error ? '<div class="alert alert-error">An error occurred. Please try again.</div>' : '';

      const lineRows = lines.recordset.map(l => `<tr>
        <td style="color:#7a8a9a;">${l.line_number}</td>
        <td class="mono text-gold"><a href="/pages/nsn-detail.html?nsn=${l.nsn||l.part_number}" target="_blank" style="color:#c8932a;">${l.nsn||l.part_number||'—'}</a></td>
        <td>${l.item_name||'—'}</td>
        <td>${l.quantity}</td>
        <td>${statusBadge(l.condition_code||'—')}</td>
        <td>${l.target_price ? '$'+parseFloat(l.target_price).toFixed(2) : '—'}</td>
        <td style="color:#7a8a9a;font-size:.8rem;">${l.notes||'—'}</td>
      </tr>`).join('');

      const quoteLineInputs = lines.recordset.map(l => `<tr>
        <td style="color:#7a8a9a;">${l.line_number}</td>
        <td class="mono" style="color:#c8932a;">${l.nsn||l.part_number||'—'}
          <input type="hidden" name="lines[${l.line_number-1}][rfq_line_id]" value="${l.id}"/>
          <input type="hidden" name="lines[${l.line_number-1}][nsn]" value="${l.nsn||''}"/>
          <input type="hidden" name="lines[${l.line_number-1}][part_number]" value="${l.part_number||''}"/>
          <input type="hidden" name="lines[${l.line_number-1}][item_name]" value="${l.item_name||''}"/>
          <input type="hidden" name="lines[${l.line_number-1}][quantity]" value="${l.quantity}"/>
          <input type="hidden" name="lines[${l.line_number-1}][condition_code]" value="${l.condition_code||'NE'}"/>
        </td>
        <td>${l.item_name||'—'}</td>
        <td style="text-align:center;">${l.quantity}</td>
        <td><input type="number" step="0.01" min="0" name="lines[${l.line_number-1}][unit_cost]" placeholder="0.00" style="width:90px;" required/></td>
        <td><input type="number" step="0.01" min="0" name="lines[${l.line_number-1}][unit_price]" placeholder="0.00" style="width:90px;" required/></td>
        <td><input type="number" min="1" name="lines[${l.line_number-1}][lead_time_days]" placeholder="7" style="width:70px;"/></td>
      </tr>`).join('');

      const logRows = log.recordset.map(l => `<tr>
        <td style="color:#7a8a9a;font-size:.78rem;">${new Date(l.created_at).toLocaleString()}</td>
        <td>${statusBadge(l.new_status)}</td>
        <td style="color:#7a8a9a;">${l.note||'—'}</td>
      </tr>`).join('');

      const statuses = ['Submitted','Under Review','Sourcing','Quoted','Closed','Cancelled'];
      const statusOptions = statuses.map(s => `<option value="${s}"${rfq.status===s?' selected':''}>${s}</option>`).join('');

      res.send(page(`RFQ ${rfq.rfq_number}`,'rfqs',`
        ${successMsg}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div class="page-title">RFQ ${rfq.rfq_number}</div>
          <a href="/admin/rfqs" class="btn btn-outline btn-sm">← Back to RFQs</a>
        </div>
        <div class="page-sub">Submitted ${new Date(rfq.submitted_at).toLocaleString()}</div>
        <div class="detail-grid">
          <div class="detail-item"><div class="detail-label">Customer</div><div class="detail-value"><a href="/admin/customers/${rfq.customer_id}" style="color:#c8932a;">${rfq.customer_name}</a></div></div>
          <div class="detail-item"><div class="detail-label">Company</div><div class="detail-value">${rfq.company||'—'}</div></div>
          <div class="detail-item"><div class="detail-label">Email</div><div class="detail-value"><a href="mailto:${rfq.email}" style="color:#c8932a;">${rfq.email}</a></div></div>
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
          <div class="card-header">
            Create & Send Quote
            <button class="btn btn-gold btn-sm" onclick="var f=document.getElementById('quote-form');f.style.display=f.style.display==='none'?'block':'none';">+ New Quote</button>
          </div>
          <div id="quote-form" style="display:none;padding:18px;">
            <form method="POST" action="/admin/rfqs/${rfq.id}/quote">
              <div style="overflow-x:auto;">
                <table style="width:100%;margin-bottom:16px;">
                  <thead><tr><th>#</th><th>NSN / Part</th><th>Description</th><th>Qty</th><th>Unit Cost ($)</th><th>Unit Price ($)</th><th>Lead Days</th></tr></thead>
                  <tbody>${quoteLineInputs}</tbody>
                </table>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
                <div>
                  <div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Payment Terms</div>
                  <input type="text" name="payment_terms" value="Credit Card, COD, or Wire Transfer" style="width:100%;"/>
                </div>
                <div>
                  <div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Valid Days</div>
                  <input type="number" name="valid_days" value="30" style="width:100%;"/>
                </div>
              </div>
              <div style="margin-bottom:16px;">
                <div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Notes / Terms</div>
                <textarea name="notes" rows="3" style="width:100%;" placeholder="Quote terms, lead times, conditions..."></textarea>
              </div>
              <button type="submit" class="btn btn-gold">Create & Send Quote to Customer →</button>
            </form>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Update Status</div>
          <div class="card-body">
            <form method="POST" action="/admin/rfqs/${rfq.id}/status" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
              <div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">New Status</div><select name="status">${statusOptions}</select></div>
              <div style="flex:1;min-width:200px;"><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Note (optional)</div><input type="text" name="note" placeholder="Add a note..." style="width:100%;"/></div>
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

  // Create Quote from RFQ
  router.post('/rfqs/:id/quote', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const rfqResult = await pool.request().input('id', sql.BigInt, req.params.id)
        .query(`SELECT h.*, c.first_name, c.last_name, c.email, c.company FROM rfq_headers h JOIN customers c ON c.id=h.customer_id WHERE h.id=@id`);
      if (!rfqResult.recordset.length) return res.redirect('/admin/rfqs');
      const rfq = rfqResult.recordset[0];
      const { valid_days = 30, payment_terms, notes } = req.body;
      const linesRaw = req.body.lines || {};
      const linesArr = Object.values(linesRaw);
      let subtotal = 0;
      const processedLines = linesArr.map((l, i) => {
        const unitPrice = parseFloat(l.unit_price) || 0;
        const unitCost = parseFloat(l.unit_cost) || 0;
        const qty = parseInt(l.quantity) || 1;
        const lineTotal = unitPrice * qty;
        const lineCost = unitCost * qty;
        subtotal += lineTotal;
        return {
          ...l,
          line_number: i + 1,
          unit_price: unitPrice,
          unit_cost: unitCost,
          quantity: qty,
          line_total: lineTotal,
          line_cost: lineCost,
          line_margin: lineTotal - lineCost,
          markup_pct: unitCost > 0 ? ((unitPrice - unitCost) / unitCost) * 100 : 0,
          margin_pct: lineTotal > 0 ? ((lineTotal - lineCost) / lineTotal) * 100 : 0,
        };
      });
      const { generateNumber } = await import('../db/numbering.js');
      const quoteNumber = await generateNumber('QT');
      const validUntil = new Date(Date.now() + parseInt(valid_days) * 24 * 60 * 60 * 1000);
      const totalCost = processedLines.reduce((s, l) => s + l.line_cost, 0);
      const qr = await pool.request()
        .input('rfqId', sql.BigInt, rfq.id)
        .input('customerId', sql.BigInt, rfq.customer_id)
        .input('quoteNumber', sql.NVarChar(20), quoteNumber)
        .input('subtotal', sql.Decimal(12,2), subtotal)
        .input('totalAmount', sql.Decimal(12,2), subtotal)
        .input('totalCost', sql.Decimal(12,2), totalCost)
        .input('totalMargin', sql.Decimal(12,2), subtotal - totalCost)
        .input('validUntil', sql.Date, validUntil)
        .input('paymentTerms', sql.NVarChar(100), payment_terms || 'Credit Card, COD, or Wire Transfer')
        .input('notes', sql.NVarChar(sql.MAX), notes || null)
        .query(`
          INSERT INTO quotes (rfq_id, customer_id, quote_number, subtotal, total_amount, total_cost, total_margin, valid_until, payment_terms, notes, status)
          OUTPUT INSERTED.id, INSERTED.quote_number
          VALUES (@rfqId, @customerId, @quoteNumber, @subtotal, @totalAmount, @totalCost, @totalMargin, @validUntil, @paymentTerms, @notes, 'Sent')
        `);
      const quote = qr.recordset[0];
      for (const l of processedLines) {
        await pool.request()
          .input('quoteId', sql.BigInt, quote.id)
          .input('rfqLineId', sql.BigInt, parseInt(l.rfq_line_id) || null)
          .input('lineNum', sql.Int, l.line_number)
          .input('nsn', sql.NVarChar(20), l.nsn || null)
          .input('partNum', sql.NVarChar(100), l.part_number || null)
          .input('itemName', sql.NVarChar(255), l.item_name || null)
          .input('condition', sql.NVarChar(5), l.condition_code || 'NE')
          .input('qty', sql.Int, l.quantity)
          .input('unitCost', sql.Decimal(10,2), l.unit_cost)
          .input('unitPrice', sql.Decimal(10,2), l.unit_price)
          .input('lineTotal', sql.Decimal(12,2), l.line_total)
          .input('lineCost', sql.Decimal(12,2), l.line_cost)
          .input('lineMargin', sql.Decimal(12,2), l.line_margin)
          .input('markupPct', sql.Decimal(5,2), l.markup_pct)
          .input('marginPct', sql.Decimal(5,2), l.margin_pct)
          .input('leadTime', sql.Int, parseInt(l.lead_time_days) || null)
          .query(`
            INSERT INTO quote_lines
              (quote_id, rfq_line_id, line_number, nsn, part_number, item_name, condition_code, quantity, unit_cost, unit_price, line_total, line_cost, line_margin, markup_pct, margin_pct, lead_time_days)
            VALUES
              (@quoteId, @rfqLineId, @lineNum, @nsn, @partNum, @itemName, @condition, @qty, @unitCost, @unitPrice, @lineTotal, @lineCost, @lineMargin, @markupPct, @marginPct, @leadTime)
          `);
      }
      await pool.request()
        .input('rfqId', sql.BigInt, rfq.id)
        .query(`UPDATE rfq_headers SET status='Quoted', updated_at=GETDATE() WHERE id=@rfqId`);
      await pool.request()
        .input('rfqId', sql.BigInt, rfq.id)
        .input('note', sql.NVarChar(500), `Quote ${quoteNumber} created and sent`)
        .query(`INSERT INTO rfq_status_log (rfq_id, old_status, new_status, note) VALUES (@rfqId, 'Submitted', 'Quoted', @note)`);
      const { sendQuoteToCustomer } = await import('../services/mailer.js');
      const customer = { first_name: rfq.first_name, last_name: rfq.last_name, email: rfq.email };
      await sendQuoteToCustomer({
        customer,
        quote: { ...quote, total_amount: subtotal, valid_until: validUntil, payment_terms, notes },
        lines: processedLines,
        pdfUrl: null,
      }).catch(console.error);
      res.redirect(`/admin/rfqs/${req.params.id}?quoted=1`);
    } catch(err) {
      console.error('Admin quote error:', err);
      res.redirect(`/admin/rfqs/${req.params.id}?error=1`);
    }
  });

  // RFQ Status Update
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

  // Customers List
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
        <td><a href="/admin/customers/${c.id}" style="color:#c8932a;">${c.name}</a></td>
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

  // Customer Detail
  router.get('/customers/:id', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const cr = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT * FROM customers WHERE id=@id');
      if (!cr.recordset.length) return res.send(page('Customer','customers','<div class="alert alert-error">Not found.</div>'));
      const cust = cr.recordset[0];
      const rfqs = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT h.id, h.rfq_number, h.status, h.priority, h.submitted_at, COUNT(l.id) AS line_count FROM rfq_headers h LEFT JOIN rfq_lines l ON l.rfq_id=h.id WHERE h.customer_id=@id GROUP BY h.id,h.rfq_number,h.status,h.priority,h.submitted_at ORDER BY h.submitted_at DESC');
      const rfqRows = rfqs.recordset.map(r => `<tr>
        <td class="mono text-gold"><a href="/admin/rfqs/${r.id}" style="color:#c8932a;">${r.rfq_number}</a></td>
        <td>${r.line_count}</td>
        <td>${statusBadge(r.priority)}</td>
        <td>${statusBadge(r.status)}</td>
        <td style="color:#7a8a9a;font-size:.78rem;">${new Date(r.submitted_at).toLocaleDateString()}</td>
        <td><a href="/admin/rfqs/${r.id}" class="btn btn-outline btn-sm">View</a></td>
      </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#7a8a9a;padding:16px;">No RFQs yet</td></tr>';
      res.send(page('Customer: '+cust.first_name+' '+cust.last_name,'customers',`
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div class="page-title">${cust.first_name} ${cust.last_name}</div>
          <a href="/admin/customers" class="btn btn-outline btn-sm">← Back</a>
        </div>
        <div class="page-sub">${cust.company||''}</div>
        <div class="detail-grid">
          <div class="detail-item"><div class="detail-label">Email</div><div class="detail-value"><a href="mailto:${cust.email}" style="color:#c8932a;">${cust.email}</a></div></div>
          <div class="detail-item"><div class="detail-label">Phone</div><div class="detail-value">${cust.phone||'—'}</div></div>
          <div class="detail-item"><div class="detail-label">Company</div><div class="detail-value">${cust.company||'—'}</div></div>
          <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">${statusBadge(cust.status)}</div></div>
          <div class="detail-item"><div class="detail-label">Member Since</div><div class="detail-value">${new Date(cust.created_at).toLocaleDateString()}</div></div>
          <div class="detail-item"><div class="detail-label">Country</div><div class="detail-value">${cust.country||'—'}</div></div>
        </div>
        <div class="card">
          <div class="card-header">RFQ History</div>
          <table><thead><tr><th>RFQ #</th><th>Lines</th><th>Priority</th><th>Status</th><th>Date</th><th></th></tr></thead>
          <tbody>${rfqRows}</tbody></table>
        </div>`));
    } catch(err) {
      res.send(page('Customer','customers',`<div class="alert alert-error">${err.message}</div>`));
    }
  });

  // Quotes
  router.get('/quotes', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const result = await pool.request().query(`
        SELECT q.id, q.quote_number, q.status, q.total_amount, q.valid_until, q.created_at,
          c.first_name+' '+c.last_name AS customer_name, c.company, h.rfq_number
        FROM quotes q
        JOIN customers c ON c.id=q.customer_id
        JOIN rfq_headers h ON h.id=q.rfq_id
        ORDER BY q.created_at DESC
      `);
      const rows = result.recordset.map(q => `<tr>
        <td class="mono text-gold">${q.quote_number}</td>
        <td class="mono" style="color:#7a8a9a;">${q.rfq_number}</td>
        <td>${q.customer_name}<br><span style="font-size:.75rem;color:#7a8a9a;">${q.company||''}</span></td>
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

  // Orders
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
        <td>${o.customer_name}<br><span style="font-size:.75rem;color:#7a8a9a;">${o.company||''}</span></td>
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

  // Invoices
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
        <td>${i.customer_name}<br><span style="font-size:.75rem;color:#7a8a9a;">${i.company||''}</span></td>
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

  // Suppliers
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

  // Messages
  router.get('/messages', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const result = await pool.request().query(`
        SELECT id, name, email, phone, company, subject, message, status, submitted_at
        FROM contact_messages
        ORDER BY submitted_at DESC
      `);
      const rows = result.recordset.map(m => `<tr>
        <td><strong>${m.name}</strong><br><span style="font-size:.75rem;color:#7a8a9a;">${m.company||''}</span></td>
        <td style="color:#7a8a9a;font-size:.8rem;"><a href="mailto:${m.email}" style="color:#c8932a;">${m.email}</a></td>
        <td style="color:#7a8a9a;">${m.phone||'—'}</td>
        <td>${m.subject||'—'}</td>
        <td style="color:#7a8a9a;font-size:.82rem;max-width:300px;">${(m.message||'').substring(0,100)}${m.message?.length>100?'...':''}</td>
        <td>${statusBadge(m.status||'New')}</td>
        <td style="color:#7a8a9a;font-size:.78rem;">${new Date(m.submitted_at).toLocaleDateString()}</td>
        <td>
          <form method="POST" action="/admin/messages/${m.id}/status" style="display:inline;">
            <select name="status" onchange="this.form.submit()" style="font-size:.7rem;padding:4px 8px;">
              <option value="New"${m.status==='New'?' selected':''}>New</option>
              <option value="Read"${m.status==='Read'?' selected':''}>Read</option>
              <option value="Responded"${m.status==='Responded'?' selected':''}>Responded</option>
            </select>
          </form>
        </td>
      </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;color:#7a8a9a;padding:24px;">No messages yet</td></tr>';
      res.send(page('Messages','messages',`
        <div class="page-title">Messages</div>
        <div class="page-sub">Contact form submissions</div>
        <div class="card">
          <table><thead><tr><th>From</th><th>Email</th><th>Phone</th><th>Subject</th><th>Message</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
          <tbody>${rows}</tbody></table>
        </div>`));
    } catch(err) {
      res.send(page('Messages','messages',`<div class="alert alert-error">${err.message}</div>`));
    }
  });

  router.post('/messages/:id/status', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      await pool.request()
        .input('id', sql.BigInt, req.params.id)
        .input('status', sql.NVarChar, req.body.status)
        .query(`UPDATE contact_messages SET status=@status WHERE id=@id`);
      res.redirect('/admin/messages');
    } catch(err) {
      res.redirect('/admin/messages');
    }
  });

  return { admin: { options: { rootPath: '/admin' } }, adminRouter: router };
}
