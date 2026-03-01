import { ShotRenderInput, ShotRenderOutput } from './types';
import { shotRenderRealEngine } from './real';
import { shotRenderReplayEngine } from './replay';

export type Stage3EngineMode = 'REAL' | 'REPLAY';

export class ShotRenderSelector {
  async invoke(input: ShotRenderInput): Promise<ShotRenderOutput> {
    const mode = (process.env.STAGE3_ENGINE_MODE?.toUpperCase() || 'REAL') as Stage3EngineMode;

    if (mode === 'REPLAY') {
      return shotRenderReplayEngine(input);
    }
    return shotRenderRealEngine(input);
  }
}
