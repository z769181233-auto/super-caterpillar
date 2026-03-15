const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const candidates = [
    'dist/main.js',
    'dist/src/main.js',
    'dist/apps/workers/src/main.js'
];

let target = null;
for (const c of candidates) {
    if (fs.existsSync(path.join(__dirname, c))) {
        target = c;
        break;
    }
}

if (!target) {
    console.error('[WORKER_BOOT] FATAL: Cannot find dist entry.');
    console.error('[WORKER_BOOT] Directory tree of dist/:');
    try {
        cp.execSync('ls -laR dist', { stdio: 'inherit' });
    } catch (e) {
        console.error('Failed to run ls -laR dist');
    }
    process.exit(1);
}

console.log(`[WORKER_BOOT] resolvedEntry=${target}`);
console.log(`[WORKER_BOOT] pid=${process.pid}`);

// Prevent require.main === module checks from failing in the target script
// by spawning a true child process.
try {
    cp.execSync('node -r tsconfig-paths/register ' + target, { stdio: 'inherit' });
} catch (e) {
    process.exit(e.status || 1);
}
