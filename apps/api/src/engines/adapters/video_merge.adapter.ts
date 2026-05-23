import { Injectable, Logger } from '@nestjs/common';
import {
  EngineAdapter,
  EngineInvokeInput,
  EngineInvokeResult,
  EngineInvokeStatus,
} from '@scu/shared-types';
import { videoMergeRealEngine } from '@scu/engines-video-merge';

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

  private requireTraceId(value: unknown): string {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
    throw new Error('[VideoMergeLocal] Missing context.traceId');
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    this.logger.log(`Invoking VIDEO_RENDER Real Adapter for jobType=${input.jobType}`);

    try {
      const jobId =
        typeof input.payload?.jobId === 'string' && input.payload.jobId.trim().length > 0
          ? input.payload.jobId
          : null;
      const framePaths = Array.isArray(input.payload?.framePaths)
        ? input.payload.framePaths.filter(
            (value): value is string => typeof value === 'string' && value.trim().length > 0
          )
        : [];
      const fps = typeof input.payload?.fps === 'number' ? input.payload.fps : NaN;
      const width = typeof input.payload?.width === 'number' ? input.payload.width : NaN;
      const height = typeof input.payload?.height === 'number' ? input.payload.height : NaN;

      if (!jobId) {
        throw new Error('VIDEO_RENDER_JOB_ID_REQUIRED');
      }
      if (framePaths.length === 0) {
        throw new Error('VIDEO_RENDER_FRAME_PATHS_REQUIRED');
      }
      if (!Number.isFinite(fps) || fps <= 0) {
        throw new Error('VIDEO_RENDER_FPS_REQUIRED');
      }
      if (!Number.isFinite(width) || width <= 0 || !Number.isInteger(width)) {
        throw new Error('VIDEO_RENDER_WIDTH_REQUIRED');
      }
      if (!Number.isFinite(height) || height <= 0 || !Number.isInteger(height)) {
        throw new Error('VIDEO_RENDER_HEIGHT_REQUIRED');
      }

      // 转换通用输入为底层引擎输入
      const engineInput = {
        jobId,
        traceId: this.requireTraceId(input.context?.traceId),
        framePaths,
        fps,
        width,
        height,
      };

      const output = await videoMergeRealEngine(engineInput, input.context);

      return {
        status: EngineInvokeStatus.SUCCESS,
        output: output as unknown as Record<string, unknown>,
        metrics: {
          usage: output.billing_usage as Record<string, unknown>,
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
