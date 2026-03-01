import { Chunk, ChunkProgress, createEmptyProgress } from './chunk-processor';

/**
 * LLM API 配置
 */
export interface LLMConfig {
  provider: 'openai' | 'anthropic';
  model: string;
  apiKey: string;
  maxConcurrentRequests: number;
  maxRetries: number;
  retryDelay: number; // ms
}

const DEFAULT_LLM_CONFIG: Partial<LLMConfig> = {
  provider: 'openai',
  model: 'gpt-4-turbo-preview',
  maxConcurrentRequests: 5,
  maxRetries: 3,
  retryDelay: 1000,
};

/**
 * LLM 处理结果
 */
export interface LLMProcessedChunk {
  chunkId: string;
  structuredOutput: any; // 解析后的结构化数据
  rawResponse: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * LLM Batch Processor
 *
 * 功能：
 * - 批量处理 Chunks，调用 LLM API 进行解析
 * - 并发控制（限制同时请求数）
 * - 失败重试机制
 * - 进度追踪
 */
export class LLMBatchProcessor {
  private config: LLMConfig;
  private semaphore: number = 0;

  constructor(config: Partial<LLMConfig>) {
    this.config = {
      ...DEFAULT_LLM_CONFIG,
      ...config,
    } as LLMConfig;
  }

  /**
   * 批量处理 Chunks (支持断点续传)
   *
   * @param chunks 所有 Chunks
   * @param existingProgress 已有进度（可选，用于断点续传）
   * @param onProgress 进度回调
   */
  async processChunks(
    chunks: Chunk[],
    existingProgress?: ChunkProgress,
    onProgress?: (progress: ChunkProgress) => void | Promise<void>
  ): Promise<LLMProcessedChunk[]> {
    // 使用已有进度或创建新进度
    const progress = existingProgress || createEmptyProgress(chunks.length);
    const results: LLMProcessedChunk[] = [];

    // B1.2: 过滤已完成的 Chunks（断点续传）
    const remainingChunks = chunks.filter(
      (chunk) => !progress.completedChunkIds.has(chunk.metadata.chunkId)
    );

    if (existingProgress && remainingChunks.length < chunks.length) {
      console.log(
        `[LLMBatchProcessor] Resume detected: ${progress.completedChunkIds.size} chunks already completed, ` +
          `${remainingChunks.length} remaining`
      );
    }

    const queue = [...remainingChunks];

    // 并发处理
    const workers: Promise<void>[] = [];
    for (let i = 0; i < this.config.maxConcurrentRequests; i++) {
      workers.push(this.worker(queue, results, progress, onProgress));
    }

    await Promise.all(workers);

    return results;
  }

  /**
   * Worker 函数：从队列中取 Chunk 并处理
   */
  private async worker(
    queue: Chunk[],
    results: LLMProcessedChunk[],
    progress: ChunkProgress,
    onProgress?: (progress: ChunkProgress) => void | Promise<void>
  ): Promise<void> {
    while (queue.length > 0) {
      const chunk = queue.shift();
      if (!chunk) break;

      try {
        const result = await this.processChunkWithRetry(chunk);
        results.push(result);
        progress.processedChunks++;
        progress.completedChunkIds.add(chunk.metadata.chunkId);

        // 支持异步回调
        await Promise.resolve(onProgress?.(progress));
      } catch (error: any) {
        progress.failedChunks++;
        progress.failedChunkIds.set(chunk.metadata.chunkId, error.message);

        console.error(
          `[LLMBatchProcessor] Failed to process chunk ${chunk.metadata.chunkId}:`,
          error.message
        );

        // 支持异步回调
        await Promise.resolve(onProgress?.(progress));
      }
    }
  }

  /**
   * 处理单个 Chunk（带重试）
   */
  private async processChunkWithRetry(chunk: Chunk): Promise<LLMProcessedChunk> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        return await this.processChunk(chunk);
      } catch (error: any) {
        lastError = error;

        if (attempt < this.config.maxRetries - 1) {
          // 指数退避
          const delay = this.config.retryDelay * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Failed to process chunk');
  }

  /**
   * 处理单个 Chunk
   */
  private async processChunk(chunk: Chunk): Promise<LLMProcessedChunk> {
    if (this.config.provider === 'openai') {
      return this.processChunkWithOpenAI(chunk);
    } else if (this.config.provider === 'anthropic') {
      return this.processChunkWithAnthropic(chunk);
    }

    throw new Error(`Unsupported provider: ${this.config.provider}`);
  }

  /**
   * 使用 OpenAI API 处理 Chunk
   */
  private async processChunkWithOpenAI(chunk: Chunk): Promise<LLMProcessedChunk> {
    const prompt = this.buildPrompt(chunk);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content:
              '你是一个专业的小说结构分析助手。你的任务是分析给定的文本片段，识别其中的场景和镜头结构。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const rawResponse = data.choices[0].message.content;
    const structuredOutput = JSON.parse(rawResponse);

    return {
      chunkId: chunk.metadata.chunkId,
      structuredOutput,
      rawResponse,
      usage: data.usage,
    };
  }

  /**
   * 使用 Anthropic API 处理 Chunk
   */
  private async processChunkWithAnthropic(chunk: Chunk): Promise<LLMProcessedChunk> {
    const prompt = this.buildPrompt(chunk);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const rawResponse = data.content[0].text;
    const structuredOutput = JSON.parse(rawResponse);

    return {
      chunkId: chunk.metadata.chunkId,
      structuredOutput,
      rawResponse,
      usage: data.usage,
    };
  }

  /**
   * 构建 LLM Prompt
   */
  private buildPrompt(chunk: Chunk): string {
    return `
# 小说文本分析任务

## 输入文本
章节：${chunk.metadata.chapterTitle || '未知'}
章节索引：${chunk.metadata.chapterIndex}

文本内容：
${chunk.content}

## 任务要求
请分析这段文本，识别其中的场景和镜头。

场景定义：一个连续的时间和空间单元（例如：同一地点、同一时间段）
镜头定义：一个独立的视觉单元，通常对应一句话或一个短段落

## 输出格式（JSON）
{
  "scenes": [
    {
      "index": 1,
      "title": "场景标题",
      "summary": "场景简介",
      "shots": [
        {
          "index": 1,
          "text": "镜头文本",
          "summary": "镜头简介"
        }
      ]
    }
  ]
}

请严格按照 JSON 格式输出，不要包含任何其他文本。
`.trim();
  }
}
