import { runShotRenderSDXL } from './sdxl.adapter';

async function test() {
  process.env.SHOT_RENDER_PROVIDER = 'replicate';
  delete process.env.REPLICATE_API_TOKEN;

  try {
    await runShotRenderSDXL({
      shotId: 'test',
      prompt: 'test',
      width: 1024,
      height: 1024,
      seed: 123,
      negative_prompt: 'bad quality',
      traceId: 'trace-1',
    });
    throw new Error('Expected missing token to throw');
  } catch (e: any) {
    if (!e.message.includes('SHOT_RENDER_NO_FALLBACK')) {
      throw e;
    }
  }

  process.env.SHOT_RENDER_PROVIDER = 'unknown_provider_xyz';
  try {
    await runShotRenderSDXL({
      shotId: 'test',
      prompt: 'test',
      width: 1024,
      height: 1024,
      seed: 123,
      negative_prompt: 'bad quality',
      traceId: 'trace-2',
    });
    throw new Error('Expected unknown provider to throw');
  } catch (e: any) {
    if (!e.message.includes('SHOT_RENDER_NO_FALLBACK')) {
      throw e;
    }
  }
}

test();
