import { ShotRenderInput, ShotRenderOutput } from './types';

export async function shotRenderReplayEngine(input: ShotRenderInput): Promise<ShotRenderOutput> {
  return {
    asset: {
      uri: '/fixtures/assets/replay_shot_001.png',
      mimeType: 'image/png',
      sizeBytes: 1024,
      sha256: 'mock_sha256_replay',
      width: 1024,
      height: 576,
    },
    render_meta: {
      model: 'mock-sdxl-replay',
      steps: 20,
      sampler: 'euler_a',
      cfg_scale: 7.0,
      seed: input.seed || 12345,
    },
    audit_trail: {
      engineKey: 'shot_render_replay',
      engineVersion: '1.0.0',
      timestamp: new Date().toISOString(),
      paramsHash: 'mock_params_hash',
    },
    billing_usage: {
      promptTokens: 50,
      completionTokens: 20, // Steps
      totalTokens: 70,
      model: 'mock-sdxl-replay',
      gpuSeconds: 0.5,
    },
  };
}
