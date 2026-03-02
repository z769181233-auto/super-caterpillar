import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Prisma, TaskType as TaskTypeEnum, TaskStatus, ProjectStatus } from 'database';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateProjectDto,
  UpdateProjectDto,
  CreateEpisodeDto,
  CreateSceneDto,
  UpdateSceneDto,
  CreateShotDto,
  UpdateShotDto,
} from './dto';
import { CreateSeasonDto } from './dto/create-season.dto';
import { SceneGraphService } from './scene-graph.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  ProjectOverviewDTO,
  ProjectFlowDTO,
  ProjectFlowStepDTO,
  BlockReasonCode,
} from '@scu/shared-types';

import { ProjectResolver } from '../common/project-resolver';

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SceneGraphService) private readonly sceneGraphService: SceneGraphService,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService,
    private readonly projectResolver: ProjectResolver
  ) { }







  async create(createProjectDto: CreateProjectDto, ownerId: string, organizationId: string) {
    this.logger.log('PROJECT SERVICE CREATE CALLED');

    // Studio v0.7: 创建项目时必须指定组织
    // Studio v0.7: Find 'OWNER' role
    // Using findFirst/findUnique. Modified for Robustness.
    let finalOwnerRole = await this.prisma.role.findFirst({
      where: { name: 'OWNER' },
    });

    if (!finalOwnerRole) {
      this.logger.warn('OWNER ROLE MISSING IN DB. ATTEMPTING SELF-HEALING');
      try {
        finalOwnerRole = await this.prisma.role.create({
          data: {
            name: 'OWNER',
            level: 100, // Assuming 100 is Owner level
          },
        });
        this.logger.log(`SUCCESS: Created OWNER role with ID ${finalOwnerRole.id}`);
      } catch (err) {
        this.logger.error(`ERROR: Failed to create OWNER role: ${err.message}`);
        // If unique constraint violation, it means it exists. Try finding it again.
        this.logger.log('RETRYING FIND OWNER ROLE ...');
        finalOwnerRole = await this.prisma.role.findFirst({
          where: { name: 'OWNER' },
        });
        if (finalOwnerRole) {
          this.logger.log(`SUCCESS: Found OWNER role after retry: ${finalOwnerRole.id}`);
        } else {
          this.logger.error(`FATAL: OWNER role still not found after creation failure`);
        }
      }
    } else {
      this.logger.log(`FOUND OWNER ROLE: ${finalOwnerRole.id}`);
    }

    // 使用事务确保 Project 和 Membership 同时创建
    const project = await this.prisma.$transaction(async (tx) => {
      const p = await tx.project.create({
        data: {
          name: createProjectDto.name,
          description: createProjectDto.description,
          ownerId,
          organizationId, // 使用传入的组织 ID
          status: ProjectStatus.in_progress,
        },
      });

      if (finalOwnerRole) {
        this.logger.log(
          `Creating OWNER member for user ${ownerId} in project ${p.id} with role ${finalOwnerRole.id}`
        );
        await tx.projectMember.create({
          data: {
            projectId: p.id,
            userId: ownerId,
            roleId: finalOwnerRole.id,
          },
        });
      } else {
        this.logger.error(
          `OWNER role STILL NOT FOUND! Skipping member creation for project ${p.id}`
        );
      }

      // CE01: 项目创建后生成角色三视图（占位实现）
      // P2-4 修复：在事务中创建 Character，确保原子性
      try {
        await tx.character.create({
          data: {
            projectId: p.id,
            name: 'Default Character',
            description: 'Auto-generated default character',
            referenceSheetUrls: { front: '', side: '', back: '' }, // 占位三视图 URL
            defaultSeed: `seed_${p.id}_${Date.now()}`,
            embeddingId: `emb_${p.id}_${Date.now()}`,
          },
        });
      } catch (error: any) {
        // 软失败：记录 audit_logs 并继续（符合 SafetySpec，Character 非阻断性）
        // 注意：事务中无法直接调用 auditLogService (外部服务)，记录日志即可
        this.logger.warn(`CE01 placeholder failed in transaction: ${error?.message}`);
      }

      return p;
    });

    // 清理缓存（新项目无需清理，但为了统一性也调用）
    await this.sceneGraphService.invalidateProjectSceneGraph(project.id);

    return project as any;
  }

  async findByIdWithHierarchy(id: string, organizationId: string) {
    // Studio v0.7: 按组织过滤
    const project = await this.prisma.project.findFirst({
      where: {
        id,
        organizationId, // 确保项目属于当前组织
      },
      include: {
        episodes: {
          include: {
            scenes: {
              include: {
                shots: true,
              },
              orderBy: { sceneIndex: 'asc' }, // V3.0
            },
          },
          orderBy: { index: 'asc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project as any;
  }

  async findTreeById(id: string, organizationId: string) {
    // Studio v0.7: 按组织过滤
    // 影视工业标准：返回 Season → Episode → Scene → Shot 结构树
    const project = await this.prisma.project.findFirst({
      where: {
        id,
        organizationId, // 确保项目属于当前组织
      },
      include: {
        // 获取最新的小说分析 Task
        tasks: {
          where: { type: TaskTypeEnum.NOVEL_ANALYSIS },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        // A1修复：包含 novelSources
        novelSources: true,
        // 影视工业标准：Season → Episode → Scene → Shot
        seasons: {
          select: {
            id: true,
            index: true,
            title: true,
            description: true,
            metadata: true,
            createdAt: true,
            episodes: {
              select: {
                id: true,
                index: true,
                name: true, // Episode 使用 name 字段
                summary: true, // Episode简介
                chapter: {
                  select: {
                    id: true,
                    title: true,
                    index: true,
                    sceneDrafts: {
                      select: {
                        id: true,
                        index: true,
                        title: true,
                        summary: true,
                        characters: true,
                        location: true,
                        status: true,
                      },
                      orderBy: { index: 'asc' },
                    },
                  },
                },
                scenes: {
                  select: {
                    id: true,
                    sceneIndex: true, // V3.0
                    title: true,
                    summary: true,
                    visualDensityScore: true, // V1.1 新增
                    enrichedText: true, // V1.1 新增
                    shots: {
                      select: {
                        id: true,
                        index: true,
                        type: true,
                        params: true,
                        title: true,
                        description: true,
                        qualityScore: true,
                        durationSeconds: true,
                        reviewedAt: true,
                        assets: {
                          // Stage 4: Include Assets
                          select: {
                            id: true,
                            type: true,
                            status: true,
                          },
                        },
                      },
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
        // 向后兼容：保留 episodes 直接关联（用于旧数据）
        // 注意：根据 schema，seasonId 是必填的，所以这里查询逻辑可能需要调整
        // 如果确实需要查询"未关联到 Season"的 Episode，可能需要通过其他字段判断
        episodes: {
          // 暂时移除 where 条件，因为 seasonId 是必填的，无法查询 null
          // 如果需要过滤，应该通过其他业务逻辑字段
          select: {
            id: true,
            index: true,
            name: true,
            summary: true,
            chapter: {
              select: {
                id: true,
                title: true,
                index: true,
                sceneDrafts: {
                  select: {
                    id: true,
                    index: true,
                    title: true,
                    summary: true,
                    characters: true,
                    location: true,
                    status: true,
                  },
                  orderBy: { index: 'asc' },
                },
              },
            },
            scenes: {
              select: {
                id: true,
                sceneIndex: true, // V3.0
                title: true,
                summary: true,
                visualDensityScore: true,
                enrichedText: true,
                shots: {
                  select: {
                    id: true,
                    index: true,
                    type: true,
                    params: true,
                    title: true,
                    description: true,
                    qualityScore: true,
                    durationSeconds: true,
                    reviewedAt: true,
                    assets: {
                      select: {
                        id: true,
                        type: true,
                        status: true,
                      },
                    },
                  },
                  orderBy: { index: 'asc' },
                },
              },
              orderBy: { sceneIndex: 'asc' },
            },
          },
          orderBy: { index: 'asc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // 计算分析状态（统一使用 NovelAnalysisStatus）
    // 类型断言：Prisma include 后的类型推断可能不完整
    const projectWithTasks = project as typeof project & {
      tasks: Array<{ id: string; type: string; status: string; updatedAt: Date }>;
    };
    const tasks = projectWithTasks.tasks || [];
    const succeeded = tasks.find((t: any) => t.status === TaskStatus.SUCCEEDED);
    const failed = tasks.find((t: any) => t.status === TaskStatus.FAILED);

    let analysisStatus: 'PENDING' | 'ANALYZING' | 'DONE' | 'FAILED' = 'PENDING';
    let analysisUpdatedAt: Date | null = null;

    if (succeeded) {
      analysisStatus = 'DONE';
      analysisUpdatedAt = succeeded.updatedAt;
    } else if (failed) {
      analysisStatus = 'FAILED';
      analysisUpdatedAt = failed.updatedAt;
    } else {
      const pendingOrRunning = tasks.find(
        (t: any) =>
          t.status === TaskStatus.PENDING ||
          t.status === TaskStatus.RUNNING ||
          t.status === TaskStatus.RETRYING
      );
      if (pendingOrRunning) {
        analysisStatus = 'ANALYZING';
        analysisUpdatedAt = pendingOrRunning.updatedAt;
      }
    }

    // Stage 4: Enrich Data with Industrial Fields (QA, Gate, Blocking)
    const enrichShot = (parentScene: any) => (shot: any) => {
      // 1. QA Status
      // Check params and qualityScore
      let qaStatus: 'PASS' | 'WARN' | 'FAIL' | 'PENDING' = 'PASS';
      let blockingReason: string | null = null;

      // MVP Rule: Logic Check
      if (!shot.params) {
        qaStatus = 'FAIL';
        blockingReason = 'Missing parameters';
      }

      // 2. Asset Check
      const generatedAssets =
        shot.assets?.filter((a: any) => a.status === 'GENERATED' || a.status === 'PUBLISHED') || [];
      const hasAssets = generatedAssets.length > 0;

      // 3. Gate Logic
      let canGenerate = true;

      // Gate: Upstream Blocked
      if (parentScene.qaStatus === 'FAIL') {
        canGenerate = false;
        blockingReason = 'Parent scene QA failed';
      }

      /* 
      // Gate: Already Generated (Soft Gate - allows re-gen, but let's warn)
      if (hasAssets) {
           blockingReason = 'Assets already exist (Re-generation allowed)';
      }
      */

      return {
        ...shot,
        qaStatus,
        blockingReason: canGenerate ? null : blockingReason, // Clear reason if actionable
        canGenerate,
        assets: undefined, // Clean up DTO if not needed explicitly in list (or keep if frontend needs it)
      };
    };

    const enrichScene = (scene: any) => {
      // 1. QA Status: Check if summary exists (Stage 2) and visual score (Stage 4)
      const hasSummary = !!scene.summary;
      // const hasVisualScore = scene.visualDensityScore !== null; // Strict mode requirement
      let qaStatus: 'PASS' | 'WARN' | 'FAIL' | 'PENDING' = 'PASS';
      let blockingReason: string | null = null;

      if (!hasSummary) {
        qaStatus = 'FAIL';
        blockingReason = 'Missing scene summary (Analysis incomplete)';
      }
      // else if (!hasVisualScore) { qaStatus = 'WARN'; blockingReason = 'Missing visual density score'; }

      const canGenerate = qaStatus !== 'FAIL';

      return {
        ...scene,
        qaStatus,
        blockingReason,
        canGenerate,
        shots: scene.shots.map(enrichShot({ qaStatus, blockingReason, canGenerate })), // Pass parent scene's QA status to shots
      };
    };

    const seasons = project.seasons.map((season: any) => ({
      ...season,
      episodes: season.episodes.map((episode: any) => ({
        ...episode,
        scenes: episode.scenes.map(enrichScene),
      })),
    }));

    // For legacy episodes root
    // Note: This modifies the specialized 'episodes' property for backward compat
    const legacyEpisodes = project.episodes?.map((episode: any) => ({
      ...episode,
      scenes: episode.scenes.map(enrichScene),
    }));

    // [Start] Strict Status Mapping Logic
    // 1. Determine sourceType
    // Heuristic: If it has 'Demo' in name OR id is the known smoke project ID -> 'DEMO'
    // In future: Check novelSources table
    const SMOKE_PROJECT_ID = '00000000-0000-0000-0000-000000000001';
    let sourceType: 'DEMO' | 'NOVEL' = 'NOVEL';
    if (
      project.id === SMOKE_PROJECT_ID ||
      project.name.includes('Demo') ||
      project.name.includes('示例')
    ) {
      sourceType = 'DEMO';
    }

    // 2. Determine structureStatus
    // If seasons array is not empty -> 'READY'
    let structureStatus: 'EMPTY' | 'READY' = 'EMPTY';
    if (project.seasons && project.seasons.length > 0) {
      structureStatus = 'READY';
    }

    // 3. Determine productionStatus
    // If DEMO -> Force 'IDLE' (Never RUNNING)
    // Else map from analysisStatus
    let productionStatus: 'IDLE' | 'READY' | 'RUNNING' | 'DONE' = 'IDLE';

    if (sourceType === 'DEMO') {
      productionStatus = 'IDLE';
    } else {
      // Map based on analysisStatus (which is derived from Tasks)
      if (analysisStatus === 'ANALYZING') {
        productionStatus = 'RUNNING';
      } else if (analysisStatus === 'DONE') {
        productionStatus = 'DONE';
      } else if (structureStatus === 'READY') {
        // If structure is ready but not currently analyzing -> READY (or IDLE if nothing done yet?)
        // Let's say READY means we have base content and *can* produce/analyze further
        productionStatus = 'READY';
      } else {
        productionStatus = 'IDLE';
      }
    }
    // [End] Strict Status Mapping Logic

    // 返回项目树结构，包含分析状态
    const { tasks: _, ...projectWithoutTasks } = projectWithTasks;
    return {
      ...projectWithoutTasks,
      seasons,
      episodes: legacyEpisodes, // Assuming we want coverage here too
      analysisStatus,
      analysisUpdatedAt,
      // New Fields
      sourceType,
      productionStatus,
      structureStatus,
    };
  }

  async findAll(userId: string, organizationId: string, page = 1, pageSize = 100) {
    // Studio v0.7: 按组织过滤
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where: {
          organizationId, // 只返回当前组织的项目
        },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          status: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take,
      }),
      this.prisma.project.count({
        where: {
          organizationId,
        },
      }),
    ]);

    return {
      projects,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findById(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project as any;
  }

  async update(id: string, updateProjectDto: UpdateProjectDto) {
    await this.findById(id); // 确保项目存在

    // 使用事务确保数据一致性
    const project = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      return tx.project.update({
        where: { id },
        data: updateProjectDto,
      });
    });

    // 清理缓存
    await this.sceneGraphService.invalidateProjectSceneGraph(id);

    return project as any;
  }

  async delete(id: string) {
    await this.findById(id); // 确保项目存在

    // 使用事务删除项目及其所有子级（Season/Episode/Scene/Shot）
    // 注意：由于 schema 中已设置 onDelete: Cascade，Prisma 会自动级联删除子级
    // 但为了确保数据一致性和可追溯性，使用事务包装
    const project = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 先删除所有关联的 ShotJob、Task 等（如果需要）
      // 由于外键约束和 onDelete 策略，Season/Episode/Scene/Shot 会自动级联删除
      return tx.project.delete({
        where: { id },
      });
    });

    // 清理缓存
    await this.sceneGraphService.invalidateProjectSceneGraph(id);

    return project as any;
  }

  async checkOwnership(projectId: string, userId: string) {
    this.logger.log(
      `checkOwnership: projectId=${projectId}, userId=${userId}, hasPrisma=${!!this.prisma}`
    );
    if (!this.prisma) {
      this.logger.error('CRITICAL: this.prisma is undefined in checkOwnership!');
      // Emergency fix attempt? No, just throw so we see log
    }
    const project = await this.findById(projectId);
    if (project.ownerId !== userId) {
      throw new ForbiddenException('You do not have permission to access this project');
    }
    return project as any;
  }

  /**
   * 创建 Season（影视工业标准）
   */
  async createSeason(
    projectId: string,
    createSeasonDto: { index: number; title: string; description?: string; metadata?: any }
  ) {
    // 检查 Project 是否存在
    await this.findById(projectId);

    // 使用事务确保数据一致性
    const season = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 检查 index 是否已存在（唯一约束：projectId + index）
      const existing = await tx.season.findUnique({
        where: {
          projectId_index: {
            projectId,
            index: createSeasonDto.index,
          },
        },
      });

      if (existing) {
        throw new ConflictException(
          `Season with index ${createSeasonDto.index} already exists in this project`
        );
      }

      return tx.season.create({
        data: {
          projectId,
          index: createSeasonDto.index,
          title: createSeasonDto.title,
          description: createSeasonDto.description,
          metadata: createSeasonDto.metadata || {},
        },
      });
    });

    // 清理缓存
    await this.sceneGraphService.invalidateProjectSceneGraph(projectId);

    return season;
  }

  /**
   * 创建 Episode（支持 Season 和 Project 两种模式，向后兼容）
   */
  async createEpisode(
    projectIdOrSeasonId: string,
    createEpisodeDto: CreateEpisodeDto,
    options?: { isSeasonId?: boolean }
  ) {
    const isSeasonId = options?.isSeasonId ?? false;

    // 使用事务确保数据一致性
    const episode = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (isSeasonId) {
        // 影视工业标准：通过 Season 创建
        const season = await tx.season.findUnique({
          where: { id: projectIdOrSeasonId },
          include: { project: true },
        });

        if (!season) {
          throw new NotFoundException('Season not found');
        }

        return tx.episode.create({
          data: {
            seasonId: projectIdOrSeasonId,
            projectId: season.projectId,
            index: createEpisodeDto.index,
            name:
              createEpisodeDto.name ||
              createEpisodeDto.title ||
              `Episode ${createEpisodeDto.index}`,
            summary: createEpisodeDto.summary,
          },
        });
      } else {
        // V3.0: 直接关联 Project，移除 Season 层
        const project = await this.findById(projectIdOrSeasonId);

        return tx.episode.create({
          data: {
            seasonId: null as any, // [Audit] Removed Season layer
            projectId: projectIdOrSeasonId,
            index: createEpisodeDto.index,
            name:
              createEpisodeDto.name ||
              createEpisodeDto.title ||
              `Episode ${createEpisodeDto.index}`,
            summary: createEpisodeDto.summary,
          },
        });
      }
    });

    // 清理缓存（需要获取 projectId）
    const projectId = isSeasonId
      ? (
        await this.prisma.season.findUnique({
          where: { id: projectIdOrSeasonId },
          select: { projectId: true },
        })
      )?.projectId
      : projectIdOrSeasonId;
    if (projectId) {
      await this.sceneGraphService.invalidateProjectSceneGraph(projectId);
    }

    return episode;
  }

  async checkEpisodeOwnership(episodeId: string, userId: string) {
    const episode = await this.prisma.episode.findUnique({
      where: { id: episodeId },
      include: {
        project: true,
      },
    });

    if (!episode) {
      throw new NotFoundException('Episode not found');
    }

    if (!episode.project) {
      throw new NotFoundException('Project not found for episode');
    }

    if (episode.project.ownerId !== userId) {
      throw new ForbiddenException('You do not have permission to access this episode');
    }

    return episode;
  }

  async createScene(episodeId: string, createSceneDto: CreateSceneDto) {
    // 使用事务确保数据一致性
    const scene = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 检查 Episode 是否存在
      const episode = await tx.episode.findUnique({
        where: { id: episodeId },
        include: {
          season: { select: { projectId: true } },
          project: { select: { id: true } },
          chapter: { select: { id: true } },
        },
      });

      if (!episode) {
        throw new NotFoundException('Episode not found');
      }

      // CE07: 分镜生成前读取短期记忆（占位实现）
      // TODO: 实现真实逻辑（使用 MemoryShortTerm 进行推理）
      if (episode.chapter?.id) {
        try {
          const shortTermMemory = await tx.memoryShortTerm.findFirst({
            where: { chapterId: episode.chapter.id },
          });
          // 如果存在短期记忆，可以在创建 Scene 时使用（当前仅记录日志）
          if (shortTermMemory) {
            this.logger.debug(`CE07: Using short-term memory for chapter ${episode.chapter.id}`);
          }
        } catch (error: any) {
          // 软失败：记录 audit_logs（符合 SafetySpec）
          // 注意：在事务中无法直接注入 AuditLogService，使用 Prisma 直接写入
          await tx.auditLog
            .create({
              data: {
                action: 'CE07_MEMORY_READ_FAIL',
                resourceType: 'memory',
                resourceId: episode.chapter.id,
                details: {
                  reason: 'CE07 short-term memory read failed',
                  error: error?.message || 'Unknown error',
                  chapterId: episode.chapter.id,
                },
              },
            })
            .catch(() => {
              // 审计失败不阻断
            });
          // 结构化日志（不打堆栈）
          this.logger.warn(
            {
              tag: 'CE07_MEMORY_READ_FAIL',
              chapterId: episode.chapter.id,
              error: error?.message || 'Unknown error',
            },
            'CE07 memory read failed'
          );
        }
      }

      return tx.scene.create({
        data: {
          episodeId,
          projectId: episode.projectId || episode.project?.id || episode.season?.projectId || '',
          sceneIndex: createSceneDto.index, // V3.0
          title: createSceneDto.title || `Scene ${createSceneDto.index}`,
          summary: createSceneDto.summary,
        },
      });
    });

    // 清理缓存（需要获取 projectId）
    const episode = await this.prisma.episode.findUnique({
      where: { id: episodeId },
      select: { projectId: true, season: { select: { projectId: true } } },
    });
    const projectId = episode?.projectId || episode?.season?.projectId;
    if (projectId) {
      await this.sceneGraphService.invalidateProjectSceneGraph(projectId);
    }

    return scene;
  }

  async checkSceneOwnership(sceneId: string, userId: string) {
    const scene = await this.prisma.scene.findUnique({
      where: { id: sceneId },
      include: {
        episode: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!scene) {
      throw new NotFoundException('Scene not found');
    }

    // 获取 project
    const project = await this.projectResolver.resolveProjectAuthOnly(scene.episode);
    if (!project) {
      throw new NotFoundException(`Project not found for scene ${sceneId}`);
    }

    if (project.ownerId !== userId) {
      throw new ForbiddenException('You do not have permission to access this scene');
    }

    return scene;
  }

  async updateScene(id: string, updateSceneDto: UpdateSceneDto) {
    // 使用事务确保数据一致性
    const scene = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.scene.findUniqueOrThrow({ where: { id } });

      return tx.scene.update({
        where: { id },
        data: updateSceneDto,
      });
    });

    // 清理缓存（需要获取 projectId）
    const sceneWithProject = await this.prisma.scene.findUnique({
      where: { id },
      select: {
        episode: {
          select: {
            projectId: true,
            season: { select: { projectId: true } },
          },
        },
      },
    });
    const projectId =
      sceneWithProject?.episode?.projectId || sceneWithProject?.episode?.season?.projectId;
    if (projectId) {
      await this.sceneGraphService.invalidateProjectSceneGraph(projectId);
    }

    return scene;
  }

  async createShot(sceneId: string, createShotDto: CreateShotDto, organizationId?: string) {
    // 使用事务确保数据一致性
    const shot = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 检查 Scene 是否存在，并获取 Project 信息以推导 organizationId
      const scene = await tx.scene.findUnique({
        where: { id: sceneId },
        include: {
          episode: {
            include: {
              project: true,
              season: {
                include: {
                  project: true,
                },
              },
            },
          },
        },
      });

      if (!scene) {
        throw new NotFoundException('Scene not found');
      }

      // Studio v0.7: 如果未传入 organizationId，从 Project 推导
      const episodeProject = await this.projectResolver.resolveProjectAuthOnly(scene.episode);
      const finalOrganizationId =
        organizationId ||
        episodeProject?.organizationId ||
        scene.episode?.season?.project?.organizationId;

      if (!finalOrganizationId) {
        throw new BadRequestException('Cannot determine organizationId for shot');
      }

      return tx.shot.create({
        data: {
          sceneId,
          index: createShotDto.index ?? 1,
          type: createShotDto.type,
          params: createShotDto.params ?? {},
          qualityScore: {}, // 确保 qualityScore 字段有默认值
          organizationId: finalOrganizationId,
          // 如果 createShotDto 包含 title/description，也写入
          title: (createShotDto as any).title,
          description: (createShotDto as any).description,
        },
      });
    });

    // 清理缓存（需要获取 projectId）
    const scene = await this.prisma.scene.findUnique({
      where: { id: sceneId },
      select: {
        episode: {
          select: {
            projectId: true,
            season: { select: { projectId: true } },
          },
        },
      },
    });
    const projectId = scene?.episode?.projectId || scene?.episode?.season?.projectId;
    if (projectId) {
      await this.sceneGraphService.invalidateProjectSceneGraph(projectId);
    }

    return shot;
  }

  async checkShotOwnership(shotId: string, userId: string, organizationId: string) {
    const shot = await this.prisma.shot.findUnique({
      where: { id: shotId },
      include: {
        scene: {
          include: {
            episode: {
              include: {
                project: true,
                season: {
                  include: {
                    project: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!shot) {
      throw new NotFoundException('Shot not found');
    }

    // 获取 project（支持 Season 和 Project 两种结构）
    const shotProject = await this.projectResolver.resolveProjectAuthOnly(shot.scene.episode);
    if (!shotProject) {
      throw new NotFoundException(`Project not found for shot ${shotId}`);
    }

    // Studio v0.7: 检查组织权限
    if (shotProject.organizationId !== organizationId) {
      throw new ForbiddenException('You do not have permission to access this shot');
    }

    return shot;
  }

  async findShotById(id: string, organizationId: string) {
    const shot = await this.prisma.shot.findUnique({
      where: { id },
      include: {
        qualityScores: true,
        safetyResults: true,
        scene: {
          include: {
            episode: {
              include: {
                project: true,
              },
            },
          },
        },
      },
    });

    if (!shot) {
      throw new NotFoundException('Shot not found');
    }

    // 获取 project
    const shotProject = await this.projectResolver.resolveProjectAuthOnly(shot.scene.episode);
    if (!shotProject) {
      throw new NotFoundException(`Project not found for shot ${id}`);
    }

    // Studio v0.7: 检查组织权限
    if (shotProject.organizationId !== organizationId) {
      throw new ForbiddenException('You do not have permission to access this shot');
    }

    return shot;
  }

  async updateShot(id: string, updateShotDto: UpdateShotDto, organizationId: string) {
    // 使用事务确保数据一致性
    const shot = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const shot = await tx.shot.findUnique({
        where: { id },
        include: {
          scene: {
            include: {
              episode: {
                include: {
                  project: true,
                  season: {
                    include: {
                      project: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!shot) {
        throw new NotFoundException('Shot not found');
      }

      // Studio v0.7: 检查组织权限
      const shotProject = await this.projectResolver.resolveProjectAuthOnly(shot.scene.episode);
      if (!shotProject || shotProject.organizationId !== organizationId) {
        throw new ForbiddenException('You do not have permission to update this shot');
      }

      // 转换 updateShotDto 以匹配 Prisma 类型
      const updateData: any = { ...updateShotDto };
      // 如果 status 是字符串，需要确保它是有效的 ShotStatus
      if (updateData.status && typeof updateData.status === 'string') {
        // 保持原值，Prisma 会进行验证
        updateData.status = updateData.status as any;
      }

      return tx.shot.update({
        where: { id },
        data: updateData,
      });
    });

    // 清理缓存（需要获取 projectId）
    const shotWithProject = await this.prisma.shot.findUnique({
      where: { id },
      select: {
        scene: {
          select: {
            episode: {
              select: {
                projectId: true,
                season: { select: { projectId: true } },
              },
            },
          },
        },
      },
    });
    const projectId =
      shotWithProject?.scene?.episode?.projectId ||
      shotWithProject?.scene?.episode?.season?.projectId;
    if (projectId) {
      await this.sceneGraphService.invalidateProjectSceneGraph(projectId);
    }

    return shot;
  }

  async listEpisodes(
    userId: string,
    organizationId: string,
    filters: {
      projectId?: string;
      seasonId?: string;
      page?: number;
      pageSize?: number;
    }
  ) {
    const { projectId, seasonId, page = 1, pageSize = 20 } = filters;
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const where: any = {
      season: {
        project: { organizationId },
      },
    };
    if (seasonId) where.seasonId = seasonId;
    if (projectId) where.season.projectId = projectId;

    const [data, total] = await Promise.all([
      this.prisma.episode.findMany({
        where,
        orderBy: { index: 'asc' }, // Strict Sort by Index
        skip,
        take,
        select: {
          // Strict Minimal Selection
          id: true,
          projectId: true, // Legacy field
          seasonId: true,
          index: true,
          name: true,
          // Episode has no createdAt/updatedAt in schema
        },
      }),
      this.prisma.episode.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async listScenes(
    userId: string,
    organizationId: string,
    filters: {
      projectId?: string;
      episodeId?: string;
      page?: number;
      pageSize?: number;
    }
  ) {
    const { projectId, episodeId, page = 1, pageSize = 20 } = filters;
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const where: any = {
      episode: {
        season: {
          project: { organizationId },
        },
      },
    };
    if (episodeId) where.episodeId = episodeId;
    if (projectId) where.episode.season.projectId = projectId;

    const [data, total] = await Promise.all([
      this.prisma.scene.findMany({
        where,
        orderBy: { sceneIndex: 'asc' },
        skip,
        take,
        select: {
          // Strict Minimal Selection
          id: true,
          projectId: true, // Legacy field
          episodeId: true,
          sceneIndex: true,
          title: true,
          // Scene has no createdAt/updatedAt in schema
        },
      }),
      this.prisma.scene.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async listShots(
    userId: string,
    organizationId: string,
    filters: {
      projectId?: string;
      episodeId?: string;
      sceneId?: string;
      status?: string;
      reviewStatus?: string;
      q?: string;
      page?: number;
      pageSize?: number;
    }
  ) {
    const {
      projectId,
      episodeId,
      sceneId,
      status,
      reviewStatus,
      q,
      page = 1,
      pageSize = 20,
    } = filters;
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // 构建 where 条件
    const where: any = {};

    // 层级过滤：通过 scene -> episode -> project 关联（移除 Season 层）
    if (sceneId) {
      where.sceneId = sceneId;
    } else if (episodeId) {
      where.scene = {
        episodeId,
      };
    } else if (projectId) {
      where.scene = {
        episode: {
          projectId,
        },
      };
    } else {
      // Studio v0.7: 如果没有指定层级，只返回当前组织的 Shots
      where.scene = {
        episode: {
          project: {
            organizationId, // 按组织过滤
          },
        },
      };
    }

    // Studio v0.7: 强制按组织过滤（通过 Shot.organizationId 或 Project.organizationId）
    // 如果 Shot 有 organizationId 字段，直接使用；否则通过 Project 关联过滤

    // 状态过滤（Shot 模型没有 status 字段，暂时移除）
    // if (status) {
    //   where.status = status;
    // }

    // 审核状态过滤（Shot 模型没有 reviewStatus 字段，暂时移除）
    // if (reviewStatus) {
    //   where.reviewStatus = reviewStatus;
    // }

    // 关键词搜索（title, description, dialogue, prompt）
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { dialogue: { contains: q, mode: 'insensitive' } },
        { prompt: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [shots, total] = await Promise.all([
      this.prisma.shot.findMany({
        where,
        select: {
          id: true,
          index: true,
          type: true,
          title: true,
          description: true,
          reviewedAt: true,
          scene: {
            select: {
              id: true,
              sceneIndex: true,
              episode: {
                select: {
                  id: true,
                  index: true,
                  name: true,
                  project: {
                    select: {
                      id: true,
                      name: true,
                      organizationId: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          index: 'asc',
        },
        skip,
        take,
      }),
      this.prisma.shot.count({ where }),
    ]);

    // Studio v0.7: 过滤掉不属于当前组织的 Shots
    const filteredShots = shots.filter((shot: any) => {
      const shotProject = shot.scene.episode?.project;
      return shotProject?.organizationId === organizationId;
    });

    // 格式化返回数据
    const formattedShots = filteredShots.map((shot: any) => {
      const ep = shot.scene?.episode;
      const proj = ep?.project;
      return {
        id: shot.id,
        index: shot.index,
        type: shot.type,
        title: shot.title,
        description: shot.description,
        reviewedAt: shot.reviewedAt,
        projectId: proj?.id,
        projectName: proj?.name,
        episodeId: ep?.id,
        episodeName: ep?.name,
        sceneId: shot.scene?.id,
        sceneIndex: shot.scene?.sceneIndex,
      };
    });

    return {
      shots: formattedShots,
      total: filteredShots.length,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
  async getProjectOverview(projectId: string, organizationId: string): Promise<ProjectOverviewDTO> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      include: {
        tasks: { orderBy: { createdAt: 'desc' } },
        novelSources: true,
      },
    });

    if (!project) throw new NotFoundException('Project not found');

    // 1. Stats & Real Data Fetching
    const [seasons, episodes, scenes, shots, runningJobs, costAgg, auditLogs] = await Promise.all([
      this.prisma.season.count({ where: { projectId } }),
      this.prisma.episode.count({
        where: { season: { projectId } },
      }),
      this.prisma.scene.count({ where: { projectId } }),
      this.prisma.shot.count({
        where: {
          scene: {
            episode: {
              season: {
                projectId,
              },
            },
          },
        },
      }),
      this.prisma.shotJob.findMany({
        where: { projectId, status: { in: ['PENDING', 'RUNNING'] } },
        include: { task: true },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.billingLedger.aggregate({
        where: { projectId: projectId },
        _sum: { amount: true },
      }),
      // Real Audit Logs: Recent actions on this project
      this.prisma.auditLog.findMany({
        where: {
          OR: [
            { resourceType: 'project', resourceId: projectId },
            { resourceType: 'scene', details: { path: ['projectId'], equals: projectId } }, // Optional: if details had projectId, but simpler to rely on resourceId for now OR extensive linking.
            // For MVP, strictly matching resourceId=projectId or generic project actions is safest/fastest.
            // Let's stick to resourceType 'project' + 'novel_source' etc if we can link them, but simpler is better first.
          ],
        },
        include: { user: { select: { id: true, email: true, avatar: true } } }, // Get actor info
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    // 2. Flow Status Logic
    const hasNovel = !!project.novelSources;
    const structureTask = project.tasks.find((t) => t.type === TaskTypeEnum.NOVEL_ANALYSIS);
    const structureStatus = structureTask?.status;

    // Node 1: Import
    const flowImport: any = {
      key: 'NOVEL_IMPORT',
      label: 'Novel Import',
      status: hasNovel ? 'DONE' : 'PENDING',
      gate: { canRun: true },
      actions: [
        {
          key: 'RUN',
          label: hasNovel ? 'Re-Import' : 'Import Novel',
          enabled: true,
          href: '/import',
        },
      ],
    };

    // Node 2: Structure
    const canRunStructure = hasNovel;
    let structureNodeStatus: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' = 'PENDING';
    if (structureStatus === 'SUCCEEDED') structureNodeStatus = 'DONE';
    else if (structureStatus === 'RUNNING') structureNodeStatus = 'RUNNING';
    else if (structureStatus === 'FAILED') structureNodeStatus = 'FAILED';

    const flowStructure: any = {
      key: 'STRUCTURE_ANALYSIS',
      label: 'Structure Analysis',
      status: structureNodeStatus,
      gate: {
        canRun: canRunStructure,
        blockedReason: !canRunStructure ? 'Depends on Novel Import' : undefined,
        missingInputs: !canRunStructure ? [{ code: 'MISSING_NOVEL', title: 'Missing Novel' }] : [],
      },
      actions: [
        {
          key: 'RUN',
          label:
            structureNodeStatus === 'RUNNING'
              ? 'Analyzing...'
              : structureNodeStatus === 'DONE'
                ? 'Re-Analyze'
                : 'Start Analysis',
          enabled: canRunStructure && structureNodeStatus !== 'RUNNING',
          disabledReason:
            structureNodeStatus === 'RUNNING'
              ? 'Analysis in progress'
              : !canRunStructure
                ? 'Missing Novel'
                : undefined,
        },
      ],
    };

    // Placeholders for future nodes (using cast to any to avoid strict typing needed for strict DTO matching right now)
    const flowScript: any = {
      key: 'SCRIPT_SEMANTIC',
      label: 'Script Semantic',
      status: 'PENDING',
      gate: { canRun: structureNodeStatus === 'DONE' },
      actions: [],
    };
    const flowShot: any = {
      key: 'SHOT_PLANNING',
      label: 'Shot Planning',
      status: 'PENDING',
      gate: { canRun: false },
      actions: [],
    };
    const flowAsset: any = {
      key: 'ASSET_GENERATION',
      label: 'Asset Gen',
      status: 'PENDING',
      gate: { canRun: false },
      actions: [],
    };
    const flowVideo: any = {
      key: 'VIDEO_GENERATION',
      label: 'Video Gen',
      status: 'PENDING',
      gate: { canRun: false },
      actions: [],
    };
    const flowExport: any = {
      key: 'COMPOSE_EXPORT',
      label: 'Export',
      status: 'PENDING',
      gate: { canRun: false },
      actions: [],
    };

    // 3. Next Action Calculation
    // Stage 4: Industrial Grade Next Action
    let nextAction: any = {
      action: {
        key: 'CHECK',
        label: 'Check Status',
        canRun: false,
        disabledReason: 'Unknown state',
      },
      why: 'Unknown state',
      estimate: { etaSec: 0 },
    };

    if (!hasNovel) {
      nextAction = {
        action: { key: 'IMPORT', label: 'Go to Import', href: '/import', canRun: true },
        why: 'Project is empty. Novel import required to start.',
        estimate: { etaSec: 60 },
      };
    } else if (structureNodeStatus !== 'DONE') {
      if (structureNodeStatus === 'RUNNING') {
        nextAction = {
          action: {
            key: 'VIEW_LOGS',
            label: 'View Analysis Logs',
            href: `/projects/${projectId}/logs`,
            canRun: true,
          },
          why: 'Structure analysis is currently running.',
          estimate: { etaSec: 120 },
        };
      } else if (structureNodeStatus === 'FAILED') {
        nextAction = {
          action: {
            key: 'RETRY',
            label: 'Retry Structure Analysis',
            href: `/projects/${projectId}/structure`,
            canRun: true,
          },
          why: 'Previous analysis failed. Please retry or check logs.',
          estimate: { etaSec: 300 },
        };
      } else {
        nextAction = {
          action: { key: 'RUN', label: 'Start Structure Analysis', canRun: true },
          why: 'Novel imported. Ready for structure analysis.',
          estimate: { etaSec: 300 },
        };
      }
    } else {
      const sceneCount = scenes;
      if (sceneCount === 0) {
        nextAction = {
          action: {
            key: 'REVIEW',
            label: 'Review Structure',
            href: `/projects/${projectId}/structure`,
            canRun: true,
          },
          why: 'Analysis done but no scenes found. Please review.',
          estimate: { etaSec: 60 },
        };
      } else {
        nextAction = {
          action: {
            key: 'REVIEW',
            label: 'Enter Workbench',
            href: `/projects/${projectId}/structure`,
            canRun: true,
          },
          why: 'Structure ready. Proceed to scene refinement and shot planning.',
          estimate: { etaSec: 600 },
        };
      }
    }

    // 4. Quality Status Aggregation
    // MVP: If we have seasons/episodes, structure is likely OK.
    const structureQuality =
      seasons > 0 && episodes > 0 ? 'OK' : structureNodeStatus === 'DONE' ? 'WARN' : 'OK';

    // 5. Audit Log Transformation
    const recentAudit = auditLogs.map((log: any) => ({
      at: log.createdAt.toISOString(),
      actor: {
        id: log.userId || log.apiKeyId || 'system',
        name: log.user?.email?.split('@')[0] || log.apiKeyId || 'System', // Fallback name
      },
      action: log.action,
      result: 'OK' as const, // AuditLog doesn't explicitly store result status (assumed OK if logged, or details has it)
    }));

    return {
      header: {
        id: project.id,
        idShort: project.id.substring(0, 8),
        name: project.name,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
        status: project.status === 'in_progress' ? 'RUNNING' : 'DRAFT',
        stage: {
          currentKey: structureNodeStatus === 'DONE' ? 'SCRIPT_SEMANTIC' : 'STRUCTURE_ANALYSIS',
          currentLabel: 'Development',
          progressPct: 30,
        },
        blocking: { isBlocked: false },
        risk: { quality: structureQuality, cost: 'OK', compliance: 'OK' },
      },
      flow: {
        nodes: [flowImport, flowStructure, flowScript, flowShot, flowAsset, flowVideo, flowExport],
      },
      next: nextAction,
      stats: {
        seasons: seasons,
        episodes: episodes,
        scenes: scenes,
        shots: shots,
        issues: { total: 0, missingBindings: 0, semanticConflicts: 0, qaFailed: 0 },
        links: { structureView: '', issuesView: '' },
      },
      jobs: {
        running: await Promise.all(
          runningJobs.map(async (j: any) => {
            const taskPayload = j.task?.payload as any;
            const isShredder = taskPayload?.mode === 'SHREDDER';

            let currentStep: string | undefined = undefined;
            let progressPct = 0;
            let breakdown: any = undefined;

            if (isShredder && j.taskId) {
              const chunkStats = await this.prisma.shotJob.groupBy({
                by: ['status'],
                where: {
                  taskId: j.taskId,
                  type: 'NOVEL_CHUNK_PARSE',
                },
                _count: true,
              });

              let totalChunks = 0;
              let succeededChunks = 0;
              let failedChunks = 0;
              let runningChunks = 0;

              for (const stat of chunkStats) {
                const count = stat._count;
                totalChunks += count;
                if (stat.status === 'SUCCEEDED') succeededChunks += count;
                if (stat.status === 'FAILED') failedChunks += count;
                if (stat.status === 'RUNNING') runningChunks += count;
              }

              // Calculate Step & Progress (Same as ContractStoryController)
              if (j.status === 'PENDING' || j.status === 'RUNNING') {
                currentStep = 'CE06_SCAN';
                progressPct = 5;
              } else {
                currentStep = 'CE06_PARSING';
                if (totalChunks > 0) {
                  progressPct = Math.floor(10 + (succeededChunks / totalChunks) * 90);
                } else {
                  progressPct = 10;
                }
              }

              breakdown = {
                scanPct: j.status === 'SUCCEEDED' ? 100 : 5,
                parsePct: totalChunks > 0 ? Math.floor((succeededChunks / totalChunks) * 100) : 0,
                doneChunks: succeededChunks,
                totalChunks,
              };
            } else {
              // Legacy or Single Job
              progressPct = j.status === 'SUCCEEDED' ? 100 : 50;
              if (j.type === 'CE06_NOVEL_PARSING') currentStep = 'CE06_PARSING';
              if (j.type === 'NOVEL_SCAN_TOC') currentStep = 'CE06_SCAN';
            }

            return {
              id: j.id,
              type: j.type,
              status: j.status as any,
              progressPct,
              currentStep,
              progressBreakdown: breakdown,
              startedAt: j.createdAt.toISOString(),
              workerId: j.workerId,
            };
          })
        ),
        queuedCount: 0,
        failed: [],
      },
      quality: {
        structure: structureQuality as any,
        semantic: 'OK', // Placeholder for now
        visual: 'OK',
      },
      cost: {
        total: { money: Math.abs(Number(costAgg._sum?.amount || 0n) / 100) },
        last24h: { money: 0.0 }, // Pending implementation: filter by createdAt > now-24h
        currentRunEstimate: { money: 0.0 },
        alert: { level: 'OK' },
      },
      audit: {
        recent: recentAudit,
        href: `/projects/audit`, // General audit log page
      },
    };
  }

  /**
   * Dev/Smoke Only: 创建或查找 Demo 项目(含 1/2/6/30 结构)
   * 用于本地证据采集和快速演示
   */
  async createDemoStructure(userId: string, organizationId: string) {
    const DEMO_PROJECT_NAME = 'Demo Structure Project';

    // 1. 查找或创建 Demo 项目
    let project = await this.prisma.project.findFirst({
      where: {
        ownerId: userId,
        organizationId,
        name: DEMO_PROJECT_NAME,
      },
    });

    if (!project) {
      project = await this.prisma.project.create({
        data: {
          name: DEMO_PROJECT_NAME,
          description: 'Auto-generated demo for structure contract verification',
          ownerId: userId,
          organizationId,
          status: 'in_progress',
        },
      });
      this.logger.log(`[DEMO] Created project: ${project.id}`);
    } else {
      this.logger.log(`[DEMO] Found existing project: ${project.id}`);
    }

    // Ensure Project Member (Idempotent)
    const existingMember = await this.prisma.projectMember.findFirst({
      where: { userId, projectId: project.id },
    });

    if (!existingMember) {
      let ownerRole = await this.prisma.role.findFirst({ where: { name: 'OWNER' } });
      if (!ownerRole) {
        try {
          ownerRole = await this.prisma.role.create({ data: { name: 'OWNER', level: 100 } });
        } catch (e) {
          ownerRole = await this.prisma.role.findFirst({ where: { name: 'OWNER' } });
        }
      }
      if (ownerRole) {
        await this.prisma.projectMember.create({
          data: { projectId: project.id, userId, roleId: ownerRole.id },
        });
        this.logger.log(`[DEMO] Added owner member: ${userId}`);
      }
    }

    // 2. 幂等创建结构: 1 Season
    let season = await this.prisma.season.findFirst({
      where: { projectId: project.id, index: 1 },
    });

    if (!season) {
      season = await this.prisma.season.create({
        data: {
          projectId: project.id,
          index: 1,
          title: 'Season 1',
        },
      });
      this.logger.log(`[DEMO] Created Season 1`);
    }

    // 3. 创建 2 Episodes
    for (let epIndex = 1; epIndex <= 2; epIndex++) {
      let episode = await this.prisma.episode.findFirst({
        where: { seasonId: season.id, index: epIndex },
      });

      if (!episode) {
        episode = await this.prisma.episode.create({
          data: {
            seasonId: season.id,
            projectId: project.id, // Legacy field
            index: epIndex,
            name: `Episode ${epIndex}`,
          },
        });
        this.logger.log(`[DEMO] Created Episode ${epIndex}`);
      }

      // 4. 每集创建 3 Scenes
      for (let scIndex = 1; scIndex <= 3; scIndex++) {
        let scene = await this.prisma.scene.findFirst({
          where: { episodeId: episode.id, sceneIndex: scIndex },
        });

        if (!scene) {
          scene = await this.prisma.scene.create({
            data: {
              episodeId: episode.id,
              projectId: project.id, // Legacy field
              sceneIndex: scIndex,
              title: `Scene ${epIndex}-${scIndex}`,
              summary: `Auto-generated summary for Scene ${epIndex}-${scIndex}`,
            },
          });
          this.logger.log(`[DEMO] Created Scene ${epIndex}-${scIndex}`);
        }

        // 5. 每场景创建 5 Shots
        for (let shotIndex = 1; shotIndex <= 5; shotIndex++) {
          const existing = await this.prisma.shot.findFirst({
            where: { sceneId: scene.id, index: shotIndex },
          });

          if (!existing) {
            await this.prisma.shot.create({
              data: {
                sceneId: scene.id,
                index: shotIndex,
                type: shotIndex % 2 === 0 ? 'CLOSEUP' : 'FULL',
                title: `Shot ${epIndex}-${scIndex}-${shotIndex}`,
                organizationId,
              },
            });
          }
        }
      }
    }

    this.logger.log(`[DEMO] Demo structure complete for project ${project.id}`);
    return { projectId: project.id };
  }
}
