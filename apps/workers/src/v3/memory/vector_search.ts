import { PrismaClient } from 'database';
import { createHash } from 'crypto';

/**
 * V3.0 P0-2: 向量检索服务（已修复 pgvector）
 * 
 * 核心逻辑：
 * 1. 生成文本的 Embedding（本地模拟或 OpenAI）
 * 2. 使用 pgvector <=> 运算符执行 top_k 检索
 */

export interface SimilarChapter {
    id: string;
    title: string | null;
    summary: string | null;
    similarity: number;
}

/**
 * 生成文本的模拟 Embedding (1536 维)
 * 用于本地开发和验证。在生产中应替换为 OpenAI 或本地推理。
 */
export async function generateSimulatedEmbedding(text: string): Promise<number[]> {
    const hash = createHash('sha256').update(text).digest();
    const vector: number[] = new Array(1536).fill(0);

    // 使用 hash 字节填充向量前 32 位，其余补零或简单拉伸
    // 目的是保证相同文本生成相同向量，且满足 1536 维要求
    for (let i = 0; i < 32; i++) {
        vector[i] = (hash[i] / 255) - 0.5; // 归一化到 [-0.5, 0.5]
    }

    // 为了让距离有意义，我们在某些维度加一点文本长度特征
    vector[32] = (text.length % 100) / 100;

    return vector;
}

/**
 * 更新章节的向量
 */
export async function upsertChapterEmbedding(params: {
    prisma: PrismaClient;
    chapterId: string;
    embedding: number[];
}) {
    const { prisma, chapterId, embedding } = params;
    const vectorString = `[${embedding.join(',')}]`;

    await prisma.$executeRawUnsafe(
        `UPDATE novel_chapters SET summary_vector = $1::vector WHERE id = $2`,
        vectorString,
        chapterId
    );
}

export async function findSimilarChapters(params: {
    prisma: PrismaClient;
    projectId: string;
    currentTextOrSummary: string;
    limit?: number;
}): Promise<SimilarChapter[]> {
    const { prisma, projectId, currentTextOrSummary, limit = 5 } = params;

    if (!currentTextOrSummary) return [];

    // 1. 生成查询向量
    const queryVector = await generateSimulatedEmbedding(currentTextOrSummary);
    const vectorString = `[${queryVector.join(',')}]`;

    // 2. 执行 pgvector 检索
    // 1 - distance = cosine similarity (if normalized)
    // 注意：summary_vector 字段在 V3.0 规范中是 snake_case
    try {
        const results = await prisma.$queryRawUnsafe<any[]>(
            `SELECT id, title, summary, 
                (1 - (summary_vector <=> $1::vector))::float AS similarity
             FROM novel_chapters
             WHERE volume_id IN (SELECT id FROM novel_volumes WHERE project_id = $2)
             AND summary_vector IS NOT NULL
             ORDER BY summary_vector <=> $1::vector
             LIMIT $3`,
            vectorString,
            projectId,
            limit
        );

        console.log(`[VECTOR_SEARCH] queryVector generated, projectId=${projectId}, resultsCount=${results.length}`);
        if (results.length > 0) {
            console.log(`[VECTOR_SEARCH] Top result: id=${results[0].id} similarity=${results[0].similarity.toFixed(4)}`);
        }

        return results.map(r => ({
            id: r.id,
            title: r.title,
            summary: r.summary,
            similarity: r.similarity || 0,
        }));
    } catch (error: any) {
        console.error(`[VectorSearch] Query failed: ${error.message}`);
        return [];
    }
}
