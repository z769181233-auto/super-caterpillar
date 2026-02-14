/**
 * A2任务：Provider 熔断机制
 * 
 * Circuit Breaker 实现
 * - 防止级联故障
 * - 快速失败，避免资源耗尽
 * - 自动恢复探测
 * 
 * @see docs/_evidence/A2_TASK_COMPLETION_REPORT.md
 */

export enum CircuitState {
    CLOSED = 'CLOSED',       // 正常状态，请求通过
    OPEN = 'OPEN',           // 断路状态，请求快速失败
    HALF_OPEN = 'HALF_OPEN', // 半开状态，允许少量请求探测
}

export interface CircuitBreakerConfig {
    /** 故障阈值：连续失败多少次后断路 */
    failureThreshold: number;

    /** 成功阈值：半开状态成功多少次后关闭 */
    successThreshold: number;

    /** 超时时间（毫秒）：请求超过此时间视为失败 */
    timeout: number;

    /** 重置时间（毫秒）：断路多久后尝试半开 */
    resetTimeout: number;

    /** 熔断器名称（用于日志） */
    name: string;
}

export interface CircuitBreakerStats {
    state: CircuitState;
    failures: number;
    successes: number;
    totalRequests: number;
    totalFailures: number;
    totalSuccesses: number;
    lastFailureTime?: number;
    lastSuccessTime?: number;
}

/**
 * Circuit Breaker 实现
 * 
 * 状态转换：
 * - CLOSED → OPEN: 连续失败达到阈值
 * - OPEN → HALF_OPEN: 超时后自动转换
 * - HALF_OPEN → CLOSED: 成功次数达到阈值
 * - HALF_OPEN → OPEN: 任何失败
 */
export class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failures = 0;
    private successes = 0;
    private totalRequests = 0;
    private totalFailures = 0;
    private totalSuccesses = 0;
    private lastFailureTime?: number;
    private lastSuccessTime?: number;
    private nextAttempt?: number;

    constructor(private config: CircuitBreakerConfig) { }

    /**
     * 执行受保护的函数
     */
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        this.totalRequests++;

        // 1. 检查是否允许执行
        if (!this.canRequest()) {
            const error = new Error(
                `[CIRCUIT_BREAKER_OPEN] ${this.config.name}: Circuit is OPEN. ` +
                `Try again after ${Math.ceil((this.nextAttempt! - Date.now()) / 1000)}s`
            );
            (error as any).code = 'CIRCUIT_BREAKER_OPEN';
            this.logState('REJECTED', error.message);
            throw error;
        }

        // 2. 执行请求（带超时）
        try {
            const result = await this.withTimeout(fn(), this.config.timeout);
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    /**
     * 检查当前是否允许请求
     */
    private canRequest(): boolean {
        const now = Date.now();

        // CLOSED 状态：允许所有请求
        if (this.state === CircuitState.CLOSED) {
            return true;
        }

        // OPEN 状态：检查是否到达重置时间
        if (this.state === CircuitState.OPEN) {
            if (this.nextAttempt && now >= this.nextAttempt) {
                this.logState('TRANSITION', `OPEN → HALF_OPEN (timeout reached)`);
                this.state = CircuitState.HALF_OPEN;
                this.successes = 0;
                return true;
            }
            return false;
        }

        // HALF_OPEN 状态：允许请求
        return true;
    }

    /**
     * 成功回调
     */
    private onSuccess(): void {
        this.totalSuccesses++;
        this.lastSuccessTime = Date.now();
        this.failures = 0; // 重置失败计数器

        if (this.state === CircuitState.HALF_OPEN) {
            this.successes++;
            this.logState('SUCCESS', `HALF_OPEN successes: ${this.successes}/${this.config.successThreshold}`);

            if (this.successes >= this.config.successThreshold) {
                this.logState('TRANSITION', `HALF_OPEN → CLOSED (${this.successes} successes)`);
                this.state = CircuitState.CLOSED;
                this.successes = 0;
            }
        }
    }

    /**
     * 失败回调
     */
    private onFailure(): void {
        this.totalFailures++;
        this.lastFailureTime = Date.now();
        this.failures++;

        if (this.state === CircuitState.HALF_OPEN) {
            this.logState('FAILURE', `HALF_OPEN → OPEN (recovery failed)`);
            this.open();
            return;
        }

        if (this.state === CircuitState.CLOSED) {
            this.logState('FAILURE', `CLOSED failures: ${this.failures}/${this.config.failureThreshold}`);

            if (this.failures >= this.config.failureThreshold) {
                this.logState('TRANSITION', `CLOSED → OPEN (${this.failures} failures)`);
                this.open();
            }
        }
    }

    /**
     * 打开断路器
     */
    private open(): void {
        this.state = CircuitState.OPEN;
        this.nextAttempt = Date.now() + this.config.resetTimeout;
        this.failures = 0;
        this.successes = 0;

        this.logState('OPEN', `Circuit opened. Next attempt at ${new Date(this.nextAttempt).toISOString()}`);
    }

    /**
     * 添加超时保护
     */
    private withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
        return Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                setTimeout(() => {
                    const error = new Error(
                        `[TIMEOUT] ${this.config.name}: Request exceeded ${timeout}ms`
                    );
                    (error as any).code = 'PROVIDER_TIMEOUT';
                    reject(error);
                }, timeout);
            }),
        ]);
    }

    /**
     * 获取当前状态
     */
    getStats(): CircuitBreakerStats {
        return {
            state: this.state,
            failures: this.failures,
            successes: this.successes,
            totalRequests: this.totalRequests,
            totalFailures: this.totalFailures,
            totalSuccesses: this.totalSuccesses,
            lastFailureTime: this.lastFailureTime,
            lastSuccessTime: this.lastSuccessTime,
        };
    }

    /**
     * 重置断路器（测试用）
     */
    reset(): void {
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.successes = 0;
        this.nextAttempt = undefined;
        this.logState('RESET', 'Circuit breaker manually reset');
    }

    /**
     * 日志输出
     */
    private logState(event: string, message: string): void {
        const timestamp = new Date().toISOString();
        console.log(
            `[CIRCUIT_BREAKER] [${timestamp}] [${this.config.name}] [${event}] ${message}`
        );
    }
}

/**
 * 指数退避重试策略
 */
export interface RetryConfig {
    /** 最大重试次数 */
    maxRetries: number;

    /** 初始延迟（毫秒） */
    initialDelay: number;

    /** 最大延迟（毫秒） */
    maxDelay: number;

    /** 退避因子（通常为 2） */
    backoffFactor: number;

    /** 添加随机抖动避免惊群 */
    jitter: boolean;
}

export class ExponentialBackoff {
    /**
     * 执行带指数退避的重试
     */
    static async retry<T>(
        fn: () => Promise<T>,
        config: RetryConfig
    ): Promise<T> {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error as Error;

                // 最后一次尝试失败后不再重试
                if (attempt === config.maxRetries) {
                    break;
                }

                // 计算延迟时间
                const delay = this.calculateDelay(attempt, config);

                console.log(
                    `[RETRY] Attempt ${attempt + 1}/${config.maxRetries + 1} failed. ` +
                    `Retrying in ${delay}ms. Error: ${(error as Error).message}`
                );

                await this.sleep(delay);
            }
        }

        throw new Error(
            `[RETRY_EXHAUSTED] Failed after ${config.maxRetries + 1} attempts. ` +
            `Last error: ${lastError?.message}`
        );
    }

    /**
     * 计算延迟时间（带指数退避和抖动）
     */
    private static calculateDelay(attempt: number, config: RetryConfig): number {
        // 指数延迟：delay = initialDelay * (backoffFactor ^ attempt)
        const exponentialDelay =
            config.initialDelay * Math.pow(config.backoffFactor, attempt);

        // 限制最大延迟
        let delay = Math.min(exponentialDelay, config.maxDelay);

        // 添加抖动（±25%）
        if (config.jitter) {
            const jitterRange = delay * 0.25;
            const jitter = Math.random() * jitterRange * 2 - jitterRange;
            delay = Math.max(0, delay + jitter);
        }

        return Math.floor(delay);
    }

    private static sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
