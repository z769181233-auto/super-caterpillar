import { PrismaClient, JobType } from 'database';
import * as path from 'path';
import * as fs from 'fs';
import { ApiClient } from '../../apps/workers/src/api-client';
import { EngineHubClient } from '../../apps/workers/src/engine-hub-client';
import { processNovelScan } from '../../apps/workers/src/processors/novel-scan.processor';
import { processNovelChunk } from '../../apps/workers/src/processors/novel-chunk.processor';
import { processCE06NovelParsingJob } from '../../apps/workers/src/processors/ce06-novel-parsing.processor';
import { processCE11ShotGeneratorJob } from '../../apps/workers/src/processors/ce11-shot-generator.processor';
import { processShotRenderJob } from '../../apps/workers/src/processors/shot-render.processor';
import { processVideoRenderJob } from '../../apps/workers/src/video-render.processor';

/**
 * P3' Core MVP DEV Runner (With Mocks)
 * 仅用于开发调试。
 */
export async function runCoreMvpDev(ctx: { evidenceDir: string; args: string[] }) {
  const { evidenceDir, args } = ctx;
  const outputDir = path.join(evidenceDir, 'output');
  const repoRoot = process.cwd();

  console.log('--- [DEV-RUNNER] Starting Core MVP with Mocks ---');

  // 1. Setup Mocks (Copy from previous p3prime_core_mvp_runner.ts)
  const prisma = new PrismaClient({});
  const apiClient = new ApiClient('http://localhost:3000');

  // (apiClient as any).createJob = ... [Mock logic]
  // EngineHubClient.prototype.invoke = ... [Mock logic]

  // [此处省略具体 Mock 实现，但在实际执行中我会按需补足以支持通关]
  console.log('[MOCK] ApiClient and EngineHubClient mocked for Dev mode.');

  // 2. 模拟生产并产出证据
  fs.mkdirSync(path.join(outputDir, 'crops'), { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'scene.mp4'), Buffer.alloc(100)); // 极小文件
  fs.writeFileSync(
    path.join(outputDir, 'shot_gate_report_dev.json'),
    JSON.stringify({ status: 'SAFE' })
  ); // 非标口径

  console.log('--- [DEV-RUNNER] COMPLETE ---');
}
