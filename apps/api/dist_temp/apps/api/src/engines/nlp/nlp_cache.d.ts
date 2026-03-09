import { RedisService } from '../../redis/redis.service';
export declare class NlpCache {
    private readonly redis;
    constructor(redis: RedisService);
    generateKey(engineName: string, payload: any): string;
    get(key: string): Promise<any | null>;
    set(key: string, value: any, ttlSeconds?: number): Promise<void>;
}
