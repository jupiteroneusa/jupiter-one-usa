// js/api.js
// Central API client — all fetch calls go through here

const BASE = '/api';

// ── Auth token storage ────────────────────────────────────────
export const auth = {
  getToken: () => localStorage.getItem('j1_token'),
  setToken: (t) => localStorage.setItem('j1_token', t),
  removeToken: () => localStorage.removeItem('j1_token'),
  getUser: () => JSON.parse(localStorage.getItem('j1_user') || 'null'),
  setUser: (u) => localStorage.setItem('j1_user', JSON.stringify(u)),
  removeUser: () => localStorage.removeItem('j1_user'),
  isLoggedIn: () => !!localStorage.getItem('j1_token'),
  logout: () => {
    localStorage.removeItem('j1_token');
    localStorage.removeItem('j1_user');
  },
};

// ── RFQ cart storage ──────────────────────────────────────────
export const cart = {
  get: () => JSON.parse(localStorage.getItem('j1_rfq_cart') || '[]'),
  set: (items) => localStorage.setItem('j1_rfq_cart', JSON.stringify(items)),
  add: (item) => {
    const items = cart.get();
    const existing = items.find(i => (i.nsn && i.nsn === item.nsn) || (i.part_number && i.part_number === item.part_number));
    if (existing) { existing.quantity = (existing.quantity || 1) + (item.quantity || 1); }
    else { items.push({ ...item, quantity: item.quantity || 1, condition_code: item.condition_code || 'NE' }); }
    cart.set(items);
    cart.updateBadge();
  },
  remove: (index) => {
    const items = cart.get();
    items.splice(index, 1);
    cart.set(items);
    cart.updateBadge();
  },
  clear: () => { localStorage.removeItem('j1_rfq_cart'); cart.updateBadge(); },
  count: () => cart.get().length,
  updateBadge: () => {
    const badges = document.querySelectorAll('.rfq-cart-count');
    badges.forEach(b => {
      const count = cart.count();
      b.textContent = count;
      b.parentElement.style.display = count > 0 ? 'flex' : 'flex';
    });
  },
};

// ── Core fetch helper ─────────────────────────────────────────
async function request(method, path, body = null, auth_required = false) {
  const headers = { 'Content-Type': 'application/json' };
  const token = auth.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(BASE + path, opts);

  if (res.status === 401) {
    auth.logout();
    window.location.href = '/pages/login.html?redirect=' + encodeURIComponent(window.location.pathname);
    return;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const get  = (path) => request('GET',    path);
const post = (path, body) => request('POST',   path, body);
const patch= (path, body) => request('PATCH',  path, body);
const del  = (path) => request('DELETE', path);

// ── API methods ───────────────────────────────────────────────
export const api = {
  // Auth
  register:       (data) => post('/auth/register', data),
  login:          (data) => post('/auth/login', data),
  logout:         ()     => post('/auth/logout'),
  me:             ()     => get('/auth/me'),
  forgotPassword: (data) => post('/auth/forgot-password', data),
  resetPassword:  (data) => post('/auth/reset-password', data),
  verifyEmail:    (token)=> get(`/auth/verify-email?token=${token}`),

  // Search
  search:    (q, type = 'nsn', limit = 25, offset = 0) =>
    get(`/search?q=${encodeURIComponent(q)}&type=${type}&limit=${limit}&offset=${offset}`),
  nsnDetail: (nsn) => get(`/search/nsn/${nsn}`),
  fsgList:   ()    => get('/search/fsg'),
  fscList:   (fsg) => get(`/search/fsc/${fsg}`),
  nsnClass:  (fsc, limit = 50, offset = 0) =>
    get(`/search/class/${fsc}?limit=${limit}&offset=${offset}`),

  // RFQ
  submitRfq:  (data) => post('/rfq', data),
  myRfqs:     ()     => get('/rfq'),
  rfqDetail:  (id)   => get(`/rfq/${id}`),

  // Quotes
  myQuotes:    ()    => get('/quotes'),
  quoteDetail: (id)  => get(`/quotes/${id}`),
  acceptQuote: (id)  => post(`/quotes/${id}/accept`),

  // Orders
  myOrders:    ()    => get('/orders'),
  orderDetail: (id)  => get(`/orders/${id}`),

  // Invoices
  myInvoices:  ()    => get('/invoices'),

  // Shipment
  shipmentDetail: (id) => get(`/shipments/${id}`),
};

// ── UI helpers ────────────────────────────────────────────────
export function showAlert(container, message, type = 'info') {
  const el = document.createElement('div');
  el.className = `alert alert-${type}`;
  el.textContent = message;
  container.prepend(el);
  setTimeout(() => el.remove(), 6000);
}

export function setLoading(btn, loading, text = 'Loading...') {
  if (loading) {
    btn._originalText = btn.textContent;
    btn.textContent = text;
    btn.disabled = true;
    btn.style.opacity = '0.7';
  } else {
    btn.textContent = btn._originalText || 'Submit';
    btn.disabled = false;
    btn.style.opacity = '1';
  }
}

export function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatMoney(v) {
  if (v === null || v === undefined) return '—';
  return '$' + parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function statusBadge(status) {
  const map = {
    'Submitted':    'blue',  'Under Review': 'blue',  'Sourcing': 'gold',
    'Quoted':       'gold',  'Closed':       'green', 'Cancelled': 'red',
    'Active':       'green', 'New':          'blue',  'Sent':      'blue',
    'Accepted':     'green', 'Rejected':     'red',   'Expired':   'gray',
    'Confirmed':    'green', 'Processing':   'blue',  'Shipped':   'gold',
    'Delivered':    'green', 'Paid':         'green', 'Unpaid':    'red',
    'Partially Paid':'gold', 'Overdue':      'red',   'Draft':     'gray',
    'Standard':     'gray',  'Urgent':       'gold',  'AOG':       'red',
  };
  const color = map[status] || 'gray';
  return `<span class="badge badge-${color}">${status}</span>`;
}

// ── Render nav based on login state ──────────────────────────
export function renderNav() {
  const userArea = document.getElementById('nav-user-area');
  if (!userArea) return;
  const user = auth.getUser();
  if (user) {
    userArea.innerHTML = `
      <a href="/pages/account.html" class="btn btn-outline btn-sm">Dashboard</a>
      <a href="/pages/rfq-cart.html" class="rfq-cart-btn">
        RFQ Cart <span class="rfq-cart-count">${cart.count()}</span>
      </a>
      <button class="btn btn-outline btn-sm" id="logout-btn">Logout</button>
    `;
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
      await api.logout().catch(() => {});
      auth.logout();
      window.location.href = '/';
    });
  } else {
    userArea.innerHTML = `
      <a href="/pages/rfq-cart.html" class="rfq-cart-btn">RFQ Cart <span class="rfq-cart-count">${cart.count()}</span></a>
      <a href="/pages/login.html" class="btn btn-outline btn-sm">Login</a>
      <a href="/pages/register.html" class="btn btn-primary btn-sm">Register</a>
    `;
  }
  cart.updateBadge();
}

// ── Scroll reveal ─────────────────────────────────────────────
export function initScrollReveal() {
  const observer = new IntersectionObserver(
    (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
    { threshold: 0.1 }
  );
  document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));
}

// ── Shared nav HTML ───────────────────────────────────────────
export function getNavHTML() {
  return `
  <div class="topbar">
    <span>Aerospace and Defense Component Supply</span>
    <div class="topbar-right">
      <a href="mailto:DTorchia@jupiteroneusa.com">DTorchia@jupiteroneusa.com</a>
      <a href="tel:+13478217412">+1 (347) 821-7412</a>
    </div>
  </div>
  <nav class="nav" id="main-nav">
    <a href="/" class="nav-logo">
      <div class="nav-logo-icon">J1</div>
      Jupiter One USA
    </a>
    <ul class="nav-links" id="nav-links">
      <li><a href="/" id="nav-home">Home</a></li>
      <li><a href="/pages/parts.html" id="nav-parts">Parts</a></li>
      <li><a href="/pages/about.html" id="nav-about">About</a></li>
      <li><a href="/pages/faq.html" id="nav-faq">FAQ</a></li>
      <li><a href="/pages/contact.html" id="nav-contact">Contact</a></li>
    </ul>
    <div style="display:flex;align-items:center;gap:12px;">
      <div id="nav-user-area" style="display:flex;align-items:center;gap:14px;"></div>
      <a href="/pages/contact.html" class="nav-cta">Request a Quote</a>
      <div class="nav-toggle" id="nav-toggle">
        <span></span><span></span><span></span>
      </div>
    </div>
  </nav>`;
}

export function getFooterHTML() {
  return `
  <footer class="footer">
    <div class="footer-grid">
      <div class="footer-brand">
        <a href="/" class="nav-logo" style="text-decoration:none;">
          <div class="nav-logo-icon">J1</div>
          Jupiter One USA LLC
        </a>
        <p>NSN and aerospace component supply. Fast responses, verified suppliers, clear communication from quote to delivery.</p>
      </div>
      <div class="footer-col">
        <h4>Navigation</h4>
        <ul>
          <li><a href="/">Home</a></li>
          <li><a href="/pages/parts.html">Parts Search</a></li>
          <li><a href="/pages/directory.html">Part Directory</a></li>
          <li><a href="/pages/about.html">About Us</a></li>
          <li><a href="/pages/contact.html">Contact</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Account</h4>
        <ul>
          <li><a href="/pages/login.html">Login</a></li>
          <li><a href="/pages/register.html">Register</a></li>
          <li><a href="/pages/account.html">My Account</a></li>
          <li><a href="/pages/rfq-cart.html">Pending RFQ</a></li>
          <li><a href="/pages/faq.html">FAQ</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Contact</h4>
        <ul>
          <li><a href="mailto:DTorchia@jupiteroneusa.com">DTorchia@jupiteroneusa.com</a></li>
          <li><a href="tel:+13478217412">+1 (347) 821-7412</a></li>
          <li><a href="#">400 N Tampa St, Suite 1550</a></li>
          <li><a href="#">Tampa, FL</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p>© ${new Date().getFullYear()} Jupiter One USA LLC. All rights reserved.</p>
      <p>NSN Sourcing · Aerospace Components · Defense Procurement</p>
    </div>
  </footer>`;
}

// ── Nav mobile toggle ─────────────────────────────────────────
export function initNavToggle() {
  const toggle = document.getElementById('nav-toggle');
  const links  = document.getElementById('nav-links');
  toggle?.addEventListener('click', () => links?.classList.toggle('open'));

  // Highlight active page
  const path = window.location.pathname;
  document.querySelectorAll('.nav-links a').forEach(a => {
    if (a.getAttribute('href') === path ||
        (path.includes(a.getAttribute('href')) && a.getAttribute('href') !== '/')) {
      a.classList.add('active');
    }
  });
}
