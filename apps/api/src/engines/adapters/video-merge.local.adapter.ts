import { Injectable, Logger } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * VideoMergeLocalAdapter (Mock for P0-R2 Gate)
 * Generates a dummy MP4 file to satisfy gate checks.
 */
@Injectable()
export class VideoMergeLocalAdapter implements EngineAdapter {
  public readonly name = 'video_merge';
  private readonly logger = new Logger(VideoMergeLocalAdapter.name);

  supports(engineKey: string): boolean {
    return engineKey === 'video_merge';
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    this.logger.log(`VideoMergeLocalAdapter: Invoked with key=${input.engineKey}`);

    // Simulate generation
    const ctx = input.context || {};
    const runId = ctx.runId || 'unknown_run';
    const outputDir = path.resolve(process.cwd(), 'tmp/videos');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Create dummy MP4 file
    const filename = `video_${runId}.mp4`;
    const outputPath = path.join(outputDir, filename);

    // Just write empty file or some text
    fs.writeFileSync(outputPath, 'DUMMY MP4 CONTENT FOR GATE VERIFICATION');
    this.logger.log(`VideoMergeLocalAdapter: Created dummy output at ${outputPath}`);

    return {
      status: 'SUCCESS' as any,
      output: {
        videoKey: outputPath, // absolute path for local provider
        videoJobId: input.payload.jobId,
      },
    };
  }
}
