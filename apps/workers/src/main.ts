import * as util from 'util';

/**
 * Worker Bootstrap 入口
 * P1-1: 重构为纯路由，使用动态 import 避免静态依赖链触发 @scu/engines 解析
 */

async function boot() {
  if (process.env.WORKER_METRICS_PORT) {
    const { startMetricsServer } = await import('./metrics-server');
    startMetricsServer(parseInt(process.env.WORKER_METRICS_PORT, 10));
  }

  const isGate = process.env.GATE_MODE === '1';

  if (isGate) {
    if (process.env.NODE_ENV === 'production') {
      // Allow for Stage verification
      process.stdout.write(util.format('[Bootstrap] WARN: Running GATE_MODE in PRODUCTION environment') + '\n');
    }
    process.stdout.write(
      util.format('[Bootstrap] GATE_MODE detected, loading Gate Worker...') + '\n'
    );
    const mod = await import('./gate/gate-worker-app');
    await mod.startGateWorkerApp();
    return;
  }

  process.stdout.write(util.format('[Bootstrap] Normal mode, loading full Worker...') + '\n');

  const mod = await import('./worker-app');
  await mod.startWorkerApp();
}

boot().catch((err) => {
  // eslint-disable-next-line no-console
  process.stderr.write(util.format('[Bootstrap] Fatal error:', err) + '\n');
  process.exit(1);
});
