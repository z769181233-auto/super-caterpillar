import { Injectable, Optional, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { ProjectSceneGraph } from '@scu/shared-types';

const SCENE_GRAPH_KEY = (projectId: string) => `scene_graph:project:${projectId}`;
const TTL_SECONDS = 5 * 60; // 5 分钟

/**
 * SceneGraphCache
 * SceneGraph 缓存服务（使用 Redis，TTL=5分钟）
 * 容错：Redis 挂掉时，读取失败返回 null（触发 DB 查询），写入失败仅打日志
 */
@Injectable()
export class SceneGraphCache {
  private readonly logger = new Logger(SceneGraphCache.name);

  constructor(
    @Optional() private readonly redis: RedisService,
  ) {}

  /**
   * 获取项目的 SceneGraph 缓存
   */
  async get(projectId: string): Promise<ProjectSceneGraph | null> {
    if (this.redis) {
      const result = await this.redis.getJson<ProjectSceneGraph>(SCENE_GRAPH_KEY(projectId));
      return result;
    }
    // Redis 不可用时，返回 null，触发 DB 查询
    return null;
  }

  /**
   * 设置项目的 SceneGraph 缓存
   */
  async set(projectId: string, sceneGraph: ProjectSceneGraph): Promise<void> {
    if (this.redis) {
      const success = await this.redis.setJson(SCENE_GRAPH_KEY(projectId), sceneGraph, TTL_SECONDS);
      if (!success) {
        this.logger.warn(`Failed to cache scene graph for project ${projectId}`);
      }
    }
    // Redis 不可用时，静默失败（不影响主链路）
  }

  /**
   * 清理项目的 SceneGraph 缓存
   */
  async invalidate(projectId: string): Promise<void> {
    if (this.redis) {
      await this.redis.del(SCENE_GRAPH_KEY(projectId));
    }
    // Redis 不可用时，静默失败（不影响主链路）
  }
}

