import { Injectable } from '@nestjs/common';
import {
  EngineAdapter,
  EngineInvokeInput,
  EngineInvokeResult,
  EngineInvokeStatus,
} from '@scu/shared-types';

/**
 * Mock Engine Adapter
 * 模拟引擎适配器（最小可用实现）
 * 注意：此适配器仅用于测试，不执行实际业务逻辑
 */
@Injectable()
export class MockEngineAdapter implements EngineAdapter {
  name = 'mock';

  supports(engineKey: string): boolean {
    return engineKey === 'mock';
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    // Mock 实现：直接返回成功，不执行实际逻辑
    // Stage 8: Enhanced Mock to return videoUrl for VIDEO_RENDER jobs
    const isVideoJob = input.jobType === 'VIDEO_RENDER' || input.jobType === 'SHOT_RENDER'; // Cover both just in case

    return {
      status: EngineInvokeStatus.SUCCESS,
      output: {
        message: 'Mock engine executed successfully',
        jobType: input.jobType,
        // Mock Video URL (Public reliable test video)
        videoUrl: isVideoJob ? 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4' : undefined,
        storageKey: isVideoJob ? 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4' : undefined,
      },
    };
  }
}

