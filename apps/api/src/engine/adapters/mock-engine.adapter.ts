import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs';
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
    return (
      engineKey === 'mock' ||
      engineKey === 'shot_render' ||
      engineKey === 'default_shot_render' ||
      engineKey === 'real_shot_render' ||
      engineKey === 'ce11_shot_generator_mock'
    );
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    // Mock 实现：直接返回成功，不执行实际逻辑
    // Stage 8: Enhanced Mock to return videoUrl for VIDEO_RENDER jobs
    const isVideoJob = input.jobType === 'VIDEO_RENDER';
    const isShotJob = input.jobType === 'SHOT_RENDER';
    const isCE11Job =
      input.jobType === 'CE11_SHOT_GENERATOR' || input.engineKey === 'ce11_shot_generator_mock';

    if (isCE11Job) {
      return {
        status: EngineInvokeStatus.SUCCESS,
        output: {
          shots: [
            {
              shot_type: 'MEDIUM_SHOT',
              camera_movement: 'STATIC',
              visual_prompt: 'Mock Shot 1: A scene from the novel',
              action_description: 'Character stands still',
              duration_sec: 3.0,
            },
            {
              shot_type: 'CLOSE_UP',
              camera_movement: 'ZOOM_IN',
              visual_prompt: 'Mock Shot 2: Detailed face',
              action_description: 'Character smiles',
              duration_sec: 3.0,
            },
          ],
          billing_usage: { model: 'mock-ce11', cost: 0 },
        },
      };
    }

    if (isShotJob) {
      // P13-1 Stub: Create dummy file for Worker Write-back
      // P13-1 FIX: Standardize repo root detection (same as LocalStorageService)
      const cwd = process.cwd();
      const hasApps = fs.existsSync(path.join(cwd, 'apps'));
      const hasPackages = fs.existsSync(path.join(cwd, 'packages'));

      let repoRoot = cwd;
      if (!hasApps || !hasPackages) {
        // If not at root, we're likely in apps/api
        repoRoot = path.resolve(cwd, '../..');
      }

      const storageRoot = path.join(repoRoot, '.data/storage');
      const relativePath = path.join('temp', 'gates', 'mock_shot_render.png');
      const absPath = path.join(storageRoot, relativePath);

      // Ensure directory exists
      if (!fs.existsSync(path.dirname(absPath))) {
        fs.mkdirSync(path.dirname(absPath), { recursive: true });
      }

      // Create a 256x256 violet PNG buffer to provide clear visual evidence.
      const violetPngHex =
        '89504e470d0a1a0a0000000d49484452000001000000010008030000005708892100000003504c54458a2be2d525420000000174524e53ff52d765e90000002f49444154789cedc101010000008220ffaf6e16fe010000000000000000000000000000000000000000000000000000002800018a381831cbb269980000000049454e44ae426082';
      const pngBuffer = Buffer.from(violetPngHex, 'hex');
      fs.writeFileSync(absPath, pngBuffer);

      return {
        status: EngineInvokeStatus.SUCCESS,
        output: {
          message: 'Mock Shot Render Success',
          asset: {
            uri: relativePath,
            type: 'image/png',
            sha256: 'mock-sha256-' + Date.now().toString(),
          },
        },
      };
    }

    return {
      status: EngineInvokeStatus.SUCCESS,
      output: {
        message: 'Mock engine executed successfully',
        jobType: input.jobType,
        // Mock Video URL (Public reliable test video)
        videoUrl: isVideoJob
          ? 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
          : undefined,
        storageKey: isVideoJob
          ? 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
          : undefined,
      },
    };
  }
}
