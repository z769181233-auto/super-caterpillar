import { PrismaClient } from 'database';
import * as path from 'path';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import { ProcessorContext } from '../types/processor-context';
import { fileExists } from '../../../../packages/shared/fs_async';
import { basicTextSegmentation } from '../novel-analysis-processor';
import { hydrateShotWithDirectorControls } from '../v3/utils/shot_field_extractor';
import { ensureDefaultMetrics, stage4JobsTotal, stage4FailedJobs, stage4DurationSeconds, stage4PeakRssMb } from '../observability/stage4.metrics';

export async function processNovelChunk(context: ProcessorContext) {
  ensureDefaultMetrics();
  const t0 = Date.now();
  let peakRssMb = 0;

  function sampleRss() {
    const rss = process.memoryUsage().rss;
    const mb = Math.round(rss / 1024 / 1024);
    if (mb > peakRssMb) peakRssMb = mb;
  }

  const { prisma, job } = context;
  const { projectId, episodeId, startByte, endByte } = job.payload;
  const fileKey = job.payload.fileKey || job.payload.filePath;
  // job.data was used in scan, here unified to payload

  try {
    stage4JobsTotal.inc({ type: job.type, status: "RUNNING" }, 1);
    sampleRss();

    console.log(
      `[NovelChunk] Parsing Project ${projectId}, Episode ${episodeId}, Bytes ${startByte}-${endByte}`
    );

    // 1. Path Resolution
    let filePath = fileKey;
    if (!(await fileExists(filePath))) {
      throw new Error(`[NovelChunk] Source file not found: ${filePath}`);
    }

    // 2. Stream Slice (0-Memory-Bomb) using Bytes
    const chunkText = await readChunk(filePath, startByte, endByte);
    sampleRss();

    // 1. Analyze (Reuse existing logic but for specific chunk)
    // 注意：basicTextSegmentation 默认生成 ProjectStructure.
    // 我们需要 hack 一下：它会生成 1个 Season, 1个 Episode。
    // 我们只需要其中的 Scenes/Shots，然后 attach 到 现有的 episodeId。

    // 调用 "Legacy Logic" 来分析这段文本
    // 假设 chunkText 是一章的内容
    const structure = basicTextSegmentation(chunkText, projectId);

    // 2. 提取 Scenes/Shots
    // basicTextSegmentation 可能会根据 "第X章" 分 Episode。
    // 如果 chunkText 包含标题，它会生成 struct.seasons[0].episodes[0]
    // 我们需要把这些 Scenes 挂载到目标 episodeId 下

    const analyzedScenes: any[] = [];
    if (structure.seasons.length > 0 && structure.seasons[0].episodes.length > 0) {
      // Flatten scenes from all parsed episodes (usually 1)
      structure.seasons[0].episodes.forEach((ep) => {
        analyzedScenes.push(...ep.scenes);
      });
    }

    if (analyzedScenes.length === 0) {
      console.warn(`[NovelChunk] No scenes found in chunk.`);
      // Even if no scenes, it is technically a success (empty chunk)
      const durationSec = (Date.now() - t0) / 1000;
      stage4DurationSeconds.observe({ type: job.type }, durationSec);
      stage4PeakRssMb.set({ type: job.type }, peakRssMb);
      stage4JobsTotal.inc({ type: job.type, status: "SUCCEEDED" }, 1);
      return { status: 'SUCCEEDED', message: 'No scenes found' };
    }

    // 3. Write to DB (Transactional for this Episode only)
    await prisma.$transaction(async (tx) => {
      // Clear existing scenes for this episode (Idempotency)
      // NOT DELETE ALL, because "Chunk" usually maps 1:1 to Episode in our scan logic.
      // But if multiple chunks map to one Episode, we shouldn't delete.
      // Our Scan logic: 1 Episode = 1 Chunk. So SAFE to delete existing scenes.

      // Find existing scenes
      const oldScenes = await tx.scene.findMany({ where: { episodeId }, select: { id: true } });
      const oldSceneIds = oldScenes.map((s) => s.id);

      // Delete shots
      if (oldSceneIds.length > 0) {
        await tx.shot.deleteMany({ where: { sceneId: { in: oldSceneIds } } });
        await tx.scene.deleteMany({ where: { episodeId } });
      }

      // Insert new Scenes & Shots
      for (const [sIdx, scene] of analyzedScenes.entries()) {
        const dbScene = await tx.scene.create({
          data: {
            projectId,
            episodeId,
            sceneIndex: sIdx + 1,
            title: scene.title || `场景 ${sIdx + 1}`,
            summary: scene.description || '',
          },
        });

        if (scene.shots.length > 0) {
          await tx.shot.createMany({
            data: scene.shots.map((shot: any, shIdx: number) => {
              const shotParams = { sourceText: shot.text };
              return hydrateShotWithDirectorControls(
                {
                  organizationId: job.organizationId as string,
                  sceneId: dbScene.id,
                  index: shIdx + 1,
                  title: shot.title,
                  description: shot.summary || shot.text.slice(0, 50),
                  type: 'novel_chunk',
                  params: shotParams,
                },
                shotParams
              );
            }),
          });
        }
      }
    });

    console.log(`[NovelChunk] Success. Imported ${analyzedScenes.length} scenes.`);

    // Metrics: Success
    const durationSec = (Date.now() - t0) / 1000;
    stage4DurationSeconds.observe({ type: job.type }, durationSec);
    stage4PeakRssMb.set({ type: job.type }, peakRssMb);
    stage4JobsTotal.inc({ type: job.type, status: "SUCCEEDED" }, 1);

    return { status: 'SUCCEEDED', message: `Imported ${analyzedScenes.length} scenes` };

  } catch (e: any) {
    // Metrics: Failure
    const durationSec = (Date.now() - t0) / 1000;
    stage4DurationSeconds.observe({ type: job.type }, durationSec);
    stage4PeakRssMb.set({ type: job.type }, peakRssMb);
    stage4JobsTotal.inc({ type: job.type, status: "FAILED" }, 1);
    stage4FailedJobs.inc({ type: job.type, reason: (e?.name || "Error") }, 1);
    throw e;
  }
}
async function readChunk(filePath: string, start: number, end: number): Promise<string> {
  const chunks: Buffer[] = [];
  // end is exclusive in payload, but fs.createReadStream end is inclusive.
  // So we read up to end - 1.
  const readStream = fs.createReadStream(filePath, { start: start, end: end - 1 });

  for await (const chunk of readStream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}
