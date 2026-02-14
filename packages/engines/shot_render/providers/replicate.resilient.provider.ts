/**
 * A2任务：Replicate Provider 熔断增强版
 * 
 * 在原有基础上添加：
 * 1. Circuit Breaker（熔断器）
 * 2. Exponential Backoff Retry（指数退避重试）
 * 3. Timeout Protection（超时保护）
 * 
 * @see packages/engines/shot_render/providers/replicate.provider.ts （原始实现）
 * @see packages/engines/common/circuit-breaker.ts
 */

import {
    CircuitBreaker,
    CircuitBreakerConfig,
    ExponentialBackoff,
    RetryConfig,
} from '../../common/circuit-breaker';
import {
    renderWithReplicate as originalRenderWithReplicate,
    RenderResult,
} from './replicate.provider';

/**
 * Replicate Provider 配置
 */
const REPLICATE_CIRCUIT_CONFIG: CircuitBreakerConfig = {
    failureThreshold: 5,          // 连续5次失败后断路
    successThreshold: 2,          // 半开状态2次成功后关闭
    timeout: 120000,              // 120秒超时（Replicate SDXL通常需要60-90秒）
    resetTimeout: 30000,          // 断路30秒后尝试恢复
    name: 'replicate-provider',
};

const REPLICATE_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,                // 最多重试3次
    initialDelay: 1000,           // 初始延迟1秒
    maxDelay: 10000,              // 最大延迟10秒
    backoffFactor: 2,             // 指数因子2（1s, 2s, 4s, 8s...）
    jitter: true,                 // 启用抖动避免惊群
};

/**
 * Replicate Circuit Breaker 单例
 */
const replicateCircuitBreaker = new CircuitBreaker(REPLICATE_CIRCUIT_CONFIG);

/**
 * 是否可重试的错误
 */
function isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    const code = (error as any).code;

    // 不可重试的错误类型
    const nonRetryable = [
        'auth_error',           // 认证错误（token无效）
        '401',                  // 未授权
        '403',                  // 禁止访问
        'invalid_input',        // 输入参数错误
        'circuit_breaker_open', // 熔断器打开
    ];

    // 可重试的错误类型
    const retryable = [
        'timeout',              // 超时
        '429',                  // 速率限制
        '500',                  // 服务器错误
        '502',                  // 网关错误
        '503',                  // 服务不可用
        '504',                  // 网关超时
        'econnreset',           // 连接重置
        'etimedout',            // 网络超时
        'network error',        // 网络错误
    ];

    // 检查是否不可重试
    if (nonRetryable.some(pattern =>
        message.includes(pattern) || code?.toLowerCase().includes(pattern)
    )) {
        return false;
    }

    // 检查是否可重试
    return retryable.some(pattern =>
        message.includes(pattern) || code?.toLowerCase().includes(pattern)
    );
}

/**
 * 带熔断和重试的 Replicate 渲染函数
 */
export async function renderWithReplicateResilient(
    prompt: string,
    options: {
        width?: number;
        height?: number;
        seed?: number;
        negativePrompt?: string;
        steps?: number;
    } = {}
): Promise<RenderResult> {
    // 1. 通过熔断器执行（带超时保护）
    return replicateCircuitBreaker.execute(async () => {
        // 2. 带指数退避的重试
        return ExponentialBackoff.retry(async () => {
            try {
                // 3. 调用原始实现
                return await originalRenderWithReplicate(prompt, options);
            } catch (error) {
                const err = error as Error;

                // 判断是否可重试
                if (!isRetryableError(err)) {
                    console.error(
                        `[REPLICATE_PROVIDER] Non-retryable error: ${err.message}`
                    );
                    throw err;
                }

                // 可重试错误，向上抛出让 ExponentialBackoff 处理
                console.warn(
                    `[REPLICATE_PROVIDER] Retryable error: ${err.message}`
                );
                throw err;
            }
        }, REPLICATE_RETRY_CONFIG);
    });
}

/**
 * 增强版 Provider 接口
 */
export const replicateResilientProvider = {
    key: 'replicate-resilient' as const,

    async render(
        prompt: string,
        options?: {
            width?: number;
            height?: number;
            seed?: number;
            negativePrompt?: string;
        }
    ): Promise<RenderResult> {
        return renderWithReplicateResilient(prompt, options);
    },

    /**
     * 获取熔断器状态（监控用）
     */
    getCircuitBreakerStats() {
        return replicateCircuitBreaker.getStats();
    },

    /**
     * 手动重置熔断器（运维用）
     */
    resetCircuitBreaker() {
        replicateCircuitBreaker.reset();
    },
};
