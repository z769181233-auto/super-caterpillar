import { Chunk, ChunkProgress } from './chunk-processor';
import { LLMProcessedChunk } from './llm-batch-processor';

/**
 * Mock LLM Batch Processor
 * 
 * 用于测试和验证，避免真实 LLM API 调用
 */
export class MockLLMBatchProcessor {
    private delay: number;

    constructor(delay: number = 100) {
        this.delay = delay;  // 模拟 API 延迟
    }

    /**
     * 批量处理 Chunks（Mock 实现）
     */
    async processChunks(
        chunks: Chunk[],
        existingProgress?: ChunkProgress,
        onProgress?: (progress: ChunkProgress) => void | Promise<void>
    ): Promise<LLMProcessedChunk[]> {
        const results: LLMProcessedChunk[] = [];

        // 简化：顺序处理（真实实现是并发）
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];

            // 跳过已完成的 Chunks
            if (existingProgress?.completedChunkIds.has(chunk.metadata.chunkId)) {
                console.log(`[MockLLM] 跳过已完成: ${chunk.metadata.chunkId}`);
                continue;
            }

            // 模拟 API 延迟
            await new Promise((resolve) => setTimeout(resolve, this.delay));

            // 生成 Mock 数据
            const result = this.mockProcessChunk(chunk);
            results.push(result);

            // 更新进度
            if (existingProgress) {
                existingProgress.processedChunks++;
                existingProgress.completedChunkIds.add(chunk.metadata.chunkId);

                if (onProgress) {
                    await Promise.resolve(onProgress(existingProgress));
                }
            }

            console.log(
                `[MockLLM] 已处理: ${chunk.metadata.chunkId} (${i + 1}/${chunks.length})`
            );
        }

        return results;
    }

    /**
     * 模拟处理单个 Chunk
     */
    private mockProcessChunk(chunk: Chunk): LLMProcessedChunk {
        // 生成 1-3 个场景
        const sceneCount = Math.floor(Math.random() * 3) + 1;
        const scenes = [];

        for (let i = 0; i < sceneCount; i++) {
            const shotCount = Math.floor(Math.random() * 5) + 2;  // 2-6 个镜头
            const shots = [];

            for (let j = 0; j < shotCount; j++) {
                shots.push({
                    index: j + 1,
                    text: `镜头文本示例 ${j + 1}`,
                    summary: `镜头 ${j + 1} 简介`,
                });
            }

            scenes.push({
                index: i + 1,
                title: `场景 ${i + 1} - ${chunk.metadata.chapterTitle || 'Unknown'}`,
                summary: `场景 ${i + 1} 简介`,
                shots,
            });
        }

        return {
            chunkId: chunk.metadata.chunkId,
            structuredOutput: { scenes },
            rawResponse: JSON.stringify({ scenes }),
            usage: {
                promptTokens: 500,
                completionTokens: 300,
                totalTokens: 800,
            },
        };
    }
}
