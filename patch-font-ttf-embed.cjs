// patch-font-ttf-embed.cjs
// Replace embedded woff2 with embedded TTF. @sparticuz/chromium headless
// builds parse TTF data URIs reliably; woff2 sometimes silently fails.
// Source: jsdelivr CDN of the npm package `@fontsource/roboto` (raw TTF).

const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');

const TARGET = 'services/poPdfService.js';
const BACKUP = TARGET + '.ttf-embed.bak';

const original = fs.readFileSync(TARGET, 'utf8');
let src = original;

if (src.includes('FONT_TTF_V1')) {
  console.log('- TTF already embedded');
  process.exit(0);
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
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
    }).on('error', reject);
  });
}

async function run() {
  console.log('Fetching Roboto TTF files from jsdelivr...');

  // jsdelivr serves @fontsource/roboto npm package as static files
  const urls = {
    400: 'https://cdn.jsdelivr.net/npm/@fontsource/roboto@5.0.13/files/roboto-latin-400-normal.ttf',
    700: 'https://cdn.jsdelivr.net/npm/@fontsource/roboto@5.0.13/files/roboto-latin-700-normal.ttf'
  };

  const fonts = [];
  for (const weight of [400, 700]) {
    try {
      const buf = await fetchUrl(urls[weight]);
      if (buf.length < 10000) throw new Error('Suspicious size: ' + buf.length);
      fonts.push({ weight, b64: buf.toString('base64'), size: buf.length });
      console.log('+ Roboto ' + weight + ' TTF: ' + buf.length + ' bytes');
    } catch (err) {
      console.error('! Failed to fetch ' + weight + ': ' + err.message);
      process.exit(1);
    }
  }

  // Find the existing FONT_EMBED_BASE64_V1 block and replace it
  // The pattern is:  /* FONT_EMBED_BASE64_V1 */ @font-face {...} @font-face {...}
  // We'll replace from `/* FONT_EMBED_BASE64_V1 */` through the second `}` after it.

  const startMarker = '/* FONT_EMBED_BASE64_V1 */';
  const startIdx = src.indexOf(startMarker);
  if (startIdx < 0) {
    console.error('! could not find existing FONT_EMBED_BASE64_V1 marker');
    process.exit(1);
  }

  // Find the end of the @font-face block — count closing braces.
  // There are exactly 2 @font-face blocks. We need to consume both.
  let i = startIdx;
  let bracesFound = 0;
  let inBlock = false;
  let endIdx = -1;
  while (i < src.length) {
    const c = src[i];
    if (c === '{') inBlock = true;
    else if (c === '}' && inBlock) {
      bracesFound++;
      inBlock = false;
      if (bracesFound === 2) {
        endIdx = i + 1;
        break;
      }
    }
    i++;
  }

  if (endIdx < 0) {
    console.error('! could not find end of existing font-face block');
    process.exit(1);
  }

  // Build the new block
  const newFontCss =
    '/* FONT_TTF_V1 */ ' +
    fonts.map(f =>
      "@font-face { font-family: 'EmbedRoboto'; font-style: normal; font-weight: " + f.weight +
      "; src: url(data:font/truetype;charset=utf-8;base64," + f.b64 +
      ") format('truetype'); font-display: block; }"
    ).join(' ');

  const newSrc = src.slice(0, startIdx) + newFontCss + src.slice(endIdx);

  fs.writeFileSync(BACKUP, original);
  fs.writeFileSync(TARGET, newSrc);

  try {
    execSync('node -c "' + TARGET + '"', { stdio: 'pipe' });
    const sizeKb = Math.round(fs.statSync(TARGET).size / 1024);
    console.log('+ Replaced woff2 with TTF data URIs');
    console.log('+ font-display: block (forces use of embedded font, no fallback)');
    console.log('+ format("truetype") for Chromium compatibility');
    console.log('+ File now ' + sizeKb + ' KB');
    console.log('SUCCESS');
  } catch (err) {
    fs.writeFileSync(TARGET, original);
    console.error('! syntax error — REVERTED');
    console.error(err.message);
    process.exit(1);
  }
}

run().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
