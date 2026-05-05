const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');

// Add JSON body parsing to the quote POST route - convert JSON body to lines object
// Find the quote POST route handler start
const routeStart = "  router.post('/rfqs/:id/quote', async (req, res) => {";
const idx = a.indexOf(routeStart);
console.log('Quote POST route at:', idx);

// Find const linesRaw line and add JSON support
const oldLinesRaw = `      // Support both nested {lines:{0:{...}}} and flat body
      let linesRaw = req.body.lines || {};
      if (Object.keys(linesRaw).length === 0) {
        // Try to reconstruct from flat keys like lines[0][fulfillment_part]
        Object.keys(req.body).forEach(key => {
          const m = key.match(/^lines\\[(\\d+)\\]\\[(.+)\\]$/);
          if (m) {
            const idx = m[1], field = m[2];
            if (!linesRaw[idx]) linesRaw[idx] = {};
            linesRaw[idx][field] = req.body[key];
          }
        });
      }`;

// Check if our previous fix is there
if (a.includes(oldLinesRaw)) {
  console.log('Previous fix found - enhancing it');
  const newLinesRaw = `      // Support both nested {lines:{0:{...}}} and flat body
      let linesRaw = req.body.lines || {};
      console.log('RAW body lines type:', typeof req.body.lines, 'keys:', Object.keys(req.body).filter(k=>k.startsWith('lines')).slice(0,3));
      if (Object.keys(linesRaw).length === 0) {
        // Try to reconstruct from flat keys like lines[0][fulfillment_part]
        Object.keys(req.body).forEach(key => {
          const m = key.match(/^lines\\[(\\d+)\\]\\[(.+)\\]$/);
          if (m) {
            const i2 = m[1], field = m[2];
            if (!linesRaw[i2]) linesRaw[i2] = {};
            linesRaw[i2][field] = req.body[key];
          }
        });
        console.log('After flat parse, linesRaw keys:', Object.keys(linesRaw));
      } else {
        console.log('Nested parse worked, keys:', Object.keys(linesRaw));
      }`;
  a = a.replace(oldLinesRaw, newLinesRaw);
  console.log('Enhanced: OK');
}

// Also add JSON content-type handling to the route
const oldRouteStart = "  router.post('/rfqs/:id/quote', async (req, res) => {\n    if (!requireAuth(req, res)) return;\n    try {\n      const pool = await getPool();";
const newRouteStart = "  router.post('/rfqs/:id/quote', async (req, res) => {\n    if (!requireAuth(req, res)) return;\n    // Parse JSON body if sent as application/json\n    if (req.is('application/json') && req.body.linesJson) {\n      try { req.body.lines = JSON.parse(req.body.linesJson); } catch(e) {}\n    }\n    try {\n      const pool = await getPool();";

if (a.includes(oldRouteStart)) { a = a.replace(oldRouteStart, newRouteStart); console.log('JSON handler: ADDED'); }
else console.log('Route start not found for JSON handler');

fs.writeFileSync('admin/index.js', a);
console.log('Done.');
