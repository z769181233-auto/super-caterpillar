"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DistributedLock = void 0;
exports.createDistributedLock = createDistributedLock;
class DistributedLock {
    redis;
    defaultTTL;
    maxRetries;
    retryDelay;
    constructor(config) {
        this.redis = config.redis;
        this.defaultTTL = config.defaultTTL || 10000;
        this.maxRetries = config.maxRetries || 3;
        this.retryDelay = config.retryDelay || 100;
    }
    async acquire(key, ttl) {
        const lockValue = this.generateLockValue();
        const lockTTL = ttl || this.defaultTTL;
        const lockTTLSeconds = Math.ceil(lockTTL / 1000);
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            const result = await this.redis.set(key, lockValue, 'EX', lockTTLSeconds, 'NX');
            if (result === 'OK') {
                console.log(`[DistributedLock] Acquired lock: ${key} (${lockValue})`);
                return lockValue;
            }
            if (attempt < this.maxRetries) {
                await this.sleep(this.retryDelay * (attempt + 1));
            }
        }
        console.warn(`[DistributedLock] Failed to acquire lock after ${this.maxRetries + 1} attempts: ${key}`);
        return null;
    }
    async release(key, lockValue) {
        const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
        try {
            const result = await this.redis.eval(script, 1, key, lockValue);
            const released = result === 1;
            if (released) {
                console.log(`[DistributedLock] Released lock: ${key} (${lockValue})`);
            }
            else {
                console.warn(`[DistributedLock] Failed to release lock (not owner or expired): ${key}`);
            }
            return released;
        }
        catch (error) {
            console.error(`[DistributedLock] Error releasing lock: ${error.message}`);
            return false;
        }
    }
    async extend(key, lockValue, additionalTTL) {
        const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;
        try {
            const ttlSeconds = Math.ceil(additionalTTL / 1000);
            const result = await this.redis.eval(script, 1, key, lockValue, ttlSeconds);
            return result === 1;
        }
        catch (error) {
            console.error(`[DistributedLock] Error extending lock: ${error.message}`);
            return false;
        }
    }
    async withLock(key, fn, ttl) {
        const lockValue = await this.acquire(key, ttl);
        if (!lockValue) {
            throw new Error(`Failed to acquire lock: ${key}`);
        }
        try {
            const result = await fn();
            return result;
        }
        finally {
            await this.release(key, lockValue);
        }
    }
    generateLockValue() {
        return `${process.pid}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.DistributedLock = DistributedLock;
function createDistributedLock(redis, config) {
    return new DistributedLock({
        redis,
        ...config,
    });
}
//# sourceMappingURL=distributed-lock.js.map