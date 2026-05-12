// po-diagnostic.cjs
// Run from project root: node po-diagnostic.cjs
// Output: prints everything Claude needs to know about PO state.

const fs = require('fs');
const path = require('path');

console.log('========== JUPITER ONE — PO DIAGNOSTIC ==========\n');

// ---------- 1. List relevant files ----------
console.log('--- 1. PO-related code files ---');
function scanDir(dir, depth = 0) {
  if (depth > 2) return;
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      scanDir(full, depth + 1);
    } else if (/\.(js|cjs|mjs)$/.test(e.name)) {
      // Search file for PO references
      try {
        const txt = fs.readFileSync(full, 'utf8');
        const hits = [];
        if (/purchase[_-]?order/i.test(txt)) hits.push('purchase_order');
        if (/\bsupplier_pos?\b/i.test(txt)) hits.push('supplier_pos');
        if (/\bPO[-_]2026\b/.test(txt)) hits.push('PO-2026');
        if (/supplier_po_lines/i.test(txt)) hits.push('supplier_po_lines');
        if (/order_line_sources/i.test(txt)) hits.push('order_line_sources');
        if (hits.length) {
          console.log(`  ${full}  [${hits.join(', ')}]`);
        }
      } catch {}
    }
  }
}
scanDir('admin');
scanDir('routes');
scanDir('services');
scanDir('db');

// ---------- 2. PO route handlers ----------
console.log('\n--- 2. PO route definitions (grep "router\\.(get|post)" with PO in path) ---');
function grepRoutes(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      grepRoutes(full);
    } else if (/\.(js|cjs|mjs)$/.test(e.name)) {
      try {
        const txt = fs.readFileSync(full, 'utf8');
        const lines = txt.split('\n');
        lines.forEach((line, i) => {
          if (/router\.(get|post|put|delete)/i.test(line) && /(po|purchase|supplier)/i.test(line)) {
            console.log(`  ${full}:${i+1}  ${line.trim().slice(0, 150)}`);
          }
        });
      } catch {}
    }
  }
}
grepRoutes('admin');
grepRoutes('routes');

// ---------- 3. PO detail page render — find the function ----------
console.log('\n--- 3. PO detail render function (look for renderPoDetail or /pos/:id GET handler) ---');
function findRenderFn(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      findRenderFn(full);
    } else if (/\.(js|cjs|mjs)$/.test(e.name)) {
      try {
        const txt = fs.readFileSync(full, 'utf8');
        const lines = txt.split('\n');
        lines.forEach((line, i) => {
          if (/(renderPo|poDetail|po_detail|PoDetail|\/pos\/)/i.test(line)) {
            console.log(`  ${full}:${i+1}  ${line.trim().slice(0, 150)}`);
          }
        });
      } catch {}
    }
  }
}
findRenderFn('admin');
findRenderFn('routes');

// ---------- 4. DB connect info ----------
console.log('\n--- 4. DB module path ---');
['db/connect.js', 'db/connect.cjs', 'db/index.js', 'db.js'].forEach(p => {
  if (fs.existsSync(p)) console.log(`  EXISTS: ${p}`);
});

// ---------- 5. Print the SQL queries Claude needs run ----------
console.log('\n========== RUN THESE SQL QUERIES IN SSMS ==========\n');
console.log(`-- Q1: Schema of purchase_orders / supplier_pos table
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('purchase_orders', 'supplier_pos', 'pos')
ORDER BY TABLE_NAME, ORDINAL_POSITION;

-- Q2: Schema of PO lines table (whichever exists)
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('purchase_order_lines', 'supplier_po_lines', 'po_lines')
ORDER BY TABLE_NAME, ORDINAL_POSITION;

-- Q3: Sample row from a real PO (PO-2026-00005 was confirmed working)
SELECT TOP 1 * FROM purchase_orders WHERE po_number LIKE 'PO-2026%' ORDER BY id DESC;
-- (if that table name doesn't exist, try supplier_pos)

-- Q4: Sample PO lines for that PO
SELECT TOP 5 * FROM purchase_order_lines WHERE purchase_order_id = (
  SELECT TOP 1 id FROM purchase_orders WHERE po_number LIKE 'PO-2026%' ORDER BY id DESC
);
-- (adjust table names if needed)

-- Q5: order_line_sources columns related to receiving
SELECT COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'order_line_sources'
  AND (COLUMN_NAME LIKE '%received%'
       OR COLUMN_NAME LIKE '%cert%'
       OR COLUMN_NAME LIKE '%8130%'
       OR COLUMN_NAME LIKE '%coc%'
       OR COLUMN_NAME LIKE '%trace%'
       OR COLUMN_NAME LIKE '%supplier_po%')
ORDER BY ORDINAL_POSITION;

-- Q6: Suppliers table columns (need to know email field name)
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'suppliers'
ORDER BY ORDINAL_POSITION;

-- Q7: Does a 'po_receipts' or 'receiving' table already exist?
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE '%receipt%' OR TABLE_NAME LIKE '%receiv%';

-- Q8: Does a 'documents' or 'attachments' table already exist?
SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME LIKE '%document%' OR TABLE_NAME LIKE '%attachment%' OR TABLE_NAME LIKE '%upload%';

-- Q9: Current PO status values in use
SELECT status, COUNT(*) AS cnt
FROM purchase_orders
GROUP BY status;
-- (or supplier_pos.status)

-- Q10: Numbering counter for POs
SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE '%PO%' OR setting_key LIKE '%po_seq%';
`);

console.log('\n========== END DIAGNOSTIC ==========');
