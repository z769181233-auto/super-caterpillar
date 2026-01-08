import { ShotRenderInput, ShotRenderOutput } from '../types';
import { runShotRenderSDXL } from './sdxl.adapter';
import { runShotRenderFlux } from './flux.adapter';
import { shotRenderRealEngine as realStub } from '../real';

/**
 * P1-A: ShotRender Real Engine Selector
 * 协调不同渲染模型
 */
export async function shotRenderRealEngine(
  input: ShotRenderInput,
  ctx: any = {}
): Promise<ShotRenderOutput> {
  const model = ctx.model || 'sdxl';

  try {
    if (model === 'flux') {
      return await runShotRenderFlux(input, ctx);
    }
    // 默认 SDXL
    return await runShotRenderSDXL(input, ctx);
  } catch (e: any) {
    console.error(`[ShotRender] Model ${model} failed, falling back to Stub: ${e.message}`);
    return await realStub(input);
  }
}
