import Redis from 'ioredis';
export interface DistributedLockConfig {
    redis: Redis;
    defaultTTL?: number;
    maxRetries?: number;
    retryDelay?: number;
}
export declare class DistributedLock {
    private redis;
    private defaultTTL;
    private maxRetries;
    private retryDelay;
    constructor(config: DistributedLockConfig);
    acquire(key: string, ttl?: number): Promise<string | null>;
    release(key: string, lockValue: string): Promise<boolean>;
    extend(key: string, lockValue: string, additionalTTL: number): Promise<boolean>;
    withLock<T>(key: string, fn: () => Promise<T>, ttl?: number): Promise<T>;
    private generateLockValue;
    private sleep;
}
export declare function createDistributedLock(redis: Redis, config?: Partial<DistributedLockConfig>): DistributedLock;
