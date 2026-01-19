import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectSceneGraph, SeasonNode, EpisodeNode, SceneNode, ShotNode } from '@scu/shared-types';
import { SceneGraphCache } from './scene-graph.cache';

/**
 * SceneGraphService
 * 提供统一的场景图查询服务，包含 Redis 缓存
 */
@Injectable()
export class SceneGraphService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: SceneGraphCache
  ) {}

  /**
   * 获取项目的完整 SceneGraph
   * @param projectId 项目 ID
   * @returns ProjectSceneGraph
   */
  async getProjectSceneGraph(projectId: string): Promise<ProjectSceneGraph> {
    // 1. 先查缓存
    const cached = await this.cache.get(projectId);
    if (cached) {
      return cached;
    }

    // 2. 从数据库构建 SceneGraph
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        // 获取最新的小说分析 Task
        tasks: {
          where: { type: 'NOVEL_ANALYSIS' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            type: true,
            status: true,
            updatedAt: true,
          },
        },
        // 影视工业标准：Season → Episode → Scene → Shot
        seasons: {
          include: {
            episodes: {
              include: {
                scenes: {
                  include: {
                    shots: {
                      orderBy: { index: 'asc' },
                    },
                  },
                  orderBy: { sceneIndex: 'asc' },
                },
              },
              orderBy: { index: 'asc' },
            },
          },
          orderBy: { index: 'asc' },
        },
      },
    });

    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const projectData = project as any;

    // 3. 计算分析状态
    const tasks = projectData.tasks || [];
    const succeeded = tasks.find((t: any) => t.status === 'SUCCEEDED');
    const failed = tasks.find((t: any) => t.status === 'FAILED');
    let analysisStatus: 'PENDING' | 'ANALYZING' | 'DONE' | 'FAILED' | null = 'PENDING';
    let analysisUpdatedAt: string | null = null;

    if (succeeded) {
      analysisStatus = 'DONE';
      analysisUpdatedAt = succeeded.updatedAt.toISOString();
    } else if (failed) {
      analysisStatus = 'FAILED';
      analysisUpdatedAt = failed.updatedAt.toISOString();
    } else {
      const pendingOrRunning = tasks.find(
        (t: any) => t.status === 'PENDING' || t.status === 'RUNNING' || t.status === 'RETRYING'
      );
      if (pendingOrRunning) {
        analysisStatus = 'ANALYZING';
        analysisUpdatedAt = pendingOrRunning.updatedAt.toISOString();
      }
    }

    // 4. 映射为 SceneGraph DTO
    const sceneGraph: ProjectSceneGraph = {
      projectId: project.id,
      projectName: project.name,
      projectStatus: project.status,
      analysisStatus,
      analysisUpdatedAt,
      seasons: projectData.seasons.map((season: any) => this.mapSeasonToNode(season)),
      episodes:
        (project as any).episodes?.length > 0
          ? (project as any).episodes.map((episode: any) =>
              this.mapEpisodeToNode(episode, project.id)
            )
          : undefined,
    };

    // 5. 写入缓存
    await this.cache.set(projectId, sceneGraph);

    return sceneGraph;
  }

  /**
   * 清理项目的 SceneGraph 缓存
   * @param projectId 项目 ID
   */
  async invalidateProjectSceneGraph(projectId: string): Promise<void> {
    await this.cache.invalidate(projectId);
  }

  /**
   * 映射 Season 为 SeasonNode
   */
  private mapSeasonToNode(season: any): SeasonNode {
    return {
      id: season.id,
      parentId: season.projectId,
      index: season.index,
      title: season.title,
      description: season.description || null,
      episodes: season.episodes.map((episode: any) =>
        this.mapEpisodeToNode(episode, season.projectId)
      ),
      engineContext: season.metadata || undefined,
    };
  }

  /**
   * 映射 Episode 为 EpisodeNode
   */
  private mapEpisodeToNode(episode: any, parentId: string): EpisodeNode {
    return {
      id: episode.id,
      parentId: episode.seasonId || parentId, // 优先使用 seasonId，否则使用 projectId
      index: episode.index,
      name: episode.name,
      summary: episode.summary || null,
      scenes: episode.scenes.map((scene: any) => this.mapSceneToNode(scene)),
      engineContext: undefined, // Episode 暂无可用的 metadata 字段
    };
  }

  /**
   * 映射 Scene 为 SceneNode
   */
  private mapSceneToNode(scene: any): SceneNode {
    return {
      id: scene.id,
      parentId: scene.episodeId,
      index: scene.sceneIndex,
      title: scene.title,
      summary: scene.summary || null,
      shots: scene.shots.map((shot: any) => this.mapShotToNode(shot)),
      engineContext: undefined, // Scene 暂无可用的 metadata 字段
    };
  }

  /**
   * 映射 Shot 为 ShotNode
   */
  private mapShotToNode(shot: any): ShotNode {
    return {
      id: shot.id,
      parentId: shot.sceneId,
      index: shot.index,
      title: shot.title || null,
      description: shot.description || null,
      type: shot.type,
      params: (shot.params as Record<string, any>) || {},
      qualityScore: (shot.qualityScore as Record<string, any>) || {},
      reviewedAt: shot.reviewedAt ? shot.reviewedAt.toISOString() : null,
      durationSeconds: shot.durationSeconds || null,
      engineContext: undefined, // Shot 暂无可用的 engineContext 字段
    };
  }
}
