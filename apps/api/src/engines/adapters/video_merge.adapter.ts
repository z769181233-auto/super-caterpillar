import { Injectable, Logger } from '@nestjs/common';
import {
  EngineAdapter,
  EngineInvokeInput,
  EngineInvokeResult,
  EngineInvokeStatus,
} from '@scu/shared-types';
import { videoMergeRealEngine } from '../../../../../packages/engines/video_merge';

/**
 * CE02 -> VIDEO_RENDER (video_merge) Adapter
 * 真实集成：调用 FFmpeg 引擎产生视频。
 */
@Injectable()
export class VideoMergeLocalAdapter implements EngineAdapter {
  public readonly name = 'video_merge';
  private readonly logger = new Logger(VideoMergeLocalAdapter.name);

  supports(engineKey: string): boolean {
    return engineKey === 'video_merge';
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    this.logger.log(`Invoking VIDEO_RENDER Real Adapter for jobType=${input.jobType}`);

    try {
      // 转换通用输入为底层引擎输入
      const engineInput = {
        jobId: input.payload?.jobId || 'unknown',
        traceId: input.context?.traceId || 'unknown',
        framePaths: input.payload?.framePaths || [], // 如果没有，底层可能会 mock 或报错
        fps: input.payload?.fps || 24,
        width: input.payload?.width || 512,
        height: input.payload?.height || 512,
      };

      const output = await videoMergeRealEngine(engineInput, input.context);

      return {
        status: EngineInvokeStatus.SUCCESS,
        output,
        metrics: {
          usage: output.billing_usage,
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`VIDEO_RENDER Local execution failed: ${message}`);
      return {
        status: 'FAILED',
        error: {
          message,
          code: 'VIDEO_RENDER_LOCAL_ERR',
        },
      } as EngineInvokeResult;
    }
  }
}
