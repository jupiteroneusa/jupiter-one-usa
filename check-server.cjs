// check-server.cjs
const fs = require('fs');
const src = fs.readFileSync('server.js', 'utf8');

console.log('========== TOP OF server.js (first 80 lines) ==========\n');
const lines = src.split('\n');
for (let i = 0; i < Math.min(80, lines.length); i++) {
  console.log((i+1).toString().padStart(3, ' ') + ': ' + lines[i]);
}

console.log('\n\n========== AROUND CC_AUTH_MOUNT_V1 (10 lines context) ==========\n');
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('CC_AUTH_MOUNT_V1')) {
    const start = Math.max(0, i - 5);
    const end = Math.min(lines.length, i + 6);
    for (let j = start; j < end; j++) {
      console.log((j+1).toString().padStart(3, ' ') + ': ' + lines[j]);
    }
    console.log('---');
  }
}

console.log('\n========== Node syntax check ==========');
const { execSync } = require('child_process');
try {
  execSync('node -c server.js', { stdio: 'pipe' });
  console.log('+ Syntax OK locally (issue is runtime, not syntax)');
} catch (err) {
  console.log('! Local syntax error:');
  console.log(err.message);
}
