// check-ccauth.cjs
const fs = require('fs');
const { execSync } = require('child_process');

const f = 'routes/ccAuth.js';
console.log('========== node -c check ==========');
try {
  execSync('node -c "' + f + '"', { stdio: 'pipe' });
  console.log('+ Syntax OK\n');
} catch (err) {
  console.log('! SYNTAX ERROR:');
  console.log(err.stderr ? err.stderr.toString() : err.message);
  process.exit(0);
}

console.log('========== Top 30 lines ==========');
const src = fs.readFileSync(f, 'utf8');
const lines = src.split('\n');
for (let i = 0; i < Math.min(30, lines.length); i++) {
  console.log((i+1).toString().padStart(3, ' ') + ': ' + lines[i]);
}

console.log('\n========== Last 30 lines ==========');
for (let i = Math.max(0, lines.length - 30); i < lines.length; i++) {
  console.log((i+1).toString().padStart(3, ' ') + ': ' + lines[i]);
}

console.log('\n========== Try to import it ==========');
// Actually try requiring (as ESM)
console.log('total file size: ' + src.length + ' chars, ' + lines.length + ' lines');
// Check for triple-backtick escape problems
const tripleBacktick = (src.match(/\\\\\\`/g) || []).length;
const normalBacktick = (src.match(/`/g) || []).length;
console.log('Escaped backticks (\\\\\\\\\\`): ' + tripleBacktick);
console.log('Regular backticks (`): ' + normalBacktick);

// Check for orphaned escape sequences
const badEscapes = src.match(/\\\\\\$\{/g);
if (badEscapes) console.log('! Found ' + badEscapes.length + ' instances of escaped \\\\${ which should be ${');
