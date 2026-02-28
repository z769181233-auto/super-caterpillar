import { execSync } from 'child_process';

console.log('Running E2E Seal Check...');

try {
    // Search for the reserved bypass token across the repository
    const output = execSync('grep -r -I -l "__E2E_MOCK_PASS__" . || true', { encoding: 'utf8', stdio: 'pipe' });
    const lines = output.split('\n').filter(Boolean);

    let hasLeak = false;
    let foundExpected = 0;

    for (const file of lines) {
        if (file.includes('.next') || file.includes('node_modules') || file.includes('tests-results')) continue;

        const normalized = file.replace(/^\.\//, '');

        const isMiddleware = normalized === 'src/middleware.ts';
        const isE2EScript = normalized.startsWith('scripts/e2e/');
        const isSelf = normalized === 'scripts/e2e-seal-check.mjs';

        if (isMiddleware || isE2EScript) {
            foundExpected++;
        }

        if (!isMiddleware && !isE2EScript && !isSelf) {
            console.error(`❌ [E2E SEAL VIOLATION] Found bypass token leak in production file: ${normalized}`);
            hasLeak = true;
        }
    }

    if (hasLeak) {
        process.exit(1);
    }

    if (foundExpected < 2) {
        console.warn('⚠️ [WARNING] E2E bypass token missing in either middleware or e2e scripts. The seal might drop.');
    }

    console.log('✅ E2E Bypass Mechanism is securely sealed and unreachable in production files.');
} catch (e) {
    console.error('❌ [E2E SEAL VIOLATION] Error executing seal check:', e);
    process.exit(1);
}
