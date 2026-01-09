/**
 * Worker Bootstrap 入口
 * P1-1: 重构为纯路由，使用动态 import 避免静态依赖链触发 @scu/engines 解析
 */

async function boot() {
  const isGate = process.env.GATE_MODE === '1';

  if (isGate) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('GATE_MODE_REFUSED_IN_PRODUCTION');
    }
    console.log('[Bootstrap] GATE_MODE detected, loading Gate Worker...');
    const mod = await import('./gate/gate-worker-app');
    await mod.startGateWorkerApp();
    return;
  }

  console.log('[Bootstrap] Normal mode, loading full Worker...');
  const mod = await import('./worker-app');
  await mod.startWorkerApp();
}

boot().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[Bootstrap] Fatal error:', err);
  process.exit(1);
});
