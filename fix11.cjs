const fs = require('fs');

// Fix api.js - show cart always + fix non-logged in nav
let a = fs.readFileSync('public/js/api.js', 'utf8');

// 1. Show RFQ cart in nav always (logged in or not)
a = a.replace(
  `    userArea.innerHTML = \`
      <a href="/pages/login.html" class="btn btn-outline btn-sm">Login</a>
      <a href="/pages/register.html" class="btn btn-primary btn-sm">Register</a>
    \`;`,
  `    userArea.innerHTML = \`
      <a href="/pages/rfq-cart.html" class="rfq-cart-btn" style="display:flex;">
        RFQ <span class="rfq-cart-count">\${cart.count()}</span>
      </a>
      <a href="/pages/login.html" class="btn btn-outline btn-sm">Login</a>
      <a href="/pages/register.html" class="btn btn-primary btn-sm">Register</a>
    \`;`
);

// 2. Fix toast to show View Cart link
a = a.replace(
  "t.textContent = `Added to RFQ (${cart.count()} items)`;",
  "t.innerHTML = `Added to RFQ (${cart.count()} items) &nbsp;·&nbsp; <a href='/pages/rfq-cart.html' style='color:var(--navy);font-weight:bold;text-decoration:underline;'>View Cart →</a>`;"
);

fs.writeFileSync('public/js/api.js', a);
console.log('api.js done');

// Fix contact.html - make message optional
let c = fs.readFileSync('public/pages/contact.html', 'utf8');
c = c.replace(
  '<label class="form-label">Message *</label>',
  '<label class="form-label">Message (optional)</label>'
);
c = c.replace(
  '<textarea class="form-textarea" id="c-message" style="height:130px;" placeholder="Describe your sourcing need or question..." required></textarea>',
  '<textarea class="form-textarea" id="c-message" style="height:130px;" placeholder="Describe your sourcing need or question..."></textarea>'
);
fs.writeFileSync('public/pages/contact.html', c);
console.log('contact.html done');

// Fix rfq-cart.html - remove login requirement, allow guest submit with name/email
let r = fs.readFileSync('public/pages/rfq-cart.html', 'utf8');

// Remove the login redirect - instead show name/email fields for guests
r = r.replace(
  `    const btn = document.getElementById('submit-rfq');
    btn.disabled = true; btn.textContent = 'Submitting...';

    try {
      const items = cart.get();
      const result = await api.submitRfq({`,
  `    if (!auth.isLoggedIn()) {
      // Guest - show name/email prompt
      const name = prompt('Your full name:');
      const email = prompt('Your email address:');
      if (!name || !email) { alert('Name and email are required to submit an RFQ.'); return; }
    }

    const btn = document.getElementById('submit-rfq');
    btn.disabled = true; btn.textContent = 'Submitting...';

    try {
      const items = cart.get();
      const result = await api.submitRfq({`
);

fs.writeFileSync('public/pages/rfq-cart.html', r);
console.log('rfq-cart.html done');