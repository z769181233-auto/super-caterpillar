import { Readable } from 'stream';
import * as readline from 'readline';

/**
 * Chunk 元数据
 */
export interface ChunkMetadata {
    chunkId: string;            // 唯一标识
    offset: number;             // 起始位置（字符数）
    length: number;             // 长度（字符数）
    chapterTitle?: string;      // 所属章节标题
    chapterIndex: number;       // 章节索引
    seasonIndex?: number;       // 季/卷索引
    isChapterBoundary: boolean; // 是否章节边界
}

/**
 * Chunk 数据
 */
export interface Chunk {
    metadata: ChunkMetadata;
    content: string;
}

/**
 * Chunk Processing 配置
 */
export interface ChunkConfig {
    minSize: number;  // 最小 Chunk 大小（字符数）
    maxSize: number;  // 最大 Chunk 大小（字符数）
    targetSize: number; // 目标 Chunk 大小（字符数）
}

const DEFAULT_CHUNK_CONFIG: ChunkConfig = {
    minSize: 2000,
    maxSize: 5000,
    targetSize: 3000,
};

/**
 * 智能 Chunk 分片器
 * 
 * 策略：
 * 1. 优先按章节边界切分
 * 2. 如果章节过大（> maxSize），按段落边界切分
 * 3. 如果段落过大（> maxSize），按句子边界切分
 * 4. 确保每个 Chunk 在 minSize 到 maxSize 之间
 */
export class ChunkProcessor {
    private config: ChunkConfig;

    constructor(config?: Partial<ChunkConfig>) {
        this.config = { ...DEFAULT_CHUNK_CONFIG, ...config };
    }

    /**
     * 从流中提取 Chunks
     */
    async extractChunks(input: Readable): Promise<Chunk[]> {
        const rl = readline.createInterface({
            input: input,
            crlfDelay: Infinity,
        });

        const chunks: Chunk[] = [];
        let currentChunk: string[] = []; // 当前累积的文本行
        let currentChunkSize = 0;
        let globalOffset = 0;
        let chunkIndex = 0;
        let chapterIndex = 0;
        let seasonIndex = 0;
        let currentChapterTitle: string | undefined;
        let isChapterBoundary = false;

        // Regex Patterns（复用 stream-parser 的逻辑）
        const seasonPattern = /第\s*([一二三四五六七八九十0-9]+)\s*(季|卷|部)/;
        const episodePattern = /第\s*([一二三四五六七八九十0-9]+)\s*(章|回|集)/;

        const flushChunk = () => {
            if (currentChunk.length === 0) return;

            const content = currentChunk.join('\n');
            const length = content.length;

            chunks.push({
                metadata: {
                    chunkId: `chunk-${chunkIndex}`,
                    offset: globalOffset - length,
                    length,
                    chapterTitle: currentChapterTitle,
                    chapterIndex,
                    seasonIndex: seasonIndex || undefined,
                    isChapterBoundary,
                },
                content,
            });

            chunkIndex++;
            currentChunk = [];
            currentChunkSize = 0;
            isChapterBoundary = false;
        };

        for await (const line of rl) {
            const lineLength = line.length + 1; // +1 for newline
            globalOffset += lineLength;

            // 检测季/卷边界
            if (seasonPattern.test(line.trim())) {
                flushChunk(); // 季边界前先 flush
                seasonIndex++;
                chapterIndex = 0;
                currentChapterTitle = line.trim();
                isChapterBoundary = true;
                currentChunk.push(line);
                currentChunkSize += lineLength;
                continue;
            }

            // 检测章节边界
            if (episodePattern.test(line.trim())) {
                flushChunk(); // 章节边界前先 flush
                chapterIndex++;
                currentChapterTitle = line.trim();
                isChapterBoundary = true;
                currentChunk.push(line);
                currentChunkSize += lineLength;
                continue;
            }

            // 累积文本
            currentChunk.push(line);
            currentChunkSize += lineLength;

            // 如果超过 maxSize，立即 flush（按段落边界）
            if (currentChunkSize >= this.config.maxSize) {
                flushChunk();
            }
            // 如果接近 targetSize 且遇到空行（段落边界），flush
            else if (
                currentChunkSize >= this.config.targetSize &&
                line.trim() === ''
            ) {
                flushChunk();
            }
        }

        // 最后 flush 剩余内容
        flushChunk();

        return chunks;
    }

    /**
     * 从文件路径提取 Chunks
     */
    async extractChunksFromFile(filePath: string): Promise<Chunk[]> {
        const fs = await import('fs');
        const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
        return this.extractChunks(stream);
    }
}

/**
 * Chunk Processing 进度追踪
 */
export interface ChunkProgress {
    totalChunks: number;
    processedChunks: number;
    failedChunks: number;
    completedChunkIds: Set<string>;
    failedChunkIds: Map<string, string>; // chunkId -> error message
}

/**
 * 创建空进度
 */
export function createEmptyProgress(totalChunks: number): ChunkProgress {
    return {
        totalChunks,
        processedChunks: 0,
        failedChunks: 0,
        completedChunkIds: new Set(),
        failedChunkIds: new Map(),
    };
}

/**
 * 计算进度百分比
 */
export function calculateProgress(progress: ChunkProgress): number {
    if (progress.totalChunks === 0) return 100;
    return Math.floor(
        (progress.processedChunks / progress.totalChunks) * 100
    );
}

/**
 * B1.2: 断点续传支持
 */

/**
 * ChunkProgressDB - 用于数据库存储的格式
 * (存储在 ShotJob.metadata 中)
 */
export interface ChunkProgressDB {
    totalChunks: number;
    processedChunks: number;
    failedChunks: number;
    completedChunkIds: string[];
    failedChunkIds: Record<string, string>;
    intermediateResults: Record<string, {
        scenes: any[];
        timestamp: string;
    }>;
    lastCheckpoint: string;
    llmProvider: string;
    llmModel: string;
}

/**
 * 序列化 ChunkProgress 为可存储格式
 */
export function serializeProgress(
    progress: ChunkProgress,
    llmProvider: string = '',
    llmModel: string = ''
): ChunkProgressDB {
    return {
        totalChunks: progress.totalChunks,
        processedChunks: progress.processedChunks,
        failedChunks: progress.failedChunks,
        completedChunkIds: Array.from(progress.completedChunkIds),
        failedChunkIds: Object.fromEntries(progress.failedChunkIds),
        intermediateResults: {},  // 初始实现暂不缓存中间结果
        lastCheckpoint: new Date().toISOString(),
        llmProvider,
        llmModel,
    };
}

/**
 * 反序列化 ChunkProgressDB 为运行时格式
 */
export function deserializeProgress(data: ChunkProgressDB): ChunkProgress {
    return {
        totalChunks: data.totalChunks,
        processedChunks: data.processedChunks,
        failedChunks: data.failedChunks,
        completedChunkIds: new Set(data.completedChunkIds),
        failedChunkIds: new Map(Object.entries(data.failedChunkIds)),
    };
}
