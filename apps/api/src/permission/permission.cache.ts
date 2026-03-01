import { Injectable, Optional, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

const USER_KEY = (userId: string) => `perm:user:${userId}`;
const PROJECT_KEY = (projectId: string, userId: string) => `perm:project:${projectId}:${userId}`;
const TTL_SECONDS = 10;

/**
 * PermissionCache
 * 权限缓存服务（使用 Redis，TTL=10s）
 * 容错：Redis 挂掉时，读取失败返回 null（触发 DB 查询），写入失败仅打日志
 */
@Injectable()
export class PermissionCache {
  private readonly logger = new Logger(PermissionCache.name);

  constructor(@Optional() private readonly redis: RedisService) {}

  async getUserPerms(userId: string): Promise<string[] | null> {
    if (this.redis) {
      const result = await this.redis.getJson<string[]>(USER_KEY(userId));
      return result;
    }
    // Redis 不可用时，返回 null，触发 DB 查询
    return null;
  }

  async setUserPerms(userId: string, perms: string[]): Promise<void> {
    if (this.redis) {
      const success = await this.redis.setJson(USER_KEY(userId), perms, TTL_SECONDS);
      if (!success) {
        this.logger.warn(`Failed to cache user permissions for ${userId}`);
      }
    }
    // Redis 不可用时，静默失败（不影响主链路）
  }

  async getProjectPerms(projectId: string, userId: string): Promise<string[] | null> {
    if (this.redis) {
      const result = await this.redis.getJson<string[]>(PROJECT_KEY(projectId, userId));
      return result;
    }
    // Redis 不可用时，返回 null，触发 DB 查询
    return null;
  }

  async setProjectPerms(projectId: string, userId: string, perms: string[]): Promise<void> {
    if (this.redis) {
      const success = await this.redis.setJson(PROJECT_KEY(projectId, userId), perms, TTL_SECONDS);
      if (!success) {
        this.logger.warn(`Failed to cache project permissions for ${projectId}:${userId}`);
      }
    }
    // Redis 不可用时，静默失败（不影响主链路）
  }

  async clear(projectId: string, userId: string) {
    if (this.redis) {
      await Promise.all([
        this.redis.del(USER_KEY(userId)),
        this.redis.del(PROJECT_KEY(projectId, userId)),
      ]);
    }
    // Redis 不可用时，静默失败（不影响主链路）
  }
}
