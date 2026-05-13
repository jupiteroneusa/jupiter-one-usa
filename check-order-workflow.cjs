// check-order-workflow.cjs
// Maps what's built for steps 7-12 on the admin order detail page.

const fs = require('fs');
const path = require('path');

console.log('========== ORDER STATUS VALUES IN USE ==========\n');
const src = fs.readFileSync('admin/orderRoutes.js', 'utf8');

// Pull all distinct status strings used in queries
const statusMatches = src.match(/status\s*=\s*'([A-Za-z ]+)'/g) || [];
const distinct = [...new Set(statusMatches.map(m => m.replace(/.*?'([^']+)'.*/, '$1')))];
console.log('Status values referenced in code:');
distinct.forEach(s => console.log('  - ' + s));

console.log('\n========== ORDER DETAIL TABS ==========\n');
// Find the GET /orders/:id route and pull the tab list
const detailIdx = src.indexOf("router.get('/orders/:id'");
if (detailIdx >= 0) {
  // Look for tabLink calls
  const tabMatches = src.slice(detailIdx, detailIdx + 8000).match(/tabLink\(['"]([^'"]+)['"],\s*['"]([^'"]+)['"]/g) || [];
  console.log('Tabs on order detail page:');
  tabMatches.forEach(m => console.log('  ' + m));
}

console.log('\n========== SHIPPING TAB CONTENTS ==========\n');
// Find renderShippingTab function
const renderIdx = src.indexOf('renderShippingTab');
if (renderIdx >= 0) {
  // Find function definition - look for "function renderShippingTab" or "const renderShippingTab"
  const fnIdx = src.indexOf('function renderShippingTab');
  if (fnIdx >= 0) {
    // Walk braces
    let depth = 0, started = false, end = -1;
    for (let i = fnIdx; i < src.length; i++) {
      if (src[i] === '{') { depth++; started = true; }
      else if (src[i] === '}') { depth--; if (started && depth === 0) { end = i + 1; break; } }
    }
    if (end > 0) {
      const fnBody = src.slice(fnIdx, end);
      console.log('renderShippingTab found (' + fnBody.length + ' chars). First 2000:');
      console.log(fnBody.slice(0, 2000));
      console.log('...[truncated]');
    }
  } else {
    console.log('renderShippingTab is called but not defined locally (probably in orderLinesBlock or similar)');
    // Search other files
    const files = ['admin/orderLinesBlock.js', 'admin/index.js', 'admin/orderShippingBlock.js'];
    for (const f of files) {
      if (fs.existsSync(f)) {
        const s = fs.readFileSync(f, 'utf8');
        if (s.includes('function renderShippingTab') || s.includes('renderShippingTab =')) {
          console.log('Found in ' + f);
          break;
        }
      }
    }
  }
}

console.log('\n========== SHIPMENTS TABLE SCHEMA QUERY ==========');
console.log(`
-- Run in SSMS:
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'shipments' ORDER BY ORDINAL_POSITION;

-- And:
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'orders' AND
      (COLUMN_NAME LIKE '%ship%' OR COLUMN_NAME LIKE '%track%'
       OR COLUMN_NAME LIKE '%deliver%' OR COLUMN_NAME LIKE '%paid%'
       OR COLUMN_NAME LIKE '%status%')
ORDER BY ORDINAL_POSITION;

-- Recent shipments:
SELECT TOP 5 * FROM shipments ORDER BY id DESC;
`);
