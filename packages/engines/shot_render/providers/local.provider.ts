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

    // Use a real dummy image that is definitely > 1000 bytes for ffmpeg

    // Resolve monorepo root
    const root = path.resolve(__dirname, '../../../../..');
    const dummyPath = path.join(
      root,
      'node_modules/.pnpm/prisma@5.22.0/node_modules/prisma/build/public/icon-1024.png'
    );

    let bytes: Buffer;
    if (fs.existsSync(dummyPath)) {
      bytes = fs.readFileSync(dummyPath);
    } else {
      // Fallback: minimal valid 1x1 black PNG (smaller than 1000, may fail VIDEO_RENDER)
      bytes = Buffer.from(
        '89504e470d0a1a0a0000000d49484452000000010000000108000000003a7e9b550000000a4944415408d76360000000020001e221bc330000000049454e44ae426082',
        'hex'
      );
    }

    return {
      bytes,
      mime: 'image/png',
      width,
      height,
      seed,
      model: 'local-mock',
      gpuSeconds: 0,
    };
  },
};
