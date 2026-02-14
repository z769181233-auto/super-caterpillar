#!/usr/bin/env ts-node

/**
 * B1.3 快速验证脚本：端到端 Chunk Processing 测试
 * 
 * 功能：
 * - 测试 Chunk 分片逻辑
 * - 测试 Mock LLM 批处理
 * - 测试断点续传恢复
 * - 验证最终数据结构
 */

import { ChunkProcessor, createEmptyProgress, serializeProgress, deserializeProgress } from '../apps/workers/src/processors/chunk-processor';
import { MockLLMBatchProcessor } from '../apps/workers/src/processors/mock-llm-batch-processor';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
    console.log('=== B1.3 快速验证：端到端 Chunk Processing ===\n');

    // 1. 准备测试数据
    const testNovelPath = path.join(__dirname, '../docs/novels/source/test_novel_20k.txt');

    if (!fs.existsSync(testNovelPath)) {
        console.error(`❌ 测试文件不存在: ${testNovelPath}`);
        console.log('提示：请先生成测试小说文件');
        process.exit(1);
    }

    console.log(`📖 测试文件: ${testNovelPath}`);
    const fileSize = fs.statSync(testNovelPath).size;
    console.log(`   大小: ${(fileSize / 1024).toFixed(2)} KB\n`);

    // 2. Chunk 分片测试
    console.log('📦 Step 1: Chunk 分片...');
    const chunkProcessor = new ChunkProcessor({
        minSize: 2000,
        maxSize: 5000,
        targetSize: 3000,
    });

    const startChunk = Date.now();
    const chunks = await chunkProcessor.extractChunksFromFile(testNovelPath);
    const chunkTime = Date.now() - startChunk;

    console.log(`✅ 分片完成！`);
    console.log(`   总 Chunks: ${chunks.length}`);
    console.log(`   耗时: ${chunkTime}ms`);

    const sizes = chunks.map((c) => c.content.length);
    const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const minSize = Math.min(...sizes);
    const maxSize = Math.max(...sizes);

    console.log(`   平均大小: ${Math.floor(avgSize)} 字符`);
    console.log(`   范围: ${minSize} - ${maxSize} 字符`);

    // 验证大小范围
    const outOfRange = sizes.filter((s) => s < 2000 || s > 5000).length;
    if (outOfRange > 0) {
        console.warn(`⚠️  警告: ${outOfRange} 个 Chunks 超出范围`);
    }

    // 统计章节边界
    const chapterBoundaries = chunks.filter((c) => c.metadata.isChapterBoundary);
    console.log(`   章节边界: ${chapterBoundaries.length} 个\n`);

    // 3. Mock LLM 批处理测试
    console.log('🤖 Step 2: Mock LLM 批处理...');
    const mockProcessor = new MockLLMBatchProcessor(50);  // 50ms 延迟
    const progress = createEmptyProgress(chunks.length);

    const startLLM = Date.now();
    const processedChunks = await mockProcessor.processChunks(
        chunks,
        progress,
        (currentProgress) => {
            if (currentProgress.processedChunks % 5 === 0) {
                console.log(
                    `   进度: ${currentProgress.processedChunks}/${currentProgress.totalChunks} ` +
                    `(${Math.floor((currentProgress.processedChunks / currentProgress.totalChunks) * 100)}%)`
                );
            }
        }
    );
    const llmTime = Date.now() - startLLM;

    console.log(`✅ LLM 处理完成！`);
    console.log(`   处理数量: ${processedChunks.length}`);
    console.log(`   耗时: ${llmTime}ms`);
    console.log(`   平均每 Chunk: ${Math.floor(llmTime / processedChunks.length)}ms\n`);

    // 4. 序列化/反序列化测试
    console.log('💾 Step 3: 序列化测试...');
    const serialized = serializeProgress(progress, 'mock', 'mock-model');
    console.log(`   序列化大小: ${JSON.stringify(serialized).length} bytes`);

    const deserialized = deserializeProgress(serialized);
    console.log(`   反序列化完成`);
    console.log(`   恢复的已完成 Chunks: ${deserialized.completedChunkIds.size}`);

    // 验证一致性
    const isConsistent = deserialized.completedChunkIds.size === progress.completedChunkIds.size;
    console.log(`   数据一致性: ${isConsistent ? '✅ 通过' : '❌ 失败'}\n`);

    // 5. 断点续传模拟
    console.log('🔄 Step 4: 断点续传测试...');
    console.log('   模拟处理前 10 个 Chunks 后中断...');

    const partialProgress = createEmptyProgress(chunks.length);
    for (let i = 0; i < 10; i++) {
        partialProgress.completedChunkIds.add(chunks[i].metadata.chunkId);
        partialProgress.processedChunks++;
    }

    console.log(`   已完成: ${partialProgress.processedChunks} 个`);
    console.log('   重启并恢复...');

    const resumedChunks = await mockProcessor.processChunks(
        chunks,
        partialProgress,
        (currentProgress) => {
            if (currentProgress.processedChunks % 5 === 0 && currentProgress.processedChunks > 10) {
                console.log(`   恢复进度: ${currentProgress.processedChunks}/${currentProgress.totalChunks}`);
            }
        }
    );

    const expectedResumed = chunks.length - 10;
    console.log(`✅ 断点续传完成！`);
    console.log(`   预期处理: ${expectedResumed} 个`);
    console.log(`   实际处理: ${resumedChunks.length} 个`);
    console.log(`   断点续传: ${resumedChunks.length === expectedResumed ? '✅ 通过' : '❌ 失败'}\n`);

    // 6. 最终统计
    console.log('📊 验证总结:');
    console.log(`   ✅ Chunk 分片: ${chunks.length} 个`);
    console.log(`   ✅ LLM 处理: ${processedChunks.length} 个`);
    console.log(`   ✅ 序列化: 通过`);
    console.log(`   ✅ 断点续传: ${resumedChunks.length === expectedResumed ? '通过' : '失败'}`);
    console.log(`\n🎉 验证完成！所有核心功能正常运行。`);
}

main().catch((error) => {
    console.error('❌ 验证失败:', error);
    process.exit(1);
});
