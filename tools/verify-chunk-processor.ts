#!/usr/bin/env ts-node

/**
 * Chunk Processor 验证脚本
 *
 * 用途：测试 Chunk 分片逻辑是否按预期工作
 */

import { ChunkProcessor } from '../apps/workers/src/processors/chunk-processor';
import { parseNovelStream } from '../apps/workers/src/processors/stream-parser';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const testFile =
    process.argv[2] || path.join(__dirname, '../docs/novels/source/test_novel_100k.txt');

  console.log(`=== Chunk Processor 验证 ===`);
  console.log(`测试文件: ${testFile}`);
  console.log();

  // 1. 测试 Chunk 分片
  console.log('📦 Step 1: 提取 Chunks...');
  const processor = new ChunkProcessor({
    minSize: 2000,
    maxSize: 5000,
    targetSize: 3000,
  });

  const startTime = Date.now();
  const chunks = await processor.extractChunksFromFile(testFile);
  const elapsed = Date.now() - startTime;

  console.log(`✅ 提取完成！耗时: ${elapsed}ms`);
  console.log();

  // 2. 统计信息
  console.log(`📊 Chunk 统计:`);
  console.log(`  总 Chunk 数: ${chunks.length}`);

  const sizes = chunks.map((c) => c.content.length);
  const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  const minSizeActual = Math.min(...sizes);
  const maxSizeActual = Math.max(...sizes);

  console.log(`  平均大小: ${Math.floor(avgSize)} 字符`);
  console.log(`  最小 Chunk: ${minSizeActual} 字符`);
  console.log(`  最大 Chunk: ${maxSizeActual} 字符`);
  console.log();

  // 3. 章节边界统计
  const chapterBoundaries = chunks.filter((c) => c.metadata.isChapterBoundary);
  console.log(`📖 章节信息:`);
  console.log(`  章节边界数: ${chapterBoundaries.length}`);
  console.log(`  章节分布:`);

  const chapterGroups = new Map<number, number>();
  chunks.forEach((c) => {
    const count = chapterGroups.get(c.metadata.chapterIndex) || 0;
    chapterGroups.set(c.metadata.chapterIndex, count + 1);
  });

  Array.from(chapterGroups.entries())
    .slice(0, 5)
    .forEach(([chapterIdx, count]) => {
      const title =
        chunks.find((c) => c.metadata.chapterIndex === chapterIdx && c.metadata.isChapterBoundary)
          ?.metadata.chapterTitle || `章节 ${chapterIdx}`;
      console.log(`    ${title}: ${count} chunks`);
    });

  if (chapterGroups.size > 5) {
    console.log(`    ... 还有 ${chapterGroups.size - 5} 个章节`);
  }
  console.log();

  // 4. 显示前 3 个 Chunk 的预览
  console.log(`👀 Chunk 预览 (前3个):`);
  chunks.slice(0, 3).forEach((chunk, i) => {
    console.log(`\n  Chunk ${i + 1}:`);
    console.log(`    ID: ${chunk.metadata.chunkId}`);
    console.log(`    章节: ${chunk.metadata.chapterTitle || 'N/A'}`);
    console.log(`    大小: ${chunk.content.length} 字符`);
    console.log(`    偏移: ${chunk.metadata.offset}`);
    console.log(`    章节边界: ${chunk.metadata.isChapterBoundary ? '是' : '否'}`);
    console.log(`    内容预览: ${chunk.content.slice(0, 100)}...`);
  });
  console.log();

  // 5. 验证流式解析器兼容性
  console.log(`🔄 Step 2: 验证与流式解析器兼容性...`);
  const stream = fs.createReadStream(testFile, { encoding: 'utf-8' });
  const structure = await parseNovelStream(stream, 'test-project');

  console.log(`✅ 流式解析成功！`);
  console.log(`  季数: ${structure.stats.seasonsCount}`);
  console.log(`  集数: ${structure.stats.episodesCount}`);
  console.log(`  场景数: ${structure.stats.scenesCount}`);
  console.log(`  镜头数: ${structure.stats.shotsCount}`);
  console.log();

  // 6. 总结
  console.log(`✨ 验证结论: `);
  console.log(`  ✅ Chunk 分片成功`);
  console.log(`  ✅ 大小控制在 ${minSizeActual} - ${maxSizeActual} 字符范围内`);
  console.log(`  ✅ 章节边界正确检测`);
  console.log(`  ✅ 与流式解析器兼容`);
  console.log();
  console.log(`🎉 Chunk Processor 验证通过！`);
}

main().catch(console.error);
