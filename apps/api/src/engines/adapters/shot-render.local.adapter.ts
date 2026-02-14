import { Injectable, Logger } from '@nestjs/common';
import { EngineAdapter, EngineInvokeInput, EngineInvokeResult } from '@scu/shared-types';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';

const execAsync = promisify(exec);
export class ShotRenderLocalAdapter implements EngineAdapter {
  public readonly name = 'shot_render_local';
  private readonly logger = new Logger(ShotRenderLocalAdapter.name);

  supports(engineKey: string): boolean {
    return (
      engineKey === 'shot_render' ||
      engineKey === 'default_shot_render' ||
      engineKey === 'real_shot_render' ||
      engineKey === 'http_shot_render'
    );
  }

  async invoke(input: EngineInvokeInput): Promise<EngineInvokeResult> {
    this.logger.log(
      `[ShotRenderLocal] REAL Invocation for ${input.engineKey} (JobType=${input.jobType})`
    );

    try {
      // P0-R0: Real-Sim (High Fidelity Local Render) - Hardened
      const shotId = (input.context?.shotId || input.payload?.shotId) as string;
      const traceId = (input.context?.traceId || input.payload?.traceId) as string;
      const projectId = input.payload.projectId;
      const sceneId = input.context?.sceneId;

      if (!projectId || !sceneId) {
        throw new Error(`[ShotRenderLocal] Missing Identity: projectId=${projectId}, sceneId=${sceneId}. Cannot persist asset safely.`);
      }

      const storageRoot = path.resolve(process.env.STORAGE_ROOT || '.data/storage');
      const outputDir = path.join(storageRoot, 'renders', projectId, 'scenes', sceneId);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Fix A: Stable output name to avoid ambiguity and path leakage
      // Named 'source.mp4' to avoid conflict with TimelineRender 'output.mp4'
      const outputFilename = 'source.mp4';
      const outputPath = path.join(outputDir, outputFilename);
      const absOutputPath = path.resolve(outputPath);

      const sourceImagePath = input.payload.sourceImagePath as string;
      if (!sourceImagePath || !fs.existsSync(sourceImagePath)) {
        throw new Error(`[ShotRenderLocal] Missing/Invalid sourceImagePath=${sourceImagePath}`);
      }

      this.logger.log(`[ShotRenderLocal] Rendering 2.5D Motion from: ${sourceImagePath}`);

      // Generate 2.5D Video (Zoom/Pan) from Image
      // -loop 1: Loop image input
      // vf: Scale to 1080p, Pad to fit, Zoompan for 5s (d=150 @ 30fps)
      // -b:v 6M: High Bitrate
      // Generate 2.5D Video (Zoom/Pan) from Image
      // Quality Pass: -crf 18 -preset slow for high-fidelity composition
      const ffmpegCmd = [
        `ffmpeg -hide_banner -y`,
        `-loop 1 -i "${sourceImagePath}"`,
        `-f lavfi -i "anullsrc=r=44100:cl=stereo"`,
        `-shortest`,
        `-vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,zoompan=z='min(zoom+0.0015,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=150:s=1920x1080:fps=30"`,
        `-t 5`,
        `-c:v libx264 -pix_fmt yuv420p -crf 18 -preset slow`,
        `-c:a aac -b:a 192k`,
        `"${absOutputPath}"`
      ].join(' ');

      this.logger.log(`[ShotRenderLocal] Executing FFmpeg: ${ffmpegCmd}`);

      await execAsync(ffmpegCmd, {
        maxBuffer: 1024 * 1024 * 10, // 10MB Buffer
        timeout: 60000 // 60s Timeout
      });

      this.logger.log(`[ShotRenderLocal] FFmpeg execution completed.`);

      // Validation 1: Size check
      const stats = fs.statSync(absOutputPath);
      if (stats.size < 10000) {
        throw new Error(`[ShotRenderLocal] Rendered video is too small (${stats.size} bytes). Likely corrupted.`);
      }

      // Validation 2: Black frame detection
      const blackDetectCmd = `ffmpeg -i "${absOutputPath}" -vf "blackdetect=d=0.1:pix_th=0.1" -f null - 2>&1`;
      const { stderr } = await execAsync(blackDetectCmd);
      if (stderr.includes('black_start:0') && stderr.includes('black_end:5')) {
        throw new Error(`[ShotRenderLocal] Black video detected! The entire output is black.`);
      }

      this.logger.log(`[ShotRenderLocal] Generated Asset Size: ${stats.size} bytes`);

      const storageKey = path.relative(storageRoot, absOutputPath);

      // Compute SHA256 for the generated file
      const fileBuffer = fs.readFileSync(absOutputPath);
      const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      const result = {
        render_meta: {
          model: 'local-ffmpeg-hifi',
          duration: 5,
          width: 1920,
          height: 1080
        },
        audit_trail: {},
        storageKey: storageKey,
        localPath: absOutputPath,
        sha256: sha256
      };

      // 增强审计轨迹以满足计费和 Gate 断言要求
      if (result.audit_trail) {
        (result.audit_trail as any).providerSelected =
          result.render_meta?.model || 'sdxl-turbo-local';
      }

      return {
        status: 'SUCCESS' as any,
        output: result,
      };
    } catch (error: any) {
      this.logger.error(`[ShotRenderLocal] REAL Invocation Failed: ${error.message}`);
      return {
        status: 'FAILED' as any,
        error: {
          code: 'SHOT_RENDER_REAL_FAILED',
          message: error.message,
        },
      };
    }
  }
}
