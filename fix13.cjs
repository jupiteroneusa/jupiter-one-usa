const fs = require('fs');
let c = fs.readFileSync('public/js/api.js', 'utf8');
c = c.replace(
  `      <a href="/pages/login.html" class="btn btn-outline btn-sm">Login</a>
      <a href="/pages/register.html" class="btn btn-primary btn-sm">Register</a>
    \`;`,
  `      <a href="/pages/rfq-cart.html" style="display:flex;align-items:center;gap:6px;border:1px solid #1e2d42;padding:6px 12px;font-family:monospace;font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:#7a8a9a;">RFQ <span class="rfq-cart-count" style="background:#c8932a;color:#0a1628;border-radius:50%;width:18px;height:18px;display:flex;align-items:center;justify-content:center;font-size:.62rem;font-weight:bold;">0</span></a>
      <a href="/pages/login.html" class="btn btn-outline btn-sm">Login</a>
      <a href="/pages/register.html" class="btn btn-primary btn-sm">Register</a>
    \`;`
);
fs.writeFileSync('public/js/api.js', c);
console.log('done - changed: ' + (c.includes('rfq-cart.html') ? 'YES' : 'NO'));