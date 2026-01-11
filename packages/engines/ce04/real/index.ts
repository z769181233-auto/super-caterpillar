import { CE04Input, CE04Output } from '../types';
import { runCE04Gemini } from './gemini.adapter';
import { ce04RealEngine as realStub } from '../real';

/**
 * P1-A: CE04 Real Engine Selector
 * 协调真实模型适配器与旧 Stub
 */
export async function ce04RealEngine(input: CE04Input, ctx: any = {}): Promise<CE04Output> {
  // 默认执行 Gemini Adapter (P1 目标)
  // 如果 ctx 指定了其他路由信息，可以在此处扩展
  try {
    return await runCE04Gemini(input, ctx);
  } catch (e: any) {
    process.stdout.write(
      `[CE04] ERROR: Gemini Adapter failed, falling back to Stub: ${e.message}\n`
    );
    return await realStub(input);
  }
}
