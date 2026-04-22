import * as fs from 'fs';
import * as path from 'path';
import { RenderResult, ShotRenderProvider } from './index';

export const localProvider: ShotRenderProvider = {
  key: 'local',
  async render(
    prompt: string,
    options: {
      width?: number;
      height?: number;
      seed?: number;
    } = {}
  ): Promise<RenderResult> {
    const width = options.width || 1024;
    const height = options.height || 1024;
    const seed = options.seed || 12345;

    // P1-HARD: placeholderPath and fallback PHYSICALLY REMOVED for Round 9.
    // Absolute truth required for local rendering. Asset missing = Fail.
    throw new Error('LOCAL_RENDER_TRUTH_VIOLATION: Required asset missing. No placeholder allowed.');
  },
};
