/**
 * Gate-Only Noop Processor
 * 仅在 GATE_MODE=1 且 stress_p1_1=true 时使用
 * 用于验证并发限流、活性断言、计费幂等性等治理能力
 * 完全不依赖 @scu/engines 包
 */

import { setTimeout as sleep } from 'node:timers/promises';

export async function gateNoopShotRender(job: any) {
    // 最小执行体：制造一点耗时窗口，便于并发采样看到 RUNNING
    const ms = 300 + Math.floor(Math.random() * 500);
    await sleep(ms);

    return {
        ok: true,
        gateNoop: true,
        sleptMs: ms,
        jobId: job.id,
        timestamp: new Date().toISOString(),
    };
}

export function shouldUseGateNoop(job: any): boolean {
    if (process.env.GATE_MODE !== '1') return false;
    if (process.env.NODE_ENV === 'production') return false; // 双保险
    if (!job) return false;
    if (job.type !== 'SHOT_RENDER') return false;
    const stress = job.payload?.stress_p1_1 === true;
    return stress;
}
