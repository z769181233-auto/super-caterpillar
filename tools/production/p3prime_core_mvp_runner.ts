import * as path from 'path';

const args = process.argv.slice(2);
const get = (k: string, d?: string) => {
  const i = args.indexOf(k);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : d;
};

const mode = get('--mode', 'real') as 'real' | 'dev';
const evidenceDir = get('--evidenceDir');

if (!evidenceDir) {
  console.error(
    'Usage: pnpm ts-node tools/production/p3prime_core_mvp_runner.ts --evidenceDir <path> [--mode real|dev]'
  );
  process.exit(1);
}

const absoluteEvidenceDir = path.isAbsolute(evidenceDir)
  ? evidenceDir
  : path.join(process.cwd(), evidenceDir);

(async () => {
  console.log(`[Dispatcher] Starting Core MVP Runner in mode: ${mode}`);
  console.log(`[Dispatcher] Evidence Directory: ${absoluteEvidenceDir}`);

  if (mode === 'real') {
    // 动态加载真实运行器，确保静态分析时不包含 Mock
    const mod = await import('./p3prime_core_mvp_runner_real');
    await mod.runCoreMvpReal({ evidenceDir: absoluteEvidenceDir, args });
    return;
  }

  // Dev 模式仅限开发者显式调用
  const mod = await import('./p3prime_core_mvp_runner_dev');
  await mod.runCoreMvpDev({ evidenceDir: absoluteEvidenceDir, args });
})().catch((err) => {
  console.error('[Dispatcher] Critical Failure:', err);
  process.exit(1);
});
