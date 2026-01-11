import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EngineInvokerHubService } from '../engine-hub/engine-invoker-hub.service';
import {
  SemanticEnhancementEngineInput,
  SemanticEnhancementEngineOutput,
  ShotPlanningEngineInput,
  ShotPlanningEngineOutput,
  StructureQAEngineInput,
  StructureQAEngineOutput,
} from '@scu/shared-types';
import { ProjectService } from '../project/project.service';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class Stage4Service {
  private readonly logger = new Logger(Stage4Service.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly engineInvoker: EngineInvokerHubService,
    private readonly projectService: ProjectService,
    private readonly auditLogService: AuditLogService
  ) {}

  async ensureSceneInProject(projectId: string, sceneId: string) {
    const scene = await this.prisma.scene.findUnique({
      where: { id: sceneId },
      include: { episode: true },
    });
    if (!scene) {
      throw new NotFoundException('Scene not found');
    }
    const sceneProjectId = scene.episode?.projectId || null;
    if (sceneProjectId && sceneProjectId !== projectId) {
      throw new ForbiddenException('Scene does not belong to project');
    }
    return scene;
  }

  async ensureShotInProject(projectId: string, shotId: string) {
    const shot = await this.prisma.shot.findUnique({
      where: { id: shotId },
      include: { scene: { include: { episode: true } } },
    });
    if (!shot) {
      throw new NotFoundException('Shot not found');
    }
    const shotProjectId = shot.scene?.episode?.projectId || null;
    if (shotProjectId && shotProjectId !== projectId) {
      throw new ForbiddenException('Shot does not belong to project');
    }
    return shot;
  }

  async runSemanticEnhancement(projectId: string, sceneId: string, userId: string) {
    try {
      this.logger.log(`Running SE for project=${projectId} scene=${sceneId} user=${userId}`);
      await this.projectService.checkOwnership(projectId, userId);
      const scene = await this.ensureSceneInProject(projectId, sceneId);
      const text = scene.summary || scene.title || '';
      this.logger.log(`Scene found, invoking engine...`);
      const prisma = this.prisma as any; // Prisma 类型在当前环境未更新 Stage4 模型，使用 any 保证编译
      const result = await this.engineInvoker.invoke<
        SemanticEnhancementEngineInput,
        SemanticEnhancementEngineOutput
      >({
        engineKey: 'semantic_enhancement',
        payload: {
          nodeType: 'scene',
          nodeId: sceneId,
          text,
          context: { projectId, sceneId },
        },
      });
      this.logger.log(`Engine result: ${JSON.stringify(result)}`);

      if (!result.success || !result.output) {
        throw new Error(result.error?.message || 'Semantic enhancement failed');
      }

      this.logger.log(`[Stage4] Writing to DB...`);
      await prisma.semanticEnhancement.upsert({
        where: { nodeType_nodeId: { nodeType: 'scene', nodeId: sceneId } },
        update: {
          data: result.output,
          engineKey: 'semantic_enhancement',
          engineVersion: 'default',
          confidence: result.output?.summary ? 0.7 : null,
        },
        create: {
          nodeType: 'scene',
          nodeId: sceneId,
          data: result.output,
          engineKey: 'semantic_enhancement',
          engineVersion: 'default',
          confidence: result.output?.summary ? 0.7 : null,
        },
      });
      return result.output;
    } catch (e: any) {
      this.logger.error(`Error: ${e.message}`, e.stack);
      throw e;
    }
  }

  async getSemanticEnhancement(sceneId: string) {
    const prisma = this.prisma as any;
    return prisma.semanticEnhancement.findUnique({
      where: { nodeType_nodeId: { nodeType: 'scene', nodeId: sceneId } },
    });
  }

  async runShotPlanning(projectId: string, shotId: string, userId: string) {
    await this.projectService.checkOwnership(projectId, userId);
    const shot = await this.ensureShotInProject(projectId, shotId);
    const text = shot.description || shot.title || '';
    const prisma = this.prisma as any;
    const result = await this.engineInvoker.invoke<
      ShotPlanningEngineInput,
      ShotPlanningEngineOutput
    >({
      engineKey: 'shot_planning',
      payload: {
        shotId,
        text,
        context: { projectId, sceneId: shot.sceneId },
      },
    });

    if (!result.success || !result.output) {
      throw new Error(result.error?.message || 'Shot planning failed');
    }

    await prisma.shotPlanning.upsert({
      where: { shotId },
      update: {
        data: result.output,
        engineKey: 'shot_planning',
        engineVersion: 'default',
        confidence: result.output?.shotType?.confidence,
      },
      create: {
        shotId,
        data: result.output,
        engineKey: 'shot_planning',
        engineVersion: 'default',
        confidence: result.output?.shotType?.confidence,
      },
    });

    return result.output;
  }

  async getShotPlanning(shotId: string) {
    const prisma = this.prisma as any;
    return prisma.shotPlanning.findUnique({
      where: { shotId },
    });
  }

  async runStructureQA(projectId: string, userId: string) {
    await this.projectService.checkOwnership(projectId, userId);
    const prisma = this.prisma as any;
    const result = await this.engineInvoker.invoke<StructureQAEngineInput, StructureQAEngineOutput>(
      {
        engineKey: 'structure_qa',
        payload: {
          projectId,
        },
      }
    );

    if (!result.success || !result.output) {
      throw new Error(result.error?.message || 'Structure QA failed');
    }

    await prisma.structureQualityReport.upsert({
      where: { projectId },
      update: {
        data: result.output,
        engineKey: 'structure_qa',
        engineVersion: 'default',
      },
      create: {
        projectId,
        data: result.output,
        engineKey: 'structure_qa',
        engineVersion: 'default',
      },
    });

    return result.output;
  }

  async getStructureQA(projectId: string) {
    const prisma: any = this.prisma;
    return prisma.structureQualityReport.findUnique({
      where: { projectId },
    });
  }

  async recordAudit(
    action: string,
    resourceType: string,
    resourceId: string | null,
    userId: string,
    details?: any
  ) {
    try {
      await this.auditLogService.record({
        userId,
        action,
        resourceType,
        resourceId: resourceId ?? undefined,
        details,
      });
    } catch (e) {
      // audit failures should not block main flow
    }
  }
}
