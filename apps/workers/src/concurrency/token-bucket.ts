/**
 * TokenBucket
 * 简单的并发令牌桶，用于本地资源限流。
 */
export class TokenBucket {
    private availableTokens: number;

    constructor(private readonly maxTokens: number) {
        this.availableTokens = maxTokens;
    }

    /**
     * 尝试获取一个令牌
     */
    acquire(): boolean {
        if (this.availableTokens > 0) {
            this.availableTokens--;
            return true;
        }
        return false;
    }

    /**
     * 释放一个令牌
     */
    release(): void {
        if (this.availableTokens < this.maxTokens) {
            this.availableTokens++;
        }
    }

    /**
     * 获取当前可用令牌数
     */
    getAvailable(): number {
        return this.availableTokens;
    }

    /**
     * 获取最大令牌数
     */
    getMax(): number {
        return this.maxTokens;
    }
}
