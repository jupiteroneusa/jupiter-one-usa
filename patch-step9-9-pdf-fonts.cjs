// patch-step9-9-pdf-fonts.cjs
// Two fixes for blank-text PDF on @sparticuz/chromium:
//   1. Inject Google Fonts <link> in the PDF HTML head — sparticuz Chrome has
//      no system fonts, so the body's font-family: Helvetica, Arial falls back
//      to a missing-glyph empty font.
//   2. After setContent, wait for document.fonts.ready before calling pdf()
//      so the font is actually loaded when render fires.
//   3. Set the page DPI properly so coordinates compute correctly.

const fs = require('fs');
const { execSync } = require('child_process');

const TARGET = 'services/poPdfService.js';
const BACKUP = TARGET + '.step9-9.bak';

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('PDF_FONTS_FIX_V1')) {
  console.log('- PDF fonts fix already applied');
  process.exit(0);
}

// 1) Add Google Font link in <head> before <style>
const oldHead = `const html = \`<!doctype html><html><head><meta charset="utf-8"/><style>`;
const newHead = `const html = \`<!doctype html><html><head><meta charset="utf-8"/>
<!-- PDF_FONTS_FIX_V1: Load web font; @sparticuz Chrome has no system fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
<style>`;

if (!src.includes(oldHead)) { console.error('! head anchor not found'); process.exit(1); }
src = src.replace(oldHead, function(){ return newHead; });

// 2) Swap body font-family to use Inter as primary
const oldBodyFont = `body { font-family: Helvetica, Arial, sans-serif; color: #1a1a1a;`;
const newBodyFont = `body { font-family: "Inter", Helvetica, Arial, sans-serif; color: #1a1a1a;`;

if (!src.includes(oldBodyFont)) { console.error('! body font anchor not found'); process.exit(1); }
src = src.replace(oldBodyFont, function(){ return newBodyFont; });

// 3) Wait for fonts after setContent, before pdf()
const oldRender = `    const pageP = await browser.newPage();
    await pageP.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await pageP.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });`;

const newRender = `    const pageP = await browser.newPage();
    await pageP.setViewport({ width: 816, height: 1056, deviceScaleFactor: 2 });
    await pageP.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    // Wait for web fonts to actually load before rendering
    await pageP.evaluate(() => document.fonts && document.fonts.ready);
    // Extra paint cycle insurance
    await new Promise(r => setTimeout(r, 500));
    const pdfBuffer = await pageP.pdf({
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });`;

if (!src.includes(oldRender)) { console.error('! render anchor not found'); process.exit(1); }
src = src.replace(oldRender, function(){ return newRender; });

fs.writeFileSync(BACKUP, original);
fs.writeFileSync(TARGET, src);
try {
  execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
  console.log('+ Inter web font preloaded in PDF HTML head');
  console.log('+ Body font-family: Inter, then Helvetica/Arial fallback');
  console.log('+ await document.fonts.ready before pdf()');
  console.log('+ 500ms paint cycle buffer');
  console.log('+ deviceScaleFactor 2 for crisp text');
  console.log('SUCCESS');
} catch (err) {
  fs.writeFileSync(TARGET, original);
  console.error('! syntax error - REVERTED');
  console.error(err.message);
  process.exit(1);
}
