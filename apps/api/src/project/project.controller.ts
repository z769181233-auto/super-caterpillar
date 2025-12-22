import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ProjectService } from './project.service';
import { StructureGenerateService } from './structure-generate.service';
import { SceneGraphService } from './scene-graph.service';
import { JobService } from '../job/job.service';
import { TaskService } from '../task/task.service';
import { PermissionService } from '../permission/permission.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtOrHmacGuard } from '../auth/guards/jwt-or-hmac.guard';
import { ProjectOwnershipGuard } from './guards/project-ownership.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentOrganization } from '../auth/decorators/current-organization.decorator';
import { AuthenticatedUser } from '@scu/shared-types';
import { TaskType as TaskTypeEnum, TaskStatus as TaskStatusEnum, JobType as JobTypeEnum } from 'database';
import { Req } from '@nestjs/common';
import { Request } from 'express';
import { Permissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { SystemPermissions, ProjectPermissions } from '../permission/permission.constants';
import {
  CreateProjectDto,
  UpdateProjectDto,
  CreateEpisodeDto,
  CreateSceneDto,
  UpdateSceneDto,
  CreateShotDto,
  UpdateShotDto,
} from './dto';
import { ListShotsDto } from './dto/list-shots.dto';
import { randomUUID } from 'crypto';
import { AuditAction } from '../audit/audit.decorator';
import { AuditActions } from '../audit/audit.constants';

@Controller('projects')
@UseGuards(JwtOrHmacGuard, PermissionsGuard)
export class ProjectController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly structureGenerateService: StructureGenerateService,
    private readonly sceneGraphService: SceneGraphService,
    private readonly jobService: JobService,
    private readonly taskService: TaskService,
    private readonly permissionService: PermissionService,
    private readonly auditLogService: AuditLogService
  ) { }

  @Get()
  async getProjects(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string | null,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ): Promise<any> {
    if (!organizationId) {
      throw new Error('No organization context');
    }
    const pageNum = page ? parseInt(page, 10) : 1;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : 100;
    const result = await this.projectService.findAll(user.userId, organizationId, pageNum, pageSizeNum);
    return {
      success: true,
      data: result,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Dev/Smoke Only: 创建示例项目(含 1/2/6/30 结构)
   * 用于本地证据采集和快速演示
   * 生产环境门禁: ENABLE_DEMO_SEED_ENDPOINT=true
   */
  @Post('demo-structure')
  @Permissions(SystemPermissions.AUTH) // 仅需登录
  async createDemoStructure(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string | null,
  ): Promise<any> {
    // 环境门禁: 仅 dev/smoke 开启
    const isDemoEnabled = process.env.ENABLE_DEMO_SEED_ENDPOINT === 'true';
    if (!isDemoEnabled) {
      throw new NotFoundException('Endpoint not available');
    }

    if (!organizationId) {
      throw new Error('No organization context');
    }

    const result = await this.projectService.createDemoStructure(user.userId, organizationId);

    return {
      success: true,
      data: result,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Post()
  @Permissions(SystemPermissions.AUTH, SystemPermissions.PROJECT_CREATE)
  @AuditAction(AuditActions.PROJECT_CREATE)
  async createProject(
    @Body() createProjectDto: CreateProjectDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string | null,
    @Req() request: Request
  ): Promise<any> {
    if (!organizationId) {
      throw new Error('No organization context');
    }
    // Studio v0.7: 权限检查
    await this.permissionService.assertCanManageProject(user.userId, organizationId);
    const project = await this.projectService.create(createProjectDto, user.userId, organizationId);

    // 记录审计日志
    const requestInfo = AuditLogService.extractRequestInfo(request);
    const apiKeyId = (request as any).apiKeyId; // 从 HMAC Guard 中获取（如果存在）
    await this.auditLogService.record({
      userId: user.userId,
      apiKeyId,
      action: 'PROJECT_CREATED',
      resourceType: 'project',
      resourceId: project.id,
      ip: requestInfo.ip,
      userAgent: requestInfo.userAgent,
      details: {
        name: project.name,
        organizationId,
      },
    });

    return {
      success: true,
      data: project,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id')
  @UseGuards(ProjectOwnershipGuard)
  async getProject(
    @Param('id') id: string,
    @CurrentOrganization() organizationId: string | null
  ): Promise<any> {
    if (!organizationId) {
      throw new Error('No organization context');
    }
    const project = await this.projectService.findByIdWithHierarchy(id, organizationId);
    return {
      success: true,
      data: project,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id/tree')
  @UseGuards(ProjectOwnershipGuard)
  async getProjectTree(
    @Param('id') id: string,
    @CurrentOrganization() organizationId: string | null
  ): Promise<any> {
    if (!organizationId) {
      throw new Error('No organization context');
    }
    const tree = await this.projectService.findTreeById(id, organizationId);
    return {
      success: true,
      data: tree,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id/scene-graph')
  @UseGuards(ProjectOwnershipGuard)
  @Permissions(ProjectPermissions.PROJECT_READ)
  @AuditAction(AuditActions.PROJECT_CREATE) // 使用 PROJECT_CREATE 作为读取操作的审计动作
  async getProjectSceneGraph(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string | null
  ): Promise<any> {
    if (!organizationId) {
      throw new Error('No organization context');
    }
    // 检查项目权限（ProjectOwnershipGuard 已处理，这里再次确认）
    await this.projectService.checkOwnership(id, user.userId);
    const sceneGraph = await this.sceneGraphService.getProjectSceneGraph(id);
    return {
      success: true,
      data: sceneGraph,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':id/overview')
  @UseGuards(ProjectOwnershipGuard)
  @Permissions(ProjectPermissions.PROJECT_READ)
  @AuditAction(AuditActions.PROJECT_CREATE)
  async getProjectOverview(
    @Param('id') id: string,
    @CurrentOrganization() organizationId: string | null
  ): Promise<any> {
    if (!organizationId) {
      throw new Error('No organization context');
    }
    const overview = await this.projectService.getProjectOverview(id, organizationId);
    return {
      success: true,
      data: overview,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':projectId/episodes')
  @Permissions(ProjectPermissions.PROJECT_READ)
  async listEpisodes(
    @Param('projectId') projectId: string,
    @Query('seasonId') seasonId: string,
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string | null
  ): Promise<any> {
    if (!organizationId) throw new Error('No organization context');
    await this.projectService.checkOwnership(projectId, user.userId);
    const result = await this.projectService.listEpisodes(user.userId, organizationId, {
      projectId,
      seasonId,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 100
    });
    return {
      success: true,
      data: result,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':projectId/scenes')
  @Permissions(ProjectPermissions.PROJECT_READ)
  async listScenes(
    @Param('projectId') projectId: string,
    @Query('episodeId') episodeId: string,
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string | null
  ): Promise<any> {
    if (!organizationId) throw new Error('No organization context');
    await this.projectService.checkOwnership(projectId, user.userId);
    const result = await this.projectService.listScenes(user.userId, organizationId, {
      projectId,
      episodeId,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 100
    });
    return {
      success: true,
      data: result,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get(':projectId/shots')
  @Permissions(ProjectPermissions.PROJECT_READ)
  async listShotsInProject(
    @Param('projectId') projectId: string,
    @Query('sceneId') sceneId: string,
    @Query('page') page: string,
    @Query('pageSize') pageSize: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string | null
  ): Promise<any> {
    if (!organizationId) throw new Error('No organization context');
    await this.projectService.checkOwnership(projectId, user.userId);
    const result = await this.projectService.listShots(user.userId, organizationId, {
      projectId, // 传入 projectId 以确保范围
      sceneId,
      page: page ? parseInt(page) : 1,
      pageSize: pageSize ? parseInt(pageSize) : 100
    });
    return {
      success: true,
      data: result,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':id/structure/generate')
  @UseGuards(ProjectOwnershipGuard)
  async generateStructure(
    @Param('id') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string | null
  ): Promise<any> {
    if (!organizationId) {
      throw new Error('No organization context');
    }

    // 检查项目权限
    await this.projectService.checkOwnership(projectId, user.userId);

    try {
      // 生成剧集结构
      const tree = await this.structureGenerateService.generateStructure(projectId, organizationId);

      return {
        success: true,
        data: tree,
        message: 'Structure generated successfully',
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'STRUCTURE_GENERATION_FAILED',
          message: error?.message || 'Failed to generate structure',
        },
        requestId: randomUUID(),
        timestamp: new Date().toISOString(),
      };
    }
  }

  @Patch(':id')
  @UseGuards(ProjectOwnershipGuard)
  @Permissions(ProjectPermissions.PROJECT_WRITE)
  @AuditAction(AuditActions.PROJECT_UPDATE)
  async updateProject(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto
  ): Promise<any> {
    const project = await this.projectService.update(id, updateProjectDto);
    return {
      success: true,
      data: project,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Delete(':id')
  @UseGuards(ProjectOwnershipGuard)
  @AuditAction(AuditActions.PROJECT_DELETE)
  async deleteProject(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request
  ): Promise<any> {
    await this.projectService.delete(id);

    // 记录审计日志
    const requestInfo = AuditLogService.extractRequestInfo(request);
    await this.auditLogService.record({
      userId: user.userId,
      action: AuditActions.PROJECT_DELETE,
      resourceType: 'project',
      resourceId: id,
      ip: requestInfo.ip,
      userAgent: requestInfo.userAgent,
    }).catch(() => undefined);

    return {
      success: true,
      data: { message: 'Project deleted successfully' },
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Post(':projectId/episodes')
  @UseGuards(ProjectOwnershipGuard)
  @AuditAction(AuditActions.EPISODE_CREATE)
  async createEpisode(
    @Param('projectId') projectId: string,
    @Body() createEpisodeDto: CreateEpisodeDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request
  ): Promise<any> {
    // 检查权限（通过 Project 检查 owner）
    await this.projectService.checkOwnership(projectId, user.userId);
    const episode = await this.projectService.createEpisode(projectId, createEpisodeDto);

    // 记录审计日志（AuditInterceptor 会自动记录，此处显式记录以包含更多细节）
    const requestInfo = AuditLogService.extractRequestInfo(request);
    await this.auditLogService.record({
      userId: user.userId,
      action: AuditActions.EPISODE_CREATE,
      resourceType: 'episode',
      resourceId: episode.id,
      ip: requestInfo.ip,
      userAgent: requestInfo.userAgent,
      details: { projectId, episodeIndex: episode.index },
    }).catch(() => undefined); // 审计失败不阻断业务

    return {
      success: true,
      data: episode,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Post('episodes/:episodeId/scenes')
  @AuditAction(AuditActions.SCENE_CREATE)
  async createScene(
    @Param('episodeId') episodeId: string,
    @Body() createSceneDto: CreateSceneDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request
  ): Promise<any> {
    // 检查权限（通过 Episode -> Project 检查 owner）
    await this.projectService.checkEpisodeOwnership(episodeId, user.userId);
    const scene = await this.projectService.createScene(episodeId, createSceneDto);

    // 记录审计日志
    const requestInfo = AuditLogService.extractRequestInfo(request);
    await this.auditLogService.record({
      userId: user.userId,
      action: AuditActions.SCENE_CREATE,
      resourceType: 'scene',
      resourceId: scene.id,
      ip: requestInfo.ip,
      userAgent: requestInfo.userAgent,
      details: { episodeId, sceneIndex: scene.index },
    }).catch(() => undefined);

    return {
      success: true,
      data: scene,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('scenes/:id')
  @AuditAction(AuditActions.SCENE_UPDATE)
  async updateScene(
    @Param('id') id: string,
    @Body() updateSceneDto: UpdateSceneDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request
  ): Promise<any> {
    // 检查权限
    await this.projectService.checkSceneOwnership(id, user.userId);
    const scene = await this.projectService.updateScene(id, updateSceneDto);

    // 记录审计日志
    const requestInfo = AuditLogService.extractRequestInfo(request);
    await this.auditLogService.record({
      userId: user.userId,
      action: AuditActions.SCENE_UPDATE,
      resourceType: 'scene',
      resourceId: id,
      ip: requestInfo.ip,
      userAgent: requestInfo.userAgent,
      details: { sceneIndex: scene.index },
    }).catch(() => undefined);

    return {
      success: true,
      data: scene,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Post('scenes/:sceneId/shots')
  @AuditAction(AuditActions.SHOT_CREATE)
  async createShot(
    @Param('sceneId') sceneId: string,
    @Body() createShotDto: CreateShotDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request
  ): Promise<any> {
    // 检查权限
    await this.projectService.checkSceneOwnership(sceneId, user.userId);
    const shot = await this.projectService.createShot(sceneId, createShotDto);

    // 记录审计日志
    const requestInfo = AuditLogService.extractRequestInfo(request);
    await this.auditLogService.record({
      userId: user.userId,
      action: AuditActions.SHOT_CREATE,
      resourceType: 'shot',
      resourceId: shot.id,
      ip: requestInfo.ip,
      userAgent: requestInfo.userAgent,
      details: { sceneId, shotIndex: shot.index },
    }).catch(() => undefined);

    return {
      success: true,
      data: shot,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('shots/:id')
  async getShot(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string | null
  ): Promise<any> {
    if (!organizationId) {
      throw new Error('No organization context');
    }
    // 检查权限
    await this.projectService.checkShotOwnership(id, user.userId, organizationId);
    const shot = await this.projectService.findShotById(id, organizationId);
    return {
      success: true,
      data: shot,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Patch('shots/:id')
  @AuditAction(AuditActions.SHOT_UPDATE)
  async updateShot(
    @Param('id') id: string,
    @Body() updateShotDto: UpdateShotDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string | null,
    @Req() request: Request
  ): Promise<any> {
    if (!organizationId) {
      throw new Error('No organization context');
    }
    // 检查权限
    await this.projectService.checkShotOwnership(id, user.userId, organizationId);
    const shot = await this.projectService.updateShot(id, updateShotDto, organizationId);

    // 记录审计日志
    const requestInfo = AuditLogService.extractRequestInfo(request);
    await this.auditLogService.record({
      userId: user.userId,
      action: AuditActions.SHOT_UPDATE,
      resourceType: 'shot',
      resourceId: id,
      ip: requestInfo.ip,
      userAgent: requestInfo.userAgent,
      details: { shotIndex: shot.index },
    }).catch(() => undefined);

    return {
      success: true,
      data: shot,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('shots')
  async listShots(
    @Query() query: ListShotsDto,
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string | null
  ): Promise<any> {
    if (!organizationId) {
      throw new Error('No organization context');
    }
    const result = await this.projectService.listShots(user.userId, organizationId, query);
    return {
      success: true,
      data: result,
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Post('shots/batch/review')
  async batchReview(
    @Body() body: { shotIds: string[]; reviewStatus: 'APPROVED' | 'REJECTED'; reviewNote?: string },
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string | null
  ): Promise<any> {
    if (!organizationId) {
      throw new Error('No organization context');
    }
    // Studio v0.7: 权限检查
    await this.permissionService.assertCanManageProject(user.userId, organizationId);
    // 检查所有 Shots 的权限
    for (const shotId of body.shotIds) {
      await this.projectService.checkShotOwnership(shotId, user.userId, organizationId);
    }

    const updated = await Promise.all(
      body.shotIds.map((shotId) =>
        this.projectService.updateShot(shotId, {
          reviewStatus: body.reviewStatus,
          reviewNote: body.reviewNote,
          reviewedAt: new Date().toISOString(),
        } as any, organizationId)
      )
    );

    return {
      success: true,
      data: { updated: updated.length, shots: updated },
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }

  @Post('shots/batch/generate')
  @UseGuards(JwtOrHmacGuard) // 支持 JWT 或 HMAC 认证
  async batchGenerate(
    @Body() body: { shotIds: string[]; jobType: 'IMAGE' | 'VIDEO' | 'STORYBOARD' | 'AUDIO'; engine?: string; engineConfig?: any },
    @CurrentUser() user: AuthenticatedUser,
    @CurrentOrganization() organizationId: string | null,
    @Req() request: Request,
  ): Promise<any> {
    if (!organizationId) {
      throw new Error('No organization context');
    }
    // Studio v0.7: 权限检查
    await this.permissionService.assertCanManageProject(user.userId, organizationId);

    // 检查所有 Shots 的权限，并收集层级信息
    const shotsWithHierarchy = await Promise.all(
      body.shotIds.map(async (shotId) => {
        await this.projectService.checkShotOwnership(shotId, user.userId, organizationId);
        // 获取 Shot 的层级信息（用于创建 Task）
        const shot = await this.projectService.findShotById(shotId, organizationId);
        return { shotId, shot };
      })
    );

    // Studio v0.8: 为每个 Shot 创建 Task，然后创建 Job
    const successfulJobs = [];
    for (const { shotId, shot } of shotsWithHierarchy) {
      try {
        // 1. 创建 Task
        const requestInfo = AuditLogService.extractRequestInfo(request);
        const apiKeyId = (request as any).apiKeyId; // 从 HMAC Guard 中获取（如果存在）
        const projectId = shot.scene?.episode?.projectId;
        if (!projectId) {
          throw new BadRequestException('Shot project missing');
        }
        const task = await this.taskService.create({
          organizationId,
          projectId,
          type: TaskTypeEnum.SHOT_RENDER,
          payload: {
            shotId,
            jobType: body.jobType,
            engine: body.engine,
            engineConfig: body.engineConfig || {},
          },
        });

        // 2. 为 Task 创建 Job
        const job = await this.jobService.create(
          shotId,
          {
            type: JobTypeEnum.SHOT_RENDER as any,
            payload: { engine: body.engine, engineConfig: body.engineConfig, jobType: body.jobType },
          },
          user.userId,
          organizationId,
          task.id // 传入 taskId
        );

        successfulJobs.push(job);
      } catch (err) {
        console.error(`Failed to create task/job for shot ${shotId}:`, err);
        // 如果 Job 创建失败，尝试更新 Task 状态为失败
        // 注意：这里可能 Task 已经创建但 Job 创建失败，需要回滚 Task
        // 为了简化，这里只记录错误，Task 状态由后续的重试机制处理
      }
    }

    return {
      success: true,
      data: {
        created: successfulJobs.length,
        total: body.shotIds.length,
        jobs: successfulJobs,
        message: `已提交 ${successfulJobs.length} 个生成任务，将在后台队列中逐步处理`,
      },
      requestId: randomUUID(),
      timestamp: new Date().toISOString(),
    };
  }
}











