// patch-step9-10-embed-font.cjs
// 1) Embed Inter font as base64 data: URL — no network round trip from Chromium.
//    This is the bulletproof fix for "fonts not loading" on @sparticuz/chromium.
// 2) Add launch retry on ETXTBSY (transient Linux file lock when two Chromes
//    launch back-to-back on a small Azure plan).

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'services/poPdfService.js';
const BACKUP = TARGET + '.step9-10.bak';

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('EMBED_FONT_V1')) {
  console.log('- font already embedded');
  process.exit(0);
}

// ============================================================
// Use Liberation Sans (a system-installable open font) via google fonts
// NO — embed instead. We'll fetch the woff2 from Google at PATCH time and
// inline it as base64. This makes the patch larger but PDF rendering is
// network-independent at runtime.
//
// Strategy: write a small helper that fetches the font once locally,
// reads it as base64, and bakes it into the source.
// To keep the patcher portable on Windows, we use Node's https module.
// ============================================================

async function fetchFont() {
  return new Promise((resolve, reject) => {
    const https = require('https');
    // Direct URL to Inter regular (400) woff2 — Google Fonts static CDN
    // This URL is stable; if it breaks we can fall back to another source.
    const url = 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2';
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error('Font fetch failed: HTTP ' + res.statusCode));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function fetchFontBold() {
  return new Promise((resolve, reject) => {
    const https = require('https');
    // Inter 700 (bold)
    const url = 'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMa05L7.woff2';
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error('Font fetch failed: HTTP ' + res.statusCode));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function run() {
  console.log('Fetching Inter font files...');
  const regularBuf = await fetchFont();
  console.log('+ Inter regular: ' + regularBuf.length + ' bytes');
  const boldBuf = await fetchFontBold();
  console.log('+ Inter bold:    ' + boldBuf.length + ' bytes');

  const regularB64 = regularBuf.toString('base64');
  const boldB64 = boldBuf.toString('base64');

  // Build the @font-face CSS block with embedded fonts
  const fontFaceCss = '/* EMBED_FONT_V1 */\\n' +
    "@font-face { font-family: 'InterEmbed'; font-style: normal; font-weight: 400; " +
    "src: url(data:font/woff2;base64," + regularB64 + ") format('woff2'); font-display: block; }\\n" +
    "@font-face { font-family: 'InterEmbed'; font-style: normal; font-weight: 700; " +
    "src: url(data:font/woff2;base64," + boldB64 + ") format('woff2'); font-display: block; }\\n";

  // 1) Remove the old google fonts <link> tags (they're not working on Azure)
  const oldLinks = `<!-- PDF_FONTS_FIX_V1: Load web font; @sparticuz Chrome has no system fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<style>`;

  if (!src.includes(oldLinks)) {
    console.error('! google fonts <link> anchor not found');
    process.exit(1);
  }
  src = src.replace(oldLinks, function(){ return '<style>' + fontFaceCss; });

  // 2) Swap body font-family to use InterEmbed
  const oldBodyFont = `body { font-family: "Inter", Helvetica, Arial, sans-serif; color: #1a1a1a;`;
  const newBodyFont = `body { font-family: "InterEmbed", Helvetica, Arial, sans-serif; color: #1a1a1a;`;
  if (!src.includes(oldBodyFont)) {
    console.error('! body font anchor not found');
    process.exit(1);
  }
  src = src.replace(oldBodyFont, function(){ return newBodyFont; });

  // 3) Wrap launch with retry on ETXTBSY
  const oldLaunch = `  // @sparticuz/chromium ships a Chrome build with the right shared libs for
  // Azure App Service Linux. executablePath() resolves it on first call.
  const executablePath = await chromium.executablePath();
  const browser = await puppeteer.launch({
    args: [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process'
    ],
    defaultViewport: chromium.defaultViewport,
    executablePath: executablePath,
    headless: chromium.headless,
  });`;

  const newLaunch = `  // @sparticuz/chromium ships a Chrome build with the right shared libs for
  // Azure App Service Linux. executablePath() resolves it on first call.
  const executablePath = await chromium.executablePath();
  // Retry launch up to 3 times on ETXTBSY (transient file lock on Azure
  // when two Chromes spawn back-to-back).
  let browser;
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      browser = await puppeteer.launch({
        args: [
          ...chromium.args,
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process'
        ],
        defaultViewport: chromium.defaultViewport,
        executablePath: executablePath,
        headless: chromium.headless,
      });
      break;
    } catch (err) {
      lastErr = err;
      if (err.code === 'ETXTBSY' || /ETXTBSY|spawn/i.test(err.message)) {
        console.warn('[poPdf] Launch attempt ' + attempt + '/3 failed (ETXTBSY); retrying in 1s...');
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      throw err;
    }
  }
  if (!browser) throw lastErr || new Error('Chromium launch failed after 3 attempts');`;

  if (!src.includes(oldLaunch)) {
    console.error('! launch anchor not found');
    process.exit(1);
  }
  src = src.replace(oldLaunch, function(){ return newLaunch; });

  fs.writeFileSync(BACKUP, original);
  fs.writeFileSync(TARGET, src);
  try {
    execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
    console.log('+ Inter font embedded as base64 in CSS (' + (regularB64.length + boldB64.length) + ' chars)');
    console.log('+ Body font-family: InterEmbed');
    console.log('+ Launch retries up to 3x on ETXTBSY');
    console.log('+ File size: ' + Math.round(fs.statSync(TARGET).size / 1024) + ' KB (was ~10 KB)');
    console.log('SUCCESS');
  } catch (err) {
    fs.writeFileSync(TARGET, original);
    console.error('! syntax error - REVERTED');
    console.error(err.message);
    process.exit(1);
  }
}

run().catch(err => {
  console.error('PATCH FAILED:', err.message);
  process.exit(1);
});
