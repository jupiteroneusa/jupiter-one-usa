// COMBO_JS_FIX_V1
// SUPPLIER_COMBO_V1
// SUPPLIER_SEARCH_V1
// SUPPLIER_DROPDOWN_V1
// SUPERSEDED_EDIT_V1
// EDIT_RESEND_V1
// admin/index.js
import { Router } from 'express';
import { mountOrderRoutes } from './orderRoutes.js';
import { mountSupplierRoutes } from './supplierRoutes.js';
import { mountSupplierPoRoutes } from './supplierPoRoutes.js';
import { mountAdminDocRoutes } from './adminDocRoutes.js';
import { mountQuoteBuilder } from './quoteBuilder.js';
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
    <a href="/admin/accounts" class="${active==='accounts'?'active':''}">🏢 Accounts</a>
    <a href="/admin/customers" class="${active==='customers'?'active':''}">👥 Customers</a>
    <a href="/admin/quotes" class="${active==='quotes'?'active':''}">💰 Quotes</a>
    <a href="/admin/orders" class="${active==='orders'?'active':''}">📦 Orders</a>
    <a href="/admin/suppliers" class="${active==='suppliers'?'active':''}">🏭 Suppliers</a>
    <a href="/admin/supplier-pos" class="${active==='supplier-pos'?'active':''}">📝 Supplier POs</a>
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
        </div>
        <script>
          (function(){
            document.querySelectorAll('tr[data-supplier-row]').forEach(function(tr){
              tr.addEventListener('click', function(e){
                if (e.target.tagName === 'A' || e.target.closest('a')) return;
                window.location = tr.getAttribute('data-href');
              });
              tr.addEventListener('mouseenter', function(){ tr.style.background='rgba(200,147,42,0.08)'; });
              tr.addEventListener('mouseleave', function(){ tr.style.background=''; });
            });
            var t = document.getElementById('suppliersTable');
            if (!t) return;
            var dirs = {};
            t.querySelectorAll('th[data-sort]').forEach(function(h){
              h.addEventListener('click', function(){
                var col = parseInt(h.getAttribute('data-sort'));
                var dir = dirs[col] = (dirs[col] === 'asc' ? 'desc' : 'asc');
                var tbody = t.querySelector('tbody');
                var rows = Array.from(tbody.querySelectorAll('tr[data-supplier-row]'));
                rows.sort(function(a,b){
                  var av = (a.children[col].textContent || '').trim().toLowerCase();
                  var bv = (b.children[col].textContent || '').trim().toLowerCase();
                  if (av < bv) return dir==='asc'?-1:1;
                  if (av > bv) return dir==='asc'?1:-1;
                  return 0;
                });
                rows.forEach(function(r){ tbody.appendChild(r); });
              });
            });
          })();
        </script>`));
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
          c.id AS customer_id, c.first_name+' '+c.last_name AS customer_name, c.company, c.email, h.customer_ref,
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
                    <td><input type="text" name="lines[0][part]" placeholder="NSN or Part #" style="width:150px;text-transform:uppercase;" oninput="this.value=this.value.toUpperCase()"  oninput="this.value=this.value.toUpperCase()"/></td>
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
      // Support both nested {lines:{0:{...}}} and flat body
      let linesRaw = req.body.lines || {};
      console.log('RAW body lines type:', typeof req.body.lines, 'keys:', Object.keys(req.body).filter(k=>k.startsWith('lines')).slice(0,3));
      if (Object.keys(linesRaw).length === 0) {
        // Try to reconstruct from flat keys like lines[0][fulfillment_part]
        Object.keys(req.body).forEach(key => {
          const m = key.match(/^lines\[(\d+)\]\[(.+)\]$/);
          if (m) {
            const i2 = m[1], field = m[2];
            if (!linesRaw[i2]) linesRaw[i2] = {};
            linesRaw[i2][field] = req.body[key];
          }
        });
        console.log('After flat parse, linesRaw keys:', Object.keys(linesRaw));
      } else {
        console.log('Nested parse worked, keys:', Object.keys(linesRaw));
      }
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
        // Send account setup email to new customer
        try {
          const crypto = await import('crypto');
          const setupToken = crypto.default.randomBytes(32).toString('hex');
          const setupExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
          const poolSetup = await getPool();
          await poolSetup.request()
            .input('customerId', sql.BigInt, finalCustomerId)
            .input('token', sql.NVarChar, setupToken)
            .input('expiresAt', sql.DateTime, setupExpiry)
            .input('ip', sql.NVarChar(45), '0.0.0.0')
            .query('INSERT INTO password_resets (customer_id, reset_token, expires_at, ip_address) VALUES (@customerId, @token, @expiresAt, @ip)');
          const { sendAccountSetup } = await import('../services/mailer.js');
          await sendAccountSetup({
            customer: { email: new_email.toLowerCase().trim(), first_name: new_first_name.trim(), id: finalCustomerId },
            token: setupToken
          });
          console.log('Account setup email sent to:', new_email);
        } catch(setupErr) { console.error('Account setup email error:', setupErr.message); }
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

      // Check for existing draft quote
      const draftCheck = await pool.request().input('rfqIdDraft', sql.BigInt, req.params.id)
        .query("SELECT id FROM quotes WHERE rfq_id=@rfqIdDraft AND status='Draft'");
      const existingDraft = draftCheck.recordset.length > 0 ? draftCheck.recordset[0] : null;
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

      // Load sent quotes for this RFQ
      const sentQuotes = await pool.request().input('rfqIdSQ', sql.BigInt, rfq.id)
        .query("SELECT id, quote_number, status, total_amount, valid_until, created_at FROM quotes WHERE rfq_id=@rfqIdSQ AND quote_number NOT LIKE '%-D' ORDER BY created_at DESC");
      const sentQuotesHtml = sentQuotes.recordset.length === 0
        ? '<div style="padding:16px;color:#7a8a9a;text-align:center;">No quotes sent yet</div>'
        : '<table><thead><tr><th>Quote #</th><th>Status</th><th>Total</th><th>Valid Until</th><th>Sent</th><th></th></tr></thead><tbody>' +
          sentQuotes.recordset.map(q => `<tr>
            <td class="mono text-gold"><a href="/admin/quotes/${q.id}" style="color:#c8932a;">${q.quote_number}</a> <span style="font-size:.68rem;background:#1e3a5f;color:#c8932a;border:1px solid #c8932a;padding:1px 7px;border-radius:10px;font-weight:700;margin-left:4px;vertical-align:middle;">${(()=>{const m=(q.quote_number||'').match(/-v(\d+)$/);return m?'v'+m[1]:(q.quote_number||'').endsWith('-D')?'DRAFT':''})()}</span></td>
            <td>${statusBadge(q.status)}</td>
            <td style="font-weight:600;">${parseFloat(q.total_amount||0).toFixed(2)}</td>
            <td style="color:#7a8a9a;font-size:.78rem;">${q.valid_until?new Date(q.valid_until).toLocaleDateString():'—'}</td>
            <td style="color:#7a8a9a;font-size:.78rem;">${new Date(q.created_at).toLocaleDateString()}</td>
            <td><a href="/admin/rfqs/${rfq.id}/quote-review" class="btn btn-outline btn-sm" style="font-size:.7rem;">Requote</a></td>
          </tr>`).join('') + '</tbody></table>';
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

        <div class="card"><!-- [Rewire 6] -->
          <div class="card-header">Sourcing &amp; Quoting</div>
          <div class="card-body" style="padding:18px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
            <a href="/admin/rfqs/${rfq.id}/sourcing" class="btn btn-outline" style="padding:10px 18px;">\u{1F50D} Source Suppliers</a>
            <a href="/admin/rfqs/${rfq.id}/quote-review" class="btn btn-gold" style="padding:10px 22px;">Build Quote &rarr;</a>
            ${existingDraft ? `<a href="/admin/rfqs/${rfq.id}/quote-review-draft" class="btn btn-outline" style="border-color:#4caf50;color:#4caf50;padding:10px 18px;">Resume Draft</a>` : ''}
            <div style="flex:1;min-width:200px;font-size:.75rem;color:#7a8a9a;text-align:right;">Record supplier responses on the Sourcing page first, then build the quote with internal cost/source data.</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Update Status</div>
          <div class="card-body">
            <form method="POST" action="/admin/rfqs/${rfq.id}/status" style="display:inline;margin-bottom:12px;" onsubmit="return confirm('Close this RFQ? It will be marked Closed.');">
              <input type="hidden" name="status" value="Closed"/>
              <input type="hidden" name="note" value="RFQ closed manually."/>
              <button type="submit" class="btn btn-sm" style="background:#c0392b;color:#fff;border:none;margin-bottom:12px;">✕ Close RFQ</button>
            </form>
            <hr style="border-color:#2a3a4a;margin-bottom:12px;"/>
            <form method="POST" action="/admin/rfqs/${rfq.id}/status" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;">
              <div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">New Status</div><select name="status">${statusOptions}</select></div>
              <div style="flex:1;min-width:200px;"><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Note (optional)</div><input type="text" name="note" placeholder="Add a note..." style="width:100%;"/></div>
              <button type="submit" class="btn btn-gold">Update Status</button>
            </form>
          </div>
        </div>
        <div class="card">
          <div class="card-header">Quote History</div>
          ${sentQuotesHtml}
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
  router.get('/rfqs/:id/quote-review-draft', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const h = await pool.request().input('id', sql.BigInt, req.params.id)
        .query(`SELECT h.*, c.id AS customer_id, c.first_name+' '+c.last_name AS customer_name, c.company, c.email FROM rfq_headers h JOIN customers c ON c.id=h.customer_id WHERE h.id=@id`);
      if (!h.recordset.length) return res.redirect('/admin/rfqs');
      const rfq = h.recordset[0];
      // Load draft quote
      const draftQ = await pool.request().input('rfqId', sql.BigInt, req.params.id)
        .query("SELECT * FROM quotes WHERE rfq_id=@rfqId AND quote_number LIKE '%-D' ORDER BY created_at DESC");
      if (!draftQ.recordset.length) return res.redirect('/admin/rfqs/' + req.params.id + '/quote-review');
      const draft = draftQ.recordset[0];
      // Load draft lines
      const draftLines = await pool.request().input('qid', sql.BigInt, draft.id)
        .query('SELECT ql.*, rl.rfq_line_id FROM quote_lines ql LEFT JOIN quote_lines rl ON rl.id=ql.rfq_line_id WHERE ql.quote_id=@qid ORDER BY ql.line_number');
      const dbLines = await pool.request().input('id2', sql.BigInt, req.params.id)
        .query('SELECT * FROM rfq_lines WHERE rfq_id=@id2 ORDER BY line_number');
      const lineInputs = draftLines.recordset.map(function(l, i) {
        const n = l.line_number - 1;
        const part = (l.nsn || l.part_number || '').toUpperCase();
        const origLine = dbLines.recordset[i] || {};
        return '<tr id="qrow-'+l.line_number+'">' +
          '<td style="color:#7a8a9a;">'+l.line_number+'</td>' +
          '<td><div style="font-size:.65rem;color:#7a8a9a;margin-bottom:3px;">Req: '+(origLine.nsn||origLine.part_number||'—')+'</div>' +
          '<input type="text" name="lines['+n+'][fulfillment_part]" value="'+part+'" style="width:130px;font-family:monospace;color:#c8932a;text-transform:uppercase;" oninput="this.value=this.value.toUpperCase()"/>' +
          '<input type="hidden" name="lines['+n+'][rfq_line_id]" value="'+(origLine.id||'')+'"/>' +
          '<input type="hidden" name="lines['+n+'][original_nsn]" value="'+(origLine.nsn||'')+'"/>' +
          '<input type="hidden" name="lines['+n+'][original_part]" value="'+(origLine.part_number||'')+'"/>' +
          '<input type="hidden" name="lines['+n+'][condition_code]" value="'+(l.condition_code||'NE')+'"/></td>' +
          '<td><input type="text" name="lines['+n+'][item_name]" value="'+(l.item_name||'')+'" style="width:150px;"/></td>' +
          '<td><input type="number" min="1" name="lines['+n+'][quantity]" value="'+l.quantity+'" style="width:60px;" required/></td>' +
          '<td><input type="number" step="0.01" min="0" name="lines['+n+'][unit_cost]" value="'+l.unit_cost+'" style="width:80px;" required/></td>' +
          '<td><input type="number" step="0.01" min="0" name="lines['+n+'][unit_price]" value="'+l.unit_price+'" style="width:80px;" required/></td>' +
          '<td><input type="text" name="lines['+n+'][lead_time_days]" value="'+(l.lead_time_text||l.lead_time_days||'')+'" style="width:100px;"/></td>' +
          '<td><button type="button" onclick="removeQRow('+l.line_number+')" class="btn btn-outline btn-sm" style="color:#e05050;">X</button></td></tr>';
      }).join('');
      const nextLine = draftLines.recordset.length + 1;
      const addRowScript = 'let qc='+nextLine+';function addQRow(){const i=qc-1;const n=qc;qc++;const r=document.createElement(\'tr\');r.id=\'qrow-\'+n;r.innerHTML=\'<td>\'+n+\'</td><td><input type=\\\'text\\\' name=\\\'lines[\'+i+\'][fulfillment_part]\\\' style=\\\'width:130px;font-family:monospace;color:#c8932a;text-transform:uppercase;\\\' oninput=\\\'this.value=this.value.toUpperCase()\\\'/><input type=\\\'hidden\\\' name=\\\'lines[\'+i+\'][rfq_line_id]\\\' value=\\\'\\\'/><input type=\\\'hidden\\\' name=\\\'lines[\'+i+\'][original_nsn]\\\' value=\\\'\\\'/><input type=\\\'hidden\\\' name=\\\'lines[\'+i+\'][original_part]\\\' value=\\\'\\\'/><input type=\\\'hidden\\\' name=\\\'lines[\'+i+\'][condition_code]\\\' value=\\\'NE\\\'/></td><td><input type=\\\'text\\\' name=\\\'lines[\'+i+\'][item_name]\\\' style=\\\'width:150px;\\\'/></td><td><input type=\\\'number\\\' min=\\\'1\\\' name=\\\'lines[\'+i+\'][quantity]\\\' value=\\\'1\\\' style=\\\'width:60px;\\\' required/></td><td><input type=\\\'number\\\' step=\\\'0.01\\\' name=\\\'lines[\'+i+\'][unit_cost]\\\' placeholder=\\\'0.00\\\' style=\\\'width:80px;\\\' required/></td><td><input type=\\\'number\\\' step=\\\'0.01\\\' name=\\\'lines[\'+i+\'][unit_price]\\\' placeholder=\\\'0.00\\\' style=\\\'width:80px;\\\' required/></td><td><input type=\\\'text\\\' name=\\\'lines[\'+i+\'][lead_time_days]\\\' style=\\\'width:100px;\\\'/></td><td><button type=\\\'button\\\' onclick=\\\'removeQRow(\'+n+\')\\\'  class=\\\'btn btn-outline btn-sm\\\' style=\\\'color:#e05050;\\\'>X</button></td>\';document.getElementById(\'qlines-tbody\').appendChild(r);}function removeQRow(n){const r=document.getElementById(\'qrow-\'+n);if(r&&document.getElementById(\'qlines-tbody\').children.length>1)r.remove();}';
      const draftScript = 'let isDirty=false;document.querySelectorAll("input,textarea").forEach(function(el){el.addEventListener("input",function(){isDirty=true;});});window.addEventListener("beforeunload",function(e){if(isDirty){e.preventDefault();e.returnValue="";}});function saveDraft(){isDirty=false;const form=document.querySelector("form");const fd=new URLSearchParams(new FormData(form));fetch("/admin/rfqs/'+rfq.id+'/quote-draft",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:fd.toString()}).then(function(r){return r.json();}).then(function(d){const btn=document.getElementById("save-draft-btn");if(btn){btn.textContent=d.ok?"Draft Saved \u2713":"Save Failed";btn.style.color=d.ok?"#4caf50":"#e05050";}setTimeout(function(){if(btn&&d.ok){btn.textContent="Save Draft";btn.style.color="";}},3000);}).catch(function(){isDirty=true;});}';
      let html = SORT_SCRIPT;
      html += '<div class="alert" style="background:rgba(76,175,80,0.1);border-color:#4caf50;color:#4caf50;margin-bottom:16px;">Resuming saved draft — '+draft.quote_number+'</div>';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
      html += '<div class="page-title">Quote Review — '+rfq.rfq_number+'</div>';
      html += '<a href="/admin/rfqs/'+rfq.id+'" class="btn btn-outline btn-sm">&larr; Back to RFQ</a></div>';
      html += '<div class="page-sub">Resuming draft — review and edit before sending</div>';
      html += '<div class="detail-grid" style="margin-bottom:20px;">';
      html += '<div class="detail-item"><div class="detail-label">Customer</div><div class="detail-value"><a href="/admin/customers/'+rfq.customer_id+'" style="color:#c8932a;">'+rfq.customer_name+'</a></div></div>';
      html += '<div class="detail-item"><div class="detail-label">Company</div><div class="detail-value">'+(rfq.company||'—')+'</div></div>';
      html += '<div class="detail-item"><div class="detail-label">Email</div><div class="detail-value"><a href="mailto:'+rfq.email+'" style="color:#c8932a;">'+rfq.email+'</a></div></div>';
      html += '<div class="detail-item"><div class="detail-label">RFQ #</div><div class="detail-value">'+rfq.rfq_number+'</div></div>';
      html += rfq.customer_ref ? '<div class="detail-item"><div class="detail-label">Customer Ref</div><div class="detail-value" style="color:#c8932a;font-family:monospace;">'+rfq.customer_ref+'</div></div>' : '';
      html += '</div>';
      html += '<form id="quote-send-form" method="POST" action="/admin/rfqs/'+rfq.id+'/quote">';
      html += '<div class="card" style="margin-bottom:20px;"><div class="card-header">Line Items <button type="button" class="btn btn-outline btn-sm" onclick="addQRow()">+ Add Line</button></div>';
      html += '<div style="overflow-x:auto;"><table style="width:100%;"><thead><tr><th>#</th><th>NSN/Part</th><th>Description</th><th>Qty</th><th>Unit Cost($)</th><th>Unit Price($)</th><th>Lead Time</th><th></th></tr></thead>';
      html += '<tbody id="qlines-tbody">'+lineInputs+'</tbody></table></div></div>';
      html += '<div class="card" style="margin-bottom:20px;"><div class="card-header">Quote Details</div><div class="card-body">';
      html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">';
      html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Payment Terms</div><input type="text" name="payment_terms" value="'+(draft.payment_terms||'Credit Card or Wire Transfer')+'" style="width:100%;"/></div>';
      html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Valid Days</div><input type="number" name="valid_days" value="30" style="width:100%;"/></div></div>';
      html += '<div style="margin-bottom:12px;"><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Terms / Notes</div><textarea name="notes" rows="3" style="width:100%;">'+(draft.notes||'')+'</textarea></div>';
      html += '<div><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Personal Message <span style="color:#555;">(optional)</span></div>';
      html += '<textarea name="personal_message" rows="3" style="width:100%;border-color:#c8932a;" placeholder="Hi, great speaking with you...">'+(draft.personal_message||'')+'</textarea></div>';
            html += '<div style="margin-top:12px;"><div style="font-size:.7rem;color:#7a8a9a;margin-bottom:4px;">Additional Recipients <span style="color:#555;">(optional)</span></div><input type="text" name="cc_emails" placeholder="e.g. john@co.com, jane@co.com" style="width:100%;"/></div>';
      html += '<div style="margin-top:12px;display:flex;align-items:center;gap:8px;"><input type="checkbox" name="attach_pdf" id="attach_pdf" value="1" style="width:auto;accent-color:#c8932a;"/><label for="attach_pdf" style="font-size:.85rem;cursor:pointer;">Attach quote as PDF</label></div>';
      html += '</div></div>';
      html += '<div style="display:flex;gap:10px;">';
      html += '<button type="submit" class="btn btn-gold" style="padding:12px 28px;">Send Quote to Customer &rarr;</button>';
      html += '<button type="button" class="btn btn-outline" style="padding:12px 20px;border-color:#4caf50;color:#4caf50;" id="save-draft-btn" onclick="saveDraft()">Save Draft</button>';
      html += '<a href="/admin/rfqs/'+rfq.id+'" class="btn btn-outline" style="padding:12px 20px;">Back to RFQ</a></div></form>';
      html += '<script>' + draftScript + addRowScript + '</script>';
      res.send(page('Resume Draft — '+rfq.rfq_number, 'rfqs', html));
    } catch(err) {
      res.send(page('Resume Draft','rfqs','<div class="alert alert-error">'+err.message+'</div>'));
    }
  });

    router.post('/rfqs/:id/quote-draft', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const rfqResult = await pool.request().input('id', sql.BigInt, req.params.id)
        .query(`SELECT h.*, c.first_name, c.last_name, c.email, c.company FROM rfq_headers h JOIN customers c ON c.id=h.customer_id WHERE h.id=@id`);
      if (!rfqResult.recordset.length) return res.json({ ok: false, error: 'RFQ not found' });
      const rfq = rfqResult.recordset[0];
      const { payment_terms, valid_days, notes, personal_message } = req.body;
      const linesRaw = req.body.lines || {};
      const linesArr = Object.values(linesRaw);
      let subtotal = 0;
      const processedLines = linesArr.map(function(l, i) {
        const unitPrice = parseFloat(l.unit_price) || 0;
        const unitCost = parseFloat(l.unit_cost) || 0;
        const qty = parseInt(l.quantity) || 1;
        const lineTotal = unitPrice * qty;
        const lineCost = unitCost * qty;
        subtotal += lineTotal;
        const fulfillPart = (l.fulfillment_part || '').trim().toUpperCase();
        const isNSN = /^\d{4}-\d{2}-\d{3}-\d{4}$/.test(fulfillPart);
        return {
          ...l,
          line_number: i + 1,
          nsn: isNSN ? fulfillPart : (l.original_nsn || null),
          part_number: !isNSN && fulfillPart ? fulfillPart : (l.original_part || null),
          item_name: l.item_name || null,
          unit_price: unitPrice,
          unit_cost: unitCost,
          quantity: qty,
          line_total: lineTotal,
          line_cost: lineCost,
          line_margin: lineTotal - lineCost,
          markup_pct: unitCost > 0 ? Math.min(999.99, Math.max(-999.99, parseFloat((((unitPrice - unitCost) / unitCost) * 100).toFixed(2)))) : 0,
          margin_pct: lineTotal > 0 ? Math.min(999.99, Math.max(-999.99, parseFloat((((lineTotal - lineCost) / lineTotal) * 100).toFixed(2)))) : 0,
        };
      });
      const totalCost = processedLines.reduce(function(s, l) { return s + l.line_cost; }, 0);
      const validUntil = new Date(Date.now() + parseInt(valid_days || 30) * 24 * 60 * 60 * 1000);
      const quoteNumber = rfq.rfq_number.replace(/^RFQ-/, 'QT-') + '-D';
      // Check if draft exists for this RFQ
      const existing = await pool.request().input('rfqId', sql.BigInt, rfq.id)
        .query("SELECT id FROM quotes WHERE rfq_id=@rfqId AND quote_number LIKE '%-D'");
      if (existing.recordset.length) {
        // Update existing draft
        await pool.request()
          .input('rfqId', sql.BigInt, rfq.id)
          .input('subtotal', sql.Decimal(12,2), subtotal)
          .input('totalAmount', sql.Decimal(12,2), subtotal)
          .input('totalCost', sql.Decimal(12,2), totalCost)
          .input('totalMargin', sql.Decimal(12,2), subtotal - totalCost)
          .input('validUntil', sql.Date, validUntil)
          .input('paymentTerms', sql.NVarChar(100), payment_terms || 'Credit Card or Wire Transfer')
          .input('notes', sql.NVarChar(sql.MAX), notes || null)
          .input('personalMessage', sql.NVarChar(sql.MAX), personal_message || null)
          .query(`UPDATE quotes SET subtotal=@subtotal,total_amount=@totalAmount,total_cost=@totalCost,total_margin=@totalMargin,valid_until=@validUntil,payment_terms=@paymentTerms,notes=@notes,personal_message=@personalMessage,updated_at=GETDATE() WHERE rfq_id=@rfqId AND quote_number LIKE '%-D'`);
        // Delete old draft lines and reinsert
        await pool.request().input('qid', sql.BigInt, existing.recordset[0].id)
          .query('DELETE FROM quote_lines WHERE quote_id=@qid');
        for (const l of processedLines) {
          await pool.request()
            .input('quoteId', sql.BigInt, existing.recordset[0].id)
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
            .input('rfqLineId', sql.BigInt, parseInt(l.rfq_line_id) || null)
            .input('leadTime', sql.Int, parseInt((l.lead_time_days||'').toString().replace(/[^0-9]/,'')) || null)
            .input('leadTimeText', sql.NVarChar(100), (l.lead_time_days||l.lead_time_text||'')+'' || null)
            .query(`INSERT INTO quote_lines (quote_id,rfq_line_id,line_number,nsn,part_number,item_name,condition_code,quantity,unit_cost,unit_price,line_total,line_cost,line_margin,markup_pct,margin_pct,lead_time_days,lead_time_text) VALUES (@quoteId,@rfqLineId,@lineNum,@nsn,@partNum,@itemName,@condition,@qty,@unitCost,@unitPrice,@lineTotal,@lineCost,@lineMargin,@markupPct,@marginPct,@leadTime,@leadTimeText)`);
        }
        return res.json({ ok: true, message: 'Draft updated' });
      } else {
        // Create new draft
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
          .input('personalMessage', sql.NVarChar(sql.MAX), personal_message || null)
          .query(`INSERT INTO quotes (rfq_id,customer_id,quote_number,subtotal,total_amount,total_cost,total_margin,valid_until,payment_terms,notes,personal_message,status) OUTPUT INSERTED.id VALUES (@rfqId,@customerId,@quoteNumber,@subtotal,@totalAmount,@totalCost,@totalMargin,@validUntil,@paymentTerms,@notes,@personalMessage,'Draft')`);
        const quoteId = qr.recordset[0].id;
        for (const l of processedLines) {
          await pool.request()
            .input('quoteId', sql.BigInt, quoteId)
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
            .input('rfqLineId', sql.BigInt, parseInt(l.rfq_line_id) || null)
            .input('leadTime', sql.Int, parseInt((l.lead_time_days||'').toString().replace(/[^0-9]/,'')) || null)
            .input('leadTimeText', sql.NVarChar(100), (l.lead_time_days||l.lead_time_text||'')+'' || null)
            .query(`INSERT INTO quote_lines (quote_id,rfq_line_id,line_number,nsn,part_number,item_name,condition_code,quantity,unit_cost,unit_price,line_total,line_cost,line_margin,markup_pct,margin_pct,lead_time_days,lead_time_text) VALUES (@quoteId,@rfqLineId,@lineNum,@nsn,@partNum,@itemName,@condition,@qty,@unitCost,@unitPrice,@lineTotal,@lineCost,@lineMargin,@markupPct,@marginPct,@leadTime,@leadTimeText)`);
        }
        return res.json({ ok: true, message: 'Draft saved' });
      }
    } catch(err) {
      console.error('Draft save error:', err);
      res.json({ ok: false, error: err.message });
    }
  });

    // Quote Review — GET (load blank form for new quote or requote)
  /* MOVED to admin/quoteBuilder.js: router.get('/rfqs/:id/quote-review', */

  /* MOVED to admin/quoteBuilder.js: router.post('/rfqs/:id/quote-review', */

  // Generate quote PDF
  router.get('/rfqs/:id/quote-pdf/:quoteId', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const qr = await pool.request()
        .input('id', sql.BigInt, req.params.quoteId)
        .query(`SELECT q.*, h.rfq_number, c.first_name+' '+c.last_name AS customer_name, c.company, c.email FROM quotes q JOIN rfq_headers h ON h.id=q.rfq_id JOIN customers c ON c.id=q.customer_id WHERE q.id=@id`);
      if (!qr.recordset.length) return res.status(404).send('Quote not found');
      const q = qr.recordset[0];
      const lines = await pool.request().input('qid', sql.BigInt, req.params.quoteId)
        .query('SELECT * FROM quote_lines WHERE quote_id=@qid ORDER BY line_number');
      const lineRows = lines.recordset.map(l => `<tr>
        <td style="padding:8px;border:1px solid #ddd;font-family:monospace;">${l.nsn||l.part_number||'—'}</td>
        <td style="padding:8px;border:1px solid #ddd;">${l.item_name||'—'}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:center;">${l.quantity}</td>
        <td style="padding:8px;border:1px solid #ddd;">${l.condition_code||'NE'}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right;">$${parseFloat(l.unit_price||0).toFixed(2)}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right;font-weight:bold;">$${parseFloat(l.line_total||0).toFixed(2)}</td>
        <td style="padding:8px;border:1px solid #ddd;">${l.lead_time_text||l.lead_time_days||'—'}</td>
      </tr>`).join('');
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
        body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#222;}
        .header{background:#0a1628;color:#c8932a;padding:20px;margin-bottom:20px;}
        .header h1{margin:0;font-size:22px;letter-spacing:.06em;}
        .header p{margin:4px 0 0;color:#aaa;font-size:12px;}
        .two-col{display:flex;gap:20px;margin-bottom:20px;}
        .col{flex:1;border:1px solid #ddd;padding:14px;}
        .label{font-size:10px;text-transform:uppercase;color:#888;margin-bottom:6px;}
        table{width:100%;border-collapse:collapse;margin:20px 0;}
        th{background:#0a1628;color:#fff;padding:10px 8px;text-align:left;font-size:12px;}
        .total-row td{font-weight:bold;background:#f5f5f5;}
        .terms{font-size:10px;color:#777;border-top:1px solid #ddd;padding-top:12px;margin-top:20px;}
      </style></head><body>
        <div class="header"><h1>JUPITER ONE USA LLC</h1><p>Aerospace &amp; Defense Component Supplier</p></div>
        <div class="two-col">
          <div class="col">
            <div class="label">Bill To</div>
            <strong>${q.customer_name}</strong><br/>
            ${q.company||''}<br/>
            ${q.email}
          </div>
          <div class="col">
            <div class="label">Quote Details</div>
            <table style="margin:0;border:none;"><tbody>
              <tr><td style="padding:2px 8px 2px 0;border:none;color:#888;font-size:12px;">Quote #</td><td style="padding:2px;border:none;font-weight:bold;">${q.quote_number}</td></tr>
              <tr><td style="padding:2px 8px 2px 0;border:none;color:#888;font-size:12px;">RFQ #</td><td style="padding:2px;border:none;">${q.rfq_number}</td></tr>
              <tr><td style="padding:2px 8px 2px 0;border:none;color:#888;font-size:12px;">Status</td><td style="padding:2px;border:none;">QUOTED</td></tr>
              <tr><td style="padding:2px 8px 2px 0;border:none;color:#888;font-size:12px;">Issued</td><td style="padding:2px;border:none;">${new Date().toLocaleDateString()}</td></tr>
              <tr><td style="padding:2px 8px 2px 0;border:none;color:#888;font-size:12px;">Valid Until</td><td style="padding:2px;border:none;font-weight:bold;">${new Date(q.valid_until).toLocaleDateString()}</td></tr>
              <tr><td style="padding:2px 8px 2px 0;border:none;color:#888;font-size:12px;">Sales Rep</td><td style="padding:2px;border:none;">Derek Torchia</td></tr>
            </tbody></table>
          </div>
        </div>
        <table>
          <thead><tr>
            <th>NSN / Part#</th><th>Description</th><th>Qty</th><th>Condition</th><th>Unit Price</th><th>Total</th><th>Lead Time</th>
          </tr></thead>
          <tbody>${lineRows}</tbody>
          <tfoot><tr class="total-row">
            <td colspan="5" style="padding:10px 8px;text-align:right;border:1px solid #ddd;">Quote Total:</td>
            <td style="padding:10px 8px;text-align:right;border:1px solid #ddd;color:#c8932a;">$${parseFloat(q.total_amount||0).toFixed(2)}</td>
            <td style="border:1px solid #ddd;"></td>
          </tr></tfoot>
        </table>
        ${q.notes ? `<div style="background:#fff8e7;border-left:3px solid #c8932a;padding:12px;font-size:12px;color:#555;">${q.notes}</div>` : ''}
        <div class="terms">
          <strong>Terms &amp; Conditions:</strong> Payment: Credit Card or Wire Transfer (3.5% CC fee). 
          All orders non-cancellable once confirmed. Delivery times estimated, not guaranteed. 
          Claims within 7 days of receipt. Quote valid 30 days. Prices subject to availability.
        </div>
        <div style="margin-top:20px;font-size:11px;color:#888;">
          Jupiter One USA LLC | 400 N Tampa St, Suite 1550, Tampa FL | +1 (347) 821-7412 | DTorchia@jupiteroneusa.com
        </div>
      </body></html>`;
      const puppeteer = await import('puppeteer');
      const browser = await puppeteer.default.launch({ 
        executablePath: '/home/puppeteer-cache/chrome/linux-147.0.7727.57/chrome-linux64/chrome',
        args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'] 
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', margin: { top:'10mm', bottom:'10mm', left:'10mm', right:'10mm' } });
      await browser.close();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Quote-${q.quote_number}.pdf"`);
      res.send(pdf);
    } catch(err) {
      console.error('PDF error:', err.message);
      res.status(500).send('PDF generation failed: ' + err.message);
    }
  });

    /* MOVED to admin/quoteBuilder.js: router.post('/rfqs/:id/quote', */

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
          c.status, c.created_at, c.last_login_at, COUNT(h.id) AS rfq_count
        FROM customers c
        LEFT JOIN rfq_headers h ON h.customer_id=c.id
        GROUP BY c.id,c.first_name,c.last_name,c.company,c.email,c.phone,c.status,c.created_at,c.last_login_at
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
        <td>${c.last_login_at ? '<span style="color:#4caf50;font-size:.75rem;">&#10004; Active</span>' : '<span style="background:#e05050;color:#fff;font-size:.65rem;padding:2px 7px;letter-spacing:.05em;">NO LOGIN</span>'}</td>
        <td>${!c.last_login_at ? '<form method="POST" action="/admin/customers/'+c.id+'/send-setup" style="display:inline;"><button type="submit" class="btn btn-sm btn-outline" style="border-color:#c8932a;color:#c8932a;font-size:.65rem;padding:3px 8px;">&#9993; Setup</button></form>' : ''}</td>
      </tr>`).join('') || '<tr><td colspan="9" style="text-align:center;color:#7a8a9a;padding:24px;">No customers yet</td></tr>';
      res.send(page('Customers','customers',`
        <div class="page-title">Customers</div>
        <div class="page-sub">All registered customers</div>
        <div class="card">
          <table><thead><tr><th>Name</th><th>Company</th><th>Email</th><th>Phone</th><th>RFQs</th><th>Status</th><th>Joined</th><th>Login</th><th></th></tr></thead>
          <tbody>${rows}</tbody></table>
        </div>`));
    } catch(err) {
      res.send(page('Customers','customers',`<div class="alert alert-error">${err.message}</div>`));
    }
  });

  router.get('/customers/:id', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const cr = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT * FROM customers WHERE id=@id');
      if (!cr.recordset.length) return res.send(page('Customer','customers','<div class="alert alert-error">Not found.</div>'));
      const cust = cr.recordset[0];

      // RFQ history
      const rfqs = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT h.id, h.rfq_number, h.status, h.priority, h.submitted_at, COUNT(l.id) AS line_count FROM rfq_headers h LEFT JOIN rfq_lines l ON l.rfq_id=h.id WHERE h.customer_id=@id GROUP BY h.id,h.rfq_number,h.status,h.priority,h.submitted_at ORDER BY h.submitted_at DESC');

      // Quote history
      const quotes = await pool.request().input('id', sql.BigInt, req.params.id)
        .query("SELECT q.id, q.quote_number, q.status, q.total_amount, q.valid_until, q.created_at, q.rejected_at, q.rejection_reason, q.expired_at, q.parent_quote_id, q.reissued_count, h.rfq_number FROM quotes q JOIN rfq_headers h ON h.id=q.rfq_id WHERE q.customer_id=@id AND q.quote_number NOT LIKE '%-D' ORDER BY q.created_at DESC");

      const activeTab = req.query.tab || 'overview';
      const successMsg = req.query.saved ? '<div class="alert alert-success" style="margin-bottom:16px;">✔ Customer updated successfully.</div>' :
        req.query.setup_sent ? '<div class="alert alert-success" style="margin-bottom:16px;">✔ Setup email sent.</div>' :
        req.query.reset_sent ? '<div class="alert alert-success" style="margin-bottom:16px;">✔ Password reset email sent.</div>' :
        req.query.error ? '<div class="alert alert-error" style="margin-bottom:16px;">'+req.query.error+'</div>' : '';

      const rfqRows = rfqs.recordset.map(r => `<tr>
        <td class="mono text-gold"><a href="/admin/rfqs/${r.id}" style="color:#c8932a;">${r.rfq_number}</a></td>
        <td>${r.line_count}</td>
        <td>${statusBadge(r.priority)}</td>
        <td>${statusBadge(r.status)}</td>
        <td style="color:#7a8a9a;font-size:.78rem;">${new Date(r.submitted_at).toLocaleDateString()}</td>
        <td><a href="/admin/rfqs/${r.id}" class="btn btn-outline btn-sm">View</a></td>
      </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#7a8a9a;padding:16px;">No RFQs yet</td></tr>';

      const quoteRows = quotes.recordset.map(q => `<tr>
        <td class="mono text-gold"><a href="/admin/quotes/${q.id}" style="color:#c8932a;">${q.quote_number}</a></td>
        <td class="mono" style="font-size:.78rem;">${q.rfq_number}</td>
        <td>${statusBadge(q.status)}</td>
        <td style="font-weight:600;">${parseFloat(q.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
        <td style="color:#7a8a9a;font-size:.78rem;">${q.valid_until?new Date(q.valid_until).toLocaleDateString():'—'}</td>
        <td style="color:#7a8a9a;font-size:.78rem;">${new Date(q.created_at).toLocaleDateString()}</td>
      </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#7a8a9a;padding:16px;">No quotes yet</td></tr>';

      function tabLink(tab, label) {
        const isActive = activeTab === tab;
        return `<a href="/admin/customers/${cust.id}?tab=${tab}" style="display:inline-block;padding:8px 18px;font-size:.82rem;font-weight:600;letter-spacing:.04em;border-bottom:2px solid ${isActive?'#c8932a':'transparent'};color:${isActive?'#c8932a':'#7a8a9a'};text-decoration:none;white-space:nowrap;">${label}</a>`;
      }

      function field(label, value) {
        return `<div class="detail-item"><div class="detail-label">${label}</div><div class="detail-value">${value||'—'}</div></div>`;
      }

      function inputField(label, name, value, type='text', extra='') {
        return `<div class="form-group" style="margin-bottom:12px;">
          <div style="font-size:.68rem;color:#7a8a9a;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px;">${label}</div>
          <input type="${type}" name="${name}" value="${value||''}" ${extra} style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:8px 12px;font-size:.85rem;"/>
        </div>`;
      }

      let tabContent = '';

      if (activeTab === 'overview') {
        tabContent = `
          <form method="POST" action="/admin/customers/${cust.id}/update">
            <input type="hidden" name="tab" value="overview"/>
            <div class="detail-grid">
              ${inputField('First Name','first_name',cust.first_name)}
              ${inputField('Last Name','last_name',cust.last_name)}
              ${inputField('Email','email',cust.email,'email')}
              ${inputField('Phone','phone',cust.phone)}
              ${inputField('Country','country',cust.country||cust.billing_country)}
            </div>
            <div style="margin-top:8px;display:flex;gap:10px;align-items:center;">
              <button type="submit" class="btn btn-gold">Save Changes</button>
              <span style="font-size:.78rem;color:#7a8a9a;">Status: ${statusBadge(cust.status)}</span>
              <span style="font-size:.78rem;color:#7a8a9a;">Last Login: ${cust.last_login_at?new Date(cust.last_login_at).toLocaleString():'Never'}</span>
              <span style="font-size:.78rem;color:#7a8a9a;">Member Since: ${new Date(cust.created_at).toLocaleDateString()}</span>
            </div>
          </form>`;
      } else if (activeTab === 'company') {
        tabContent = `
          <form method="POST" action="/admin/customers/${cust.id}/update">
            <input type="hidden" name="tab" value="company"/>
            <div class="detail-grid">
              ${inputField('Company Name','company',cust.company)}
              ${inputField('Job Title','job_title',cust.job_title)}
              ${inputField('Website','website',cust.website)}
              ${inputField('CAGE Code','cage_code',cust.cage_code)}
              ${inputField('DUNS Number','duns_number',cust.duns_number)}
              ${inputField('Account Manager','account_manager',cust.account_manager)}
            </div>
            <button type="submit" class="btn btn-gold" style="margin-top:8px;">Save Changes</button>
          </form>`;
      } else if (activeTab === 'addresses') {
        tabContent = `
          <form method="POST" action="/admin/customers/${cust.id}/update">
            <input type="hidden" name="tab" value="addresses"/>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
              <div>
                <div style="font-size:.72rem;color:#c8932a;letter-spacing:.15em;text-transform:uppercase;margin-bottom:12px;font-weight:600;">Billing Address</div>
                ${inputField('Address Line 1','billing_address1',cust.billing_address1)}
                ${inputField('Address Line 2','billing_address2',cust.billing_address2)}
                ${inputField('City','billing_city',cust.billing_city)}
                ${inputField('State','billing_state',cust.billing_state)}
                ${inputField('ZIP','billing_zip',cust.billing_zip)}
                ${inputField('Country','billing_country',cust.billing_country)}
              </div>
              <div>
                <div style="font-size:.72rem;color:#c8932a;letter-spacing:.15em;text-transform:uppercase;margin-bottom:12px;font-weight:600;">Shipping Address</div>
                ${inputField('Address Line 1','shipping_address1',cust.shipping_address1)}
                ${inputField('Address Line 2','shipping_address2',cust.shipping_address2)}
                ${inputField('City','shipping_city',cust.shipping_city)}
                ${inputField('State','shipping_state',cust.shipping_state)}
                ${inputField('ZIP','shipping_zip',cust.shipping_zip)}
                ${inputField('Country','shipping_country',cust.shipping_country)}
              </div>
            </div>
            <button type="submit" class="btn btn-gold" style="margin-top:16px;">Save Changes</button>
          </form>`;
      } else if (activeTab === 'payment') {
        tabContent = `
          <form method="POST" action="/admin/customers/${cust.id}/update">
            <input type="hidden" name="tab" value="payment"/>
            <div class="detail-grid">
              ${inputField('Payment Terms','payment_terms',cust.payment_terms,'text','placeholder="e.g. Net 30, Credit Card"')}
              ${inputField('Credit Limit ($)','credit_limit',cust.credit_limit,'number','step="0.01" min="0"')}
              ${inputField('Tax Exempt Number','tax_exempt_number',cust.tax_exempt_number)}
            </div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
              <input type="checkbox" name="tax_exempt" id="tax_exempt" value="1" ${cust.tax_exempt?'checked':''} style="width:auto;accent-color:#c8932a;"/>
              <label for="tax_exempt" style="font-size:.85rem;cursor:pointer;">Tax Exempt</label>
            </div>
            <button type="submit" class="btn btn-gold">Save Changes</button>
          </form>`;
      } else if (activeTab === 'history') {
        tabContent = `
          <div style="margin-bottom:24px;">
            <div style="font-size:.72rem;color:#c8932a;letter-spacing:.15em;text-transform:uppercase;margin-bottom:12px;font-weight:600;">RFQ History (${rfqs.recordset.length})</div>
            <table><thead><tr><th>RFQ #</th><th>Lines</th><th>Priority</th><th>Status</th><th>Date</th><th></th></tr></thead>
            <tbody>${rfqRows}</tbody></table>
          </div>
          <div>
            <div style="font-size:.72rem;color:#c8932a;letter-spacing:.15em;text-transform:uppercase;margin-bottom:12px;font-weight:600;">Quote History (${quotes.recordset.length})</div>
            <table><thead><tr><th>Quote #</th><th>RFQ</th><th>Status</th><th>Total</th><th>Valid Until</th><th>Sent</th></tr></thead>
            <tbody>${quoteRows}</tbody></table>
          </div>`;
      } else if (activeTab === 'notes') {
        tabContent = `
          <form method="POST" action="/admin/customers/${cust.id}/update">
            <input type="hidden" name="tab" value="notes"/>
            <div style="margin-bottom:12px;">
              <div style="font-size:.68rem;color:#7a8a9a;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px;">Internal Notes (not visible to customer)</div>
              <textarea name="internal_notes" rows="10" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:12px;font-size:.85rem;resize:vertical;">${cust.internal_notes||''}</textarea>
            </div>
            <button type="submit" class="btn btn-gold">Save Notes</button>
          </form>`;
      }

      res.send(page('Customer: '+cust.first_name+' '+cust.last_name,'customers',`
        ${successMsg}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:8px;">
          <div>
            <div class="page-title">${cust.first_name} ${cust.last_name}</div>
            <div class="page-sub" style="margin-bottom:0;">${cust.company||''} ${cust.email?'· '+cust.email:''}</div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <form method="POST" action="/admin/customers/${cust.id}/send-setup" style="display:inline;" onsubmit="return confirm('Send account setup email to ${cust.email}?');">
              <button type="submit" class="btn btn-outline btn-sm" style="border-color:#4caf50;color:#4caf50;">✉ Send Setup</button>
            </form>
            <form method="POST" action="/admin/customers/${cust.id}/send-reset" style="display:inline;" onsubmit="return confirm('Send password reset to ${cust.email}?');">
              <button type="submit" class="btn btn-outline btn-sm" style="border-color:#c8932a;color:#c8932a;">🔑 Send Reset</button>
            </form>
            <a href="/admin/customers" class="btn btn-outline btn-sm">← Back</a>
          </div>
        </div>

        <div style="border-bottom:1px solid #1e2d42;margin-bottom:24px;overflow-x:auto;white-space:nowrap;">
          ${tabLink('overview','👤 Overview')}
          ${tabLink('company','🏢 Company')}
          ${tabLink('addresses','📍 Addresses')}
          ${tabLink('payment','💳 Payment')}
          ${tabLink('history','📋 History')}
          ${tabLink('notes','📝 Notes')}
        </div>

        <div class="card">
          <div class="card-body">
            ${tabContent}
          </div>
        </div>
      `));
    } catch(err) {
      res.send(page('Customer','customers',`<div class="alert alert-error">${err.message}</div>`));
    }
  });

  // Save customer updates
  router.post('/customers/:id/update', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const b = req.body;
      await pool.request()
        .input('id', sql.BigInt, req.params.id)
        .input('firstName', sql.NVarChar(100), b.first_name||null)
        .input('lastName', sql.NVarChar(100), b.last_name||null)
        .input('email', sql.NVarChar(150), b.email||null)
        .input('phone', sql.NVarChar(30), b.phone||null)
        .input('country', sql.NVarChar(100), b.country||null)
        .input('company', sql.NVarChar(150), b.company||null)
        .input('jobTitle', sql.NVarChar(100), b.job_title||null)
        .input('website', sql.NVarChar(150), b.website||null)
        .input('cageCode', sql.NVarChar(10), b.cage_code||null)
        .input('dunsNumber', sql.NVarChar(20), b.duns_number||null)
        .input('accountManager', sql.NVarChar(100), b.account_manager||null)
        .input('billingAddress1', sql.NVarChar(150), b.billing_address1||null)
        .input('billingAddress2', sql.NVarChar(150), b.billing_address2||null)
        .input('billingCity', sql.NVarChar(100), b.billing_city||null)
        .input('billingState', sql.NVarChar(50), b.billing_state||null)
        .input('billingZip', sql.NVarChar(20), b.billing_zip||null)
        .input('billingCountry', sql.NVarChar(50), b.billing_country||null)
        .input('shippingAddress1', sql.NVarChar(150), b.shipping_address1||null)
        .input('shippingAddress2', sql.NVarChar(150), b.shipping_address2||null)
        .input('shippingCity', sql.NVarChar(100), b.shipping_city||null)
        .input('shippingState', sql.NVarChar(50), b.shipping_state||null)
        .input('shippingZip', sql.NVarChar(20), b.shipping_zip||null)
        .input('shippingCountry', sql.NVarChar(50), b.shipping_country||null)
        .input('paymentTerms', sql.NVarChar(50), b.payment_terms||null)
        .input('creditLimit', sql.Decimal(12,2), parseFloat(b.credit_limit)||null)
        .input('taxExempt', sql.Bit, b.tax_exempt==='1'?1:0)
        .input('taxExemptNumber', sql.NVarChar(50), b.tax_exempt_number||null)
        .input('internalNotes', sql.NVarChar(sql.MAX), b.internal_notes||null)
        .query(`UPDATE customers SET
          first_name=@firstName, last_name=@lastName, email=@email, phone=@phone, country=@country,
          company=@company, job_title=@jobTitle, website=@website, cage_code=@cageCode,
          duns_number=@dunsNumber, account_manager=@accountManager,
          billing_address1=@billingAddress1, billing_address2=@billingAddress2,
          billing_city=@billingCity, billing_state=@billingState,
          billing_zip=@billingZip, billing_country=@billingCountry,
          shipping_address1=@shippingAddress1, shipping_address2=@shippingAddress2,
          shipping_city=@shippingCity, shipping_state=@shippingState,
          shipping_zip=@shippingZip, shipping_country=@shippingCountry,
          payment_terms=@paymentTerms, credit_limit=@creditLimit,
          tax_exempt=@taxExempt, tax_exempt_number=@taxExemptNumber,
          internal_notes=@internalNotes, updated_at=GETDATE()
          WHERE id=@id`);
      res.redirect('/admin/customers/' + req.params.id + '?tab=' + (b.tab||'overview') + '&saved=1');
    } catch(err) {
      console.error('Customer update error:', err);
      res.redirect('/admin/customers/' + req.params.id + '?error=' + encodeURIComponent(err.message));
    }
  });

  // Send account setup email to customer// Send account setup email to customer
  router.post('/customers/:id/send-setup', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const cr = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT id, first_name, email FROM customers WHERE id=@id');
      if (!cr.recordset.length) return res.redirect('/admin/customers/' + req.params.id + '?error=Customer+not+found');
      const customer = cr.recordset[0];
      const crypto = await import('crypto');
      const setupToken = crypto.default.randomBytes(32).toString('hex');
      const setupExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await pool.request()
        .input('customerId', sql.BigInt, customer.id)
        .input('token', sql.NVarChar, setupToken)
        .input('expiresAt', sql.DateTime, setupExpiry)
        .input('ip', sql.NVarChar(45), '0.0.0.0')
        .query('INSERT INTO password_resets (customer_id, reset_token, expires_at, ip_address) VALUES (@customerId, @token, @expiresAt, @ip)');
      const { sendAccountSetup } = await import('../services/mailer.js');
      await sendAccountSetup({ customer, token: setupToken });
      res.redirect('/admin/customers/' + req.params.id + '?setup_sent=1');
    } catch(err) {
      console.error('Send setup email error:', err);
      res.redirect('/admin/customers/' + req.params.id + '?error=' + encodeURIComponent(err.message));
    }
  });

  // Send password reset email from admin
  router.post('/customers/:id/send-reset', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const cr = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT id, first_name, email FROM customers WHERE id=@id');
      if (!cr.recordset.length) return res.redirect('/admin/customers/' + req.params.id + '?error=Customer+not+found');
      const customer = cr.recordset[0];
      const crypto = await import('crypto');
      const resetToken = crypto.default.randomBytes(32).toString('hex');
      const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await pool.request()
        .input('customerId', sql.BigInt, customer.id)
        .input('token', sql.NVarChar, resetToken)
        .input('expiresAt', sql.DateTime, resetExpiry)
        .input('ip', sql.NVarChar(45), '0.0.0.0')
        .query('INSERT INTO password_resets (customer_id, reset_token, expires_at, ip_address) VALUES (@customerId, @token, @expiresAt, @ip)');
      const { sendPasswordReset } = await import('../services/mailer.js');
      await sendPasswordReset({ customer, token: resetToken });
      res.redirect('/admin/customers/' + req.params.id + '?reset_sent=1');
    } catch(err) {
      console.error('Send reset email error:', err);
      res.redirect('/admin/customers/' + req.params.id + '?error=' + encodeURIComponent(err.message));
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
        <td class="mono text-gold"><a href="/admin/quotes/${q.id}" style="color:#c8932a;">${q.quote_number}</a> <span style="font-size:.68rem;background:#1e3a5f;color:#c8932a;border:1px solid #c8932a;padding:1px 7px;border-radius:10px;font-weight:700;margin-left:4px;vertical-align:middle;">${(()=>{const m=(q.quote_number||'').match(/-v(\d+)$/);return m?'v'+m[1]:(q.quote_number||'').endsWith('-D')?'DRAFT':''})()}</span></td>
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
      // QUOTE_SOURCES_SUBROW_V1
      const _qSources = await pool.request().input('id2', sql.BigInt, req.params.id).query('SELECT qls.quote_line_id, qls.supplier_id, qls.allocated_qty, qls.unit_cost, qls.supplier_lead_time_days, qls.lead_time_text, qls.has_8130, qls.has_coc, qls.has_trace, s.company_name AS supplier_name FROM quote_line_sources qls INNER JOIN quote_lines ql ON ql.id = qls.quote_line_id LEFT JOIN suppliers s ON s.id = qls.supplier_id WHERE ql.quote_id = @id2 ORDER BY qls.quote_line_id, qls.sort_order');
      const _sourcesByLine = {};
      _qSources.recordset.forEach(function(src) { if (!_sourcesByLine[src.quote_line_id]) _sourcesByLine[src.quote_line_id] = []; _sourcesByLine[src.quote_line_id].push(src); });
      const _renderSourceSubRow = function(srcs) {
        if (!srcs || !srcs.length) { return '<tr><td colspan="10" style="padding:6px 12px;background:rgba(200,147,42,0.04);font-size:.72rem;color:#7a8a9a;border-top:none;border-bottom:1px solid #1e2d42;font-style:italic;">No supplier sourcing on this line</td></tr>'; }
        var html = '';
        html += '<tr><td colspan="10" style="padding:0;background:rgba(200,147,42,0.04);border-top:none;border-bottom:1px solid #1e2d42;">';
        html += '<div style="padding:6px 14px;font-size:.65rem;letter-spacing:.12em;color:#c8932a;text-transform:uppercase;">Sourcing (Internal)</div>';
        html += '<table style="width:100%;margin:0;"><thead><tr style="background:transparent;">';
        html += '<th style="font-size:.65rem;padding:4px 12px;color:#7a8a9a;text-align:left;">Supplier</th>';
        html += '<th style="font-size:.65rem;padding:4px 12px;color:#7a8a9a;text-align:left;">Qty</th>';
        html += '<th style="font-size:.65rem;padding:4px 12px;color:#7a8a9a;text-align:left;">Unit Cost</th>';
        html += '<th style="font-size:.65rem;padding:4px 12px;color:#7a8a9a;text-align:left;">Lead Time</th>';
        html += '<th style="font-size:.65rem;padding:4px 12px;color:#7a8a9a;text-align:left;">Certs</th>';
        html += '</tr></thead><tbody>';
        srcs.forEach(function(src) {
          var leadText = src.lead_time_text || (src.supplier_lead_time_days ? src.supplier_lead_time_days + ' days' : '\u2014');
          var certs = '';
          if (src.has_8130) certs += '<span style="display:inline-block;padding:2px 6px;background:rgba(76,175,80,0.15);color:#4caf50;border-radius:3px;font-size:.65rem;margin-right:3px;">8130</span>';
          if (src.has_coc) certs += '<span style="display:inline-block;padding:2px 6px;background:rgba(76,175,80,0.15);color:#4caf50;border-radius:3px;font-size:.65rem;margin-right:3px;">CoC</span>';
          if (src.has_trace) certs += '<span style="display:inline-block;padding:2px 6px;background:rgba(76,175,80,0.15);color:#4caf50;border-radius:3px;font-size:.65rem;">Trace</span>';
          if (!certs) certs = '<span style="color:#7a8a9a;">\u2014</span>';
          html += '<tr style="background:transparent;">';
          html += '<td style="padding:4px 12px;font-size:.78rem;color:#eef1f5;">' + (src.supplier_name || '\u2014') + '</td>';
          html += '<td style="padding:4px 12px;font-size:.78rem;">' + (src.allocated_qty || 0) + '</td>';
          html += '<td style="padding:4px 12px;font-size:.78rem;color:#c8932a;font-weight:600;">$' + parseFloat(src.unit_cost || 0).toFixed(2) + '</td>';
          html += '<td style="padding:4px 12px;font-size:.78rem;color:#7a8a9a;">' + leadText + '</td>';
          html += '<td style="padding:4px 12px;font-size:.78rem;">' + certs + '</td>';
          html += '</tr>';
        });
        html += '</tbody></table></td></tr>';
        return html;
      };
      const rfqLog = await pool.request().input('rfqIdLog', sql.BigInt, q.rfq_id)
        .query('SELECT * FROM rfq_status_log WHERE rfq_id=@rfqIdLog ORDER BY created_at ASC');
      // EDIT_RESEND_V1 load versions
      const versionsR = await pool.request().input('idv', sql.BigInt, req.params.id).query('SELECT id, version, revised_at, revised_by, revision_note, email_sent, subtotal, total FROM quote_versions WHERE quote_id=@idv ORDER BY version DESC');
      const versionRows = versionsR.recordset.map(function(v) { return '<tr><td style="color:#c8932a;font-weight:600;">v' + v.version + '</td><td>' + new Date(v.revised_at).toLocaleString() + '</td><td>' + (v.revised_by || 'admin') + '</td><td style="font-weight:600;">$' + parseFloat(v.total || 0).toLocaleString('en-US', {minimumFractionDigits: 2}) + '</td><td style="color:#7a8a9a;">' + (v.revision_note || '\u2014') + '</td><td>' + (v.email_sent ? '<span style="color:#4caf50;">Sent</span>' : '<span style="color:#7a8a9a;">No</span>') + '</td></tr>'; }).join('');
      const logRows = rfqLog.recordset.map(l => `<tr>
        <td style="color:#7a8a9a;font-size:.78rem;">${new Date(l.created_at).toLocaleString()}</td>
        <td>${statusBadge(l.new_status)}</td>
        <td style="color:#7a8a9a;">${l.note||'—'}</td>
      </tr>`).join('');
      const lineRows = lines.recordset.map(l => `<tr>
        <td style="color:#7a8a9a;">${l.line_number}</td>
        <td class="mono" style="color:#c8932a;">${l.nsn||l.part_number||'—'}</td>
        <td>${l.item_name||'—'}</td>
        <td>${l.quantity}</td>
        <td style="color:#7a8a9a;">${l.condition_code||'—'}</td>
        <td style="color:#7a8a9a;">${parseFloat(l.unit_cost||0).toFixed(2)}</td>
        <td style="font-weight:600;">${parseFloat(l.unit_price||0).toFixed(2)}</td>
        <td style="font-weight:600;">${parseFloat(l.line_total||0).toFixed(2)}</td>
        <td style="color:#7a8a9a;">${l.lead_time_text || (l.lead_time_days ? l.lead_time_days+' days' : '—')}</td>
        <td style="color:${parseFloat(l.margin_pct||0)>=20?'#4caf50':'#e05050'};">${parseFloat(l.margin_pct||0).toFixed(1)}%</td>
      </tr>${_renderSourceSubRow(_sourcesByLine[l.id])}`).join('');
      res.send(page(`Quote ${q.quote_number}`,'quotes',`
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div class="page-title">Quote ${q.quote_number}</div>
          <div style="display:flex;gap:8px;">
          
          ${q.status!=='Accepted' ? `<a href="/admin/quotes/${q.id}/edit" class="btn btn-sm" style="background:#c8932a;color:#000;font-weight:600;text-decoration:none;">&#x270F; Edit &amp; Resend</a>` : ''}
          <a href="/admin/quotes" class="btn btn-outline btn-sm">← Back to Quotes</a>
        </div>
        </div>
        <div class="page-sub">Created ${new Date(q.created_at).toLocaleString()}</div>
        <div class="detail-grid">
          <div class="detail-item"><div class="detail-label">Customer</div><div class="detail-value"><a href="/admin/customers/${q.customer_id}" style="color:#c8932a;">${q.customer_name}</a></div></div>
          <div class="detail-item"><div class="detail-label">Company</div><div class="detail-value">${q.company||'—'}</div></div>
          <div class="detail-item"><div class="detail-label">Email</div><div class="detail-value"><a href="mailto:${q.email}" style="color:#c8932a;">${q.email}</a></div></div>
          <div class="detail-item"><div class="detail-label">RFQ</div><div class="detail-value"><a href="/admin/rfqs/${q.rfq_header_id}" style="color:#c8932a;">${q.rfq_number}</a></div></div>
          <div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">${statusBadge(q.status)}${(() => { if (q.status==='Sent' && q.valid_until) {  const days = Math.ceil((new Date(q.valid_until)-new Date())/86400000);  if (days < 0) return ' <span style="color:#e05050;font-size:.7rem;margin-left:6px;">EXPIRED '+Math.abs(days)+'d AGO</span>';  if (days <= 3) return ' <span style="color:#e05050;font-size:.7rem;margin-left:6px;">Expires in '+days+'d</span>';  if (days <= 7) return ' <span style="color:#c8932a;font-size:.7rem;margin-left:6px;">Expires in '+days+'d</span>';  return ' <span style="color:#7a8a9a;font-size:.7rem;margin-left:6px;">'+days+'d left</span>'; } if (q.reissued_count > 0) return ' <span style="color:#c8932a;font-size:.7rem;margin-left:6px;">Reissued '+q.reissued_count+'x</span>'; return '';})()}</div></div>${q.status==='Rejected' ? `<div class="alert alert-error" style="grid-column:1/-1;">&#9888; Customer rejected${q.rejected_at ? ' on '+new Date(q.rejected_at).toLocaleDateString() : ''}${q.rejection_reason ? '. Reason: '+q.rejection_reason : ''}</div>` : ''}${q.status==='Expired' ? `<div class="alert" style="grid-column:1/-1;background:rgba(122,138,154,0.1);border-color:#7a8a9a;color:#7a8a9a;">&#9201; This quote expired${q.expired_at ? ' on '+new Date(q.expired_at).toLocaleDateString() : (q.valid_until ? ' on '+new Date(q.valid_until).toLocaleDateString() : '')}. Use Reissue or Revise to send a new one.</div>` : ''}
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
        ${q.personal_message?`<div class="card"><div class="card-header">Personal Message</div><div class="card-body" style="color:#7a8a9a;font-style:italic;">&ldquo;${q.personal_message}&rdquo;</div></div>`:''}
        <div class="card">
          <div class="card"><div class="card-header">Revision History (Current: v${q.version || 1})</div><table><thead><tr><th>Version</th><th>Date</th><th>By</th><th>Total</th><th>Note</th><th>Emailed</th></tr></thead><tbody>${versionRows || '<tr><td colspan="6" style="color:#7a8a9a;text-align:center;padding:16px;">Original version only \u2014 no revisions yet</td></tr>'}</tbody></table></div>
        <div class="card">
          <div class="card-header">RFQ Status History</div>
          <table><thead><tr><th>Date</th><th>Status</th><th>Note</th></tr></thead>
          <tbody>${logRows||'<tr><td colspan="3" style="color:#7a8a9a;text-align:center;padding:16px;">No history yet</td></tr>'}</tbody></table>
        </div>
        <script>
          
        </script>
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
        <td class="mono text-gold"><a href="/admin/orders/${o.id}" style="color:#c8932a;">${o.order_number}</a></td>
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
        <td class="mono text-gold"><a href="/admin/invoices/${i.id}" style="color:#c8932a;">${i.invoice_number}</a></td>
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
  // Invoice Detail
  router.get('/invoices/:id', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const ir = await pool.request().input('id', sql.BigInt, req.params.id).query(`
        SELECT i.*, o.order_number, o.id AS order_id,
          c.first_name+' '+c.last_name AS customer_name, c.company, c.email, c.phone, c.id AS customer_id,
          c.billing_address1, c.billing_address2, c.billing_city, c.billing_state, c.billing_zip, c.billing_country
        FROM invoices i
        LEFT JOIN orders o ON o.id=i.order_id
        JOIN customers c ON c.id=i.customer_id
        WHERE i.id=@id
      `);
      if (!ir.recordset.length) return res.send(page('Invoice','invoices','<div class="alert alert-error">Invoice not found.</div>'));
      const inv = ir.recordset[0];
      const lines = await pool.request().input('id', sql.BigInt, req.params.id)
        .query('SELECT * FROM invoice_lines WHERE invoice_id=@id ORDER BY line_number');

      const isPaid = inv.status === 'Paid';
      const balanceDue = parseFloat(inv.balance_due||0);

      let lineRows = '';
      lines.recordset.forEach(function(l) {
        lineRows += '<tr>';
        lineRows += '<td style="color:#7a8a9a;">' + l.line_number + '</td>';
        lineRows += '<td class="mono" style="color:#c8932a;">' + (l.nsn||l.part_number||'&mdash;') + '</td>';
        lineRows += '<td>' + (l.description||'&mdash;') + '</td>';
        lineRows += '<td>' + l.quantity + '</td>';
        lineRows += '<td style="color:#7a8a9a;">' + (l.condition_code||'&mdash;') + '</td>';
        lineRows += '<td style="font-weight:600;">$' + parseFloat(l.unit_price||0).toFixed(2) + '</td>';
        lineRows += '<td style="font-weight:600;">$' + parseFloat(l.line_total||0).toFixed(2) + '</td>';
        lineRows += '</tr>';
      });
      if (!lineRows) lineRows = '<tr><td colspan="7" style="text-align:center;color:#7a8a9a;padding:16px;">No lines</td></tr>';

      const billToParts = [];
      if (inv.billing_address1) billToParts.push(inv.billing_address1);
      if (inv.billing_address2) billToParts.push(inv.billing_address2);
      const cityLine = [inv.billing_city, inv.billing_state, inv.billing_zip].filter(Boolean).join(', ');
      if (cityLine) billToParts.push(cityLine);
      if (inv.billing_country) billToParts.push(inv.billing_country);
      const billTo = billToParts.length ? billToParts.join('<br>') : '<span style="color:#7a8a9a;">No billing address on file</span>';

      let html = '';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;flex-wrap:wrap;gap:8px;">';
      html += '<div><div class="page-title">' + inv.invoice_number + '</div>';
      html += '<div class="page-sub" style="margin-bottom:0;">' + inv.customer_name + ' &middot; ' + (inv.company||'') + '</div></div>';
      html += '<div style="display:flex;gap:8px;">';
      if (inv.order_id) html += '<a href="/admin/orders/' + inv.order_id + '?tab=payment" class="btn btn-outline btn-sm">View Order</a>';
      html += '<a href="/admin/invoices" class="btn btn-outline btn-sm">&larr; Back</a></div></div>';

      html += '<div class="detail-grid">';
      html += '<div class="detail-item"><div class="detail-label">Invoice #</div><div class="detail-value" style="font-family:monospace;color:#c8932a;">' + inv.invoice_number + '</div></div>';
      html += '<div class="detail-item"><div class="detail-label">Order</div><div class="detail-value">' + (inv.order_number ? '<a href="/admin/orders/' + inv.order_id + '" style="color:#c8932a;">' + inv.order_number + '</a>' : '&mdash;') + '</div></div>';
      html += '<div class="detail-item"><div class="detail-label">Customer</div><div class="detail-value"><a href="/admin/customers/' + inv.customer_id + '" style="color:#c8932a;">' + inv.customer_name + '</a></div></div>';
      html += '<div class="detail-item"><div class="detail-label">Email</div><div class="detail-value"><a href="mailto:' + inv.email + '" style="color:#c8932a;">' + inv.email + '</a></div></div>';
      html += '<div class="detail-item"><div class="detail-label">Status</div><div class="detail-value">' + statusBadge(inv.status) + '</div></div>';
      html += '<div class="detail-item"><div class="detail-label">Issue Date</div><div class="detail-value">' + (inv.issue_date ? new Date(inv.issue_date).toLocaleDateString() : '&mdash;') + '</div></div>';
      html += '<div class="detail-item"><div class="detail-label">Due Date</div><div class="detail-value">' + (inv.due_date ? new Date(inv.due_date).toLocaleDateString() : '&mdash;') + '</div></div>';
      html += '<div class="detail-item"><div class="detail-label">Paid Date</div><div class="detail-value">' + (inv.paid_date ? new Date(inv.paid_date).toLocaleDateString() : '&mdash;') + '</div></div>';
      html += '<div class="detail-item"><div class="detail-label">Subtotal</div><div class="detail-value">$' + parseFloat(inv.subtotal||0).toLocaleString('en-US',{minimumFractionDigits:2}) + '</div></div>';
      html += '<div class="detail-item"><div class="detail-label">Shipping</div><div class="detail-value">$' + parseFloat(inv.shipping_amount||0).toLocaleString('en-US',{minimumFractionDigits:2}) + '</div></div>';
      html += '<div class="detail-item"><div class="detail-label">Total</div><div class="detail-value" style="font-weight:700;color:#c8932a;font-size:1.1rem;">$' + parseFloat(inv.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2}) + '</div></div>';
      html += '<div class="detail-item"><div class="detail-label">Balance Due</div><div class="detail-value" style="font-weight:700;color:' + (balanceDue>0?'#e05050':'#4caf50') + ';font-size:1.1rem;">$' + balanceDue.toLocaleString('en-US',{minimumFractionDigits:2}) + '</div></div>';
      html += '</div>';

      html += '<div class="card"><div class="card-header">Bill To</div><div class="card-body" style="line-height:1.6;">';
      html += '<strong>' + inv.customer_name + '</strong>';
      if (inv.company) html += '<br>' + inv.company;
      html += '<br>' + billTo + '</div></div>';

      html += '<div class="card"><div class="card-header">Line Items (' + lines.recordset.length + ')</div>';
      html += '<table><thead><tr><th>#</th><th>NSN/Part</th><th>Description</th><th>Qty</th><th>Condition</th><th>Unit Price</th><th>Line Total</th></tr></thead>';
      html += '<tbody>' + lineRows + '</tbody></table>';
      html += '<div style="padding:16px;text-align:right;border-top:1px solid #1e2d42;">';
      html += '<span style="color:#7a8a9a;margin-right:16px;">Subtotal: <strong>$' + parseFloat(inv.subtotal||0).toLocaleString('en-US',{minimumFractionDigits:2}) + '</strong></span>';
      if (parseFloat(inv.shipping_amount||0) > 0) {
        html += '<span style="color:#7a8a9a;margin-right:16px;">Shipping: <strong>$' + parseFloat(inv.shipping_amount).toFixed(2) + '</strong></span>';
      }
      html += '<span style="font-size:1.1rem;font-weight:700;">Total: <strong style="color:#c8932a;">$' + parseFloat(inv.total_amount||0).toLocaleString('en-US',{minimumFractionDigits:2}) + '</strong></span>';
      html += '</div></div>';

      if (!isPaid && inv.order_id) {
        html += '<div class="card"><div class="card-header">Payment</div><div class="card-body">';
        html += '<p style="font-size:.85rem;color:#7a8a9a;margin-bottom:12px;">To mark this invoice paid, use the order payment tab.</p>';
        html += '<a href="/admin/orders/' + inv.order_id + '?tab=payment" class="btn btn-gold">Go to Order Payment Tab &rarr;</a>';
        html += '</div></div>';
      } else if (isPaid) {
        html += '<div class="alert alert-success">&#10004; This invoice is paid in full.</div>';
      }

      if (inv.notes) {
        html += '<div class="card"><div class="card-header">Notes</div><div class="card-body" style="color:#7a8a9a;">' + inv.notes + '</div></div>';
      }

      res.send(page('Invoice ' + inv.invoice_number, 'invoices', html));
    } catch(err) {
      console.error('Invoice detail error:', err);
      res.send(page('Invoice','invoices','<div class="alert alert-error">' + err.message + '</div>'));
    }
  });


  // Suppliers
  router.get('/suppliers', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const filterMode = (req.query.filter || 'all').toLowerCase();
      let whereClause = '';
      if (filterMode === 'active') whereClause = "WHERE status='Active'";
      else if (filterMode === 'preferred') whereClause = "WHERE status='Active' AND is_preferred=1";
      else if (filterMode === 'cert8130') whereClause = "WHERE status='Active' AND is_certified_8130=1";
      else if (filterMode === 'inactive') whereClause = "WHERE status<>'Active'";
      const result = await pool.request().query(`
        SELECT id, company_name AS name, contact_name, email, phone, country, status, is_preferred, is_certified_8130, created_at
        FROM suppliers ${whereClause} ORDER BY company_name ASC
      `);
      const rows = result.recordset.map(s => `<tr data-supplier-row data-href="/admin/suppliers/${s.id}" style="cursor:pointer;">
        <td style="font-weight:600;color:#c8932a;">${s.name}</td>
        <td style="color:#7a8a9a;">${s.contact_name||'—'}</td>
        <td style="color:#7a8a9a;font-size:.8rem;">${s.email||'—'}</td>
        <td style="color:#7a8a9a;">${s.phone||'—'}</td>
        <td style="color:#7a8a9a;">${s.country||'—'}</td>
        <td>${statusBadge(s.status)}</td>
      </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;color:#7a8a9a;padding:24px;">No suppliers yet</td></tr>';
      res.send(page('Suppliers','suppliers',`
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;"><div class="page-title">Suppliers</div><a href="/admin/suppliers/new" class="btn btn-gold">+ New Supplier</a></div>
        <div class="page-sub">Verified supplier network</div>
        <div id="supplierFilters" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;">${['all','active','preferred','cert8130','inactive'].map(f=>{const labels={all:'All',active:'Active',preferred:'Preferred',cert8130:'8130 Certified',inactive:'Inactive'};return '<a href="/admin/suppliers'+(f==='all'?'':'?filter='+f)+'" class="btn btn-sm '+(filterMode===f?'btn-gold':'btn-outline')+'" style="font-size:.7rem;">'+labels[f]+'</a>'}).join('')}</div>
        <div class="card">
          <table id="suppliersTable"><thead><tr><th data-sort="0" style="cursor:pointer;user-select:none;">Company &#x25B2;&#x25BC;</th><th data-sort="1" style="cursor:pointer;user-select:none;">Contact &#x25B2;&#x25BC;</th><th>Email</th><th>Phone</th><th data-sort="4" style="cursor:pointer;user-select:none;">Country &#x25B2;&#x25BC;</th><th data-sort="5" style="cursor:pointer;user-select:none;">Status &#x25B2;&#x25BC;</th></tr></thead>
          <tbody>${rows}</tbody></table>
        </div>
        <script>/* SUPPLIER_ROWCLICK_V1 */(function(){
          document.querySelectorAll("tr[data-supplier-row]").forEach(function(tr){
            tr.addEventListener("click", function(e){
              if (e.target.tagName === "A" || e.target.closest("a")) return;
              if (e.target.tagName === "BUTTON" || e.target.closest("button")) return;
              window.location = tr.getAttribute("data-href");
            });
            tr.addEventListener("mouseenter", function(){ tr.style.background="rgba(200,147,42,0.08)"; });
            tr.addEventListener("mouseleave", function(){ tr.style.background=""; });
          });
          var t = document.getElementById("suppliersTable"); if (!t) return;
          var dirs = {};
          t.querySelectorAll("th[data-sort]").forEach(function(h){
            h.addEventListener("click", function(){
              var col = parseInt(h.getAttribute("data-sort"));
              var dir = dirs[col] = (dirs[col] === "asc" ? "desc" : "asc");
              var tbody = t.querySelector("tbody");
              var rows = Array.from(tbody.querySelectorAll("tr[data-supplier-row]"));
              rows.sort(function(a,b){
                var av = (a.children[col].textContent || "").trim().toLowerCase();
                var bv = (b.children[col].textContent || "").trim().toLowerCase();
                if (av < bv) return dir==="asc"?-1:1;
                if (av > bv) return dir==="asc"?1:-1;
                return 0;
              });
              rows.forEach(function(r){ tbody.appendChild(r); });
            });
          });
        })();</script>`));
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

  mountOrderRoutes(router, requireAuth, page);
  mountSupplierRoutes(router, requireAuth, page);
  // EDIT_RESEND_V1 ============================================================
  // GET /admin/quotes/:id/edit  — show pre-filled edit form for an existing quote
  router.get('/quotes/:id/edit', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const qr = await pool.request().input('id', sql.BigInt, req.params.id).query('SELECT q.*, c.first_name+\' \'+c.last_name AS customer_name, c.email, c.company FROM quotes q JOIN customers c ON c.id=q.customer_id WHERE q.id=@id');
      if (!qr.recordset.length) return res.send(page('Edit Quote', 'quotes', '<div class="alert alert-error">Quote not found.</div>'));
      const q = qr.recordset[0];
      if (q.status === 'Accepted') {
        return res.send(page('Edit Quote', 'quotes', '<div class="alert alert-error">Cannot edit an accepted quote. To fix typos on accepted quotes, use the order page Lines tab.</div><div style="margin-top:12px;"><a href="/admin/quotes/' + q.id + '" class="btn btn-outline">&larr; Back to Quote</a></div>'));
      }
      const linesR = await pool.request().input('qid', sql.BigInt, req.params.id).query('SELECT * FROM quote_lines WHERE quote_id=@qid ORDER BY line_number');
      const srcsR = await pool.request().input('qid2', sql.BigInt, req.params.id).query('SELECT qls.*, s.company_name AS supplier_name FROM quote_line_sources qls LEFT JOIN suppliers s ON s.id=qls.supplier_id INNER JOIN quote_lines ql ON ql.id=qls.quote_line_id WHERE ql.quote_id=@qid2 ORDER BY qls.quote_line_id, qls.sort_order');
      const srcsByLine = {};
      srcsR.recordset.forEach(function(src) { if (!srcsByLine[src.quote_line_id]) srcsByLine[src.quote_line_id] = []; srcsByLine[src.quote_line_id].push(src); });
      // SUPPLIER_DROPDOWN_V1: load suppliers for dropdown
      const _suppliersR = await pool.request().query("SELECT id, company_name FROM suppliers WHERE status='Active' ORDER BY company_name ASC");
      const _supplierOptions = _suppliersR.recordset.map(function(s2) { return '<option value="' + s2.id + '">' + (s2.company_name || ('Supplier ' + s2.id)).replace(/</g,'&lt;') + '</option>'; }).join('');
      var html = '';
      html += '<div class="page-title">Edit Quote ' + q.quote_number + ' &mdash; v' + (q.version || 1) + ' \u2192 v' + ((q.version || 1) + 1) + '</div>';
      html += '<div class="page-sub">Editing creates a new version. Customer will receive an email with the revised PDF.</div>';
      html += '<form method="POST" action="/admin/quotes/' + q.id + '/edit-save">';
      html += '<div class="card"><div class="card-body">';
      html += '<div class="detail-grid">';
      html += '<div><div class="detail-label">Valid Until</div><input type="date" name="valid_until" value="' + (q.valid_until ? new Date(q.valid_until).toISOString().substring(0,10) : '') + '" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:8px 12px;"/></div>';
      html += '<div><div class="detail-label">Payment Terms</div><input type="text" name="payment_terms" value="' + (q.payment_terms || '').replace(/"/g, '&quot;') + '" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:8px 12px;"/></div>';
      html += '</div>';
      html += '</div></div>';
      html += '<div class="card" style="margin-top:14px;"><div class="card-header">Line Items</div><div class="card-body">';
      linesR.recordset.forEach(function(l, idx) {
        html += '<div style="margin-bottom:14px;padding:12px;background:#0a1628;border:1px solid #1e2d42;border-radius:4px;">';
        html += '<input type="hidden" name="lines[' + idx + '][id]" value="' + l.id + '"/>';
        html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">';
        html += '<div><div class="detail-label">NSN</div><input type="text" name="lines[' + idx + '][nsn]" value="' + ((l.nsn || '').toString().replace(/"/g, '&quot;')) + '" style="width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;"/></div>';
        html += '<div><div class="detail-label">Part Number</div><input type="text" name="lines[' + idx + '][part_number]" value="' + ((l.part_number || '').toString().replace(/"/g, '&quot;')) + '" style="width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;"/></div>';
        html += '<div style="grid-column:span 2;"><div class="detail-label">Item Name</div><input type="text" name="lines[' + idx + '][item_name]" value="' + ((l.item_name || '').toString().replace(/"/g, '&quot;')) + '" style="width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;"/></div>';
        html += '<div><div class="detail-label">Condition</div><input type="text" name="lines[' + idx + '][condition_code]" value="' + (l.condition_code || '') + '" style="width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;"/></div>';
        html += '<div><div class="detail-label">Qty</div><input type="number" min="1" name="lines[' + idx + '][quantity]" value="' + (l.quantity || 1) + '" style="width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;"/></div>';
        html += '<div><div class="detail-label">Unit Cost</div><input type="number" step="0.01" name="lines[' + idx + '][unit_cost]" value="' + parseFloat(l.unit_cost || 0).toFixed(2) + '" style="width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;"/></div>';
        html += '<div><div class="detail-label">Unit Price</div><input type="number" step="0.01" name="lines[' + idx + '][unit_price]" value="' + parseFloat(l.unit_price || 0).toFixed(2) + '" style="width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;"/></div>';
        html += '<div><div class="detail-label">Lead Time</div><input type="text" name="lines[' + idx + '][lead_time_text]" value="' + ((l.lead_time_text || '').toString().replace(/"/g, '&quot;')) + '" placeholder="e.g. 7-10 days" style="width:100%;background:#0e1828;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;"/></div>';
        html += '</div>';
        var srcs = srcsByLine[l.id] || [];
        // SOURCES_FULL_EDIT_V1
        html += '<div style="margin-top:10px;padding-top:8px;border-top:1px dashed #1e2d42;"><div style="font-size:.65rem;color:#c8932a;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px;">Sources (editable)</div>';
        html += '<div id="srcs-line-' + l.id + '">';
        var srcs = srcsByLine[l.id] || [];
        srcs.forEach(function(src, sIdx) {
          var rk = l.id + '_' + sIdx;
          html += '<div data-srcrow="' + rk + '" style="display:grid;grid-template-columns:1.5fr 0.5fr 0.7fr 1fr 0.5fr 0.5fr 0.5fr 0.3fr;gap:6px;align-items:end;margin-bottom:6px;padding:6px;background:#0e1828;border:1px solid #1e2d42;border-radius:3px;">';
          html += '<input type="hidden" name="line_' + l.id + '_src_' + sIdx + '[id]" value="' + src.id + '"/>';
          html += '<div style="position:relative;"><div style="font-size:.6rem;color:#7a8a9a;margin-bottom:2px;">Supplier</div><input type="text" class="sup-combo" data-target-id="sup_' + l.id + '_' + sIdx + '" value="' + ((src.supplier_name || '').toString().replace(/"/g, '&quot;')) + '" placeholder="Type to search suppliers..." autocomplete="off" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 24px 5px 8px;"/><div class="sup-arrow" style="position:absolute;right:8px;top:24px;color:#c8932a;pointer-events:none;font-size:.7rem;">\u25BC</div><div class="sup-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:#0a1628;border:1px solid #c8932a;border-top:none;max-height:200px;overflow-y:auto;z-index:1000;"></div><input type="hidden" id="sup_' + l.id + '_' + sIdx + '" name="line_' + l.id + '_src_' + sIdx + '[supplier_id]" value="' + src.supplier_id + '" required/></div>';
          html += '<div><div style="font-size:.6rem;color:#7a8a9a;margin-bottom:2px;">Qty</div><input type="number" min="1" name="line_' + l.id + '_src_' + sIdx + '[allocated_qty]" value="' + (src.allocated_qty || 1) + '" required style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;"/></div>';
          html += '<div><div style="font-size:.6rem;color:#7a8a9a;margin-bottom:2px;">Unit Cost</div><input type="number" step="0.01" name="line_' + l.id + '_src_' + sIdx + '[unit_cost]" value="' + parseFloat(src.unit_cost || 0).toFixed(2) + '" required style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;"/></div>';
          html += '<div><div style="font-size:.6rem;color:#7a8a9a;margin-bottom:2px;">Lead Time</div><input type="text" name="line_' + l.id + '_src_' + sIdx + '[lead_time_text]" value="' + ((src.lead_time_text || '').toString().replace(/"/g, '&quot;')) + '" placeholder="e.g. 5 days" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;"/></div>';
          html += '<div><div style="font-size:.6rem;color:#7a8a9a;margin-bottom:2px;">8130</div><input type="checkbox" name="line_' + l.id + '_src_' + sIdx + '[has_8130]" value="1"' + (src.has_8130 ? ' checked' : '') + '/></div>';
          html += '<div><div style="font-size:.6rem;color:#7a8a9a;margin-bottom:2px;">CoC</div><input type="checkbox" name="line_' + l.id + '_src_' + sIdx + '[has_coc]" value="1"' + (src.has_coc ? ' checked' : '') + '/></div>';
          html += '<div><div style="font-size:.6rem;color:#7a8a9a;margin-bottom:2px;">Trace</div><input type="checkbox" name="line_' + l.id + '_src_' + sIdx + '[has_trace]" value="1"' + (src.has_trace ? ' checked' : '') + '/></div>';
          html += '<div><button type="button" onclick="this.closest(&quot;[data-srcrow]&quot;).remove();" style="background:#3b1d1d;border:1px solid #5a2828;color:#e05050;padding:5px 8px;cursor:pointer;border-radius:3px;">&#x2716;</button></div>';
          html += '</div>';
        });
        html += '</div>';
        html += '<button type="button" onclick="addSrcRow(' + l.id + ')" style="background:rgba(200,147,42,0.1);border:1px solid #c8932a;color:#c8932a;padding:5px 12px;cursor:pointer;border-radius:3px;font-size:.78rem;">+ Add Source</button>';
        html += '</div>';
        var srcCount = srcs.length;
        html += '<input type="hidden" name="line_' + l.id + '_src_count_initial" value="' + srcCount + '"/>';
        html += '</div>';
      });
      html += '</div></div>';
      html += '<div class="card" style="margin-top:14px;"><div class="card-body">';
      html += '<div class="detail-label">Revision Note (visible to admin only, optional)</div>';
      html += '<input type="text" name="revision_note" placeholder="e.g. Updated price per Mike at Acme" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:8px 12px;margin-bottom:10px;"/>';
      html += '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" name="email_customer" value="1" checked/> Email customer the revised quote PDF</label>';
      html += '</div></div>';
      html += '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;">';
      html += '<a href="/admin/quotes/' + q.id + '" class="btn btn-outline">Cancel</a>';
      html += '<button type="submit" class="btn btn-gold">Save & Resend</button>';
      // SOURCES_FULL_EDIT_V1 - JS for adding new source rows
      html += '<script>';
      html += 'window.__SUPPLIERS = ' + JSON.stringify(_suppliersR.recordset) + ';';
      html += 'window.__supplierOptionsHTML = function(sel) { return window.__SUPPLIERS.map(function(s) { var name = (s.company_name||"").replace(/</g,"&lt;"); return "<option value=\\"" + s.id + "\\"" + (sel == s.id ? " selected" : "") + ">" + name + "</option>"; }).join(""); };';
      html += 'window.addSrcRow = function(lineId) {';
      html += '  var container = document.getElementById("srcs-line-" + lineId);';
      html += '  if (!container) return;';
      html += '  var existing = container.querySelectorAll("[data-srcrow]");';
      html += '  var nextIdx = existing.length;';
      html += '  while (document.querySelector("[data-srcrow=\\\"" + lineId + "_" + nextIdx + "\\\"]")) nextIdx++;';
      html += '  var prefix = "line_" + lineId + "_src_" + nextIdx;';
      html += '  var div = document.createElement("div");';
      html += '  div.setAttribute("data-srcrow", lineId + "_" + nextIdx);';
      html += '  div.style.cssText = "display:grid;grid-template-columns:1.5fr 0.5fr 0.7fr 1fr 0.5fr 0.5fr 0.5fr 0.3fr;gap:6px;align-items:end;margin-bottom:6px;padding:6px;background:#0e1828;border:1px solid #1e2d42;border-radius:3px;";';
      html += '  div.innerHTML =';
      html += '    \'<input type="hidden" name="\' + prefix + \'[id]" value=""/>\' +';
      html += '    \'<div style="position:relative;"><div style="font-size:.6rem;color:#7a8a9a;margin-bottom:2px;">Supplier</div><input type="text" class="sup-combo" data-target-id="sup_new_\' + Date.now() + \'_\' + nextIdx + \'" placeholder="Type to search suppliers..." autocomplete="off" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 24px 5px 8px;"/><div style="position:absolute;right:8px;top:24px;color:#c8932a;pointer-events:none;font-size:.7rem;">\\u25BC</div><div class="sup-dropdown" style="display:none;position:absolute;top:100%;left:0;right:0;background:#0a1628;border:1px solid #c8932a;border-top:none;max-height:200px;overflow-y:auto;z-index:1000;"></div><input type="hidden" id="sup_new_\' + Date.now() + \'_\' + nextIdx + \'" name="\' + prefix + \'[supplier_id]" required/></div>\' +';
      html += '    \'<div><div style="font-size:.6rem;color:#7a8a9a;margin-bottom:2px;">Qty</div><input type="number" min="1" name="\' + prefix + \'[allocated_qty]" value="1" required style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;"/></div>\' +';
      html += '    \'<div><div style="font-size:.6rem;color:#7a8a9a;margin-bottom:2px;">Unit Cost</div><input type="number" step="0.01" name="\' + prefix + \'[unit_cost]" required style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;"/></div>\' +';
      html += '    \'<div><div style="font-size:.6rem;color:#7a8a9a;margin-bottom:2px;">Lead Time</div><input type="text" name="\' + prefix + \'[lead_time_text]" placeholder="5 days" style="width:100%;background:#0a1628;border:1px solid #1e2d42;color:#eef1f5;padding:5px 8px;"/></div>\' +';
      html += '    \'<div><div style="font-size:.6rem;color:#7a8a9a;margin-bottom:2px;">8130</div><input type="checkbox" name="\' + prefix + \'[has_8130]" value="1"/></div>\' +';
      html += '    \'<div><div style="font-size:.6rem;color:#7a8a9a;margin-bottom:2px;">CoC</div><input type="checkbox" name="\' + prefix + \'[has_coc]" value="1"/></div>\' +';
      html += '    \'<div><div style="font-size:.6rem;color:#7a8a9a;margin-bottom:2px;">Trace</div><input type="checkbox" name="\' + prefix + \'[has_trace]" value="1"/></div>\' +';
      html += '    \'<div><button type="button" onclick="this.closest(\\\'[data-srcrow]\\\').remove();" style="background:#3b1d1d;border:1px solid #5a2828;color:#e05050;padding:5px 8px;cursor:pointer;border-radius:3px;">\\u2716</button></div>\';';
      html += '  container.appendChild(div);';
      html += '};';
      html += 'function renderSupOptions(combo, query) {';
            html += '  var dd = combo.parentElement.querySelector(".sup-dropdown");';
            html += '  if (!dd) return;';
            html += '  var q = (query || "").toLowerCase();';
            html += '  var matches = window.__SUPPLIERS.filter(function(s) { return !q || (s.company_name||"").toLowerCase().includes(q); }).slice(0, 50);';
            html += '  if (!matches.length) { dd.innerHTML = "<div style=\\"padding:8px;color:#7a8a9a;font-size:.78rem;\\">No suppliers match</div>"; dd.style.display = "block"; return; }';
            html += '  dd.innerHTML = matches.map(function(s) { var name = (s.company_name||"").replace(/</g,"&lt;"); return "<div class=\\"sup-opt\\" data-id=\\"" + s.id + "\\" data-name=\\"" + name.replace(/\\"/g, "&quot;") + "\\" style=\\"padding:6px 10px;cursor:pointer;font-size:.82rem;color:#eef1f5;border-bottom:1px solid #1e2d42;\\">" + name + "</div>"; }).join("");';
            html += '  dd.style.display = "block";';
            html += '}';
            html += 'document.addEventListener("focus", function(e) {';
            html += '  if (!e.target.classList || !e.target.classList.contains("sup-combo")) return;';
            html += '  renderSupOptions(e.target, e.target.value);';
            html += '}, true);';
            html += 'document.addEventListener("input", function(e) {';
            html += '  if (!e.target.classList || !e.target.classList.contains("sup-combo")) return;';
            html += '  var hid = document.getElementById(e.target.getAttribute("data-target-id"));';
            html += '  var match = window.__SUPPLIERS.find(function(s) { return (s.company_name||"").toLowerCase() === e.target.value.trim().toLowerCase(); });';
            html += '  if (hid) hid.value = match ? match.id : "";';
            html += '  e.target.style.borderColor = match ? "#4caf50" : (e.target.value ? "#e05050" : "#1e2d42");';
            html += '  renderSupOptions(e.target, e.target.value);';
            html += '});';
            html += 'document.addEventListener("click", function(e) {';
            html += '  var opt = e.target.closest && e.target.closest(".sup-opt");';
            html += '  if (opt) {';
            html += '    var dd = opt.parentElement;';
            html += '    var wrap = dd.parentElement;';
            html += '    var input = wrap.querySelector(".sup-combo");';
            html += '    var hid = document.getElementById(input.getAttribute("data-target-id"));';
            html += '    input.value = opt.getAttribute("data-name");';
            html += '    if (hid) hid.value = opt.getAttribute("data-id");';
            html += '    input.style.borderColor = "#4caf50";';
            html += '    dd.style.display = "none";';
            html += '    return;';
            html += '  }';
            html += '  if (!e.target.classList || !e.target.classList.contains("sup-combo")) {';
            html += '    document.querySelectorAll(".sup-dropdown").forEach(function(dd) { dd.style.display = "none"; });';
            html += '  }';
            html += '});';
      html += '<\\/script>';
      html += '</div></form>';
      res.send(page('Edit Quote', 'quotes', html));
    } catch (err) { console.error('Quote edit form error:', err); res.send(page('Edit Quote', 'quotes', '<div class="alert alert-error">' + err.message + '</div>')); }
  });

  // POST /admin/quotes/:id/edit-save — snapshot old version, update current, optionally email
  router.post('/quotes/:id/edit-save', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const b = req.body;
      const qid = parseInt(req.params.id);
      const qCur = await pool.request().input('id', sql.BigInt, qid).query('SELECT q.*, c.email, c.first_name+\' \'+c.last_name AS customer_name FROM quotes q JOIN customers c ON c.id=q.customer_id WHERE q.id=@id');
      if (!qCur.recordset.length) return res.redirect('/admin/quotes/' + qid + '?error=Quote+not+found');
      const q = qCur.recordset[0];
      if (q.status === 'Accepted') return res.redirect('/admin/quotes/' + qid + '?error=Cannot+edit+accepted+quote');

      // Snapshot current state before changes
      const linesBefore = await pool.request().input('qid', sql.BigInt, qid).query('SELECT * FROM quote_lines WHERE quote_id=@qid ORDER BY line_number');
      const srcsBefore = await pool.request().input('qid', sql.BigInt, qid).query('SELECT qls.* FROM quote_line_sources qls INNER JOIN quote_lines ql ON ql.id=qls.quote_line_id WHERE ql.quote_id=@qid');
      const snapshot = JSON.stringify({ quote: q, lines: linesBefore.recordset, sources: srcsBefore.recordset });

      const curVer = q.version || 1;
      await pool.request()
        .input('qid', sql.BigInt, qid)
        .input('ver', sql.Int, curVer)
        .input('snap', sql.NVarChar(sql.MAX), snapshot)
        .input('sub', sql.Decimal(12,2), q.subtotal || 0)
        .input('tot', sql.Decimal(12,2), q.total_amount || 0)
        .input('vu', sql.Date, q.valid_until)
        .input('by', sql.NVarChar(255), 'admin')
        .input('note', sql.NVarChar(sql.MAX), b.revision_note || null)
        .input('sent', sql.Bit, q.status === 'Sent' ? 1 : 0)
        .query('INSERT INTO quote_versions (quote_id, version, snapshot_json, subtotal, total, valid_until, revised_by, revision_note, email_sent) VALUES (@qid, @ver, @snap, @sub, @tot, @vu, @by, @note, @sent)');

      // Apply edits to quote header
      const newVer = curVer + 1;
      await pool.request()
        .input('id', sql.BigInt, qid)
        .input('ver', sql.Int, newVer)
        .input('vu', sql.Date, b.valid_until || q.valid_until)
        .input('pt', sql.NVarChar(100), b.payment_terms || q.payment_terms)
        .query("UPDATE quotes SET version=@ver, valid_until=@vu, payment_terms=@pt, status='Sent', rejected_at=NULL, rejection_reason=NULL, expired_at=NULL, updated_at=GETDATE() WHERE id=@id");

      // Apply line edits + recompute totals
      let newSubtotal = 0, newTotalCost = 0, newTotalMargin = 0;
      const editLines = b.lines || [];
      // SOURCES_FULL_EDIT_V1: collect submitted sources keyed by line id
      const _srcsByLine = {};
      Object.keys(b).forEach(function(k) {
        var m = k.match(/^line_(\d+)_src_(\d+)$/);
        if (!m) return;
        var lid = parseInt(m[1]);
        if (!_srcsByLine[lid]) _srcsByLine[lid] = [];
        var data = b[k];
        if (!data || typeof data !== 'object') return;
        _srcsByLine[lid].push({
          id: data.id ? parseInt(data.id) : null,
          supplier_id: data.supplier_id ? parseInt(data.supplier_id) : null,
          allocated_qty: data.allocated_qty ? parseInt(data.allocated_qty) : 0,
          unit_cost: data.unit_cost ? parseFloat(data.unit_cost) : 0,
          lead_time_text: data.lead_time_text || null,
          has_8130: data.has_8130 === '1' ? 1 : 0,
          has_coc: data.has_coc === '1' ? 1 : 0,
          has_trace: data.has_trace === '1' ? 1 : 0
        });
      });
      for (const ln of editLines) {
        const lid = parseInt(ln.id);
        const qty = parseInt(ln.quantity) || 0;
        var uc = parseFloat(ln.unit_cost) || 0;
        // SOURCES_FULL_EDIT_V1: recompute uc from sources if any submitted
        var _srcs = _srcsByLine[parseInt(ln.id)] || [];
        if (_srcs.length) {
          var totalQty = 0, totalCost = 0;
          _srcs.forEach(function(s2) { totalQty += s2.allocated_qty; totalCost += s2.allocated_qty * s2.unit_cost; });
          if (totalQty > 0) uc = totalCost / totalQty;
        }
        const up = parseFloat(ln.unit_price) || 0;
        const lineTotal = qty * up;
        const lineCost = qty * uc;
        const lineMargin = lineTotal - lineCost;
        const marginPct = up > 0 ? Math.min(999.99, Math.max(-999.99, (lineMargin / lineTotal) * 100)) : 0;
        const markupPct = uc > 0 ? Math.min(999.99, Math.max(-999.99, ((up - uc) / uc) * 100)) : 0;
        newSubtotal += lineTotal;
        newTotalCost += lineCost;
        newTotalMargin += lineMargin;
        await pool.request()
          .input('id', sql.BigInt, lid)
          .input('nsn', sql.NVarChar(20), ln.nsn || null)
          .input('pn', sql.NVarChar(100), ln.part_number || null)
          .input('iname', sql.NVarChar(255), ln.item_name || null)
          .input('cond', sql.NVarChar(5), ln.condition_code || null)
          .input('qty', sql.Int, qty)
          .input('uc', sql.Decimal(10,2), uc)
          .input('up', sql.Decimal(10,2), up)
          .input('lt', sql.Decimal(12,2), lineTotal)
          .input('lc', sql.Decimal(12,2), lineCost)
          .input('lm', sql.Decimal(12,2), lineMargin)
          .input('mpct', sql.Decimal(5,2), marginPct)
          .input('mkp', sql.Decimal(5,2), markupPct)
          .input('ltt', sql.NVarChar(100), ln.lead_time_text || null)
          .query('UPDATE quote_lines SET nsn=@nsn, part_number=@pn, item_name=@iname, condition_code=@cond, quantity=@qty, unit_cost=@uc, unit_price=@up, line_total=@lt, line_cost=@lc, line_margin=@lm, margin_pct=@mpct, markup_pct=@mkp, lead_time_text=@ltt WHERE id=@id');
        // SOURCES_FULL_EDIT_V1: rebuild quote_line_sources for this line
        await pool.request().input('qlid', sql.BigInt, parseInt(ln.id))
          .query('DELETE FROM quote_line_sources WHERE quote_line_id=@qlid');
        var _sortOrder = 1;
        for (const src of _srcs) {
          if (!src.supplier_id) continue;
          await pool.request()
            .input('qlid2', sql.BigInt, parseInt(ln.id))
            .input('sid', sql.BigInt, src.supplier_id)
            .input('aq', sql.Int, src.allocated_qty)
            .input('uc2', sql.Decimal(10,2), src.unit_cost)
            .input('ltt2', sql.NVarChar(sql.MAX), src.lead_time_text)
            .input('h81', sql.Bit, src.has_8130)
            .input('hcoc', sql.Bit, src.has_coc)
            .input('htr', sql.Bit, src.has_trace)
            .input('so', sql.Int, _sortOrder++)
            .query('INSERT INTO quote_line_sources (quote_line_id, supplier_id, allocated_qty, unit_cost, lead_time_text, has_8130, has_coc, has_trace, sort_order, is_selected) VALUES (@qlid2, @sid, @aq, @uc2, @ltt2, @h81, @hcoc, @htr, @so, 1)');
        }
      }
      await pool.request()
        .input('id', sql.BigInt, qid)
        .input('sub', sql.Decimal(12,2), newSubtotal)
        .input('tot', sql.Decimal(12,2), newSubtotal)
        .input('tc', sql.Decimal(12,2), newTotalCost)
        .input('tm', sql.Decimal(12,2), newTotalMargin)
        .query('UPDATE quotes SET subtotal=@sub, total_amount=@tot, total_cost=@tc, total_margin=@tm WHERE id=@id');

      // Send email if requested
      if (b.email_customer === '1') {
        try {
          const nodemailerMod = await import('nodemailer');
          const nodemailer = nodemailerMod.default;
          if (process.env.SMTP_HOST) {
            const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: parseInt(process.env.SMTP_PORT || '587'), auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
            const body = '<p>Hello ' + q.customer_name + ',</p><p>Your quote ' + q.quote_number + ' has been revised (version ' + newVer + '). Please review and let us know if you have any questions.</p><p>View: <a href="https://jupiteroneusa.com/quote/' + q.accept_token + '">https://jupiteroneusa.com/quote/' + q.accept_token + '</a></p><p>Thank you,<br/>Jupiter One USA</p>';
            await transport.sendMail({ from: process.env.ADMIN_EMAIL || 'DTorchia@jupiteroneusa.com', to: q.email, subject: 'Revised Quote ' + q.quote_number + ' (v' + newVer + ')', html: body });
          }
        } catch (mailErr) { console.error('Quote revise email error:', mailErr.message); }
      }
      res.redirect('/admin/quotes/' + qid + '?saved=1&new_version=' + newVer);
    } catch (err) { console.error('Quote edit-save error:', err); res.redirect('/admin/quotes/' + req.params.id + '?error=' + encodeURIComponent(err.message)); }
  });

  // Phase B3: Reissue an expired/rejected quote (extends valid_until, marks Sent again)
  router.post('/quotes/:id/reissue', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const days = parseInt(req.body.valid_days || 30);
      const newValid = new Date(Date.now() + days*24*60*60*1000);
      await pool.request()
        .input('id', sql.BigInt, req.params.id)
        .input('vu', sql.Date, newValid)
        .query("UPDATE quotes SET status='Sent', valid_until=@vu, expired_at=NULL, rejected_at=NULL, rejection_reason=NULL, reissued_count=ISNULL(reissued_count,0)+1, updated_at=GETDATE() WHERE id=@id");
      res.redirect('/admin/quotes/'+req.params.id+'?reissued=1');
    } catch(err) { res.redirect('/admin/quotes/'+req.params.id+'?error='+encodeURIComponent(err.message)); }
  });

  // Phase B3: Revise quote - mark old quote Superseded, redirect admin to new quote builder
  router.post('/quotes/:id/revise', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const qR = await pool.request().input('id', sql.BigInt, req.params.id).query('SELECT rfq_id FROM quotes WHERE id=@id');
      if (!qR.recordset.length) return res.redirect('/admin/quotes?error=Quote+not+found');
      const rfqId = qR.recordset[0].rfq_id;
      // Mark current quote as Superseded (keep history)
      await pool.request().input('id', sql.BigInt, req.params.id)
        .query("UPDATE quotes SET status='Superseded', updated_at=GETDATE() WHERE id=@id");
      // Redirect to existing requote flow on the RFQ
      res.redirect('/admin/rfqs/'+rfqId+'/quote-review');
    } catch(err) { res.redirect('/admin/quotes/'+req.params.id+'?error='+encodeURIComponent(err.message)); }
  });

  
  // Phase B3: Revise quote - mark old quote Superseded, redirect admin to new quote builder
  router.post('/quotes/:id/revise', async (req, res) => {
    if (!requireAuth(req, res)) return;
    try {
      const pool = await getPool();
      const qR = await pool.request().input('id', sql.BigInt, req.params.id).query('SELECT rfq_id FROM quotes WHERE id=@id');
      if (!qR.recordset.length) return res.redirect('/admin/quotes?error=Quote+not+found');
      const rfqId = qR.recordset[0].rfq_id;
      // Mark current quote as Superseded (keep history)
      await pool.request().input('id', sql.BigInt, req.params.id)
        .query("UPDATE quotes SET status='Superseded', updated_at=GETDATE() WHERE id=@id");
      // Redirect to existing requote flow on the RFQ
      res.redirect('/admin/rfqs/'+rfqId+'/quote-review');
    } catch(err) { res.redirect('/admin/quotes/'+req.params.id+'?error='+encodeURIComponent(err.message)); }
  });

  mountSupplierPoRoutes(router, requireAuth, page);
mountAdminDocRoutes(router, requireAuth);
  mountQuoteBuilder(router, requireAuth, page);
  return { admin: { options: { rootPath: '/admin' } }, adminRouter: router };
}
