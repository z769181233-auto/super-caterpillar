import { env } from '@scu/config';
import { engineLimiter } from '../concurrency/engine-limiter';
import { RetryPolicy } from '../retry/retry-policy';
import { ApiClient } from '../api-client';

export interface ExecutionResult {
    success: boolean;
    output?: any;
    error?: any;
    durationMs: number;
}

/**
 * JobExecutor
 * 负责任务的执行生命周期管理。
 */
export class JobExecutor {
    constructor(private readonly apiClient: ApiClient) { }

    /**
     * 执行任务（带限流、超时与重试）
     */
    async execute(
        jobId: string,
        engineKey: string,
        processor: () => Promise<any>
    ): Promise<ExecutionResult> {
        const startTime = Date.now();

        // 1. 获取本地令牌
        const config = env as any;
        if (config.concurrencyLimiterEnabled) {
            if (!engineLimiter.acquire(engineKey)) {
                return {
                    success: false,
                    error: { message: 'Worker busy: local concurrency limit reached', code: 'WORKER_BUSY' },
                    durationMs: 0,
                };
            }
        }

        try {
            let attempt = 1;
            let lastError: any = null;

            while (attempt <= (config.retryPolicyEnabled ? config.retryMaxAttempts : 1)) {
                try {
                    // 2. 执行逻辑（带超时）
                    const output = await this.executeWithTimeout(engineKey, processor);

                    return {
                        success: true,
                        output,
                        durationMs: Date.now() - startTime,
                    };
                } catch (error: any) {
                    lastError = error;

                    // 3. 检查是否重试
                    if (RetryPolicy.shouldRetry(attempt)) {
                        const delay = RetryPolicy.getDelay(attempt);
                        console.warn(`[Executor] Job ${jobId} failed (attempt ${attempt}). Retrying in ${delay}ms... Error: ${error.message}`);
                        await new Promise((resolve) => setTimeout(resolve, delay));
                        attempt++;
                    } else {
                        break;
                    }
                }
            }

            return {
                success: false,
                error: lastError || { message: 'Execution failed after retries' },
                durationMs: Date.now() - startTime,
            };
        } finally {
            // 4. 释放令牌
            if (config.concurrencyLimiterEnabled) {
                engineLimiter.release(engineKey);
            }
        }
    }

    /**
     * 带超时的执行
     */
    private async executeWithTimeout(engineKey: string, processor: () => Promise<any>): Promise<any> {
        const config = env as any;
        if (!config.execTimeoutEnabled) {
            return processor();
        }

        const timeoutSeconds = config.getEngineTimeoutSeconds(engineKey);
        const timeoutMs = timeoutSeconds * 1000;

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error(`Execution timed out after ${timeoutSeconds}s for engine ${engineKey}`));
            }, timeoutMs);

            processor()
                .then((result) => {
                    clearTimeout(timer);
                    resolve(result);
                })
                .catch((err) => {
                    clearTimeout(timer);
                    reject(err);
                });
        });
    }
}
