const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const candidates = [
    'dist/apps/workers/src/main.js',
    'dist/src/main.js',
    'dist/main.js'
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
const targetPath = path.join(__dirname, target);

// Prevent require.main === module checks from failing in the target script
// by spawning a true child process.
try {
    const inheritedNodeOptions = process.env.NODE_OPTIONS || '';
    const sanitizedNodeOptions = inheritedNodeOptions
        .replace(/(^|\s)-r\s+tsconfig-paths\/register(?=\s|$)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const childEnv = {
        ...process.env,
        IGNORE_ENV_FILE: process.env.IGNORE_ENV_FILE || 'true',
        GATE_MODE: process.env.GATE_MODE === '1' ? '0' : (process.env.GATE_MODE || '0'),
        NODE_OPTIONS: sanitizedNodeOptions,
    };
    cp.execFileSync('node', [targetPath], {
        stdio: 'inherit',
        env: childEnv,
    });
} catch (e) {
    process.exit(e.status || 1);
}
