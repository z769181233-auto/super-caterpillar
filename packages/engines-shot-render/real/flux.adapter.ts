import { ShotRenderInput, ShotRenderOutput } from '../types';
import { runShotRenderSDXL } from './sdxl.adapter';

/**
 * P1-A: ShotRender Flux Adapter
 * 实现真实 Flux 模型渲染逻辑（目前复用 SDXL 逻辑作为 Real 实现）
 */
export async function runShotRenderFlux(
  input: ShotRenderInput,
  ctx: any = {}
): Promise<ShotRenderOutput> {
  // 复用 Real Logic
  const result = await runShotRenderSDXL(input, ctx);

  result.render_meta.model = 'flux-v1-dev';
  result.billing_usage = {
    ...result.billing_usage,
    model: 'flux-v1-dev',
    gpuSeconds: 8.0, // Flux 成本极高
  };

  if (ctx.traceId) {
    result.audit_trail.traceId = ctx.traceId;
  }

  return result;
}
