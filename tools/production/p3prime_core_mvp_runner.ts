import * as path from 'path';
import { runCoreMvpDev } from './p3prime_core_mvp_runner_dev';
import { runCoreMvpReal } from './p3prime_core_mvp_runner_real';

const args = process.argv.slice(2);
const get = (key: string, def?: string) => {
  const idx = args.indexOf(key);
  return idx !== -1 ? args[idx + 1] : def;
};

const mode = get('--mode', 'real') as 'real' | 'dev';
const evidenceDir = get('--evidenceDir');

if (!evidenceDir) {
  console.error(
    'Usage: pnpm ts-node tools/production/p3prime_core_mvp_runner.ts --evidenceDir <path> [--mode real|dev]'
  );
  process.exit(1);
}

const absoluteEvidenceDir = path.resolve(process.cwd(), evidenceDir);

console.log(`[Dispatcher] Starting Core MVP Runner in mode: ${mode}`);
console.log(`[Dispatcher] Evidence Directory: ${absoluteEvidenceDir}`);

async function main() {
  try {
    if (mode === 'real') {
      await runCoreMvpReal({ evidenceDir: absoluteEvidenceDir, args });
    } else {
      await runCoreMvpDev({ evidenceDir: absoluteEvidenceDir, args });
    }
    console.log('[Dispatcher] Runner Finished Successfully.');
  } catch (err) {
    console.error('[Dispatcher] Critical Failure:', err);
    process.exit(1);
  }
}

main();
