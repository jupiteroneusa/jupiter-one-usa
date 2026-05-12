// patch-step9-6-sparticuz-chromium.cjs
// Swaps services/poPdfService.js Puppeteer import + launch over to
// @sparticuz/chromium + puppeteer-core, which is the standard fix for
// Azure App Service / serverless Linux where the default puppeteer Chrome
// download is missing libcairo / libnss / etc.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'services/poPdfService.js';
const BACKUP = TARGET + '.step9-6.bak';

if (!fs.existsSync(TARGET)) { console.error('! ' + TARGET + ' missing'); process.exit(1); }

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('@sparticuz/chromium')) {
  console.log('- already using @sparticuz/chromium');
  process.exit(0);
}

// 1) Swap the import
const oldImport = `import puppeteer from 'puppeteer';`;
const newImport = `import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';`;

if (!src.includes(oldImport)) {
  console.error('! puppeteer import anchor not found');
  process.exit(1);
}
src = src.replace(oldImport, function(){ return newImport; });

// 2) Swap the launch block
const oldLaunch = `  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-zygote',
      '--single-process'
    ]
  });`;

const newLaunch = `  // @sparticuz/chromium ships a Chrome build with the right shared libs for
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

if (!src.includes(oldLaunch)) {
  console.error('! launch anchor not found');
  console.error('  Make sure patch-step9-3 ran successfully first.');
  process.exit(1);
}
src = src.replace(oldLaunch, function(){ return newLaunch; });

// Write + verify syntax
fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);
try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ Import swapped to puppeteer-core + @sparticuz/chromium');
  console.log('+ Launch uses chromium.executablePath() — bundled Chrome');
  console.log('+ Azure-compatible: ships libcairo/libnss/etc');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! syntax error - REVERTED');
  console.error(err.message);
  process.exit(1);
}
