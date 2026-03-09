import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
export declare class RedisService implements OnModuleInit, OnModuleDestroy {
    private readonly logger;
    private client;
    private isConnected;
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    private isAvailable;
    get(key: string): Promise<string | null>;
    set(key: string, value: string, ttlSeconds?: number): Promise<boolean>;
    del(key: string): Promise<boolean>;
    getJson<T = any>(key: string): Promise<T | null>;
    setJson(key: string, value: any, ttlSeconds?: number): Promise<boolean>;
}
