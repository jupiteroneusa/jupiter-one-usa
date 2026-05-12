// patch-step9-3-harden-pdf-launch.cjs
// Aligns poPdfService.js Puppeteer launch flags with the proven-working
// services/nsnnow.js pattern. Adds --disable-dev-shm-usage and --disable-gpu
// which prevent Azure App Service crashes when generating PDFs.
//
// Also adds a SMTP_FROM fallback to use ADMIN_EMAIL (which exists in .env)
// instead of guessing. Updates supplierPoRoutes.js send handler.

const fs = require('fs');
const { execSync } = require('child_process');

// -------- 1) Harden poPdfService.js launch flags --------
const PDF = 'services/poPdfService.js';
if (!fs.existsSync(PDF)) { console.error('! ' + PDF + ' missing'); process.exit(1); }

let pdfSrc = fs.readFileSync(PDF, 'utf8');
const pdfBackup = pdfSrc;

if (pdfSrc.includes('--disable-dev-shm-usage')) {
  console.log('- poPdfService already hardened');
} else {
  const oldLaunch = `  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });`;

  const newLaunch = `  const browser = await puppeteer.launch({
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

  if (!pdfSrc.includes(oldLaunch)) {
    console.error('! launch anchor not found in poPdfService.js');
    process.exit(1);
  }
  pdfSrc = pdfSrc.replace(oldLaunch, function(){ return newLaunch; });

  fs.writeFileSync(PDF + '.step9-3.bak', pdfBackup);
  fs.writeFileSync(PDF, pdfSrc);
  try {
    execSync('node -c "' + PDF + '"', { stdio: 'pipe' });
    console.log('+ poPdfService.js: Azure-compatible launch flags');
  } catch (err) {
    fs.writeFileSync(PDF, pdfBackup);
    console.error('! poPdfService syntax error - REVERTED');
    process.exit(1);
  }
}

// -------- 2) Fix supplierPoRoutes mailer config to use known-good env vars --------
const ROUTES = 'admin/supplierPoRoutes.js';
let rSrc = fs.readFileSync(ROUTES, 'utf8');
const rBackup = rSrc;

if (rSrc.includes('STEP9_3_MAILER_FIX')) {
  console.log('- supplierPoRoutes mailer already aligned');
  process.exit(0);
}

const oldMailer = `      // Build mailer
      const smtpUser = process.env.SMTP_USER || process.env.MAIL_USER;
      const smtpPass = process.env.SMTP_PASS || process.env.MAIL_PASS;
      const smtpHost = process.env.SMTP_HOST || process.env.MAIL_HOST || 'smtp.office365.com';
      const smtpPort = parseInt(process.env.SMTP_PORT || process.env.MAIL_PORT || '587');
      const fromAddr = process.env.SMTP_FROM || process.env.MAIL_FROM || smtpUser || 'DTorchia@JupiterOneUSA.com';

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
      });`;

const newMailer = `      // STEP9_3_MAILER_FIX: use env vars known to exist in production (SendGrid via .env)
      const smtpHost = process.env.SMTP_HOST || 'smtp.sendgrid.net';
      const smtpPort = parseInt(process.env.SMTP_PORT || '587');
      const smtpUser = process.env.SMTP_USER || 'apikey';
      const smtpPass = process.env.SMTP_PASS;
      // SendGrid requires a verified sender. ADMIN_EMAIL is the verified one.
      const fromAddr = process.env.ADMIN_EMAIL || process.env.RFQ_NOTIFY_EMAIL || 'DTorchia@jupiteroneusa.com';

      if (!smtpPass) {
        throw new Error('SMTP_PASS not configured in environment');
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });`;

if (!rSrc.includes(oldMailer)) {
  console.error('! mailer anchor not found in supplierPoRoutes.js');
  process.exit(1);
}
rSrc = rSrc.replace(oldMailer, function(){ return newMailer; });

// Also fix the from-name to be more professional
const oldFromLine = `        from: fromAddr,`;
const newFromLine = `        from: '"Derek Torchia - Jupiter One USA" <' + fromAddr + '>',`;
// Only replace ONE occurrence (the one in /send handler)
if (rSrc.includes(oldFromLine)) {
  rSrc = rSrc.replace(oldFromLine, function(){ return newFromLine; });
  console.log('+ supplierPoRoutes: From line uses display name');
}

fs.writeFileSync(ROUTES + '.step9-3.bak', rBackup);
fs.writeFileSync(ROUTES, rSrc);
try {
  execSync('node -c "' + ROUTES + '"', { stdio: 'pipe' });
  console.log('+ supplierPoRoutes: mailer uses SendGrid env vars from .env');
  console.log('+ supplierPoRoutes: from addr uses verified ADMIN_EMAIL');
  console.log('+ supplierPoRoutes: throws clear error if SMTP_PASS missing');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(ROUTES, rBackup);
  console.error('! supplierPoRoutes syntax error - REVERTED');
  console.error(err.message);
  process.exit(1);
}
