// patch-font-embed-final.cjs
// Last-resort approach: download Roboto font from Google's font CDN ON YOUR
// MACHINE (your computer reaches the internet fine), bake it directly into
// poPdfService.js as a base64 @font-face. Chromium on Azure then reads the
// font from the HTML itself — zero runtime network dependency.

const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');

const TARGET = 'services/poPdfService.js';
const BACKUP = TARGET + '.font-embed.bak';

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('FONT_EMBED_BASE64_V1')) {
  console.log('- already embedded');
  process.exit(0);
}

// Fetch a font that doesn't 404 — Roboto Regular and Bold from gstatic
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return resolve(fetchUrl(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

// Get the CSS from Google Fonts (which contains font URLs) then fetch the woff2
async function getGoogleFont(family, weights) {
  const familyParam = family.replace(/ /g, '+') + ':wght@' + weights.join(';');
  const cssUrl = 'https://fonts.googleapis.com/css2?family=' + familyParam;
  const cssBuf = await new Promise((resolve, reject) => {
    https.get(cssUrl, {
      headers: {
        // pretend to be a modern browser so we get woff2 URLs
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
  });
  const css = cssBuf.toString('utf8');
  // Parse out url(...) from @font-face blocks paired with their font-weight
  const fontFaces = [];
  const blockRegex = /@font-face\s*\{([^}]+)\}/g;
  let m;
  while ((m = blockRegex.exec(css)) !== null) {
    const block = m[1];
    const weightM = block.match(/font-weight:\s*(\d+)/);
    const urlM = block.match(/url\((https:\/\/[^)]+\.woff2)\)/);
    if (weightM && urlM) {
      fontFaces.push({ weight: parseInt(weightM[1]), url: urlM[1] });
    }
  }
  // Dedup by weight (keep first occurrence — latin)
  const seen = {};
  const result = [];
  for (const f of fontFaces) {
    if (!seen[f.weight] && weights.includes(f.weight)) {
      seen[f.weight] = true;
      const buf = await fetchUrl(f.url);
      result.push({ weight: f.weight, b64: buf.toString('base64'), size: buf.length });
    }
  }
  return result;
}

async function run() {
  console.log('Fetching Roboto Regular + Bold from Google Fonts...');
  let fonts;
  try {
    fonts = await getGoogleFont('Roboto', [400, 700]);
  } catch (err) {
    console.error('! Font fetch failed:', err.message);
    console.error('  Check your internet connection.');
    process.exit(1);
  }
  if (fonts.length < 2) {
    console.error('! Could not fetch both weights, got: ' + fonts.length);
    process.exit(1);
  }
  fonts.forEach(f => console.log('+ Roboto ' + f.weight + ': ' + f.size + ' bytes (base64: ' + f.b64.length + ' chars)'));

  // Build @font-face CSS with embedded base64
  const fontCss =
    '/* FONT_EMBED_BASE64_V1 */ ' +
    fonts.map(f =>
      "@font-face { font-family: 'EmbedRoboto'; font-style: normal; font-weight: " + f.weight +
      "; src: url(data:font/woff2;base64," + f.b64 + ") format('woff2'); font-display: block; }"
    ).join(' ');

  // Replace the google fonts <link> tags with embedded @font-face
  const oldLink = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap">
<style>`;

  const newLink = '<style>' + fontCss + ' ';

  if (!src.includes(oldLink)) {
    console.error('! google fonts link anchor not found');
    process.exit(1);
  }
  src = src.replace(oldLink, function(){ return newLink; });

  // Update body font-family to use EmbedRoboto
  const oldBody = `body { font-family: 'Roboto', sans-serif; color: #1a1a1a;`;
  const newBody = `body { font-family: 'EmbedRoboto', 'Arial', sans-serif; color: #1a1a1a;`;
  if (!src.includes(oldBody)) {
    console.error('! body anchor not found');
    process.exit(1);
  }
  src = src.replace(oldBody, function(){ return newBody; });

  // Also fix any other Roboto refs in CSS to use EmbedRoboto
  src = src.replace(/font-family: 'Roboto'/g, "font-family: 'EmbedRoboto'");

  fs.writeFileSync(BACKUP, original);
  fs.writeFileSync(TARGET, src);
  try {
    execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
    const sizeKb = Math.round(fs.statSync(TARGET).size / 1024);
    console.log('+ Embedded ' + fonts.length + ' fonts as base64 in CSS');
    console.log('+ Body font-family: EmbedRoboto');
    console.log('+ File now ' + sizeKb + ' KB');
    console.log('+ Chromium reads font from HTML — zero runtime network calls');
    console.log('SUCCESS');
  } catch (err) {
    fs.writeFileSync(TARGET, original);
    console.error('! syntax error - REVERTED');
    console.error(err.message);
    process.exit(1);
  }
}

run().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
