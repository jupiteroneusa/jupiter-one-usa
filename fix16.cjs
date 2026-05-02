const fs = require('fs');
let c = fs.readFileSync('public/pages/login.html', 'utf8');

c = c.replace(
  "if (auth.isLoggedIn()) window.location.href = '/pages/account.html';",
  `if (auth.isLoggedIn()) window.location.href = '/pages/account.html';
const params = new URLSearchParams(window.location.search);
if (params.get('redirect') && params.get('redirect').includes('rfq-cart')) {
  document.querySelector('.auth-sub').textContent = 'Login or create a free account to submit your RFQ. Your cart will be saved.';
  document.querySelector('.auth-title').textContent = 'Almost There!';
}`
);

fs.writeFileSync('public/pages/login.html', c);
console.log('done');