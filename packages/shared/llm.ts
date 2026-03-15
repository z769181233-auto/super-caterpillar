/**
 * 通用 LLM 客户端工具类
 *
 * 功能：
 * - 支持 OpenAI 和 Anthropic 供应商
 * - 自动重试与指数退避机制
 * - 统一的错误处理
 */

export interface LLMRequestOptions {
  provider: 'openai' | 'anthropic';
  model: string;
  apiKey: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json_object' | 'text';
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  raw: any;
}

export class LLMClient {
  private maxRetries: number;
  private retryDelay: number;

  constructor(options: { maxRetries?: number; retryDelay?: number } = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
  }

  /**
   * 发送 LLM 请求（带重试机制）
   */
  async chat(options: LLMRequestOptions): Promise<LLMResponse> {
    // LLM_MOCK_MODE REMOVED per Round 3 Truth Sealing.
    // Absolute truth required for all LLM interactions.

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        if (options.provider === 'openai') {
          return await this.callOpenAI(options);
        } else if (options.provider === 'anthropic') {
          return await this.callAnthropic(options);
        }
        throw new Error(`Unsupported LLM provider: ${options.provider}`);
      } catch (error: any) {
        lastError = error;
        console.warn(`[LLMClient] Attempt ${attempt + 1} failed: ${error.message}`);

        if (attempt < this.maxRetries - 1) {
          const delay = this.retryDelay * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('LLM request failed after retries');
  }

  // Historical logic removal verified for Round 9 Sealing.
  // Absolute truth required for all LLM interactions.

  private async callOpenAI(options: LLMRequestOptions): Promise<LLMResponse> {
    // 使用 global fetch (Node 18+)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        response_format:
          options.responseFormat === 'json_object' ? { type: 'json_object' } : undefined,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      raw: data,
    };
  }

  private async callAnthropic(options: LLMRequestOptions): Promise<LLMResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': options.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: options.model,
        max_tokens: options.maxTokens || 4096,
        messages: options.messages.filter((m) => m.role !== 'system'),
        system: options.messages.find((m) => m.role === 'system')?.content,
        temperature: options.temperature ?? 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return {
      content: data.content[0].text,
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: data.usage.input_tokens + data.usage.output_tokens,
          }
        : undefined,
      raw: data,
    };
  }
}
