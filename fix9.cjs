const fs = require('fs');

// Fix 1: Remove COD from rfq-cart.html
let c = fs.readFileSync('public/pages/rfq-cart.html', 'utf8');
c = c.replace('Credit Card, COD, or Wire Transfer', 'Credit Card or Wire Transfer');
fs.writeFileSync('public/pages/rfq-cart.html', c);
console.log('rfq-cart done');

// Fix 2: After adding to RFQ toast, add View Cart button in api.js
let a = fs.readFileSync('public/js/api.js', 'utf8');
a = a.replace(
  "t.textContent = `Added to RFQ (${cart.count()} items)`;",
  "t.innerHTML = `Added to RFQ (${cart.count()} items) &nbsp;·&nbsp; <a href='/pages/rfq-cart.html' style='color:var(--navy);text-decoration:underline;font-weight:bold;'>View Cart →</a>`;"
);
fs.writeFileSync('public/js/api.js', a);
console.log('api.js done');

// Fix 3: Show cart in nav always
let n = fs.readFileSync('public/js/api.js', 'utf8');
n = n.replace(
  `userArea.innerHTML = \`
      <a href="/pages/login.html" class="btn btn-outline btn-sm">Login</a>
      <a href="/pages/register.html" class="btn btn-primary btn-sm">Register</a>
    \`;`,
  `userArea.innerHTML = \`
      <a href="/pages/rfq-cart.html" class="rfq-cart-btn" style="display:flex;">
        RFQ Cart <span class="rfq-cart-count">\${cart.count()}</span>
      </a>
      <a href="/pages/login.html" class="btn btn-outline btn-sm">Login</a>
      <a href="/pages/register.html" class="btn btn-primary btn-sm">Register</a>
    \`;`
);
fs.writeFileSync('public/js/api.js', n);
console.log('nav done');