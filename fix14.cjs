const fs = require('fs');
let c = fs.readFileSync('public/js/api.js', 'utf8');

const before = "    userArea.innerHTML = `\r\n      <a href=\"/pages/login.html\" class=\"btn btn-outline btn-sm\">Login</a>\r\n      <a href=\"/pages/register.html\" class=\"btn btn-primary btn-sm\">Register</a>\r\n    `;\r\n  }";

const after = "    userArea.innerHTML = `\r\n      <a href=\"/pages/rfq-cart.html\" class=\"rfq-cart-btn\">RFQ Cart <span class=\"rfq-cart-count\">${cart.count()}</span></a>\r\n      <a href=\"/pages/login.html\" class=\"btn btn-outline btn-sm\">Login</a>\r\n      <a href=\"/pages/register.html\" class=\"btn btn-primary btn-sm\">Register</a>\r\n    `;\r\n  }";

if (c.includes(before)) {
  c = c.replace(before, after);
  fs.writeFileSync('public/js/api.js', c);
  console.log('DONE');
} else {
  console.log('NOT FOUND');
}