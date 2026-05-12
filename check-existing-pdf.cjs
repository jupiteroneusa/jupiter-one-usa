// check-existing-pdf.cjs
// Finds and dumps the existing invoice PDF service so we can match its patterns.

const fs = require('fs');
const path = require('path');

console.log('========== EXISTING PDF SERVICE FILES ==========\n');

const candidates = [
  'services/pdfService.js',
  'services/invoicePdfService.js',
  'services/invoiceService.js',
  'services/pdf.js',
  'services/puppeteer.js',
];

let found = [];
if (fs.existsSync('services')) {
  fs.readdirSync('services').forEach(f => {
    if (/pdf|invoice|puppet/i.test(f) && !f.endsWith('.bak')) {
      found.push(path.join('services', f));
    }
  });
}

console.log('Candidate files in services/:');
found.forEach(f => console.log('  - ' + f));
console.log('');

// Dump each
found.forEach(f => {
  console.log('\n========== ' + f + ' (FULL) ==========\n');
  try {
    console.log(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    console.log('ERROR reading: ' + e.message);
  }
});

// Also check package.json for puppeteer
console.log('\n========== package.json dependencies ==========\n');
try {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const allDeps = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {});
  const pdfRelated = Object.keys(allDeps).filter(k =>
    /puppet|chrome|playwright|pdf|nodemailer|mail/i.test(k)
  );
  pdfRelated.forEach(k => console.log('  ' + k + ': ' + allDeps[k]));
} catch (e) {
  console.log('package.json read error: ' + e.message);
}

// Check if there's a chromium executable path or skip-download env
console.log('\n========== .env (puppeteer-related vars only, redacted) ==========\n');
try {
  const env = fs.readFileSync('.env', 'utf8');
  env.split('\n').forEach(line => {
    if (/PUPPETEER|CHROMIUM|SMTP|MAIL|AZURE_STORAGE/i.test(line) && !line.startsWith('#')) {
      const idx = line.indexOf('=');
      if (idx > 0) {
        const k = line.slice(0, idx);
        const v = line.slice(idx + 1);
        // Redact passwords/keys
        if (/PASS|KEY|SECRET|TOKEN/i.test(k)) {
          console.log('  ' + k + '=<REDACTED ' + v.length + ' chars>');
        } else {
          console.log('  ' + k + '=' + v);
        }
      }
    }
  });
} catch (e) {
  console.log('  (no .env file found locally - that is fine, Azure has the env)');
}

// Grep for puppeteer.launch in any file
console.log('\n========== All puppeteer.launch() calls in the codebase ==========\n');
function grep(dir, depth = 0) {
  if (depth > 3 || !fs.existsSync(dir)) return;
  fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
    if (e.name.startsWith('.') || e.name === 'node_modules') return;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      grep(full, depth + 1);
    } else if (/\.(js|cjs|mjs)$/.test(e.name)) {
      try {
        const txt = fs.readFileSync(full, 'utf8');
        const lines = txt.split('\n');
        lines.forEach((line, i) => {
          if (line.includes('puppeteer.launch') || line.includes('chromium.launch')) {
            // Show 6 lines of context
            console.log('--- ' + full + ':' + (i + 1) + ' ---');
            for (let j = Math.max(0, i - 1); j < Math.min(lines.length, i + 6); j++) {
              console.log('  ' + lines[j]);
            }
            console.log('');
          }
        });
      } catch {}
    }
  });
}
grep('.');

console.log('\n========== END ==========');
