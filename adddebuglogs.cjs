const fs = require('fs');
let a = fs.readFileSync('admin/index.js', 'utf8');
const lines = a.split('\n');

// Find line 1177 (0-indexed 1176) - const linesRaw = req.body.lines || {};
const linesRawLine = lines.findIndex((l, i) => i >= 1175 && i <= 1182 && l.includes('const linesRaw = req.body.lines'));
console.log('linesRaw at line:', linesRawLine + 1);

if (linesRawLine > -1) {
  lines.splice(linesRawLine + 1, 0, 
    "      console.log('DEBUG body keys:', Object.keys(req.body));",
    "      console.log('DEBUG linesRaw:', JSON.stringify(linesRaw));",
    "      console.log('DEBUG linesArr length:', Object.values(linesRaw).length);"
  );
  console.log('Debug logs: ADDED');
}

fs.writeFileSync('admin/index.js', lines.join('\n'));
console.log('Done.');
