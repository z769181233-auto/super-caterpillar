import { PrismaClient, JobType, JobStatus } from 'database';
import * as path from 'path';
import * as fs from 'fs';
import { ProcessorContext } from '../types/processor-context';

/**
 * Stage 4: NOVEL_SCAN_TOC Processor
 *
 * 职责：
 * 1. 读取小说文件 (Stream)。
 * 2. 快速扫描目录结构 (Table of Contents)。
 * 3. 创建 Season/Episode 骨架。
 * 4. 扇出 NOVEL_CHUNK_PARSE 任务。
 */
export async function processNovelScan(context: ProcessorContext) {
  const { prisma, job, workerId } = context;
  const { projectId, fileKey, options } = job.payload;

  console.log(`[NovelScan] Starting Scan for Project ${projectId}, File: ${fileKey}`);

  // [MOCK] 模拟 S3 读取 -> 本地文件
  // 假设 fileKey 是绝对路径 (临时方便)
  // 真实生产环境应使用: s3.getObject(fileKey).createReadStream()
  let filePath = fileKey;
  if (!fs.existsSync(filePath)) {
    // Fallback for evidence/test paths
    filePath = path.resolve(process.cwd(), fileKey);
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`[NovelScan] File not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8'); // TODO: Stream for >100MB
  const lines = content.split(/\r?\n/);

  // 简单目录扫描逻辑 (Fast Regex)
  const episodes: { title: string; startLine: number; endLine: number }[] = [];
  let currentEp = { title: '序章/开始', startLine: 0, endLine: 0 };

  const chapterPattern = /第\s*([0-9一二三四五六七八九十百千]+)\s*[章回集]/;

  lines.forEach((line, index) => {
    if (chapterPattern.test(line)) {
      // Close previous
      currentEp.endLine = index - 1;
      if (currentEp.endLine >= currentEp.startLine) {
        episodes.push({ ...currentEp });
      }
      // Start new
      currentEp = { title: line.trim(), startLine: index, endLine: index };
    }
  });
  // Close last
  currentEp.endLine = lines.length - 1;
  episodes.push(currentEp);

  console.log(`[NovelScan] Scanned ${episodes.length} episodes.`);

  // 2. 事务写入骨架 + 扇出任务
  await prisma.$transaction(async (tx) => {
    // 创建 Season (默认 Season 1)
    const season = await tx.season.create({
      data: {
        projectId,
        index: 1,
        title: '第一季',
        description: 'Auto-scanned from upload',
      },
    });

    // 批量创建 Episodes
    // 注意：Prisma createMany 不返回 IDs，所以我们需要一个个创或者用 createMany + find (Tradeoff)
    // 为了拿到 ID 发 Job，必须一个个创，或者我们用 uuid 生成器预生成 ID。
    // 为了性能，我们这里演示 "Batch Create" 逻辑的变体：
    // 真实场景：使用 createMany 插入 DB，然后 select * from episodes where seasonId=... order by index

    // 既然是 Stage 4 "Industrial Scale"，我们必须高效。
    // 但为了简单，先由 Loop Create 代替 (Fan-out 3000 job 没问题)
    // 优化: 并行 Promise.all (Batch 50)

    const BATCH_SIZE = 50;
    for (let i = 0; i < episodes.length; i += BATCH_SIZE) {
      const batch = episodes.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (ep, idx) => {
          const globalIndex = i + idx + 1;
          const dbEp = await tx.episode.create({
            data: {
              seasonId: season.id,
              projectId,
              index: globalIndex,
              name: ep.title,
              summary: `Lines ${ep.startLine}-${ep.endLine}`,
            },
          });

          // 3. 扇出 NOVEL_CHUNK_PARSE Job
          // 我们不在这里直接插 Job 表，而是通过 Side Effect 或者是 `tx.shotJob`?
          // Shared-Types 里的 JobType 是 SHOT_JOB 的 type?
          // 是的, create ShotJob (Task)

          await tx.shotJob.create({
            data: {
              organizationId: job.organizationId as string,
              projectId,
              episodeId: dbEp.id,
              sceneId: null,
              shotId: null,
              type: JobType.NOVEL_CHUNK_PARSE,
              status: JobStatus.PENDING,
              priority: 50,
              payload: {
                projectId,
                fileKey,
                startLine: ep.startLine,
                endLine: ep.endLine,
                episodeId: dbEp.id,
              },
            },
          });
        })
      );
    }
  });

  console.log(`[NovelScan] Fan-out complete. Dispatched ${episodes.length} parse jobs.`);
}
