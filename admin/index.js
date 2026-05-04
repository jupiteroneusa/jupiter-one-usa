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
th.sortable { cursor:pointer; user-select:none; }
th.sortable:hover { color:#c8932a; }
th.sort-asc::after { content:' ▲'; color:#c8932a; }
th.sort-desc::after { content:' ▼'; color:#c8932a; }
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
.pagination { display:flex; align-items:center; gap:8px; padding:14px 18px; border-top:1px solid #1e2d42; flex-wrap:wrap; }
.pagination-info { color:#7a8a9a; font-size:.78rem; margin-right:auto; }
.pagination .btn { padding:5px 12px; font-size:.7rem; }
.page-size-select { background:#0a1628; border:1px solid #1e2d42; color:#eef1f5; padding:5px 8px; font-size:.78rem; }
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
    <a href="/admin/dashboard" class="${active==='dashboard'?'active':''}">📈 Dashboard</a>
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

// Sortable table script for dashboard
const SORT_SCRIPT = `
<script>
function sortTable(th, col, dataAttr) {
  const table = th.closest('table');
  const tbody = table.querySelector('tbody');
  const rows = Array.from(tbody.querySelectorAll('tr'));
  const allTh = table.querySelectorAll('th.sortable');
  const asc = !th.classList.contains('sort-asc');
  allTh.forEach(t => t.classList.remove('sort-asc','sort-desc'));
  th.classList.add(asc ? 'sort-asc' : 'sort-desc');
  rows.sort((a, b) => {
    const cell_a = a.cells[col];
    const cell_b = b.cells[col];
    // Use data attribute if specified (e.g. for RFQ # numeric sort)
    if (dataAttr && cell_a && cell_b) {
      const an = parseFloat(cell_a.getAttribute(dataAttr) || cell_a.innerText);
      const bn = parseFloat(cell_b.getAttribute(dataAttr) || cell_b.innerText);
      if (!isNaN(an) && !isNaN(bn)) return asc ? an - bn : bn - an;
    }
    const av = cell_a?.innerText.trim() || '';
    const bv = cell_b?.innerText.trim() || '';
    const an = parseFloat(av.replace(/[^0-9.-]/g,''));
    const bn = parseFloat(bv.replace(/[^0-9.-]/g,''));
    if (!isNaN(an) && !isNaN(bn) && av !== '' && bv !== '') return asc ? an - bn : bn - an;
    return asc ? av.localeCompare(bv) : bv.localeCompare(av);
  });
  rows.forEach(r => tbody.appendChild(r));
}
</script>`;

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
        SELECT TOP 20 h.id, h.rfq_number, h.status, h.priority, h.submitted_at,
          c.id AS customer_id, c.first_name+' '+c.last_name AS customer_name, c.company,
          COUNT(l.id) AS line_count
        FROM rfq_headers h
        JOIN customers c ON c.id=h.customer_id
        LEFT JOIN rfq_lines l ON l.rfq_id=h.id
        GROUP BY h.id,h.rfq_number,h.status,h.priority,h.submitted_at,c.id,c.first_name,c.last_name,c.company
        ORDER BY h.submitted_at DESC
      `);
      const rows = recent.recordset.map(r => {
        const seq = parseInt((r.rfq_number||'').split('-').pop()) || 0;
        return `<tr>
        <td class="mono text-gold" data-val="${seq}"><a href="/admin/rfqs/${r.id}" style="color:#c8932a;">${r.rfq_number}</a></td>
        <td><a href="/admin/customers/${r.customer_id}" style="color:#c8932a;">${r.customer_name}</a><br><span style="font-size:.75rem;color:#7a8a9a;">${r.company||''}</span></td>
        <td>${r.line_count}</td>
        <td>${statusBadge(r.priority)}</td>
        <td>${statusBadge(r.status)}</td>
        <td>${new Date(r.submitted_at).toLocaleDateString()}</td>
        <td><a href="/admin/rfqs/${r.id}" class="btn btn-outline btn-sm">View</a></td>
      </tr>`;
      }).join('');
      res.send(page('Dashboard', 'dashboard', `
        ${SORT_SCRIPT}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div class="page-title">Dashboard</div>
          <a href="/admin/rfqs/create" class="btn btn-gold">+ Create Manual RFQ</a>
        </div>
        <div class="page-sub">Jupiter One USA — Admin Overview</div>
        <div class="stat-grid">
          <div class="stat"><div class="stat-num">${s.new_rfqs}</div><div class="stat-label">New RFQs</div></div>
          <div class="stat"><div class="stat-num">${s.total_rfqs}</div><div class="stat-label">Total RFQs</div></div>
          <div class="stat"><div class="stat-num">${s.active_sourcing}</div><div class="stat-label">Active</div></div>
          <div class="stat"><div class="stat-num">${s.total_customers}</div><div class="stat-label">Customers</div></div>
          <div class="stat"><div class="stat-num">${s.new_messages}</div><div class="stat-label">New Messages</div></div>
        </div>
        <div class="card">
          <div class="card-header">Recent RFQs <span style="font-size:.72rem;color:#7a8a9a;font-weight:400;">Click column headers to sort</span></div>
          <table><thead><tr>
            <th class="sortable" onclick="sortTable(this,0,'data-val')">RFQ #</th>
            <th class="sortable" onclick="sortTable(this,1)">Customer</th>
            <th class="sortable" onclick="sortTable(this,2)">Lines</th>
            <th class="sortable" onclick="sortTable(this,3)">Priority</th>
            <th class="sortable" onclick="sortTable(this,4)">Status</th>
            <th class="sortable" onclick="sortTable(this,5)">Date</th>
            <th></th>
          </tr></thead>
          <tbody>${rows}</tbody></table>
        </div>`));
    } catch(err) {
      res.send(page('Dashboard','dashboard',`<div class="alert alert-error">${err.message}</div>`));
    }
  });

  // RFQs List — with pagination + sortable headers
  router.get('/rfqs', async (req, res) => {
    if (!requireAuth(req, res)) return;
    const status = req.query.status || '';
    const pageNum = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = [10, 25, 50, 100].includes(parseInt(req.query.pageSize)) ? parseInt(req.query.pageSize) : 25;
    const offset = (pageNum - 1) * pageSize;
    const sortCol = req.query.sort || 'submitted_at';
    const sortDir = req.query.dir === 'asc' ? 'ASC' : 'DESC';

    // Whitelist sort columns
    const allowedSorts = {
      rfq_number: 'h.rfq_number',
      customer: 'c.last_name',
      lines: 'line_count',
      priority: 'h.priority',
      status: 'h.status',
      submitted_at: 'h.submitted_at',
    };
    const orderBy = allowedSorts[sortCol] || 'h.submitted_at';

    try {
      const pool = await getPool();
      const r = pool.request().input('lim', sql.Int, pageSize).input('off', sql.Int, offset);
      const refFilter = req.query.ref || '';
      let where = '';
      let whereClauses = [];
      if (status) { r.input('status', sql.NVarChar, status); whereClauses.push('h.status=@status'); }
      if (refFilter) { r.input('refFilter', sql.NVarChar, refFilter); whereClauses.push('h.customer_ref=@refFilter'); }
      if (whereClauses.length) where = 'WHERE ' + whereClauses.join(' AND ');

      // Count query
      const countQ = await pool.request()
        .input('status2', sql.NVarChar, status || null)
        .input('refFilter2', sql.NVarChar, refFilter || null)
        .query(`
        SELECT COUNT(*) AS total FROM rfq_headers h
        JOIN customers c ON c.id=h.customer_id
        WHERE (1=1)
          ${status ? 'AND h.status=@status2' : ''}
          ${refFilter ? 'AND h.customer_ref=@refFilter2' : ''}
      `);
      const totalRows = countQ.recordset[0].total;
      const totalPages = Math.ceil(totalRows / pageSize);

      const result = await r.query(`
        SELECT h.id, h.rfq_number, h.status, h.priority, h.submitted_at,
          c.id AS customer_id, c.first_name+' '+c.last_name AS customer_name, c.company, c.email, h.customer_ref, h.customer_ref,
          COUNT(l.id) AS line_count
        FROM rfq_headers h
        JOIN customers c ON c.id=h.customer_id
        LEFT JOIN rfq_lines l ON l.rfq_id=h.id
        ${where}
        GROUP BY h.id,h.rfq_number,h.status,h.priority,h.submitted_at,h.customer_ref,c.id,c.first_name,c.last_name,c.company,c.email
        ORDER BY ${orderBy} ${sortDir}
        OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY
      `);

      const statuses = ['','Submitted','Under Review','Sourcing','Quoted','Closed','Cancelled'];
      const filters = statuses.map(s => `<a href="/admin/rfqs?status=${s}&pageSize=${pageSize}" class="btn btn-sm ${status===s?'btn-gold':'btn-outline'}">${s||'All'}</a>`).join('');

      // Build sortable header link helper
      function sortLink(col, label) {
        const nextDir = (sortCol === col && sortDir === 'DESC') ? 'asc' : 'desc';
        const arrow = sortCol === col ? (sortDir === 'DESC' ? ' ▼' : ' ▲') : '';
        return `<th><a href="/admin/rfqs?status=${status}&sort=${col}&dir=${nextDir}&page=1&pageSize=${pageSize}" style="color:${sortCol===col?'#c8932a':'#7a8a9a'};text-decoration:none;font:inherit;letter-spacing:inherit;text-transform:inherit;">${label}${arrow}</a></th>`;
      }

      const rows = result.recordset.map(r => `<tr>
        <td class="mono text-gold"><a href="/admin/rfqs/${r.id}" style="color:#c8932a;">${r.rfq_number}</a></td>
        <td><a href="/admin/customers/${r.customer_id}" style="color:#c8932a;">${r.customer_name}</a><br><span style="font-size:.75rem;color:#7a8a9a;">${r.company||''}</span></td>
        <td style="color:#7a8a9a;font-size:.8rem;">${r.email}</td>
        <td>${r.customer_ref ? `<a href="/admin/rfqs?ref=${encodeURIComponent(r.customer_ref)}" style="color:#c8932a;font-size:.8rem;font-family:monospace;">${r.customer_ref}</a>` : '<span style="color:#555;">—</span>'}</td>
        <td>${r.line_count}</td>
        <td>${statusBadge(r.priority)}</td>
        <td>${statusBadge(r.status)}</td>
        <td>${new Date(r.submitted_at).toLocaleDateString()}</td>
        <td><a href="/admin/rfqs/${r.id}" class="btn btn-outline btn-sm">View</a></td>
      </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;color:#7a8a9a;padding:24px;">No RFQs found</td></tr>';

      // Pagination controls
      const baseUrl = (p) => `/admin/rfqs?status=${status}&sort=${sortCol}&dir=${sortDir}&page=${p}&pageSize=${pageSize}${refFilter?'&ref='+encodeURIComponent(refFilter):''}`;
      const pageSizeOptions = [10,25,50,100].map(n =>
        `<option value="${n}" ${n===pageSize?'selected':''}>${n} per page</option>`).join('');

      const prevBtn = pageNum > 1
        ? `<a href="${baseUrl(pageNum-1)}" class="btn btn-outline">← Prev</a>` : `<span class="btn btn-outline" style="opacity:.4;cursor:default;">← Prev</span>`;
      const nextBtn = pageNum < totalPages
        ? `<a href="${baseUrl(pageNum+1)}" class="btn btn-outline">Next →</a>` : `<span class="btn btn-outline" style="opacity:.4;cursor:default;">Next →</span>`;

      // Page number buttons (show up to 7)
      let pageButtons = '';
      const delta = 3;
      for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= pageNum - delta && p <= pageNum + delta)) {
          pageButtons += `<a href="${baseUrl(p)}" class="btn btn-sm ${p===pageNum?'btn-gold':'btn-outline'}">${p}</a>`;
        } else if (p === pageNum - delta - 1 || p === pageNum + delta + 1) {
          pageButtons += `<span style="color:#7a8a9a;padding:0 4px;">…</span>`;
        }
      }

      const start = offset + 1;
      const end = Math.min(offset + pageSize, totalRows);

      const pagination = `
        <div class="pagination">
          <span class="pagination-info">Showing ${start}–${end} of ${totalRows} RFQs</span>
          <select class="page-size-select" onchange="window.location='/admin/rfqs?status=${status}&sort=${sortCol}&dir=${sortDir}&page=1&pageSize='+this.value">
            ${pageSizeOptions}
          </select>
          ${prevBtn}
          ${pageButtons}
          ${nextBtn}
        </div>`;

      res.send(page('RFQs','rfqs',`
        <div class="page-title">RFQs${refFilter ? ' — Ref: '+refFilter : ''}</div>
        <div class="page-sub">${refFilter ? '<a href="/admin/rfqs" style="color:#c8932a;">← Clear filter</a> &nbsp;|&nbsp; RFQs for ref: <strong style="color:#c8932a;">'+refFilter+'</strong>' : 'All customer requests for quotation'}</div>
        <div class="filter-bar">${filters}</div>
        <div class="card">
          <table><thead><tr>
            ${sortLink('rfq_number','RFQ #')}
            ${sortLink('customer','Customer')}
            <th>Email</th>
            <th>Cust Ref</th>
            ${sortLink('lines','Lines')}
            ${sortLink('priority','Priority')}
            ${sortLink('status','Status')}
            ${sortLink('submitted_at','Date')}
            <th></th>
          </tr></thead>
          <tbody>${rows}</tbody></table>
          ${pagination}
        </div>`));
    } catch(err) {
      res.send(page('RFQs','rfqs',`<div class="alert alert-error">${err.message}</div>`));
    }
  });

  // Create Manual RFQ — GET form
  router.get('/rfqs/create', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      // Load existing customers for the dropdown
      const custResult = await pool.request().query(`
        SELECT id, first_name+' '+last_name AS name, email, company
        FROM customers ORDER BY last_name, first_name
      `);
      const custOptions = custResult.recordset.map(c =>
        `<option value="${c.id}">${c.name}${c.company ? ' — '+c.company : ''} (${c.email})</option>`
      ).join('');

      const errorMsg = req.query.error ? `<div class="alert alert-error">${decodeURIComponent(req.query.error)}</div>` : '';

      res.send(page('Create Manual RFQ', 'rfqs', `
        ${errorMsg}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div class="page-title">Create Manual RFQ</div>
          <a href="/admin/rfqs" class="btn btn-outline btn-sm">← Back to RFQs</a>
        </div>
        <div class="page-sub">Enter RFQ from a verbal or email order</div>

        <form method="POST" action="/admin/rfqs/create" id="manual-rfq-form">

          <!-- Customer Section -->
          <div class="card" style="margin-bottom:20px;">
            <div class="card-header">Customer</div>
            <div class="card-body">
              <div style="margin-bottom:16px;">
                <div style="display:flex;gap:16px;margin-bottom:12px;">
                  <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:.85rem;">
                    <input type="radio" name="customer_type" value="existing" checked onchange="toggleCustomer(this.value)" style="accent-color:#c8932a;width:auto;border:none;padding:0;"/> Use Existing Customer
                  </label>
                  <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:.85rem;">
                    <input type="radio" name="customer_type" value="new" onchange="toggleCustomer(this.value)" style="accent-color:#c8932a;width:auto;border:none;padding:0;"/> Create New Customer
                  </label>
                </div>
              </div>

              <!-- Existing customer typeahead -->
              <div id="existing-customer-section">
                <div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Search Customer (name, company, or email)</div>
                <div style="position:relative;max-width:500px;">
                  <input type="text" id="customer-search" placeholder="Start typing..." autocomplete="off" style="width:100%;" oninput="searchCustomers(this.value)"/>
                  <input type="hidden" name="customer_id" id="customer-id-hidden"/>
                  <div id="customer-suggestions" style="position:absolute;top:100%;left:0;right:0;background:#0f1e35;border:1px solid #c8932a;z-index:999;max-height:220px;overflow-y:auto;display:none;"></div>
                </div>
                <div id="customer-selected" style="margin-top:8px;font-size:.8rem;color:#4caf50;display:none;"></div>
              </div>

              <!-- New customer -->
              <div id="new-customer-section" style="display:none;">
                <div class="detail-grid" style="margin-bottom:0;">
                  <div>
                    <div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">First Name *</div>
                    <input type="text" name="new_first_name" style="width:100%;"/>
                  </div>
                  <div>
                    <div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Last Name *</div>
                    <input type="text" name="new_last_name" style="width:100%;"/>
                  </div>
                  <div>
                    <div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Email *</div>
                    <input type="email" name="new_email" style="width:100%;"/>
                  </div>
                  <div>
                    <div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Phone *</div>
                    <input type="text" name="new_phone" style="width:100%;"/>
                  </div>
                  <div>
                    <div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Company</div>
                    <input type="text" name="new_company" style="width:100%;"/>
                  </div>
                  <div>
                    <div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Country</div>
                    <input type="text" name="new_country" style="width:100%;"/>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- RFQ Details -->
          <div class="card" style="margin-bottom:20px;">
            <div class="card-header">RFQ Details</div>
            <div class="card-body">
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;">
                <div>
                  <div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Priority</div>
                  <select name="priority" style="width:100%;">
                    <option value="Standard">Standard</option>
                    <option value="Urgent">Urgent</option>
                    <option value="AOG">AOG</option>
                  </select>
                </div>
                <div>
                  <div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Status</div>
                  <select name="status" style="width:100%;">
                    <option value="Submitted">Submitted</option>
                    <option value="Under Review">Under Review</option>
                    <option value="Sourcing">Sourcing</option>
                  </select>
                </div>
                <div>
                  <div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Source</div>
                  <select name="source" style="width:100%;">
                    <option value="Phone">Phone</option>
                    <option value="Email">Email</option>
                    <option value="In Person">In Person</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Notes</div>
                <textarea name="notes" rows="3" style="width:100%;" placeholder="Customer notes, special requirements, delivery instructions..."></textarea>
              </div>
              <div style="margin-top:12px;">
                <div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Customer Reference <span style="color:#555;">(optional — customer's PO#, project code, etc.)</span></div>
                <input type="text" name="customer_ref" placeholder="e.g. PO-12345, Project Alpha" style="width:100%;"/>
              </div>
            </div>
          </div>

          <!-- Line Items -->
          <div class="card" style="margin-bottom:20px;">
            <div class="card-header">
              Line Items
              <button type="button" class="btn btn-outline btn-sm" onclick="addLine()">+ Add Line</button>
            </div>
            <div style="overflow-x:auto;">
              <table style="width:100%;">
                <thead><tr>
                  <th>#</th>
                  <th>NSN / Part Number</th>
                  <th>Description</th>
                  <th>Qty *</th>
                  <th>Condition</th>
                  <th>Target Price ($)</th>
                  <th>Notes</th>
                  <th></th>
                </tr></thead>
                <tbody id="lines-tbody">
                  <tr id="line-1">
                    <td style="color:#7a8a9a;">1</td>
                    <td><input type="text" name="lines[0][part]" placeholder="NSN or Part #" style="width:150px;"/></td>
                    <td><input type="text" name="lines[0][description]" placeholder="Item description" style="width:180px;"/></td>
                    <td><input type="number" name="lines[0][quantity]" value="1" min="1" style="width:70px;" required/></td>
                    <td>
                      <select name="lines[0][condition]" style="width:80px;">
                        <option value="NE">NE</option>
                        <option value="NS">NS</option>
                        <option value="AR">AR</option>
                        <option value="OH">OH</option>
                        <option value="RN">RN</option>
                        <option value="RP">RP</option>
                        <option value="RX">RX</option>
                        <option value="SV">SV</option>
                        <option value="UN">UN</option>
                      </select>
                    </td>
                    <td><input type="number" step="0.01" min="0" name="lines[0][target_price]" placeholder="0.00" style="width:90px;"/></td>
                    <td><input type="text" name="lines[0][notes]" placeholder="Notes" style="width:140px;"/></td>
                    <td><button type="button" onclick="removeLine(1)" class="btn btn-outline btn-sm" style="color:#e05050;border-color:#e05050;">✕</button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div style="display:flex;gap:10px;">
            <button type="submit" class="btn btn-gold" style="padding:11px 28px;">Create RFQ →</button>
            <a href="/admin/rfqs" class="btn btn-outline" style="padding:11px 20px;">Cancel</a>
          </div>
        </form>

        <script>
        let lineCount = 1;
        function toggleCustomer(val) {
          document.getElementById('existing-customer-section').style.display = val === 'existing' ? 'block' : 'none';
          document.getElementById('new-customer-section').style.display = val === 'new' ? 'block' : 'none';
          if (val === 'existing') {
            document.getElementById('customer-search').focus();
          }
        }
        let searchTimeout;
        function searchCustomers(val) {
          clearTimeout(searchTimeout);
          const box = document.getElementById('customer-suggestions');
          const hidden = document.getElementById('customer-id-hidden');
          const selected = document.getElementById('customer-selected');
          hidden.value = '';
          selected.style.display = 'none';
          if (val.length < 2) { box.style.display = 'none'; return; }
          searchTimeout = setTimeout(() => {
            fetch('/admin/api/customer-search?q=' + encodeURIComponent(val))
              .then(r => r.json())
              .then(results => {
                if (!results.length) { box.innerHTML = '<div style="padding:10px 14px;color:#7a8a9a;font-size:.82rem;">No customers found</div>'; box.style.display = 'block'; return; }
                box.innerHTML = results.map(c => \`<div onclick="selectCustomer('\${c.id}','\${c.name}','\${c.company||''}','\${c.email}')"
                  style="padding:10px 14px;cursor:pointer;border-bottom:1px solid #1e2d42;font-size:.82rem;"
                  onmouseover="this.style.background='rgba(200,147,42,0.1)'" onmouseout="this.style.background=''">
                  <span style="color:#eef1f5;font-weight:600;">\${c.name}</span>
                  \${c.company ? '<span style="color:#7a8a9a;"> — '+c.company+'</span>' : ''}
                  <br><span style="color:#c8932a;font-size:.75rem;">\${c.email}</span>
                </div>\`).join('');
                box.style.display = 'block';
              });
          }, 200);
        }
        function selectCustomer(id, name, company, email) {
          document.getElementById('customer-id-hidden').value = id;
          document.getElementById('customer-search').value = name + (company ? ' — ' + company : '');
          document.getElementById('customer-suggestions').style.display = 'none';
          const sel = document.getElementById('customer-selected');
          sel.innerHTML = '✓ Selected: <strong>' + name + '</strong> (' + email + ')';
          sel.style.display = 'block';
        }
        document.addEventListener('click', function(e) {
          if (!e.target.closest('#existing-customer-section')) {
            document.getElementById('customer-suggestions').style.display = 'none';
          }
        });
        function addLine() {
          const idx = lineCount;
          lineCount++;
          const num = idx + 1;
          const row = document.createElement('tr');
          row.id = 'line-' + num;
          row.innerHTML = \`
            <td style="color:#7a8a9a;">\${num}</td>
            <td><input type="text" name="lines[\${idx}][part]" placeholder="NSN or Part #" style="width:150px;"/></td>
            <td><input type="text" name="lines[\${idx}][description]" placeholder="Item description" style="width:180px;"/></td>
            <td><input type="number" name="lines[\${idx}][quantity]" value="1" min="1" style="width:70px;" required/></td>
            <td><select name="lines[\${idx}][condition]" style="width:80px;">
              <option value="NE">NE</option><option value="NS">NS</option><option value="AR">AR</option>
              <option value="OH">OH</option><option value="RN">RN</option><option value="RP">RP</option>
              <option value="RX">RX</option><option value="SV">SV</option><option value="UN">UN</option>
            </select></td>
            <td><input type="number" step="0.01" min="0" name="lines[\${idx}][target_price]" placeholder="0.00" style="width:90px;"/></td>
            <td><input type="text" name="lines[\${idx}][notes]" placeholder="Notes" style="width:140px;"/></td>
            <td><button type="button" onclick="removeLine(\${num})" class="btn btn-outline btn-sm" style="color:#e05050;border-color:#e05050;">✕</button></td>
          \`;
          document.getElementById('lines-tbody').appendChild(row);
        }
        function removeLine(num) {
          const row = document.getElementById('line-' + num);
          if (row && document.getElementById('lines-tbody').children.length > 1) row.remove();
        }
        </script>
      `));
    } catch(err) {
      res.send(page('Create RFQ', 'rfqs', `<div class="alert alert-error">${err.message}</div>`));
    }
  });

  // Create Manual RFQ — POST handler
  router.post('/rfqs/create', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const { customer_type, customer_id, priority, status, source, notes, customer_ref,
              new_first_name, new_last_name, new_email, new_phone, new_company, new_country } = req.body;
      const linesRaw = req.body.lines || {};
      const linesArr = Object.values(linesRaw).filter(l => l.quantity && parseInt(l.quantity) > 0);

      if (!linesArr.length) {
        return res.redirect('/admin/rfqs/create?error='+encodeURIComponent('At least one line item is required.'));
      }

      let finalCustomerId;

      if (customer_type === 'new') {
        // Validate required new customer fields
        if (!new_first_name || !new_last_name || !new_email || !new_phone) {
          return res.redirect('/admin/rfqs/create?error='+encodeURIComponent('First name, last name, email and phone are required for new customers.'));
        }
        // Check if email already exists
        const existing = await pool.request()
          .input('email', sql.NVarChar, new_email.toLowerCase())
          .query('SELECT id FROM customers WHERE email=@email');
        if (existing.recordset.length) {
          return res.redirect('/admin/rfqs/create?error='+encodeURIComponent('A customer with that email already exists. Use "existing customer" and select them.'));
        }
        // Create the customer (no password — admin-created, they can reset later)
        const bcrypt = await import('bcryptjs');
        const tempHash = await bcrypt.default.hash(Math.random().toString(36), 10);
        const newCust = await pool.request()
          .input('firstName', sql.NVarChar(100), new_first_name.trim())
          .input('lastName', sql.NVarChar(100), new_last_name.trim())
          .input('email', sql.NVarChar(255), new_email.toLowerCase().trim())
          .input('phone', sql.NVarChar(50), new_phone.trim())
          .input('company', sql.NVarChar(255), new_company?.trim() || null)
          .input('country', sql.NVarChar(100), new_country?.trim() || null)
          .input('passwordHash', sql.NVarChar(255), tempHash)
          .query(`
            INSERT INTO customers (first_name, last_name, email, phone, company, country, password_hash, status)
            OUTPUT INSERTED.id
            VALUES (@firstName, @lastName, @email, @phone, @company, @country, @passwordHash, 'Active')
          `);
        finalCustomerId = newCust.recordset[0].id;
      } else {
        if (!customer_id) {
          return res.redirect('/admin/rfqs/create?error='+encodeURIComponent('Please select a customer.'));
        }
        finalCustomerId = parseInt(customer_id);
      }

      // Generate RFQ number
      const { generateNumber } = await import('../db/numbering.js');
      const rfqNumber = await generateNumber('RFQ');

      // Insert RFQ header
      const rfqResult = await pool.request()
        .input('customerId', sql.BigInt, finalCustomerId)
        .input('rfqNumber', sql.NVarChar(20), rfqNumber)
        .input('status', sql.NVarChar(50), status || 'Submitted')
        .input('priority', sql.NVarChar(20), priority || 'Standard')
        .input('notes', sql.NVarChar(sql.MAX), notes || null)
        .input('source', sql.NVarChar(50), source || 'Phone')
        .input('customerRef', sql.NVarChar(100), customer_ref?.trim() || null)
        .query(`
          INSERT INTO rfq_headers (customer_id, rfq_number, status, priority, notes, customer_ref)
          OUTPUT INSERTED.id
          VALUES (@customerId, @rfqNumber, @status, @priority, @notes, @customerRef)
        `);
      const rfqId = rfqResult.recordset[0].id;

      // Insert line items
      for (let i = 0; i < linesArr.length; i++) {
        const l = linesArr[i];
        const partVal = (l.part || '').trim();
        // Detect if it looks like an NSN (contains dashes and right length) or part number
        const isNSN = /^\d{4}-\d{2}-\d{3}-\d{4}$/.test(partVal);
        await pool.request()
          .input('rfqId', sql.BigInt, rfqId)
          .input('lineNum', sql.Int, i + 1)
          .input('nsn', sql.NVarChar(20), isNSN ? partVal : null)
          .input('partNum', sql.NVarChar(100), !isNSN && partVal ? partVal : null)
          .input('itemName', sql.NVarChar(255), l.description?.trim() || null)
          .input('qty', sql.Int, parseInt(l.quantity) || 1)
          .input('condition', sql.NVarChar(5), l.condition || 'NE')
          .input('targetPrice', sql.Decimal(10,2), parseFloat(l.target_price) || null)
          .input('notes', sql.NVarChar(500), l.notes?.trim() || null)
          .query(`
            INSERT INTO rfq_lines (rfq_id, line_number, nsn, part_number, item_name, quantity, condition_code, target_price, notes)
            VALUES (@rfqId, @lineNum, @nsn, @partNum, @itemName, @qty, @condition, @targetPrice, @notes)
          `);
      }

      // Log initial status
      await pool.request()
        .input('rfqId', sql.BigInt, rfqId)
        .input('status', sql.NVarChar(50), status || 'Submitted')
        .input('note', sql.NVarChar(500), `Manual RFQ created by admin via ${source || 'Phone'}`)
        .query(`INSERT INTO rfq_status_log (rfq_id, old_status, new_status, note) VALUES (@rfqId, NULL, @status, @note)`);

      res.redirect('/admin/rfqs/' + rfqId + '?created=1');
    } catch(err) {
      console.error('Manual RFQ create error:', err);
      res.redirect('/admin/rfqs/create?error=' + encodeURIComponent(err.message));
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

      const successMsg = req.query.created ? '<div class="alert alert-success">Manual RFQ created successfully!</div>' : req.query.quoted ? '<div class="alert alert-success">Quote created and sent to customer!</div>' : req.query.updated ? '<div class="alert alert-success">Status updated.</div>' : req.query.error ? '<div class="alert alert-error">An error occurred. Please try again.</div>' : '';

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
        <td>
          <div style="font-size:.65rem;color:#7a8a9a;margin-bottom:3px;">Requested: ${l.nsn||l.part_number||'—'}</div>
          <input type="text" name="lines[${l.line_number-1}][fulfillment_part]" value="${l.nsn||l.part_number||''}" placeholder="NSN or Part #" style="width:150px;font-family:monospace;color:#c8932a;" title="Edit to substitute a different part number"/>
          <input type="hidden" name="lines[${l.line_number-1}][rfq_line_id]" value="${l.id}"/>
          <input type="hidden" name="lines[${l.line_number-1}][original_nsn]" value="${l.nsn||''}"/>
          <input type="hidden" name="lines[${l.line_number-1}][original_part]" value="${l.part_number||''}"/>
          <input type="hidden" name="lines[${l.line_number-1}][condition_code]" value="${l.condition_code||'NE'}"/>
        </td>
        <td><input type="text" name="lines[${l.line_number-1}][item_name]" value="${l.item_name||''}" placeholder="Description" style="width:160px;"/></td>
        <td><input type="number" min="1" name="lines[${l.line_number-1}][quantity]" value="${l.quantity||1}" style="width:65px;" required/></td>
        <td><input type="number" step="0.01" min="0" name="lines[${l.line_number-1}][unit_cost]" placeholder="0.00" style="width:90px;" required/></td>
        <td><input type="number" step="0.01" min="0" name="lines[${l.line_number-1}][unit_price]" placeholder="0.00" style="width:90px;" required/></td>
        <td><input type="text" name="lines[${l.line_number-1}][lead_time_days]" placeholder="e.g. 7-10 days" style="width:110px;"/></td>
      </tr>`).join('');

      const logRows = log.recordset.map(l => `<tr>
        <td style="color:#7a8a9a;font-size:.78rem;">${new Date(l.created_at).toLocaleString()}</td>
        <td>${statusBadge(l.new_status)}</td>
        <td style="color:#7a8a9a;">${l.note||'—'}</td>
      </tr>`).join('');

      const statuses = ['Submitted','Under Review','Sourcing','Quoted','Closed','Cancelled'];
      const statusOptions = statuses.map(s => `<option value="${s}"${rfq.status===s?' selected':''}>${s}</option>`).join('');

      res.send(page(`${rfq.rfq_number}`,'rfqs',`
        ${successMsg}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div class="page-title">${rfq.rfq_number}</div>
          <a href="/admin/rfqs" class="btn btn-outline btn-sm">← Back to RFQs</a>
        </div>
        <div class="page-sub">Submitted ${new Date(rfq.submitted_at).toLocaleString('en-US', {timeZone:'America/New_York'})} ET</div>
        <div class="detail-grid">
          <div class="detail-item"><div class="detail-label">Customer</div><div class="detail-value"><a href="/admin/customers/${rfq.customer_id}" style="color:#c8932a;">${rfq.customer_name}</a></div></div>
          <div class="detail-item"><div class="detail-label">Company</div><div class="detail-value">${rfq.company||'—'}</div></div>
          <div class="detail-item"><div class="detail-label">Email</div><div class="detail-value"><a href="mailto:${rfq.email}" style="color:#c8932a;">${rfq.email}</a></div></div>
          <div class="detail-item"><div class="detail-label">Phone</div><div class="detail-value">${rfq.phone||'—'}</div></div>
          <div class="detail-item"><div class="detail-label">Priority</div><div class="detail-value">${statusBadge(rfq.priority)}</div></div>
          <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">${statusBadge(rfq.status)}</div></div>
          ${rfq.customer_ref ? `<div class="detail-item"><div class="detail-label">Customer Ref</div><div class="detail-value"><a href="/admin/rfqs?ref=${rfq.customer_ref}" style="color:#c8932a;font-family:monospace;">${rfq.customer_ref}</a></div></div>` : ''}
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
                  <thead><tr><th>#</th><th>NSN / Part</th><th>Description</th><th>Qty</th><th>Unit Cost ($)</th><th>Unit Price ($)</th><th>Lead Time</th></tr></thead>
                  <tbody>${quoteLineInputs}</tbody>
                </table>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
                <div>
                  <div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Payment Terms</div>
                  <input type="text" name="payment_terms" value="Credit Card or Wire Transfer" style="width:100%;"/>
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
        const qty = parseInt(l.quantity) || 1; // qty now editable in form
        const lineTotal = unitPrice * qty;
        const lineCost = unitCost * qty;
        subtotal += lineTotal;
        // Use fulfillment_part if provided (admin may substitute a different part)
        const fulfillPart = (l.fulfillment_part || '').trim();
        const isNSN = /^\d{4}-\d{2}-\d{3}-\d{4}$/.test(fulfillPart);
        const resolvedNsn = isNSN ? fulfillPart : (l.original_nsn || l.nsn || null);
        const resolvedPart = !isNSN && fulfillPart ? fulfillPart : (l.original_part || l.part_number || null);
        return {
          ...l,
          line_number: i + 1,
          nsn: resolvedNsn,
          part_number: resolvedPart,
          item_name: l.item_name || null,
          lead_time_text: l.lead_time_days?.toString().trim() || null,
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
      // Use same sequence number as RFQ for matching (RFQ-2026-00001 -> QT-2026-00001)
      const quoteNumber = rfq.rfq_number.replace(/^RFQ-/, 'QT-');
      const validUntil = new Date(Date.now() + parseInt(valid_days) * 24 * 60 * 60 * 1000);
      const totalCost = processedLines.reduce((s, l) => s + l.line_cost, 0);
      // Check if quote already exists for this RFQ - if so, update it (revision)
      const existingQuote = await pool.request()
        .input('rfqId2', sql.BigInt, rfq.id)
        .query('SELECT id, quote_number FROM quotes WHERE rfq_id=@rfqId2');

      let quote;
      if (existingQuote.recordset.length) {
        // Update existing quote
        const qr = await pool.request()
          .input('rfqId', sql.BigInt, rfq.id)
          .input('subtotal', sql.Decimal(12,2), subtotal)
          .input('totalAmount', sql.Decimal(12,2), subtotal)
          .input('totalCost', sql.Decimal(12,2), totalCost)
          .input('totalMargin', sql.Decimal(12,2), subtotal - totalCost)
          .input('validUntil', sql.Date, validUntil)
          .input('paymentTerms', sql.NVarChar(100), payment_terms || 'Credit Card or Wire Transfer')
          .input('notes', sql.NVarChar(sql.MAX), notes || null)
          .query(`
            UPDATE quotes SET
              subtotal=@subtotal, total_amount=@totalAmount, total_cost=@totalCost,
              total_margin=@totalMargin, valid_until=@validUntil, payment_terms=@paymentTerms,
              notes=@notes, status='Sent', updated_at=GETDATE()
            OUTPUT INSERTED.id, INSERTED.quote_number
            WHERE rfq_id=@rfqId
          `);
        quote = qr.recordset[0];
        // Delete old lines and reinsert
        await pool.request().input('qid', sql.BigInt, quote.id)
          .query('DELETE FROM quote_lines WHERE quote_id=@qid');
        console.log('Quote revised:', quote.quote_number);
      } else {
        // Insert new quote
        const qr = await pool.request()
          .input('rfqId', sql.BigInt, rfq.id)
          .input('customerId', sql.BigInt, rfq.customer_id)
          .input('quoteNumber', sql.NVarChar(20), quoteNumber)
          .input('subtotal', sql.Decimal(12,2), subtotal)
          .input('totalAmount', sql.Decimal(12,2), subtotal)
          .input('totalCost', sql.Decimal(12,2), totalCost)
          .input('totalMargin', sql.Decimal(12,2), subtotal - totalCost)
          .input('validUntil', sql.Date, validUntil)
          .input('paymentTerms', sql.NVarChar(100), payment_terms || 'Credit Card or Wire Transfer')
          .input('notes', sql.NVarChar(sql.MAX), notes || null)
          .query(`
            INSERT INTO quotes (rfq_id, customer_id, quote_number, subtotal, total_amount, total_cost, total_margin, valid_until, payment_terms, notes, status)
            OUTPUT INSERTED.id, INSERTED.quote_number
            VALUES (@rfqId, @customerId, @quoteNumber, @subtotal, @totalAmount, @totalCost, @totalMargin, @validUntil, @paymentTerms, @notes, 'Sent')
          `);
        quote = qr.recordset[0];
      }
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
          .input('leadTime', sql.Int, parseInt((l.lead_time_days||'').toString().replace(/[^0-9]/,'')) || null)
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

  // Accounts — search by company or customer ref
  router.get('/accounts', async (req, res) => {
    if (!requireAuth(req, res)) return;
    const search = (req.query.q || '').trim();
    const type = req.query.type || 'company'; // 'company' or 'ref'
    try {
      const pool = await getPool();
      let rows = '';

      if (search) {
        if (type === 'ref') {
          // Search by customer ref
          const result = await pool.request()
            .input('q', sql.NVarChar, '%' + search + '%')
            .query(`
              SELECT h.customer_ref,
                COUNT(DISTINCT h.id) AS rfq_count,
                COUNT(DISTINCT q.id) AS quote_count,
                COUNT(DISTINCT o.id) AS order_count,
                SUM(DISTINCT ISNULL(q.total_amount,0)) AS total_quoted,
                MAX(h.submitted_at) AS last_activity,
                c.first_name+' '+c.last_name AS customer_name,
                c.company
              FROM rfq_headers h
              JOIN customers c ON c.id=h.customer_id
              LEFT JOIN quotes q ON q.rfq_id=h.id
              LEFT JOIN orders o ON o.quote_id=q.id
              WHERE h.customer_ref LIKE @q
              GROUP BY h.customer_ref, c.first_name, c.last_name, c.company
              ORDER BY last_activity DESC
            `);
          rows = result.recordset.map(r => `<tr>
            <td><a href="/admin/accounts/ref/${encodeURIComponent(r.customer_ref)}" style="color:#c8932a;font-family:monospace;">${r.customer_ref}</a></td>
            <td><span style="color:#7a8a9a;">${r.customer_name}</span></td>
            <td style="color:#7a8a9a;">${r.company||'—'}</td>
            <td style="text-align:center;">${r.rfq_count}</td>
            <td style="text-align:center;">${r.quote_count}</td>
            <td style="text-align:center;">${r.order_count}</td>
            <td style="font-weight:600;">${parseFloat(r.total_quoted||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
            <td style="color:#7a8a9a;font-size:.78rem;">${new Date(r.last_activity).toLocaleDateString()}</td>
          </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;color:#7a8a9a;padding:24px;">No results found</td></tr>';
        } else {
          // Search by company
          const result = await pool.request()
            .input('q', sql.NVarChar, '%' + search + '%')
            .query(`
              SELECT c.company,
                COUNT(DISTINCT c.id) AS contact_count,
                COUNT(DISTINCT h.id) AS rfq_count,
                COUNT(DISTINCT q.id) AS quote_count,
                COUNT(DISTINCT o.id) AS order_count,
                SUM(ISNULL(q.total_amount,0)) AS total_quoted,
                MAX(h.submitted_at) AS last_activity
              FROM customers c
              LEFT JOIN rfq_headers h ON h.customer_id=c.id
              LEFT JOIN quotes q ON q.rfq_id=h.id
              LEFT JOIN orders o ON o.quote_id=q.id
              WHERE c.company LIKE @q
              GROUP BY c.company
              ORDER BY last_activity DESC
            `);
          rows = result.recordset.map(r => `<tr>
            <td><a href="/admin/accounts/company/${encodeURIComponent(r.company)}" style="color:#c8932a;">${r.company||'—'}</a></td>
            <td style="text-align:center;">${r.contact_count}</td>
            <td style="text-align:center;">${r.rfq_count}</td>
            <td style="text-align:center;">${r.quote_count}</td>
            <td style="text-align:center;">${r.order_count}</td>
            <td style="font-weight:600;">${parseFloat(r.total_quoted||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
            <td style="color:#7a8a9a;font-size:.78rem;">${r.last_activity ? new Date(r.last_activity).toLocaleDateString() : '—'}</td>
          </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:#7a8a9a;padding:24px;">No results found</td></tr>';
        }
      }

      const isRef = type === 'ref';
      res.send(page('Accounts','accounts',`
        ${SORT_SCRIPT}
        <div class="page-title">Accounts</div>
        <div class="page-sub">Search activity by company or customer reference</div>
        <div class="card" style="margin-bottom:20px;">
          <div class="card-body">
            <form method="GET" action="/admin/accounts" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
              <div style="flex:1;min-width:250px;">
                <div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Search</div>
                <input type="text" name="q" value="${search}" placeholder="${isRef ? 'Enter customer ref...' : 'Enter company name...'}" style="width:100%;" autofocus/>
              </div>
              <div>
                <div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Search By</div>
                <select name="type" style="width:150px;">
                  <option value="company" ${!isRef?'selected':''}>Company</option>
                  <option value="ref" ${isRef?'selected':''}>Customer Ref</option>
                </select>
              </div>
              <button type="submit" class="btn btn-gold">Search →</button>
              ${search ? '<a href="/admin/accounts" class="btn btn-outline">Clear</a>' : ''}
            </form>
          </div>
        </div>
        ${search ? `
        <div class="card">
          <div class="card-header">${isRef ? 'Customer Refs' : 'Companies'} matching "${search}"</div>
          <div style="overflow-x:auto;">
            <table><thead><tr>
              ${isRef
                ? '<th>Customer Ref</th><th>Customer</th><th>Company</th><th>RFQs</th><th>Quotes</th><th>Orders</th><th>Total Quoted</th><th>Last Activity</th>'
                : '<th>Company</th><th>Contacts</th><th>RFQs</th><th>Quotes</th><th>Orders</th><th>Total Quoted</th><th>Last Activity</th>'
              }
            </tr></thead>
            <tbody>${rows}</tbody></table>
          </div>
        </div>` : `
        <div style="text-align:center;padding:60px;color:#7a8a9a;">
          <div style="font-size:2rem;margin-bottom:12px;">≡ƒæó</div>
          <div style="font-size:1rem;">Search by company name or customer reference to view account activity</div>
        </div>`}
      `));
    } catch(err) {
      res.send(page('Accounts','accounts',`<div class="alert alert-error">${err.message}</div>`));
    }
  });

  // Account detail by customer ref
  router.get('/accounts/ref/:ref', async (req, res) => {
    if (!requireAuth(req, res)) return;
    const ref = decodeURIComponent(req.params.ref);
    try {
      const pool = await getPool();
      const rfqs = await pool.request().input('ref', sql.NVarChar, ref).query(`
        SELECT h.id, h.rfq_number, h.status, h.priority, h.submitted_at,
          c.id AS customer_id, c.first_name+' '+c.last_name AS customer_name, c.company,
          COUNT(l.id) AS line_count,
          q.id AS quote_id, q.quote_number, q.total_amount, q.status AS quote_status
        FROM rfq_headers h
        JOIN customers c ON c.id=h.customer_id
        LEFT JOIN rfq_lines l ON l.rfq_id=h.id
        LEFT JOIN quotes q ON q.rfq_id=h.id
        WHERE h.customer_ref=@ref
        GROUP BY h.id,h.rfq_number,h.status,h.priority,h.submitted_at,
          c.id,c.first_name,c.last_name,c.company,q.id,q.quote_number,q.total_amount,q.status
        ORDER BY h.submitted_at DESC
      `);

      const totalQuoted = rfqs.recordset.reduce((s,r) => s + parseFloat(r.total_amount||0), 0);
      const rfqRows = rfqs.recordset.map(r => `<tr>
        <td class="mono text-gold"><a href="/admin/rfqs/${r.id}" style="color:#c8932a;">${r.rfq_number}</a></td>
        <td><a href="/admin/customers/${r.customer_id}" style="color:#c8932a;">${r.customer_name}</a><br><span style="font-size:.75rem;color:#7a8a9a;">${r.company||''}</span></td>
        <td>${r.line_count}</td>
        <td>${statusBadge(r.priority)}</td>
        <td>${statusBadge(r.status)}</td>
        <td>${r.quote_number ? `<a href="/admin/quotes/${r.quote_id}" style="color:#c8932a;">${r.quote_number}</a>` : '—'}</td>
        <td>${r.total_amount ? ', async (req, res) => {
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
          q.rfq_id, q.customer_id,
          c.first_name+' '+c.last_name AS customer_name, c.company, h.rfq_number
        FROM quotes q
        JOIN customers c ON c.id=q.customer_id
        JOIN rfq_headers h ON h.id=q.rfq_id
        ORDER BY q.created_at DESC
      `);
      const rows = result.recordset.map(q => `<tr>
        <td class="mono text-gold"><a href="/admin/quotes/${q.id}" style="color:#c8932a;">${q.quote_number}</a></td>
        <td class="mono"><a href="/admin/rfqs/${q.rfq_id}" style="color:#c8932a;">${q.rfq_number}</a></td>
        <td><a href="/admin/customers/${q.customer_id}" style="color:#c8932a;">${q.customer_name}</a></td>
        <td style="color:#7a8a9a;font-size:.8rem;">${q.company||'—'}</td>
        <td style="font-weight:600;">${parseFloat(q.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
        <td>${statusBadge(q.status)}</td>
        <td style="color:#7a8a9a;font-size:.78rem;">${q.valid_until?new Date(q.valid_until).toLocaleDateString():'—'}</td>
        <td style="color:#7a8a9a;font-size:.78rem;">${new Date(q.created_at).toLocaleDateString()}</td>
      </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;color:#7a8a9a;padding:24px;">No quotes yet</td></tr>';
      res.send(page('Quotes','quotes',`
        ${SORT_SCRIPT}
        <div class="page-title">Quotes</div>
        <div class="page-sub">All customer quotes</div>
        <div class="card">
          <table><thead><tr>
            <th class="sortable" onclick="sortTable(this,0)">Quote #</th>
            <th class="sortable" onclick="sortTable(this,1)">RFQ #</th>
            <th class="sortable" onclick="sortTable(this,2)">Customer</th>
            <th class="sortable" onclick="sortTable(this,3)">Company</th>
            <th class="sortable" onclick="sortTable(this,4)">Amount</th>
            <th class="sortable" onclick="sortTable(this,5)">Status</th>
            <th class="sortable" onclick="sortTable(this,6)">Valid Until</th>
            <th class="sortable" onclick="sortTable(this,7)">Created</th>
          </tr></thead>
          <tbody>${rows}</tbody></table>
        </div>`));
    } catch(err) {
      res.send(page('Quotes','quotes',`<div class="alert alert-error">${err.message}</div>`));
    }
  });

  // Quote Detail
  router.get('/quotes/:id', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const qr = await pool.request().input('id', sql.BigInt, req.params.id).query(`
        SELECT q.*, h.rfq_number, h.id AS rfq_header_id,
          c.first_name+' '+c.last_name AS customer_name, c.company, c.email, c.phone, c.id AS customer_id
        FROM quotes q
        JOIN rfq_headers h ON h.id=q.rfq_id
        JOIN customers c ON c.id=q.customer_id
        WHERE q.id=@id`);
      if (!qr.recordset.length) return res.send(page('Quote','quotes','<div class="alert alert-error">Quote not found.</div>'));
      const q = qr.recordset[0];
      const lines = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT * FROM quote_lines WHERE quote_id=@id ORDER BY line_number');
      const lineRows = lines.recordset.map(l => `<tr>
        <td style="color:#7a8a9a;">${l.line_number}</td>
        <td class="mono" style="color:#c8932a;">${l.nsn||l.part_number||'—'}</td>
        <td>${l.item_name||'—'}</td>
        <td>${l.quantity}</td>
        <td style="color:#7a8a9a;">${l.condition_code||'—'}</td>
        <td style="color:#7a8a9a;">${parseFloat(l.unit_cost||0).toFixed(2)}</td>
        <td style="font-weight:600;">${parseFloat(l.unit_price||0).toFixed(2)}</td>
        <td style="font-weight:600;">${parseFloat(l.line_total||0).toFixed(2)}</td>
        <td style="color:#7a8a9a;">${l.lead_time_days ? l.lead_time_days+' days' : '—'}</td>
        <td style="color:${parseFloat(l.margin_pct||0)>=20?'#4caf50':'#e05050'};">${parseFloat(l.margin_pct||0).toFixed(1)}%</td>
      </tr>`).join('');
      res.send(page(`Quote ${q.quote_number}`,'quotes',`
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div class="page-title">Quote ${q.quote_number}</div>
          <a href="/admin/quotes" class="btn btn-outline btn-sm">← Back to Quotes</a>
        </div>
        <div class="page-sub">Created ${new Date(q.created_at).toLocaleString()}</div>
        <div class="detail-grid">
          <div class="detail-item"><div class="detail-label">Customer</div><div class="detail-value"><a href="/admin/customers/${q.customer_id}" style="color:#c8932a;">${q.customer_name}</a></div></div>
          <div class="detail-item"><div class="detail-label">Company</div><div class="detail-value">${q.company||'—'}</div></div>
          <div class="detail-item"><div class="detail-label">Email</div><div class="detail-value"><a href="mailto:${q.email}" style="color:#c8932a;">${q.email}</a></div></div>
          <div class="detail-item"><div class="detail-label">RFQ</div><div class="detail-value"><a href="/admin/rfqs/${q.rfq_header_id}" style="color:#c8932a;">${q.rfq_number}</a></div></div>
          <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">${statusBadge(q.status)}</div></div>
          <div class="detail-item"><div class="detail-label">Valid Until</div><div class="detail-value">${q.valid_until?new Date(q.valid_until).toLocaleDateString():'—'}</div></div>
          <div class="detail-item"><div class="detail-label">Payment Terms</div><div class="detail-value">${q.payment_terms||'—'}</div></div>
          <div class="detail-item"><div class="detail-label">Total</div><div class="detail-value" style="font-weight:700;color:#c8932a;font-size:1.1rem;">${parseFloat(q.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2})}</div></div>
        </div>
        <div class="card">
          <div class="card-header">Line Items (${lines.recordset.length})</div>
          <div style="overflow-x:auto;">
            <table><thead><tr>
              <th>#</th><th>NSN / Part</th><th>Description</th><th>Qty</th><th>Condition</th>
              <th>Unit Cost</th><th>Unit Price</th><th>Line Total</th><th>Lead Time</th><th>Margin %</th>
            </tr></thead>
            <tbody>${lineRows||'<tr><td colspan="10" style="text-align:center;color:#7a8a9a;padding:16px;">No lines</td></tr>'}</tbody></table>
          </div>
          <div style="padding:16px;text-align:right;border-top:1px solid #1e2d42;">
            <span style="color:#7a8a9a;margin-right:16px;">Total Cost: <strong style="color:#eef1f5;">${parseFloat(q.total_cost||0).toLocaleString('en-US',{minimumFractionDigits:2})}</strong></span>
            <span style="color:#7a8a9a;margin-right:16px;">Margin: <strong style="color:#4caf50;">${parseFloat(q.total_margin||0).toLocaleString('en-US',{minimumFractionDigits:2})}</strong></span>
            <span style="font-size:1.1rem;font-weight:700;">Total: <strong style="color:#c8932a;">${parseFloat(q.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2})}</strong></span>
          </div>
        </div>
        ${q.notes?`<div class="card"><div class="card-header">Notes</div><div class="card-body" style="color:#7a8a9a;">${q.notes}</div></div>`:''}
      `));
    } catch(err) {
      res.send(page('Quote','quotes',`<div class="alert alert-error">${err.message}</div>`));
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

  // Customer typeahead search API
  router.get('/api/customer-search', async (req, res) => {
    if (!requireAuth(req, res)) return;
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json([]);
    try {
      const pool = await getPool();
      const result = await pool.request()
        .input('q', sql.NVarChar, '%' + q + '%')
        .query(`
          SELECT TOP 10 id,
            first_name + ' ' + last_name AS name,
            email, company
          FROM customers
          WHERE first_name LIKE @q OR last_name LIKE @q
            OR email LIKE @q OR company LIKE @q
            OR (first_name + ' ' + last_name) LIKE @q
          ORDER BY last_name, first_name
        `);
      res.json(result.recordset);
    } catch(err) {
      res.json([]);
    }
  });

  return { admin: { options: { rootPath: '/admin' } }, adminRouter: router };
}
+parseFloat(r.total_amount).toLocaleString('en-US',{minimumFractionDigits:2}) : '—'}</td>
        <td>${r.quote_status ? statusBadge(r.quote_status) : '—'}</td>
        <td style="color:#7a8a9a;font-size:.78rem;">${new Date(r.submitted_at).toLocaleDateString()}</td>
      </tr>`).join('') || '<tr><td colspan="9" style="text-align:center;color:#7a8a9a;padding:24px;">No RFQs found</td></tr>';

      res.send(page(`Ref: ${ref}`,'accounts',`
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div class="page-title">Customer Ref: <span style="color:#c8932a;font-family:monospace;">${ref}</span></div>
          <a href="/admin/accounts?type=ref&q=${encodeURIComponent(ref)}" class="btn btn-outline btn-sm">← Back</a>
        </div>
        <div class="page-sub">All activity linked to this reference</div>
        <div class="stat-grid" style="margin-bottom:20px;">
          <div class="stat"><div class="stat-num">${rfqs.recordset.length}</div><div class="stat-label">RFQs</div></div>
          <div class="stat"><div class="stat-num">${rfqs.recordset.filter(r=>r.quote_id).length}</div><div class="stat-label">Quotes</div></div>
          <div class="stat"><div class="stat-num">${totalQuoted.toLocaleString('en-US',{minimumFractionDigits:2})}</div><div class="stat-label">Total Quoted</div></div>
        </div>
        <div class="card">
          <div class="card-header">RFQs & Quotes</div>
          <div style="overflow-x:auto;">
            <table><thead><tr>
              <th>RFQ #</th><th>Customer</th><th>Lines</th><th>Priority</th><th>RFQ Status</th>
              <th>Quote #</th><th>Amount</th><th>Quote Status</th><th>Date</th>
            </tr></thead>
            <tbody>${rfqRows}</tbody></table>
          </div>
        </div>
      `));
    } catch(err) {
      res.send(page('Account','accounts',`<div class="alert alert-error">${err.message}</div>`));
    }
  });

  // Account detail by company
  router.get('/accounts/company/:company', async (req, res) => {
    if (!requireAuth(req, res)) return;
    const company = decodeURIComponent(req.params.company);
    try {
      const pool = await getPool();

      // Get all contacts at this company
      const contacts = await pool.request().input('company', sql.NVarChar, company).query(`
        SELECT id, first_name+' '+last_name AS name, email, phone, status, created_at
        FROM customers WHERE company=@company ORDER BY last_name
      `);

      // Get all RFQs for this company
      const rfqs = await pool.request().input('company', sql.NVarChar, company).query(`
        SELECT h.id, h.rfq_number, h.status, h.priority, h.customer_ref, h.submitted_at,
          c.id AS customer_id, c.first_name+' '+c.last_name AS customer_name,
          COUNT(l.id) AS line_count,
          q.id AS quote_id, q.quote_number, q.total_amount, q.status AS quote_status
        FROM rfq_headers h
        JOIN customers c ON c.id=h.customer_id
        LEFT JOIN rfq_lines l ON l.rfq_id=h.id
        LEFT JOIN quotes q ON q.rfq_id=h.id
        WHERE c.company=@company
        GROUP BY h.id,h.rfq_number,h.status,h.priority,h.customer_ref,h.submitted_at,
          c.id,c.first_name,c.last_name,q.id,q.quote_number,q.total_amount,q.status
        ORDER BY h.submitted_at DESC
      `);

      const totalQuoted = rfqs.recordset.reduce((s,r) => s + parseFloat(r.total_amount||0), 0);

      const contactRows = contacts.recordset.map(c => `<tr>
        <td><a href="/admin/customers/${c.id}" style="color:#c8932a;">${c.name}</a></td>
        <td style="color:#7a8a9a;font-size:.8rem;">${c.email}</td>
        <td style="color:#7a8a9a;">${c.phone||'—'}</td>
        <td>${statusBadge(c.status)}</td>
        <td style="color:#7a8a9a;font-size:.78rem;">${new Date(c.created_at).toLocaleDateString()}</td>
      </tr>`).join('');

      const rfqRows = rfqs.recordset.map(r => `<tr>
        <td class="mono text-gold"><a href="/admin/rfqs/${r.id}" style="color:#c8932a;">${r.rfq_number}</a></td>
        <td style="color:#7a8a9a;"><a href="/admin/customers/${r.customer_id}" style="color:#c8932a;">${r.customer_name}</a></td>
        <td>${r.customer_ref ? `<a href="/admin/accounts/ref/${encodeURIComponent(r.customer_ref)}" style="color:#c8932a;font-family:monospace;">${r.customer_ref}</a>` : '—'}</td>
        <td>${r.line_count}</td>
        <td>${statusBadge(r.priority)}</td>
        <td>${statusBadge(r.status)}</td>
        <td>${r.quote_number ? `<a href="/admin/quotes/${r.quote_id}" style="color:#c8932a;">${r.quote_number}</a>` : '—'}</td>
        <td>${r.total_amount ? ', async (req, res) => {
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
          q.rfq_id, q.customer_id,
          c.first_name+' '+c.last_name AS customer_name, c.company, h.rfq_number
        FROM quotes q
        JOIN customers c ON c.id=q.customer_id
        JOIN rfq_headers h ON h.id=q.rfq_id
        ORDER BY q.created_at DESC
      `);
      const rows = result.recordset.map(q => `<tr>
        <td class="mono text-gold"><a href="/admin/quotes/${q.id}" style="color:#c8932a;">${q.quote_number}</a></td>
        <td class="mono"><a href="/admin/rfqs/${q.rfq_id}" style="color:#c8932a;">${q.rfq_number}</a></td>
        <td><a href="/admin/customers/${q.customer_id}" style="color:#c8932a;">${q.customer_name}</a></td>
        <td style="color:#7a8a9a;font-size:.8rem;">${q.company||'—'}</td>
        <td style="font-weight:600;">${parseFloat(q.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
        <td>${statusBadge(q.status)}</td>
        <td style="color:#7a8a9a;font-size:.78rem;">${q.valid_until?new Date(q.valid_until).toLocaleDateString():'—'}</td>
        <td style="color:#7a8a9a;font-size:.78rem;">${new Date(q.created_at).toLocaleDateString()}</td>
      </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;color:#7a8a9a;padding:24px;">No quotes yet</td></tr>';
      res.send(page('Quotes','quotes',`
        ${SORT_SCRIPT}
        <div class="page-title">Quotes</div>
        <div class="page-sub">All customer quotes</div>
        <div class="card">
          <table><thead><tr>
            <th class="sortable" onclick="sortTable(this,0)">Quote #</th>
            <th class="sortable" onclick="sortTable(this,1)">RFQ #</th>
            <th class="sortable" onclick="sortTable(this,2)">Customer</th>
            <th class="sortable" onclick="sortTable(this,3)">Company</th>
            <th class="sortable" onclick="sortTable(this,4)">Amount</th>
            <th class="sortable" onclick="sortTable(this,5)">Status</th>
            <th class="sortable" onclick="sortTable(this,6)">Valid Until</th>
            <th class="sortable" onclick="sortTable(this,7)">Created</th>
          </tr></thead>
          <tbody>${rows}</tbody></table>
        </div>`));
    } catch(err) {
      res.send(page('Quotes','quotes',`<div class="alert alert-error">${err.message}</div>`));
    }
  });

  // Quote Detail
  router.get('/quotes/:id', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const qr = await pool.request().input('id', sql.BigInt, req.params.id).query(`
        SELECT q.*, h.rfq_number, h.id AS rfq_header_id,
          c.first_name+' '+c.last_name AS customer_name, c.company, c.email, c.phone, c.id AS customer_id
        FROM quotes q
        JOIN rfq_headers h ON h.id=q.rfq_id
        JOIN customers c ON c.id=q.customer_id
        WHERE q.id=@id`);
      if (!qr.recordset.length) return res.send(page('Quote','quotes','<div class="alert alert-error">Quote not found.</div>'));
      const q = qr.recordset[0];
      const lines = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT * FROM quote_lines WHERE quote_id=@id ORDER BY line_number');
      const lineRows = lines.recordset.map(l => `<tr>
        <td style="color:#7a8a9a;">${l.line_number}</td>
        <td class="mono" style="color:#c8932a;">${l.nsn||l.part_number||'—'}</td>
        <td>${l.item_name||'—'}</td>
        <td>${l.quantity}</td>
        <td style="color:#7a8a9a;">${l.condition_code||'—'}</td>
        <td style="color:#7a8a9a;">${parseFloat(l.unit_cost||0).toFixed(2)}</td>
        <td style="font-weight:600;">${parseFloat(l.unit_price||0).toFixed(2)}</td>
        <td style="font-weight:600;">${parseFloat(l.line_total||0).toFixed(2)}</td>
        <td style="color:#7a8a9a;">${l.lead_time_days ? l.lead_time_days+' days' : '—'}</td>
        <td style="color:${parseFloat(l.margin_pct||0)>=20?'#4caf50':'#e05050'};">${parseFloat(l.margin_pct||0).toFixed(1)}%</td>
      </tr>`).join('');
      res.send(page(`Quote ${q.quote_number}`,'quotes',`
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div class="page-title">Quote ${q.quote_number}</div>
          <a href="/admin/quotes" class="btn btn-outline btn-sm">← Back to Quotes</a>
        </div>
        <div class="page-sub">Created ${new Date(q.created_at).toLocaleString()}</div>
        <div class="detail-grid">
          <div class="detail-item"><div class="detail-label">Customer</div><div class="detail-value"><a href="/admin/customers/${q.customer_id}" style="color:#c8932a;">${q.customer_name}</a></div></div>
          <div class="detail-item"><div class="detail-label">Company</div><div class="detail-value">${q.company||'—'}</div></div>
          <div class="detail-item"><div class="detail-label">Email</div><div class="detail-value"><a href="mailto:${q.email}" style="color:#c8932a;">${q.email}</a></div></div>
          <div class="detail-item"><div class="detail-label">RFQ</div><div class="detail-value"><a href="/admin/rfqs/${q.rfq_header_id}" style="color:#c8932a;">${q.rfq_number}</a></div></div>
          <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">${statusBadge(q.status)}</div></div>
          <div class="detail-item"><div class="detail-label">Valid Until</div><div class="detail-value">${q.valid_until?new Date(q.valid_until).toLocaleDateString():'—'}</div></div>
          <div class="detail-item"><div class="detail-label">Payment Terms</div><div class="detail-value">${q.payment_terms||'—'}</div></div>
          <div class="detail-item"><div class="detail-label">Total</div><div class="detail-value" style="font-weight:700;color:#c8932a;font-size:1.1rem;">${parseFloat(q.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2})}</div></div>
        </div>
        <div class="card">
          <div class="card-header">Line Items (${lines.recordset.length})</div>
          <div style="overflow-x:auto;">
            <table><thead><tr>
              <th>#</th><th>NSN / Part</th><th>Description</th><th>Qty</th><th>Condition</th>
              <th>Unit Cost</th><th>Unit Price</th><th>Line Total</th><th>Lead Time</th><th>Margin %</th>
            </tr></thead>
            <tbody>${lineRows||'<tr><td colspan="10" style="text-align:center;color:#7a8a9a;padding:16px;">No lines</td></tr>'}</tbody></table>
          </div>
          <div style="padding:16px;text-align:right;border-top:1px solid #1e2d42;">
            <span style="color:#7a8a9a;margin-right:16px;">Total Cost: <strong style="color:#eef1f5;">${parseFloat(q.total_cost||0).toLocaleString('en-US',{minimumFractionDigits:2})}</strong></span>
            <span style="color:#7a8a9a;margin-right:16px;">Margin: <strong style="color:#4caf50;">${parseFloat(q.total_margin||0).toLocaleString('en-US',{minimumFractionDigits:2})}</strong></span>
            <span style="font-size:1.1rem;font-weight:700;">Total: <strong style="color:#c8932a;">${parseFloat(q.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2})}</strong></span>
          </div>
        </div>
        ${q.notes?`<div class="card"><div class="card-header">Notes</div><div class="card-body" style="color:#7a8a9a;">${q.notes}</div></div>`:''}
      `));
    } catch(err) {
      res.send(page('Quote','quotes',`<div class="alert alert-error">${err.message}</div>`));
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

  // Customer typeahead search API
  router.get('/api/customer-search', async (req, res) => {
    if (!requireAuth(req, res)) return;
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json([]);
    try {
      const pool = await getPool();
      const result = await pool.request()
        .input('q', sql.NVarChar, '%' + q + '%')
        .query(`
          SELECT TOP 10 id,
            first_name + ' ' + last_name AS name,
            email, company
          FROM customers
          WHERE first_name LIKE @q OR last_name LIKE @q
            OR email LIKE @q OR company LIKE @q
            OR (first_name + ' ' + last_name) LIKE @q
          ORDER BY last_name, first_name
        `);
      res.json(result.recordset);
    } catch(err) {
      res.json([]);
    }
  });

  return { admin: { options: { rootPath: '/admin' } }, adminRouter: router };
}
+parseFloat(r.total_amount).toLocaleString('en-US',{minimumFractionDigits:2}) : '—'}</td>
        <td style="color:#7a8a9a;font-size:.78rem;">${new Date(r.submitted_at).toLocaleDateString()}</td>
      </tr>`).join('') || '<tr><td colspan="9" style="text-align:center;color:#7a8a9a;padding:24px;">No RFQs yet</td></tr>';

      res.send(page(`Company: ${company}`,'accounts',`
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div class="page-title">${company}</div>
          <a href="/admin/accounts?type=company&q=${encodeURIComponent(company)}" class="btn btn-outline btn-sm">← Back</a>
        </div>
        <div class="page-sub">Full account activity</div>
        <div class="stat-grid" style="margin-bottom:20px;">
          <div class="stat"><div class="stat-num">${contacts.recordset.length}</div><div class="stat-label">Contacts</div></div>
          <div class="stat"><div class="stat-num">${rfqs.recordset.length}</div><div class="stat-label">RFQs</div></div>
          <div class="stat"><div class="stat-num">${rfqs.recordset.filter(r=>r.quote_id).length}</div><div class="stat-label">Quotes</div></div>
          <div class="stat"><div class="stat-num">${totalQuoted.toLocaleString('en-US',{minimumFractionDigits:2})}</div><div class="stat-label">Total Quoted</div></div>
        </div>
        <div class="card" style="margin-bottom:20px;">
          <div class="card-header">Contacts</div>
          <table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th><th>Joined</th></tr></thead>
          <tbody>${contactRows}</tbody></table>
        </div>
        <div class="card">
          <div class="card-header">RFQs & Quotes</div>
          <div style="overflow-x:auto;">
            <table><thead><tr>
              <th>RFQ #</th><th>Contact</th><th>Cust Ref</th><th>Lines</th><th>Priority</th>
              <th>RFQ Status</th><th>Quote #</th><th>Amount</th><th>Date</th>
            </tr></thead>
            <tbody>${rfqRows}</tbody></table>
          </div>
        </div>
      `));
    } catch(err) {
      res.send(page('Account','accounts',`<div class="alert alert-error">${err.message}</div>`));
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
          q.rfq_id, q.customer_id,
          c.first_name+' '+c.last_name AS customer_name, c.company, h.rfq_number
        FROM quotes q
        JOIN customers c ON c.id=q.customer_id
        JOIN rfq_headers h ON h.id=q.rfq_id
        ORDER BY q.created_at DESC
      `);
      const rows = result.recordset.map(q => `<tr>
        <td class="mono text-gold"><a href="/admin/quotes/${q.id}" style="color:#c8932a;">${q.quote_number}</a></td>
        <td class="mono"><a href="/admin/rfqs/${q.rfq_id}" style="color:#c8932a;">${q.rfq_number}</a></td>
        <td><a href="/admin/customers/${q.customer_id}" style="color:#c8932a;">${q.customer_name}</a></td>
        <td style="color:#7a8a9a;font-size:.8rem;">${q.company||'—'}</td>
        <td style="font-weight:600;">${parseFloat(q.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
        <td>${statusBadge(q.status)}</td>
        <td style="color:#7a8a9a;font-size:.78rem;">${q.valid_until?new Date(q.valid_until).toLocaleDateString():'—'}</td>
        <td style="color:#7a8a9a;font-size:.78rem;">${new Date(q.created_at).toLocaleDateString()}</td>
      </tr>`).join('') || '<tr><td colspan="8" style="text-align:center;color:#7a8a9a;padding:24px;">No quotes yet</td></tr>';
      res.send(page('Quotes','quotes',`
        ${SORT_SCRIPT}
        <div class="page-title">Quotes</div>
        <div class="page-sub">All customer quotes</div>
        <div class="card">
          <table><thead><tr>
            <th class="sortable" onclick="sortTable(this,0)">Quote #</th>
            <th class="sortable" onclick="sortTable(this,1)">RFQ #</th>
            <th class="sortable" onclick="sortTable(this,2)">Customer</th>
            <th class="sortable" onclick="sortTable(this,3)">Company</th>
            <th class="sortable" onclick="sortTable(this,4)">Amount</th>
            <th class="sortable" onclick="sortTable(this,5)">Status</th>
            <th class="sortable" onclick="sortTable(this,6)">Valid Until</th>
            <th class="sortable" onclick="sortTable(this,7)">Created</th>
          </tr></thead>
          <tbody>${rows}</tbody></table>
        </div>`));
    } catch(err) {
      res.send(page('Quotes','quotes',`<div class="alert alert-error">${err.message}</div>`));
    }
  });

  // Quote Detail
  router.get('/quotes/:id', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const qr = await pool.request().input('id', sql.BigInt, req.params.id).query(`
        SELECT q.*, h.rfq_number, h.id AS rfq_header_id,
          c.first_name+' '+c.last_name AS customer_name, c.company, c.email, c.phone, c.id AS customer_id
        FROM quotes q
        JOIN rfq_headers h ON h.id=q.rfq_id
        JOIN customers c ON c.id=q.customer_id
        WHERE q.id=@id`);
      if (!qr.recordset.length) return res.send(page('Quote','quotes','<div class="alert alert-error">Quote not found.</div>'));
      const q = qr.recordset[0];
      const lines = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT * FROM quote_lines WHERE quote_id=@id ORDER BY line_number');
      const lineRows = lines.recordset.map(l => `<tr>
        <td style="color:#7a8a9a;">${l.line_number}</td>
        <td class="mono" style="color:#c8932a;">${l.nsn||l.part_number||'—'}</td>
        <td>${l.item_name||'—'}</td>
        <td>${l.quantity}</td>
        <td style="color:#7a8a9a;">${l.condition_code||'—'}</td>
        <td style="color:#7a8a9a;">${parseFloat(l.unit_cost||0).toFixed(2)}</td>
        <td style="font-weight:600;">${parseFloat(l.unit_price||0).toFixed(2)}</td>
        <td style="font-weight:600;">${parseFloat(l.line_total||0).toFixed(2)}</td>
        <td style="color:#7a8a9a;">${l.lead_time_days ? l.lead_time_days+' days' : '—'}</td>
        <td style="color:${parseFloat(l.margin_pct||0)>=20?'#4caf50':'#e05050'};">${parseFloat(l.margin_pct||0).toFixed(1)}%</td>
      </tr>`).join('');
      res.send(page(`Quote ${q.quote_number}`,'quotes',`
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div class="page-title">Quote ${q.quote_number}</div>
          <a href="/admin/quotes" class="btn btn-outline btn-sm">← Back to Quotes</a>
        </div>
        <div class="page-sub">Created ${new Date(q.created_at).toLocaleString()}</div>
        <div class="detail-grid">
          <div class="detail-item"><div class="detail-label">Customer</div><div class="detail-value"><a href="/admin/customers/${q.customer_id}" style="color:#c8932a;">${q.customer_name}</a></div></div>
          <div class="detail-item"><div class="detail-label">Company</div><div class="detail-value">${q.company||'—'}</div></div>
          <div class="detail-item"><div class="detail-label">Email</div><div class="detail-value"><a href="mailto:${q.email}" style="color:#c8932a;">${q.email}</a></div></div>
          <div class="detail-item"><div class="detail-label">RFQ</div><div class="detail-value"><a href="/admin/rfqs/${q.rfq_header_id}" style="color:#c8932a;">${q.rfq_number}</a></div></div>
          <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">${statusBadge(q.status)}</div></div>
          <div class="detail-item"><div class="detail-label">Valid Until</div><div class="detail-value">${q.valid_until?new Date(q.valid_until).toLocaleDateString():'—'}</div></div>
          <div class="detail-item"><div class="detail-label">Payment Terms</div><div class="detail-value">${q.payment_terms||'—'}</div></div>
          <div class="detail-item"><div class="detail-label">Total</div><div class="detail-value" style="font-weight:700;color:#c8932a;font-size:1.1rem;">${parseFloat(q.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2})}</div></div>
        </div>
        <div class="card">
          <div class="card-header">Line Items (${lines.recordset.length})</div>
          <div style="overflow-x:auto;">
            <table><thead><tr>
              <th>#</th><th>NSN / Part</th><th>Description</th><th>Qty</th><th>Condition</th>
              <th>Unit Cost</th><th>Unit Price</th><th>Line Total</th><th>Lead Time</th><th>Margin %</th>
            </tr></thead>
            <tbody>${lineRows||'<tr><td colspan="10" style="text-align:center;color:#7a8a9a;padding:16px;">No lines</td></tr>'}</tbody></table>
          </div>
          <div style="padding:16px;text-align:right;border-top:1px solid #1e2d42;">
            <span style="color:#7a8a9a;margin-right:16px;">Total Cost: <strong style="color:#eef1f5;">${parseFloat(q.total_cost||0).toLocaleString('en-US',{minimumFractionDigits:2})}</strong></span>
            <span style="color:#7a8a9a;margin-right:16px;">Margin: <strong style="color:#4caf50;">${parseFloat(q.total_margin||0).toLocaleString('en-US',{minimumFractionDigits:2})}</strong></span>
            <span style="font-size:1.1rem;font-weight:700;">Total: <strong style="color:#c8932a;">${parseFloat(q.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2})}</strong></span>
          </div>
        </div>
        ${q.notes?`<div class="card"><div class="card-header">Notes</div><div class="card-body" style="color:#7a8a9a;">${q.notes}</div></div>`:''}
      `));
    } catch(err) {
      res.send(page('Quote','quotes',`<div class="alert alert-error">${err.message}</div>`));
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

  // Customer typeahead search API
  router.get('/api/customer-search', async (req, res) => {
    if (!requireAuth(req, res)) return;
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json([]);
    try {
      const pool = await getPool();
      const result = await pool.request()
        .input('q', sql.NVarChar, '%' + q + '%')
        .query(`
          SELECT TOP 10 id,
            first_name + ' ' + last_name AS name,
            email, company
          FROM customers
          WHERE first_name LIKE @q OR last_name LIKE @q
            OR email LIKE @q OR company LIKE @q
            OR (first_name + ' ' + last_name) LIKE @q
          ORDER BY last_name, first_name
        `);
      res.json(result.recordset);
    } catch(err) {
      res.json([]);
    }
  });

  return { admin: { options: { rootPath: '/admin' } }, adminRouter: router };
}
