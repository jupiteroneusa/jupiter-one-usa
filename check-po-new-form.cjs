// check-po-new-form.cjs
const fs = require('fs');

console.log('========== Searches for "supplier-pos/new" form fields ==========\n');

const files = [
  'admin/supplierPoRoutes.js',
  'admin/orderRoutes.js',
  'admin/index.js'
];

files.forEach(function(f) {
  if (!fs.existsSync(f)) return;
  const src = fs.readFileSync(f, 'utf8');
  const lines = src.split('\n');
  console.log('--- ' + f + ' ---');
  lines.forEach(function(line, i) {
    // Look for date-related inputs in the supplier-pos/new context
    if (line.includes('expected_delivery') || line.includes('inputField(\'Expected') || line.includes('inputField("Expected')) {
      console.log('  L' + (i+1) + ': ' + line.trim().substring(0, 160));
    }
  });
  console.log('');
});

console.log('\n========== inputField helper definition ==========\n');
if (fs.existsSync('admin/uiHelpers.js')) {
  const ui = fs.readFileSync('admin/uiHelpers.js', 'utf8');
  const lines = ui.split('\n');
  let inFn = false;
  let depth = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('inputField') && lines[i].includes('function')) {
      inFn = true;
    }
    if (inFn) {
      console.log('L' + (i+1) + ': ' + lines[i]);
      for (const c of lines[i]) {
        if (c === '{') depth++;
        if (c === '}') depth--;
      }
      if (depth === 0 && inFn && lines[i].includes('}')) break;
    }
  }
}

console.log('\n========== Live test (run separately) ==========');
console.log('# Hit the page and grep for type="date":');
console.log('curl -s -b cookies.txt https://jupiteroneusa.com/admin/supplier-pos/new?from_order=12 | findstr /C:"expected_delivery"');
