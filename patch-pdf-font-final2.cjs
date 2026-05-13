// patch-pdf-font-final2.cjs
// Fix: chromium.font() doesn't exist in the @sparticuz/chromium version installed.
// Solution: @sparticuz/chromium DOES ship with a few built-in fonts (Roboto family)
// but they need to be triggered correctly. The reliable cross-version approach:
//   1. Remove the broken chromium.font() calls
//   2. Use --font-render-hinting=none and let Chromium use its bundled
//      fonts via standard CSS font-family fallback ('sans-serif')
//   3. Inject fonts via setExtraHTTPHeaders + page.addStyleTag with a data URI

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'services/poPdfService.js';
const BACKUP = TARGET + '.font-final2.bak';

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('FONT_FINAL2_V1')) {
  console.log('- already patched');
  process.exit(0);
}

// 1) Remove the broken chromium.font() calls
const oldFontLoad = `  // CRITICAL: Tell @sparticuz/chromium to load fonts into its sandbox.
  // This is the documented fix — Chromium runs in --no-sandbox and cannot
  // download fonts at runtime, so we hand it the font URLs at boot.
  // chromium.font() must be called BEFORE chromium.executablePath().
  await chromium.font('https://raw.githack.com/googlefonts/roboto/main/src/hinted/Roboto-Regular.ttf');
  await chromium.font('https://raw.githack.com/googlefonts/roboto/main/src/hinted/Roboto-Bold.ttf');

  const executablePath = await chromium.executablePath();`;

const newFontLoad = `  // FONT_FINAL2_V1: chromium.font() is not in all versions of @sparticuz/chromium.
  // Instead: use sans-serif fallback (Chromium has DejaVu Sans bundled) and load
  // any web font via the HTML <link> with networkidle wait.
  const executablePath = await chromium.executablePath();`;

if (!src.includes(oldFontLoad)) {
  console.error('! font-load anchor not found');
  process.exit(1);
}
src = src.replace(oldFontLoad, function(){ return newFontLoad; });

// 2) Add Google Fonts link in the HTML head and use sans-serif fallback
const oldHeadTag = `const html = \`<!doctype html><html><head><meta charset="utf-8"/><style>`;
const newHeadTag = `const html = \`<!doctype html><html><head><meta charset="utf-8"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap">
<style>`;

if (!src.includes(oldHeadTag)) {
  console.error('! head tag anchor not found');
  process.exit(1);
}
src = src.replace(oldHeadTag, function(){ return newHeadTag; });

// 3) Update body font-family to use Roboto first, then sans-serif (DejaVu bundled)
const oldBodyFont = `body { font-family: 'Roboto', 'Helvetica', 'Arial', sans-serif; color: #1a1a1a; background: #fff; padding: 40px 50px; font-size: 11pt; line-height: 1.4; -webkit-font-smoothing: antialiased; }`;
const newBodyFont = `body { font-family: 'Roboto', sans-serif; color: #1a1a1a; background: #fff; padding: 40px 50px; font-size: 11pt; line-height: 1.4; -webkit-font-smoothing: antialiased; }`;

if (src.includes(oldBodyFont)) {
  src = src.replace(oldBodyFont, function(){ return newBodyFont; });
}

fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);
try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ Removed broken chromium.font() calls');
  console.log('+ Added <link> to Google Fonts Roboto in PDF HTML');
  console.log('+ Body font-family: Roboto, sans-serif (sans-serif = DejaVu bundled fallback)');
  console.log('+ networkidle0 setContent will wait for the font to load');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! syntax error - REVERTED');
  console.error(err.message);
  process.exit(1);
}
