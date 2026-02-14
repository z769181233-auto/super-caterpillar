/**
 * B3-1: Adaptive Polling Strategy
 * 
 * 动态轮询策略：根据任务队列状态自适应调整轮询间隔，降低延迟并节省资源。
 * 
 * 策略：
 * - 有任务时：快速轮询 (200ms)
 * - 无任务时：逐步退避 (最长 2000ms)
 * - 任务恢复时：立即重置为快速轮询
 */

export class AdaptivePollStrategy {
    private currentInterval: number;
    private readonly minInterval: number;
    private readonly maxInterval: number;
    private readonly backoffFactor: number;
    private consecutiveEmptyPolls: number;

    constructor(options?: {
        minInterval?: number;
        maxInterval?: number;
        backoffFactor?: number;
    }) {
        this.minInterval = options?.minInterval || 200; // 最短轮询间隔 (ms)
        this.maxInterval = options?.maxInterval || 2000; // 最长轮询间隔 (ms)
        this.backoffFactor = options?.backoffFactor || 1.5; // 退避因子
        this.currentInterval = this.minInterval;
        this.consecutiveEmptyPolls = 0;
    }

    /**
     * 报告本次轮询结果
     * @param foundJobs 是否找到任务
     * @returns 下次轮询应等待的毫秒数
     */
    public reportPollResult(foundJobs: boolean): number {
        if (foundJobs) {
            // 发现任务，重置为快速轮询
            this.consecutiveEmptyPolls = 0;
            this.currentInterval = this.minInterval;
        } else {
            // 未发现任务，逐步退避
            this.consecutiveEmptyPolls++;
            this.currentInterval = Math.min(
                this.currentInterval * this.backoffFactor,
                this.maxInterval
            );
        }

        return this.currentInterval;
    }

    /**
     * 获取当前轮询间隔
     */
    public getCurrentInterval(): number {
        return this.currentInterval;
    }

    /**
     * 重置策略（例如在收到外部通知时）
     */
    public reset(): void {
        this.consecutiveEmptyPolls = 0;
        this.currentInterval = this.minInterval;
    }

    /**
     * 获取统计信息
     */
    public getStats() {
        return {
            currentInterval: this.currentInterval,
            consecutiveEmptyPolls: this.consecutiveEmptyPolls,
            isBackedOff: this.currentInterval > this.minInterval,
        };
    }
}
