// dump-shipping-block.cjs
const fs = require('fs');
const f = 'admin/orderShippingBlock.js';
if (fs.existsSync(f)) {
  console.log('========== ' + f + ' (FULL) ==========\n');
  console.log(fs.readFileSync(f, 'utf8'));
} else {
  console.log('file not found');
}
