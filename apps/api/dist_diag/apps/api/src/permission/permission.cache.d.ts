import { RedisService } from '../redis/redis.service';
export declare class PermissionCache {
    private readonly redis;
    private readonly logger;
    constructor(redis: RedisService);
    getUserPerms(userId: string): Promise<string[] | null>;
    setUserPerms(userId: string, perms: string[]): Promise<void>;
    getProjectPerms(projectId: string, userId: string): Promise<string[] | null>;
    setProjectPerms(projectId: string, userId: string, perms: string[]): Promise<void>;
    clear(projectId: string, userId: string): Promise<void>;
}
